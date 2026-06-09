#!/usr/bin/env python3
"""
geopdf_to_supabase.py — Importa GeoPDF para a tabela lider_mapas

Uso:
  python scripts/geopdf_to_supabase.py arquivo.pdf [arquivo2.pdf ...]
      --workspace <uuid>
      [--tipo acesso|microplanejamento|outro]
      [--nome "Nome do mapa"]
      [--dpi 150]

Exemplo:
  python scripts/geopdf_to_supabase.py PERDIZES_ACESSO.pdf \\
      --workspace d344baed-c9da-4d28-8167-0e3e550cab81 \\
      --tipo acesso
"""

import argparse
import sys
import uuid
import fitz          # pymupdf  → pip install pymupdf
import pypdf         # pypdf    → pip install pypdf
from pathlib import Path
from supabase import create_client


# ── Carrega .env ──────────────────────────────────────────────────────────────
def load_env():
    env_file = Path(__file__).parent.parent / '.env'
    env = {}
    if env_file.exists():
        for line in env_file.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, _, v = line.partition('=')
                env[k.strip()] = v.strip()
    return env


# ── Extrai coordenadas + LPTS do GeoPDF ──────────────────────────────────────
#
# GeoPDFs (Avenza, IBGE, ArcGIS) separam:
#   GPTS — lat/lon WGS84 dos cantos da ÁREA GEOGRÁFICA (não da folha)
#   LPTS — posição desses cantos no espaço de página (pontos PDF, origem bottom-left)
#
# A folha inclui bordas, título, legenda e margens cartográficas que ficam
# FORA da área geográfica.  Se renderizarmos a página inteira e mapearmos GPTS
# para as bordas da imagem, o offset pode chegar a dezenas de km.
#
# A solução: recortar a imagem renderizada ao retângulo definido por LPTS.
# ─────────────────────────────────────────────────────────────────────────────
def extract_geo(pdf_path: str, verbose: bool = False) -> dict | None:
    reader = pypdf.PdfReader(pdf_path)
    page   = reader.pages[0]
    obj    = page.get_object()

    # Dimensões da página em pontos PDF (1pt = 1/72 pol)
    mb = page.mediabox
    page_w_pt = float(mb.width)
    page_h_pt = float(mb.height)

    vp = obj.get('/VP', None)
    if not vp:
        return None

    for item in vp:
        it = item.get_object() if hasattr(item, 'get_object') else item
        m  = it.get('/Measure', None)
        if not m:
            continue
        mo   = m.get_object() if hasattr(m, 'get_object') else m
        gpts = list(mo.get('/GPTS', []))
        lpts = list(mo.get('/LPTS', []))

        if len(gpts) < 8:
            continue

        # GPTS: pares [lat, lon] para cada canto — usa min/max para robustez
        lats = [float(gpts[i])     for i in range(0, len(gpts), 2)]
        lons = [float(gpts[i + 1]) for i in range(0, len(gpts), 2)]
        sw_lat, ne_lat = min(lats), max(lats)
        sw_lng, ne_lng = min(lons), max(lons)

        # LPTS: pares [x, y] em espaço de página PDF (origin bottom-left, em pontos)
        crop_rect_pt = None  # (x0, y0_pdf, x1, y1_pdf)  — PDF convention (Y-up)
        if len(lpts) >= 8:
            if verbose:
                print(f'  Página:      {page_w_pt:.1f} × {page_h_pt:.1f} pt')
            raw_lx = [float(lpts[i])     for i in range(0, len(lpts), 2)]
            raw_ly = [float(lpts[i + 1]) for i in range(0, len(lpts), 2)]

            # Detecta se LPTS é normalizado (0–1) ou em pontos de página (>1)
            # GeoPDFs do Avenza/ArcGIS costumam usar normalizado; IBGE usa pontos
            is_normalized = max(raw_lx + raw_ly) <= 1.0
            if is_normalized:
                # Converte para coordenadas de página em pontos
                lx = [v * page_w_pt for v in raw_lx]
                ly = [v * page_h_pt for v in raw_ly]
                if verbose:
                    print(f'  LPTS norm -> pts (normalizado detectado)')
            else:
                lx, ly = raw_lx, raw_ly

            x0, x1 = min(lx), max(lx)
            y0, y1 = min(ly), max(ly)   # PDF Y-up: y0=bottom, y1=top
            crop_rect_pt = (x0, y0, x1, y1)

            # Fração da página coberta pela área geográfica
            frac_w = (x1 - x0) / page_w_pt
            frac_h = (y1 - y0) / page_h_pt
            margin_left_pct   = x0 / page_w_pt * 100
            margin_bottom_pct = y0 / page_h_pt * 100
            if verbose:
                print(f'  LPTS área:   x={x0:.1f}–{x1:.1f} pt  y={y0:.1f}–{y1:.1f} pt')
                print(f'  Cobertura:   {frac_w*100:.1f}% largo × {frac_h*100:.1f}% alto')
                print(f'  Margem E:    {margin_left_pct:.1f}%  Margem S: {margin_bottom_pct:.1f}%')
            if frac_w < 0.99 or frac_h < 0.99:
                if verbose:
                    print(f'  AVISO: Margens detectadas -- imagem sera recortada a area geografica')
            else:
                if verbose:
                    print(f'  OK: LPTS cobre a pagina inteira -- sem recorte necessario')
                crop_rect_pt = None  # sem recorte
        else:
            if verbose:
                print(f'  AVISO: LPTS ausente -- renderizando pagina completa (possivel offset)')

        if verbose:
            print(f'  GPTS SW: ({sw_lat:.6f}, {sw_lng:.6f})  NE: ({ne_lat:.6f}, {ne_lng:.6f})')

        return {
            'sw_lat': sw_lat,
            'sw_lng': sw_lng,
            'ne_lat': ne_lat,
            'ne_lng': ne_lng,
            'crop_rect_pt': crop_rect_pt,  # (x0, y0_pdf, x1, y1_pdf) ou None
            'page_w_pt':    page_w_pt,
            'page_h_pt':    page_h_pt,
        }
    return None


