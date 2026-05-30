import { useState, useEffect, useCallback } from 'react'
import Header from '../components/Header'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDaysIcon, UsersIcon, WrenchScrewdriverIcon,
  ShieldCheckIcon, ArrowPathIcon, ClockIcon, CheckCircleIcon,
  ArrowTrendingUpIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'

function fmtData(iso) {
  if (!iso) return '—'
  const s = iso.split('T')[0]
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const STATUS_CFG = {
  aberto:  { label: 'Aberto',  color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  fechado: { label: 'Fechado', color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
}
const TURNO_LABEL = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

export default function LiderDashboard() {
  const navigate    = useNavigate()
  const workspaceId = useStore(s => s.workspaceId)
  const [turnos,  setTurnos]  = useState([])
  const [kpis,    setKpis]    = useState({ abertos: 0, hoje: 0, presenca: 0, areaHa: 0, maquinas: 0, epis: 0 })
  const [loading, setLoading] = useState(true)

  const hoje = new Date().toISOString().split('T')[0]

  const load = useCallback(async () => {
    if (!workspaceId) return
    setLoading(true)
    const [
      { data: allTurnos },
      { data: maoObra },
      { data: prodEquip },
      { data: apontMaq },
      { data: epiCtrl },
    ] = await Promise.all([
      supabase.from('lider_turnos')
        .select('id,frente_nome,equipe_nome,lider_nome,data,turno,status,fechado_em,created_at')
        .eq('workspace_id', workspaceId)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('lider_mao_obra')
        .select('presente')
        .eq('workspace_id', workspaceId)
        .gte('created_at', hoje + 'T00:00:00'),
      supabase.from('lider_produtividade_equipamento')
        .select('area_ha')
        .eq('workspace_id', workspaceId)
        .gte('created_at', hoje + 'T00:00:00'),
      supabase.from('lider_apontamentos_maquina')
        .select('id')
        .eq('workspace_id', workspaceId)
        .gte('created_at', hoje + 'T00:00:00'),
      supabase.from('lider_controle_epi')
        .select('id')
        .eq('workspace_id', workspaceId)
        .gte('created_at', hoje + 'T00:00:00'),
    ])

    setTurnos(allTurnos || [])
    const abertos  = (allTurnos || []).filter(t => t.status === 'aberto').length
    const hojeCount = (allTurnos || []).filter(t => t.data === hoje).length
    const presenca  = (maoObra || []).filter(m => m.presente).length
    const areaHa    = (prodEquip || []).reduce((acc, p) => acc + (p.area_ha || 0), 0)
    setKpis({ abertos, hoje: hojeCount, presenca, areaHa, maquinas: (apontMaq || []).length, epis: (epiCtrl || []).length })
    setLoading(false)
  }, [workspaceId, hoje])

  useEffect(() => { load() }, [load])

  const kpiCards = [
    { label: 'Turnos abertos',   value: kpis.abertos,              color: '#f59e0b', Icon: ClockIcon },
    { label: 'Turnos hoje',      value: kpis.hoje,                 color: '#6366f1', Icon: CalendarDaysIcon },
    { label: 'Presença hoje',    value: kpis.presenca,             color: '#10b981', Icon: UsersIcon },
    { label: 'Área trabalhada',  value: kpis.areaHa.toFixed(1) + ' ha', color: '#0ea5e9', Icon: ArrowTrendingUpIcon, isText: true },
    { label: 'Maq. apontadas',   value: kpis.maquinas,             color: '#8b5cf6', Icon: WrenchScrewdriverIcon },
    { label: 'EPIs hoje',        value: kpis.epis,                 color: '#ec4899', Icon: ShieldCheckIcon },
  ]

  const modulos = [
    { label: 'Turnos',          sub: 'Lista e status de todos os turnos',             path: '/lider/turnos',         Icon: CalendarDaysIcon, color: '#6366f1' },
    { label: 'Mão de Obra',     sub: 'Presença, horas e cargo',                       path: '/lider/apontamentos',   Icon: UsersIcon,        color: '#10b981' },
    { label: 'Máquinas',        sub: 'Horímetros e atividades',                       path: '/lider/apontamentos',   Icon: WrenchScrewdriverIcon, color: '#8b5cf6' },
    { label: 'Insumos',         sub: 'Aplicações de produtos',                        path: '/lider/apontamentos',   Icon: ChartBarIcon,     color: '#f59e0b' },
    { label: 'Produtividade',   sub: 'Área e eficiência por equipe / equipamento',    path: '/lider/apontamentos',   Icon: ArrowTrendingUpIcon, color: '#0ea5e9' },
    { label: 'Avaliações',      sub: 'Avaliação das equipes',                         path: '/lider/apontamentos',   Icon: CheckCircleIcon,  color: '#ec4899' },
    { label: 'Aferição',        sub: 'Vazão e volume calda',                          path: '/lider/apontamentos',   Icon: ChartBarIcon,     color: '#f97316' },
    { label: 'Controle EPI',    sub: 'Entrega e validade de EPIs',                    path: '/lider/epi/solicitacoes', Icon: ShieldCheckIcon, color: '#ef4444' },
    { label: 'Cadastros',       sub: 'Colaboradores, máquinas, produtos e EPIs',      path: '/lider/cadastros',      Icon: UsersIcon,        color: '#64748b' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Header
        title="SmartLíder — Dashboard"
        subtitle="Visão geral operacional em tempo real"
        action={{ label: 'Atualizar', icon: ArrowPathIcon, onClick: load }}
      />
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>Carregando...</div>
        ) : (
          <>
            {/* KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
              {kpiCards.map(k => {
                const Icon = k.Icon
                return (
                  <div key={k.label} style={{ background: `linear-gradient(135deg, ${k.color}14 0%, var(--bg-card) 55%)`, border: `1px solid ${k.color}28`, borderTop: `3px solid ${k.color}`, borderRadius: 14, padding: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: k.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 17, height: 17, color: k.color }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.3 }}>{k.label}</span>
                    </div>
                    <div style={{ fontSize: k.isText ? 20 : 30, fontWeight: 800, color: 'var(--text)' }}>{k.value}</div>
                  </div>
                )
              })}
            </div>

            {/* Módulos Rápidos */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 12 }}>Módulos</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {modulos.map(m => {
                  const Icon = m.Icon
                  return (
                    <button key={m.label + m.path} onClick={() => navigate(m.path)} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 12, padding: '13px 16px', cursor: 'pointer',
                      textAlign: 'left', transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = m.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: m.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon style={{ width: 18, height: 18, color: m.color }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{m.sub}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Turnos Recentes */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14 }}>Turnos Recentes</span>
                <button onClick={() => navigate('/lider/turnos')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  Ver todos →
                </button>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-muted)' }}>
                      {['Data', 'Frente', 'Equipe', 'Líder', 'Turno', 'Status'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {turnos.length === 0 ? (
                      <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Nenhum turno registrado ainda</td></tr>
                    ) : turnos.slice(0, 10).map(t => {
                      const cfg = STATUS_CFG[t.status] || { label: t.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' }
                      return (
                        <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '11px 14px', fontWeight: 600 }}>{fmtData(t.data || t.created_at)}</td>
                          <td style={{ padding: '11px 14px' }}>{t.frente_nome || '—'}</td>
                          <td style={{ padding: '11px 14px' }}>{t.equipe_nome || '—'}</td>
                          <td style={{ padding: '11px 14px' }}>{t.lider_nome || '—'}</td>
                          <td style={{ padding: '11px 14px' }}>{TURNO_LABEL[t.turno] || t.turno || '—'}</td>
                          <td style={{ padding: '11px 14px' }}>
                            <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
