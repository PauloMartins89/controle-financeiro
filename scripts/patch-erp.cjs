const fs = require('fs')
const path = require('path')

let c = fs.readFileSync(path.join(__dirname, '../src/pages/LancamentosERP.jsx'), 'utf8')

// ── 1. KPI STRIP ──────────────────────────────────────────────────────────────
const kpiStart = c.indexOf("        {/* ── KPI CARDS")
const kpiEnd   = c.indexOf('\n        </div>', kpiStart) + '\n        </div>'.length
if (kpiStart < 0) { console.error('KPI CARDS not found'); process.exit(1) }

const kpiStrip = `        {/* ── KPI STRIP ──────────────────────────────────────────────────── */}
        <div style={{ background: C.white, border: \`1px solid \${C.border}\`, borderRadius: 8, display: 'flex', alignItems: 'stretch', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          {[
            { label: 'Receitas Apuradas',  value: fmtCurrency(totalReceitas), color: C.green,   accent: '#F0FDF4' },
            { label: 'Boletins Recebidos', value: boletinsRecebidos,          color: C.blue,    accent: '#EFF6FF' },
            { label: 'Revisão Pendente',   value: pendenteRevisao,            color: C.amber,   accent: '#FFFBEB' },
            { label: 'Com Divergência',    value: comDivergencia,             color: C.red,     accent: '#FEF2F2' },
            { label: 'Validados',          value: validados,                  color: C.green,   accent: '#F0FDF4' },
            { label: 'Prontos para Lote',  value: prontosLote,                color: '#0EA5E9', accent: '#E0F2FE' },
          ].map(({ label, value, color, accent }, i, arr) => (
            <div key={label} style={{ flex: 1, padding: '10px 14px', borderRight: i < arr.length - 1 ? \`1px solid \${C.border}\` : 'none', borderLeft: \`3px solid \${color}\`, background: accent, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
            </div>
          ))}
        </div>`

c = c.slice(0, kpiStart) + kpiStrip + c.slice(kpiEnd)
console.log('✓ KPI strip substituído')

// ── 2. PAINÉIS INFERIORES ─────────────────────────────────────────────────────
const panelMarker = "        {/* ── PAINÉIS INFERIORES"
const panelStart  = c.indexOf(panelMarker)
// find the closing </div> that closes the grid div  (4 levels deep — find the matching one)
let depth = 0, i = panelStart, panelEnd = -1
while (i < c.length) {
  if (c.slice(i, i+4) === '<div') depth++
  if (c.slice(i, i+6) === '</div>') {
    depth--
    if (depth === 0) { panelEnd = i + 6; break }
  }
  i++
}

if (panelStart < 0 || panelEnd < 0) { console.error('PAINÉIS not found'); process.exit(1) }