# ── Renderiza PDF → PNG bytes (com recorte à área geográfica via LPTS) ────────
def render_pdf_png(pdf_path: str, dpi: int = 150,
                   geo: dict | None = None) -> tuple[bytes, int, int]:
    doc  = fitz.open(pdf_path)
    page = doc[0]
    mat  = fitz.Matrix(dpi / 72, dpi / 72)

    clip = None
    if geo and geo.get('crop_rect_pt'):
        x0, y0_pdf, x1, y1_pdf = geo['crop_rect_pt']
        ph = geo['page_h_pt']
        # PyMuPDF usa coordenadas top-left (Y invertido em relação ao PDF)
        # fitz.Rect(left, top, right, bottom) — tudo em pontos PDF
        clip = fitz.Rect(x0, ph - y1_pdf, x1, ph - y0_pdf)

    pix       = page.get_pixmap(matrix=mat, alpha=False, clip=clip)
    png_bytes = pix.tobytes('png')
    w, h      = pix.width, pix.height
    doc.close()
    return png_bytes, w, h


# ── Upload para Supabase Storage ──────────────────────────────────────────────
def upload_storage(sb, filename: str, png_bytes: bytes) -> str:
    bucket = 'mapas-lider'
    sb.storage.from_(bucket).upload(
        path=filename,
        file=png_bytes,
        file_options={'content-type': 'image/png', 'upsert': 'true'},
    )
    res = sb.storage.from_(bucket).get_public_url(filename)
    return res


