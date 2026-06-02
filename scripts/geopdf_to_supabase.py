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


# ── Extrai coordenadas do GeoPDF ──────────────────────────────────────────────
def extract_geo(pdf_path: str) -> dict | None:
    reader = pypdf.PdfReader(pdf_path)
    page = reader.pages[0]
    obj = page.get_object()
    vp = obj.get('/VP', None)
    if not vp:
        return None
    for item in vp:
        it = item.get_object() if hasattr(item, 'get_object') else item
        m = it.get('/Measure', None)
        if not m:
            continue
        mo = m.get_object() if hasattr(m, 'get_object') else m
        gpts = list(mo.get('/GPTS', []))
        if len(gpts) >= 8:
            # LPTS corners: (0,0)=SW, (0,1)=NW, (1,1)=NE, (1,0)=SE
            # GPTS: [lat0,lng0, lat1,lng1, lat2,lng2, lat3,lng3]
            return {
                'sw_lat': float(gpts[0]),
                'sw_lng': float(gpts[1]),
                'ne_lat': float(gpts[4]),
                'ne_lng': float(gpts[5]),
            }
    return None


# ── Renderiza PDF → PNG bytes ─────────────────────────────────────────────────
def render_pdf_png(pdf_path: str, dpi: int = 150) -> tuple[bytes, int, int]:
    doc = fitz.open(pdf_path)
    page = doc[0]
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    png_bytes = pix.tobytes('png')
    w, h = pix.width, pix.height
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
    parser.add_argument('--workspace', required=True, help='workspace_id (UUID)')
    parser.add_argument('--tipo', default='acesso',
                        choices=['acesso', 'microplanejamento', 'outro'],
                        help='Tipo do mapa')
    parser.add_argument('--nome', help='Nome do mapa (padrão: nome do arquivo)')
    parser.add_argument('--dpi', type=int, default=150,
                        help='Resolução da imagem em DPI (padrão: 150)')
    args = parser.parse_args()

    env = load_env()
    supa_url = (env.get('SUPABASE_URL') or env.get('VITE_SUPABASE_URL', '')).rstrip('/')
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

        # Nome exibido no app
        nome = args.nome or pdf_path.stem.replace('_', ' ').title()
        print(f'\n>>> {pdf_path.name}')

        # 1. Coordenadas
        geo = extract_geo(str(pdf_path))
        if geo:
            print(f'  Coords  SW ({geo["sw_lat"]:.5f}, {geo["sw_lng"]:.5f})'
                  f'  NE ({geo["ne_lat"]:.5f}, {geo["ne_lng"]:.5f})')
        else:
            print('  AVISO: sem georreferenciamento, mapa sem coordenadas')
            geo = {'sw_lat': None, 'sw_lng': None, 'ne_lat': None, 'ne_lng': None}

        # 2. Render
        print(f'  Renderizando ({args.dpi} DPI)...')
        png_bytes, w, h = render_pdf_png(str(pdf_path), dpi=args.dpi)
        print(f'  Imagem: {w}×{h}px  ({len(png_bytes)/1024/1024:.1f} MB)')

        # 3. Upload
        file_id = str(uuid.uuid4())
        filename = f'{file_id}.png'
        print('  Enviando para storage...')
        public_url = upload_storage(sb, filename, png_bytes)
        print(f'  URL: {public_url}')

        # 4. Inserir
        record = {
            'id': file_id,
            'workspace_id': args.workspace,
            'nome': nome,
            'descricao': f'Importado de {pdf_path.name}',
            'tipo': args.tipo,
            'imagem_url': public_url,
            'tamanho_bytes': len(png_bytes),
            'pdf_origem': pdf_path.name,
            'pdf_escala': None,
            'pdf_datum': 'WGS84',
            'ativo': True,
        }
        # Só inclui coords se existirem
        for k, v in geo.items():
            if v is not None:
                record[k] = v

        insert_mapa(sb, record)
        print(f'  ✓ "{nome}" importado! (id: {file_id})')

    print('\nPronto.')


if __name__ == '__main__':
    main()
