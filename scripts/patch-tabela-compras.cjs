const fs = require('fs')
let c = fs.readFileSync('src/pages/ComprasERP.jsx', 'utf8')

// 1. Adicionar colunas no header da tabela
c = c.replace(
  "['Item / Descrição', 'Origem', 'Solicitante', 'Prioridade', 'Status', 'Prazo Necessário', 'Valor Estimado', 'Próxima Ação']",
  "['Item / Descrição', 'Nº Req', 'Nº OS', 'Origem', 'Solicitante', 'Prioridade', 'Status', 'Prazo Necessário', 'Valor Estimado', 'Próxima Ação']"
)

// 2. Adicionar células numero_req e numero_os após a célula do título (primeira <td>)
const oldTitleTd = `                        <td style={{ padding: '9px 12px', minWidth: 140 }}>
                          <div style={{ fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{item.titulo}</div>
                          {item.categoria && <div style={{ fontSize: 10, color: C.textSec, marginTop: 1 }}>{item.categoria}</div>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{origemBadge(item)}</td>`

const newTitleTd = `                        <td style={{ padding: '9px 12px', minWidth: 140 }}>
                          <div style={{ fontWeight: 700, color: C.text, lineHeight: 1.2 }}>{item.titulo}</div>
                          {item.categoria && <div style={{ fontSize: 10, color: C.textSec, marginTop: 1 }}>{item.categoria}</div>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          {item.numero_req
                            ? <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: '#EFF6FF', padding: '2px 7px', borderRadius: 4, border: '1px solid #BFDBFE' }}>{item.numero_req}</span>
                            : <span style={{ color: C.textSec }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          {item.numero_os
                            ? <span style={{ fontSize: 11, fontWeight: 600, color: '#7c3aed', background: '#F5F3FF', padding: '2px 7px', borderRadius: 4, border: '1px solid #C4B5FD' }}>{item.numero_os}</span>
                            : <span style={{ color: C.textSec }}>—</span>}
                        </td>
                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{origemBadge(item)}</td>`

c = c.replace(oldTitleTd, newTitleTd)

// 3. Substituir ChevronRightIcon da linha por botão editar + chevron
const oldLastTd = `                        <td style={{ padding: '6px' }}>
                          <ChevronRightIcon style={{ width: 13, color: C.textSec }} />
                        </td>`

const newLastTd = `                        <td style={{ padding: '6px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              onClick={e => { e.stopPropagation(); setEditarItem(item) }}
                              title="Editar requisição"
                              style={{ padding: '3px 6px', borderRadius: 5, background: 'rgba(15,118,110,0.08)', border: '1px solid rgba(15,118,110,0.25)', cursor: 'pointer', color: '#0F766E', display: 'flex', alignItems: 'center' }}
                            >
                              <PencilSquareIcon style={{ width: 13, height: 13 }} />
                            </button>
                            <ChevronRightIcon style={{ width: 13, color: C.textSec }} />
                          </div>
                        </td>`

c = c.replace(oldLastTd, newLastTd)

fs.writeFileSync('src/pages/ComprasERP.jsx', c, 'utf8')

// Verificar
const lines = c.split('\n')
lines.forEach(function(l, i) {
  if (l.includes('Nº Req') || l.includes('numero_req') || l.includes('setEditarItem')) {
    console.log((i+1) + ': ' + l.trim())
  }
})
console.log('\ndone')