# ── Insere na tabela lider_mapas ──────────────────────────────────────────────
def insert_mapa(sb, record: dict) -> dict:
    res = sb.table('lider_mapas').insert(record).execute()
    return res.data


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Importa GeoPDF para lider_mapas')
    parser.add_argument('pdf', nargs='+', help='Caminhos dos arquivos PDF')
    parser.add_argument('--workspace', default=None,
                        help='workspace_id (UUID) — obrigatório exceto com --diagnose')
    parser.add_argument('--tipo', default='acesso',
                        choices=['acesso', 'microplanejamento', 'outro'],
                        help='Tipo do mapa')
    parser.add_argument('--nome', help='Nome do mapa (padrão: nome do arquivo)')
    parser.add_argument('--dpi', type=int, default=150,
                        help='Resolução da imagem em DPI (padrão: 150)')
    parser.add_argument('--diagnose', action='store_true',
                        help='Só extrai metadados (GPTS/LPTS) sem importar')
    args = parser.parse_args()

    if not args.diagnose and not args.workspace:
        print('ERRO: --workspace é obrigatório para importação')
        sys.exit(1)

    sb = None
    if not args.diagnose:
        env = load_env()
        supa_url    = (env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL', '')).rstrip('/')
        service_key = env.get('SUPABASE_SERVICE_KEY', '')
        if not supa_url or not service_key:
            print('ERRO: SUPABASE_URL e SUPABASE_SERVICE_KEY não encontrados no .env')
            sys.exit(1)
        sb = create_client(supa_url, service_key)

    for pdf_arg in args.pdf:
        pdf_path = Path(pdf_arg)
        if not pdf_path.exists():
            print(f'\n[SKIP] Arquivo não encontrado: {pdf_path}')
            continue

        nome = args.nome or pdf_path.stem.replace('_', ' ').title()
        print(f'\n>>> {pdf_path.name}')

        # 1. Coordenadas + LPTS (verbose sempre em --diagnose)
        geo = extract_geo(str(pdf_path), verbose=True)
        if geo:
            print(f'  Bounds  SW ({geo["sw_lat"]:.6f}, {geo["sw_lng"]:.6f})'
                  f'  NE ({geo["ne_lat"]:.6f}, {geo["ne_lng"]:.6f})')
            geo_w_km = abs(geo["ne_lng"] - geo["sw_lng"]) * 111.32 * abs(
                __import__('math').cos(__import__('math').radians(
                    (geo["sw_lat"] + geo["ne_lat"]) / 2)))
            geo_h_km = abs(geo["ne_lat"] - geo["sw_lat"]) * 111.32
            print(f'  Área geo: {geo_w_km:.1f} km × {geo_h_km:.1f} km')
        else:
            print('  AVISO: sem georreferenciamento, mapa sem coordenadas')
            geo = {'sw_lat': None, 'sw_lng': None, 'ne_lat': None, 'ne_lng': None,
                   'crop_rect_pt': None, 'page_w_pt': None, 'page_h_pt': None}

        if args.diagnose:
            # Renderiza localmente só para mostrar dimensões; não faz upload
            print(f'  Renderizando ({args.dpi} DPI) para diagnóstico...')
            png_bytes, w, h = render_pdf_png(str(pdf_path), dpi=args.dpi, geo=None)
            print(f'  Imagem COMPLETA (sem recorte): {w}×{h}px')
            if geo.get('crop_rect_pt'):
                png_crop, wc, hc = render_pdf_png(str(pdf_path), dpi=args.dpi, geo=geo)
                print(f'  Imagem RECORTADA (área geo):   {wc}×{hc}px')
                print(f'  Recorte remove: {w-wc}px horizontal, {h-hc}px vertical')
            continue

        # 2. Render com recorte à área geográfica (corrige offset de margens)
        print(f'  Renderizando ({args.dpi} DPI)...')
        png_bytes, w, h = render_pdf_png(str(pdf_path), dpi=args.dpi, geo=geo)
        print(f'  Imagem: {w}×{h}px  ({len(png_bytes)/1024/1024:.1f} MB)')

        # 3. Upload
        file_id  = str(uuid.uuid4())
        filename = f'{file_id}.png'
        print('  Enviando para storage...')
        public_url = upload_storage(sb, filename, png_bytes)
        print(f'  URL: {public_url}')

        # 4. Inserir
        record = {
            'id':            file_id,
            'workspace_id':  args.workspace,
            'nome':          nome,
            'descricao':     f'Importado de {pdf_path.name}',
            'tipo':          args.tipo,
            'imagem_url':    public_url,
            'tamanho_bytes': len(png_bytes),
            'pdf_origem':    pdf_path.name,
            'pdf_escala':    None,
            'pdf_datum':     'SIRGAS2000',   # GeoPDFs brasileiros usam SIRGAS 2000
            'ativo':         True,
        }
        # Só inclui coords geográficas (não inclui crop_rect_pt/page_*_pt)
        for k in ('sw_lat', 'sw_lng', 'ne_lat', 'ne_lng'):
            if geo.get(k) is not None:
                record[k] = geo[k]

        insert_mapa(sb, record)
        print(f'  ✓ "{nome}" importado! (id: {file_id})')

    print('\nPronto.')


if __name__ == '__main__':
    main()
