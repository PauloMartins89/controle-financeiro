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

        # ── BBox do viewport ─────────────────────────────────────────────────
        # O viewport define EXATAMENTE qual parte da página é a área geográfica.
        # Legenda, cartela, régua e título ficam fora do BBox.
        # BBox está em coordenadas de página PDF (origin bottom-left, em pontos).
        crop_rect_pt = None
        bbox = it.get('/BBox', None)
        if bbox:
            try:
                bv = [float(v) for v in bbox]
                # BBox = [x0,y0,x1,y1] — cantos opostos em coords PDF (Y-up, bottom-left)
                # Usar min/max para normalizar (independente da ordem dos cantos)
                bx0 = min(bv[0], bv[2])   # x esquerda
                bx1 = max(bv[0], bv[2])   # x direita
                by0 = min(bv[1], bv[3])   # y baixo (PDF Y-up)
                by1 = max(bv[1], bv[3])   # y cima  (PDF Y-up)
                frac_w = (bx1 - bx0) / page_w_pt
                frac_h = (by1 - by0) / page_h_pt
                if verbose:
                    print(f'  Pagina:      {page_w_pt:.1f} x {page_h_pt:.1f} pt')
                    print(f'  BBox (geo):  x={bx0:.1f}-{bx1:.1f} pt  y={by0:.1f}-{by1:.1f} pt (PDF Y-up)')
                    print(f'  Cobertura:   {frac_w*100:.1f}% largo x {frac_h*100:.1f}% alto')
                    marg_l = bx0/page_w_pt*100
                    marg_r = (1 - bx1/page_w_pt)*100
                    marg_b = by0/page_h_pt*100          # rodape em coords PDF
                    marg_t = (1 - by1/page_h_pt)*100    # cabecalho em coords PDF
                    print(f'  Margens:     E={marg_l:.1f}% D={marg_r:.1f}% Rodape={marg_b:.1f}% Cabecalho={marg_t:.1f}%')
                if frac_w > 0.999 and frac_h > 0.999:
                    if verbose:
                        print(f'  OK: BBox cobre pagina inteira -- sem recorte')
                    crop_rect_pt = None
                else:
                    if verbose:
                        print(f'  RECORTE: imagem sera cortada ao BBox geografico')
                    crop_rect_pt = (bx0, by0, bx1, by1)  # PDF Y-up convention
            except Exception as e:
                if verbose:
                    print(f'  AVISO: BBox invalido ({e}) -- tentando LPTS')
                bbox = None

        # LPTS como fallback se BBox ausente
        if bbox is None and len(lpts) >= 8:
            if verbose:
                print(f'  Pagina:      {page_w_pt:.1f} x {page_h_pt:.1f} pt')
            raw_lx = [float(lpts[i])     for i in range(0, len(lpts), 2)]
            raw_ly = [float(lpts[i + 1]) for i in range(0, len(lpts), 2)]

            is_normalized = max(raw_lx + raw_ly) <= 1.0
            if is_normalized:
                lx = [v * page_w_pt for v in raw_lx]
                ly = [v * page_h_pt for v in raw_ly]
                if verbose:
                    print(f'  LPTS norm -> pts (normalizado)')
            else:
                lx, ly = raw_lx, raw_ly

            x0, x1 = min(lx), max(lx)
            y0, y1 = min(ly), max(ly)
            frac_w = (x1 - x0) / page_w_pt
            frac_h = (y1 - y0) / page_h_pt
            if verbose:
                print(f'  LPTS area:   x={x0:.1f}-{x1:.1f} pt  y={y0:.1f}-{y1:.1f} pt')
                print(f'  Cobertura:   {frac_w*100:.1f}% largo x {frac_h*100:.1f}% alto')
            if frac_w < 0.99 or frac_h < 0.99:
                if verbose:
                    print(f'  RECORTE: imagem sera cortada ao LPTS geografico')
                crop_rect_pt = (x0, y0, x1, y1)
            else:
                if verbose:
                    print(f'  OK: LPTS cobre pagina inteira -- sem recorte')
                crop_rect_pt = None
        else:
            if verbose:
                print(f'  AVISO: sem BBox nem LPTS -- renderizando pagina completa')

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
        x0_pdf, y0_pdf, x1_pdf, y1_pdf = geo['crop_rect_pt']
        ph = geo['page_h_pt']
        # BBox em PDF Y-up (y0=baixo, y1=cima) → fitz Y-down (top < bottom)
        # fitz_top  = ph - y_max_pdf  (mais alto na tela = menor y fitz)
        # fitz_bot  = ph - y_min_pdf
        fitz_top = ph - y1_pdf   # y1_pdf é o topo em PDF coords (maior valor)
        fitz_bot = ph - y0_pdf   # y0_pdf é o rodapé em PDF coords (menor valor)
        clip = fitz.Rect(x0_pdf, fitz_top, x1_pdf, fitz_bot)

    pix       = page.get_pixmap(matrix=mat, alpha=False, clip=clip)
    png_bytes = pix.tobytes('png')
    w, h      = pix.width, pix.height
    doc.close()
    return png_bytes, w, h


