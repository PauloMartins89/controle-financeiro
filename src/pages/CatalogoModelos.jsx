import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import {
  MagnifyingGlassIcon, FunnelIcon, CubeIcon, BoltIcon, ChevronRightIcon,
  XMarkIcon, Squares2X2Icon, ListBulletIcon, ArrowTopRightOnSquareIcon, BookOpenIcon,
} from '@heroicons/react/24/outline'

// ── Cores por fabricante (sem CDN, 100% inline CSS) ──────────────────────────
const FAB_CONFIG = {
  'John Deere':      { bg: '#367C2B', text: '#FFDE00', abbr: 'JD'  },
  'Case IH':         { bg: '#C41E3A', text: '#fff',    abbr: 'CI'  },
  'New Holland':     { bg: '#003B8E', text: '#FECC00', abbr: 'NH'  },
  'Valtra':          { bg: '#B01010', text: '#fff',    abbr: 'VA'  },
  'Massey Ferguson': { bg: '#730000', text: '#E8B800', abbr: 'MF'  },
  'Fendt':           { bg: '#1B5E20', text: '#d4f7d8', abbr: 'FE'  },
  'Deutz-Fahr':      { bg: '#B85C00', text: '#fff',    abbr: 'DF'  },
  'CLAAS':           { bg: '#2E7D32', text: '#fff',    abbr: 'CL'  },
  'Kubota':          { bg: '#C2300C', text: '#fff',    abbr: 'KU'  },
  'Caterpillar':     { bg: '#CC9900', text: '#1D1D1D', abbr: 'CAT' },
  'Komatsu':         { bg: '#B07700', text: '#fff',    abbr: 'KO'  },
  'JCB':             { bg: '#CCAA00', text: '#1D1D1D', abbr: 'JCB' },
  'Agrale':          { bg: '#0060AA', text: '#fff',    abbr: 'AG'  },
  'Landini':         { bg: '#1255A8', text: '#fff',    abbr: 'LAN' },
  'Same':            { bg: '#6A1B9A', text: '#fff',    abbr: 'SME' },
  'Challenger':      { bg: '#CC2222', text: '#fff',    abbr: 'CH'  },
  'Versatile':       { bg: '#0074B8', text: '#fff',    abbr: 'VE'  },
  'LS Tractor':      { bg: '#006B5E', text: '#fff',    abbr: 'LS'  },
  'Bobcat':          { bg: '#CC6200', text: '#fff',    abbr: 'BOB' },
}
const DEFAULT_FAB = { bg: '#475569', text: '#fff', abbr: '?' }

function fabCfg(nome) {
  return FAB_CONFIG[nome] || DEFAULT_FAB
}

const TIPOS_LABEL = {
  trator:           'Trator',
  escavadeira:      'Escavadeira',
  'pa-carregadeira':'Pá-carregadeira',
  'moto-niveladora':'Motoniveladora',
  'trator-esteira': 'Esteira',
  colheitadeira:    'Colheitadeira',
}

const TIPO_ICONS = {
  trator: '🚜', escavadeira: '🦾', 'pa-carregadeira': '🏗️',
  'moto-niveladora': '🛤️', 'trator-esteira': '⛏️', colheitadeira: '🌾',
}

// ── Componente Avatar do fabricante ──────────────────────────────────────────
function FabAvatar({ nome, size = 40, fontSize = 13 }) {
  const cfg = fabCfg(nome)
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.2, flexShrink: 0,
      background: cfg.bg, color: cfg.text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize, letterSpacing: '-0.5px', userSelect: 'none',
    }}>
      {cfg.abbr}
    </div>
  )
}

