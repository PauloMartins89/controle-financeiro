const fs = require('fs')
let c = fs.readFileSync('src/pages/ComprasERP.jsx', 'utf8')

// 1. ModalNovaReq state: remover numero_req
c = c.replace(
  "    titulo: '', urgencia: 'media',\n    numero_os: '', numero_req: '',",
  "    titulo: '', urgencia: 'media',\n    numero_os: '',"
)

// 2. Payloads de insert: remover linha numero_req
c = c.replace(/[ ]+numero_req:\s+form\.numero_req\?\.trim\(\) \|\| null,\r?\n/g, '')

// 3. ModalContinuarRascunho e ModalEditarReq state: remover numero_req
c = c.replace(/\r?\n[ ]+numero_req:\s+item\.numero_req \|\| '',/g, '')

// 4. Trocar <input> editável de numero_req por display somente leitura
// Padrão nas 2 ocorrências restantes (ModalContinuar e ModalEditar)
c = c.replace(
  /<label style={labelSt}>N\u00ba da Requisi\u00e7\u00e3o<\/label>\n[ ]+<input value={form\.numero_req} onChange={e => F\('numero_req', e\.target\.value\)} placeholder="Ex: REQ-2024-001" style={inputSt} \/>/g,
  `<label style={labelSt}>N\u00ba da Requisi\u00e7\u00e3o</label>\n              <div style={{ padding: '7px 12px', borderRadius: 6, border: \`1px solid \${C.border}\`, background: '#F1F5F9', color: '#475569', fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>\n                {item.numero_req || '\u2014'}\n              </div>`
)

fs.writeFileSync('src/pages/ComprasERP.jsx', c, 'utf8')

// Verificar resultado
const lines = c.split('\n')
lines.forEach((l, i) => {
  if (l.includes('numero_req')) console.log((i+1) + ': ' + l.trim())
})
console.log('\ndone')