# ── Lista / Deleta mapas ────────────────────────────────────────────────────
def list_mapas(sb, workspace_id: str):
    res = sb.table('lider_mapas').select('id, nome, tipo, criado_em') \
             .eq('workspace_id', workspace_id).order('criado_em').execute()
    if not res.data:
        print('  Nenhum mapa encontrado no workspace')
        return
    for row in res.data:
        print(f'  [{row["id"][:8]}]  {row["nome"]}  ({row["tipo"]})')


def delete_mapa(sb, workspace_id: str, nome: str):
    res = sb.table('lider_mapas').select('id, imagem_url') \
             .eq('workspace_id', workspace_id).eq('nome', nome).execute()
    if not res.data:
        print(f'  "{nome}" não encontrado no workspace')
        return
    for row in res.data:
        # Remove do storage
        fname = row['imagem_url'].split('/')[-1].split('?')[0]
        try:
            sb.storage.from_('mapas-lider').remove([fname])
        except Exception as e:
            print(f'  AVISO storage: {e}')
        # Remove do DB
        sb.table('lider_mapas').delete().eq('id', row['id']).execute()
        print(f'  ✓ Deletado: "{nome}" (id: {row["id"][:8]})')


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
    parser.add_argument('pdf', nargs='*', help='Caminhos dos arquivos PDF')
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
    parser.add_argument('--list', action='store_true',
                        help='Lista todos os mapas do workspace')
    parser.add_argument('--delete-nome', dest='delete_nome', default=None,
                        help='Deleta mapa pelo nome (sem PDF = só deleta)')
    parser.add_argument('--replace', action='store_true',
                        help='Substitui mapa existente com o mesmo nome antes de importar')
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

    # ── Modo --list ──────────────────────────────────────────────────────────
    if args.list:
        print(f'Mapas no workspace {args.workspace}:')
        list_mapas(sb, args.workspace)
        return

    # ── Modo --delete-nome (sem PDFs = só deleta) ────────────────────────────
    if args.delete_nome and not args.pdf:
        delete_mapa(sb, args.workspace, args.delete_nome)
        print('\nPronto.')
        return

    for pdf_arg in args.pdf:
        pdf_path = Path(pdf_arg)
        if not pdf_path.exists():
            print(f'\n[SKIP] Arquivo não encontrado: {pdf_path}')
            continue

        nome = args.nome or pdf_path.stem.replace('_', ' ').title()
        print(f'\n>>> {pdf_path.name}')

        # Deleta versão anterior se --replace ou --delete-nome coincidir
        if sb and (args.replace or args.delete_nome == nome):
            delete_mapa(sb, args.workspace, nome)

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