// ── Card do modelo ────────────────────────────────────────────────────────────
function ModelCard({ item, onVerPlano }) {
  const cfg = fabCfg(item.fabricante)
  const cvRange = item.potencia_cv_min && item.potencia_cv_max
    ? item.potencia_cv_min === item.potencia_cv_max
      ? `${item.potencia_cv_min} cv`
      : `${item.potencia_cv_min}–${item.potencia_cv_max} cv`
    : null
  const anoRange = item.ano_inicio
    ? `${item.ano_inicio}${item.ano_fim ? `–${item.ano_fim}` : '+'}`
    : null
  const tipoLabel = TIPOS_LABEL[item.tipo] || item.tipo || '—'
  const tipoIcon  = TIPO_ICONS[item.tipo] || '⚙️'

  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      transition: 'box-shadow .15s',
      boxShadow: '0 1px 3px rgba(0,0,0,.07)',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.14)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,.07)'}
    >
      {/* Header colorido */}
      <div style={{
        background: cfg.bg, padding: '12px 14px', display: 'flex',
        alignItems: 'center', gap: 10, minHeight: 64,
      }}>
        {item.imagem_url ? (
          <img
            src={item.imagem_url}
            alt={item.modelo}
            style={{ height: 40, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
            onError={e => { e.target.style.display = 'none' }}
          />
        ) : (
          <FabAvatar nome={item.fabricante} size={40} />
        )}
        <div style={{ overflow: 'hidden' }}>
          <div style={{
            color: cfg.text, fontWeight: 700, fontSize: 15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.modelo}
          </div>
          {item.configuracao && (
            <div style={{ color: cfg.text, opacity: .75, fontSize: 11, marginTop: 1 }}>
              {item.configuracao}
            </div>
          )}
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '10px 14px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* família */}
        {item.familia && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
            {item.familia}
          </div>
        )}

        {/* badges */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          <span style={{
            background: 'var(--badge-bg,#f1f5f9)', color: 'var(--text-secondary)',
            borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 500,
          }}>
            {tipoIcon} {tipoLabel}
          </span>
          {cvRange && (
            <span style={{
              background: '#fef9c3', color: '#713f12',
              borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
            }}>
              ⚡ {cvRange}
            </span>
          )}
          {item.transmissao && (
            <span style={{
              background: 'var(--badge-bg,#f1f5f9)', color: 'var(--text-secondary)',
              borderRadius: 4, padding: '2px 6px', fontSize: 11,
            }}>
              {item.transmissao}
            </span>
          )}
          {anoRange && (
            <span style={{
              background: 'var(--badge-bg,#f1f5f9)', color: 'var(--text-secondary)',
              borderRadius: 4, padding: '2px 6px', fontSize: 11,
            }}>
              📅 {anoRange}
            </span>
          )}
          {item.mercado && item.mercado !== 'GLOBAL' && (
            <span style={{
              background: '#ecfdf5', color: '#065f46',
              borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600,
            }}>
              🇧🇷 {item.mercado}
            </span>
          )}
        </div>

        {/* motor */}
        {(item.motor_cilindros || item.motor_litros) && (
          <div style={{ fontSize: 11, color: 'var(--text-muted,#94a3b8)', marginTop: 2 }}>
            Motor: {[item.motor_cilindros && `${item.motor_cilindros} cil`, item.motor_litros && `${item.motor_litros}L`].filter(Boolean).join(' · ')}
          </div>
        )}

        {/* botão */}
        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
          <button
            onClick={() => onVerPlano(item)}
            style={{
              width: '100%', background: cfg.bg, color: cfg.text,
              border: 'none', borderRadius: 7, padding: '7px 10px',
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              opacity: .9,
              transition: 'opacity .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '.9'}
          >
            <ChevronRightIcon style={{ width: 14, height: 14 }} />
            Buscar Plano de Manutenção
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CatalogoModelos() {
  const navigate = useNavigate()
  const [modelos, setModelos] = useState([])
  const [fabricantes, setFabricantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]       = useState('')
  const [filtroFab, setFiltroFab] = useState('Todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroClasse, setFiltroClasse] = useState('todos')
  const [viewMode, setViewMode]   = useState('cards') // 'cards' | 'lista'

  // ── Carregar dados ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: mods }, { data: fabs }] = await Promise.all([
        supabase
          .from('cat_modelos')
          .select('id,fabricante,familia,modelo,configuracao,classe,tipo,ano_inicio,ano_fim,potencia_cv_min,potencia_cv_max,transmissao,tracao,motor_cilindros,motor_litros,mercado,imagem_url')
          .order('fabricante')
          .order('modelo'),
        supabase
          .from('cat_fabricantes')
          .select('id,nome,pais_origem,grupo')
          .order('nome'),
      ])
      setModelos(mods || [])
      setFabricantes(fabs || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Contagens por fabricante ────────────────────────────────────────────────
  const countByFab = useMemo(() => {
    const m = {}
    modelos.forEach(item => { m[item.fabricante] = (m[item.fabricante] || 0) + 1 })
    return m
  }, [modelos])

  // ── Fabricantes que têm modelos ─────────────────────────────────────────────
  const fabsComModelos = useMemo(() => {
    const known = new Set(fabricantes.map(f => f.nome))
    const allFabs = [...new Set(modelos.map(m => m.fabricante))].sort()
    return allFabs.map(nome => ({
      nome,
      pais_origem: (fabricantes.find(f => f.nome === nome) || {}).pais_origem || '',
      count: countByFab[nome] || 0,
    }))
  }, [fabricantes, modelos, countByFab])

  // ── Tipos disponíveis (filtrado pelo fabricante já) ─────────────────────────
  const tiposDisponiveis = useMemo(() => {
    const base = filtroFab === 'Todos' ? modelos : modelos.filter(m => m.fabricante === filtroFab)
    return [...new Set(base.map(m => m.tipo).filter(Boolean))].sort()
  }, [modelos, filtroFab])

  const classesDisponiveis = useMemo(() => {
    const base = filtroFab === 'Todos' ? modelos : modelos.filter(m => m.fabricante === filtroFab)
    return [...new Set(base.map(m => m.classe).filter(Boolean))].sort()
  }, [modelos, filtroFab])

  // ── Modelos filtrados ────────────────────────────────────────────────────────
  const modelosFiltrados = useMemo(() => {
    const q = search.toLowerCase().trim()
    return modelos.filter(m => {
      if (filtroFab !== 'Todos' && m.fabricante !== filtroFab) return false
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
      if (filtroClasse !== 'todos' && m.classe !== filtroClasse) return false
      if (!q) return true
      return (
        (m.modelo      || '').toLowerCase().includes(q) ||
        (m.familia     || '').toLowerCase().includes(q) ||
        (m.fabricante  || '').toLowerCase().includes(q) ||
        (m.configuracao|| '').toLowerCase().includes(q)
      )
    })
  }, [modelos, filtroFab, filtroTipo, filtroClasse, search])

  // ── Navegar para busca de plano ─────────────────────────────────────────────
  function handleVerPlano(item) {
    navigate('/manutencao/api-planos', {
      state: { prefill: { fabricante: item.fabricante, modelo: item.modelo } }
    })
  }

  // ── Resetar filtros de tipo/classe quando muda fabricante ───────────────────
  function handleFabClick(nome) {
    setFiltroFab(nome)
    setFiltroTipo('todos')
    setFiltroClasse('todos')
    setSearch('')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <ArrowPathIcon style={{ width: 28, height: 28, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
        <div>Carregando catálogo…</div>
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── Cabeçalho escuro padrão ─────────────────────────────────────── */}
      <PageHeader
        icon={BookOpenIcon}
        iconColor="#8b5cf6"
        title="Catálogo de Equipamentos"
        subtitle={`${modelos.length.toLocaleString('pt-BR')} modelos cadastrados · ${fabsComModelos.length} fabricantes`}
        badges={[
          filtroFab !== 'Todos' && { label: filtroFab, color: '#8b5cf6', primary: true },
          (search || filtroFab !== 'Todos' || filtroTipo !== 'todos') && { label: `${modelosFiltrados.length} encontrados`, color: '#0ea5e9', primary: true },
        ].filter(Boolean)}
        actions={[
          { label: viewMode === 'cards' ? 'Vista Lista' : 'Vista Cards', icon: viewMode === 'cards' ? ListBulletIcon : Squares2X2Icon, onClick: () => setViewMode(v => v === 'cards' ? 'lista' : 'cards') },
          { label: 'Plano API', icon: ChevronRightIcon, onClick: () => navigate('/manutencao/api-planos'), primary: true },
        ]}
      />

      {/* ── Barra de busca + pills de fabricante ─────────────────────────── */}
      <div style={{
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        padding: '10px 24px 0',
      }}>
        {/* Busca inline */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ position: 'relative', maxWidth: 340 }}>
            <MagnifyingGlassIcon style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              width: 15, height: 15, color: 'var(--text-muted)',
            }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar modelo, família…"
              style={{
                paddingLeft: 32, paddingRight: search ? 28 : 10,
                paddingTop: 7, paddingBottom: 7,
                background: 'var(--input-bg,#f8fafc)', border: '1px solid var(--border)',
                borderRadius: 8, fontSize: 13, color: 'var(--text)', outline: 'none', width: '100%',
              }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{
                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                color: 'var(--text-muted)',
              }}>
                <XMarkIcon style={{ width: 14, height: 14 }} />
              </button>
            )}
          </div>
        </div>

        {/* Pills de fabricante */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          scrollbarWidth: 'thin',
        }}>
          <button
            key="todos"
            onClick={() => handleFabClick('Todos')}
            style={{
              flexShrink: 0,
              background: filtroFab === 'Todos' ? '#334155' : 'var(--badge-bg,#f1f5f9)',
              color: filtroFab === 'Todos' ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (filtroFab === 'Todos' ? '#334155' : 'var(--border)'),
              borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Todos · {modelos.length}
          </button>

          {fabsComModelos.map(fab => {
            const cfg = fabCfg(fab.nome)
            const active = filtroFab === fab.nome
            return (
              <button
                key={fab.nome}
                onClick={() => handleFabClick(fab.nome)}
                style={{
                  flexShrink: 0,
                  background: active ? cfg.bg : 'var(--badge-bg,#f1f5f9)',
                  color: active ? cfg.text : 'var(--text-secondary)',
                  border: '1px solid ' + (active ? cfg.bg : 'var(--border)'),
                  borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <span>{fab.nome}</span>
                <span style={{
                  background: active ? 'rgba(255,255,255,.25)' : 'rgba(0,0,0,.08)',
                  borderRadius: 10, padding: '0px 6px', fontSize: 10, fontWeight: 700,
                }}>
                  {fab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Filtros secundários (tipo / classe) ───────────────────────────── */}
      <div style={{
        background: 'var(--card)', borderBottom: '1px solid var(--border)',
        padding: '8px 24px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginRight: 4 }}>
          TIPO:
        </span>
        {['todos', ...tiposDisponiveis].map(t => (
          <button key={t}
            onClick={() => setFiltroTipo(t)}
            style={{
              background: filtroTipo === t ? '#3b82f6' : 'var(--badge-bg,#f1f5f9)',
              color: filtroTipo === t ? '#fff' : 'var(--text-secondary)',
              border: '1px solid ' + (filtroTipo === t ? '#3b82f6' : 'var(--border)'),
              borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {t === 'todos' ? 'Todos' : (TIPOS_LABEL[t] || t)}
          </button>
        ))}

        {classesDisponiveis.length > 1 && (
          <>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginLeft: 12 }}>
              CLASSE:
            </span>
            {['todos', ...classesDisponiveis].map(c => (
              <button key={c}
                onClick={() => setFiltroClasse(c)}
                style={{
                  background: filtroClasse === c ? '#7c3aed' : 'var(--badge-bg,#f1f5f9)',
                  color: filtroClasse === c ? '#fff' : 'var(--text-secondary)',
                  border: '1px solid ' + (filtroClasse === c ? '#7c3aed' : 'var(--border)'),
                  borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 500,
                  cursor: 'pointer', whiteSpace: 'nowrap', textTransform: 'capitalize',
                }}
              >
                {c === 'todos' ? 'Todas' : c}
              </button>
            ))}
          </>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>
          {modelosFiltrados.length} {modelosFiltrados.length === 1 ? 'modelo' : 'modelos'}
          {modelosFiltrados.length !== modelos.length && ` de ${modelos.length}`}
        </div>
      </div>

      {/* ── Grades de fabricantes (apenas quando "Todos" selecionado) ─────── */}
      {filtroFab === 'Todos' && !search && filtroTipo === 'todos' && filtroClasse === 'todos' && (
        <div style={{ padding: '24px 24px 0' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Fabricantes
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 10, marginBottom: 28,
          }}>
            {fabsComModelos.map(fab => {
              const cfg = fabCfg(fab.nome)
              return (
                <button
                  key={fab.nome}
                  onClick={() => handleFabClick(fab.nome)}
                  style={{
                    background: 'var(--card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 12,
                    transition: 'box-shadow .15s, border-color .15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${cfg.bg}55`
                    e.currentTarget.style.borderColor = cfg.bg
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, background: cfg.bg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cfg.text, fontWeight: 700, fontSize: 12, flexShrink: 0,
                  }}>
                    {cfg.abbr}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', lineHeight: 1.2 }}>
                      {fab.nome}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {fab.count} modelos
                      {fab.pais_origem && ` · ${fab.pais_origem}`}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Lista / Cards de modelos ─────────────────────────────────────── */}
      <div style={{ padding: '16px 24px 32px' }}>

        {modelosFiltrados.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: 'var(--text-secondary)',
          }}>
            <CubeIcon style={{ width: 48, height: 48, margin: '0 auto 12px', opacity: .3 }} />
            <div style={{ fontWeight: 600, fontSize: 15 }}>Nenhum modelo encontrado</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Tente ajustar os filtros ou a busca</div>
            <button onClick={() => { setSearch(''); setFiltroFab('Todos'); setFiltroTipo('todos'); setFiltroClasse('todos') }}
              style={{ marginTop: 16, background: 'var(--primary,#3b82f6)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}>
              Limpar filtros
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 12,
          }}>
            {modelosFiltrados.map(item => (
              <ModelCard key={item.id} item={item} onVerPlano={handleVerPlano} />
            ))}
          </div>
        ) : (
          /* ── Vista lista ──────────────────────────────────────────────── */
          <div style={{
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            {/* cabeçalho da tabela */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr 100px 120px 100px 90px 90px',
              gap: 8, padding: '9px 14px',
              background: 'var(--badge-bg,#f8fafc)', borderBottom: '1px solid var(--border)',
              fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '.04em',
            }}>
              <span>Fabricante</span>
              <span>Modelo / Família</span>
              <span>Tipo</span>
              <span>Classe</span>
              <span>Potência</span>
              <span>Ano</span>
              <span></span>
            </div>

            {modelosFiltrados.map((item, idx) => {
              const cfg = fabCfg(item.fabricante)
              const cvRange = item.potencia_cv_min
                ? item.potencia_cv_min === item.potencia_cv_max
                  ? `${item.potencia_cv_min} cv`
                  : `${item.potencia_cv_min}–${item.potencia_cv_max} cv`
                : '—'
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '200px 1fr 100px 120px 100px 90px 90px',
                    gap: 8, padding: '9px 14px', alignItems: 'center',
                    borderBottom: idx < modelosFiltrados.length - 1 ? '1px solid var(--border)' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'var(--bg)',
                    fontSize: 13,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 4, background: cfg.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: cfg.text, fontWeight: 700, fontSize: 9, flexShrink: 0,
                    }}>{cfg.abbr}</div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.fabricante}
                    </span>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>
                      {item.modelo} {item.configuracao && <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>· {item.configuracao}</span>}
                    </div>
                    {item.familia && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.familia}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {TIPOS_LABEL[item.tipo] || item.tipo || '—'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {item.classe || '—'}
                  </span>
                  <span style={{ fontWeight: 600, color: '#92400e', fontSize: 12 }}>
                    {cvRange}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {item.ano_inicio}{item.ano_fim ? `–${item.ano_fim}` : item.ano_inicio ? '+' : '—'}
                  </span>
                  <button
                    onClick={() => handleVerPlano(item)}
                    style={{
                      background: cfg.bg, color: cfg.text,
                      border: 'none', borderRadius: 6, padding: '4px 8px',
                      fontWeight: 600, fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}
                  >
                    <ChevronRightIcon style={{ width: 12, height: 12 }} />
                    Plano
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