const newPanels = `        {/* ── CONTROLE DE PAINÉIS ───────────────────────────────────────── */}
        <div style={{ background: C.white, border: \`1px solid \${C.border}\`, borderRadius: 8, padding: '7px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 2 }}>Painéis:</span>
          {[
            { key: 'resumo',    label: 'Resumo do Período' },
            { key: 'fila',      label: 'Fila de Revisão' },
            { key: 'auditoria', label: 'Auditoria Recente' },
            { key: 'acoes',     label: 'Ações do Módulo' },
          ].map(({ key, label }) => {
            const on = visiblePanels.has(key)
            return (
              <button key={key}
                onClick={() => setVisiblePanels(prev => { const n = new Set(prev); on ? n.delete(key) : n.add(key); return n })}
                style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: \`1px solid \${on ? C.blue : C.border}\`, background: on ? '#EFF6FF' : C.white, color: on ? C.blue : C.textSec }}
              >{on ? '✓ ' : ''}{label}</button>
            )
          })}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: C.textSec }}>{visiblePanels.size} de 4 visível{visiblePanels.size !== 1 ? 'is' : ''}</span>
        </div>

        {/* ── PAINÉIS INFERIORES ──────────────────────────────────────────── */}
        {visiblePanels.size > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: \`repeat(\${visiblePanels.size}, 1fr)\`, gap: 10, marginBottom: 16 }}>

          {/* RESUMO */}
          {visiblePanels.has('resumo') && (() => {
            const daysInMonth = new Date(competencia.year, competencia.month, 0).getDate()
            const byDay = Array(daysInMonth).fill(0)
            filtered.forEach(l => {
              if (!l.data) return
              const d = new Date(l.data + 'T12:00:00')
              if (d.getMonth() + 1 === competencia.month && d.getFullYear() === competencia.year) byDay[d.getDate() - 1] += l.valor || 0
            })
            let acc = 0
            const sparkVals = byDay.map(v => { acc += v; return acc })
            return (
              <div style={{ background: C.white, border: \`1px solid \${C.border}\`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ background: C.navy, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Resumo do Período</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{MONTHS[competencia.month - 1]}/{competencia.year}</div>
                  </div>
                  <Sparkline values={sparkVals} width={80} height={28} color="#86EFAC" />
                </div>
                <div style={{ padding: '12px 16px' }}>
                  {[
                    ['Total de Boletins', filtered.length, null],
                    ['Horas Apuradas',    fmtHorasTotal(filtered), null],
                    ['Horas Diurnas',     fmtHorasSum(filtered, 'horas_diurnas'), C.blue],
                    ['Horas Noturnas',    fmtHorasSum(filtered, 'horas_noturnas'), C.navy],
                    ['Valor Total',       fmtCurrency(filtered.reduce((s, l) => s + (l.valor || 0), 0)), C.green],
                  ].map(([label, value, color]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: \`1px solid \${C.border}\` }}>
                      <span style={{ fontSize: 11, color: C.textSec }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: color || C.text }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* FILA DE REVISÃO */}
          {visiblePanels.has('fila') && (
            <div style={{ background: C.white, border: \`1px solid \${C.border}\`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ background: C.groupJorn, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Fila de Revisão</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>{filtered.length} boletins</div>
              </div>
              <div style={{ padding: '14px 16px' }}>
                <HBarChart data={statusDist} />
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: \`1px solid \${C.border}\`, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 11, color: C.textSec }}>Total no período</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.text }}>{filtered.length}</span>
                </div>
              </div>
            </div>
          )}

          {/* AUDITORIA RECENTE */}
          {visiblePanels.has('auditoria') && (
            <div style={{ background: C.white, border: \`1px solid \${C.border}\`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ background: C.groupVal, padding: '10px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Auditoria Recente</div>
              </div>
              <div style={{ padding: '10px 16px' }}>
                {eventos.length === 0 && <div style={{ textAlign: 'center', padding: '20px 0', color: C.textSec, fontSize: 12 }}>Nenhum evento recente</div>}
                {eventos.map(ev => {
                  const lanc = lancamentos.find(l => l.id === ev.lancamento_id)
                  const num = lanc ? getLanNum(lanc) : ev.lancamento_id?.slice(0, 6)
                  const dt = new Date(ev.created_at)
                  const dtStr = \`\${dt.toLocaleDateString('pt-BR')} \${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\`
                  const evLabel = { aprovado:'validado internamente', enviado_aprovacao:'enviado para revisão', processado_ia:'OCR processado', criado:'boletim recebido', editado:'lançamento editado', devolvido:'em revisão', corrigido:'divergência corrigida', reprovado:'divergência registrada', enviado_lote:'lote gerado', faturado:'faturado' }[ev.tipo] || ev.tipo
                  return (
                    <div key={ev.id} style={{ padding: '7px 0', borderBottom: \`1px solid \${C.border}\`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div><span style={{ fontSize: 11, fontWeight: 700, color: C.blue }}>{num}</span><span style={{ fontSize: 11, color: C.text }}> {evLabel}</span></div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 10, color: C.textSec }}>{dtStr}</div>
                        <div style={{ fontSize: 10, color: C.textSec, opacity: 0.7 }}>{ev.usuario_nome || 'Sistema'}</div>
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => navigate('/lancamentos')} style={{ width: '100%', marginTop: 8, padding: '6px', border: 'none', background: 'none', color: C.blue, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>Ver todas →</button>
              </div>
            </div>
          )}

          {/* AÇÕES DO MÓDULO */}
          {visiblePanels.has('acoes') && (
            <div style={{ background: C.white, border: \`1px solid \${C.border}\`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ background: C.groupFin, padding: '10px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.white, letterSpacing: 0.8, textTransform: 'uppercase' }}>Ações do Módulo</div>
              </div>
              <div style={{ padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Receber Boletim',   icon: DocumentArrowDownIcon,   color: C.blue,    bg: '#EFF6FF', action: () => setEditModal('novo') },
                  { label: 'Digitalizar OCR',   icon: SparklesIcon,            color: '#7C3AED', bg: '#F5F3FF', path: '/boletins-diarios' },
                  { label: 'Revisar Pendências', icon: ClockIcon,              color: C.amber,   bg: '#FFFBEB', action: () => setFilterStatus('aguardando_aprovacao') },
                  { label: 'Ver Divergências',  icon: ExclamationTriangleIcon, color: C.red,     bg: '#FEF2F2', action: () => setFilterStatus('revisar') },
                  { label: 'Gerar Lote',        icon: TableCellsIcon,          color: '#0EA5E9', bg: '#E0F2FE', action: () => selecionados.size > 0 ? setLoteModal(true) : toast('Selecione os boletins primeiro', { icon: '⚠️' }) },
                  { label: 'Relatórios',        icon: DocumentChartBarIcon,    color: C.green,   bg: '#F0FDF4', path: '/central' },
                ].map(item => (
                  <button key={item.label}
                    onClick={() => item.action ? item.action() : navigate(item.path)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '12px 8px', borderRadius: 8, border: \`1px solid \${item.color}22\`, background: item.bg, cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.96)' }}
                    onMouseLeave={e => { e.currentTarget.style.filter = 'none' }}
                  >
                    <item.icon style={{ width: 18, height: 18, color: item.color }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: item.color, textAlign: 'center', lineHeight: 1.2 }}>{item.label}</span>
                  </button>
                ))}
              </div>
              <div style={{ padding: '0 12px 12px' }}>
                <button onClick={() => navigate('/configuracoes')} style={{ width: '100%', padding: '7px', borderRadius: 6, border: \`1px solid \${C.border}\`, background: 'none', color: C.textSec, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Cog6ToothIcon style={{ width: 13, height: 13 }} /> Configurações
                </button>
              </div>
            </div>
          )}
        </div>
        )}`

c = c.slice(0, panelStart) + newPanels + c.slice(panelEnd)
console.log('✓ Painéis inferiores substituídos')

fs.writeFileSync(path.join(__dirname, '../src/pages/LancamentosERP.jsx'), c, 'utf8')
console.log('✓ Arquivo salvo')
