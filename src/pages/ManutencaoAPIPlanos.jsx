import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import useStore from '../store/useStore'
import { toast } from 'react-hot-toast'
import {
  MagnifyingGlassIcon, ArrowPathIcon, ArrowUpTrayIcon, BookOpenIcon,
  Cog6ToothIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon,
  ClockIcon, ClipboardDocumentListIcon, WrenchScrewdriverIcon, BoltIcon,
  ChevronRightIcon, XMarkIcon, LinkIcon, DocumentTextIcon, FunnelIcon,
  CubeIcon, ShieldCheckIcon, PlusIcon, DocumentDuplicateIcon, BeakerIcon,
  TruckIcon, CalendarDaysIcon, ArrowTopRightOnSquareIcon, SignalIcon,
  InformationCircleIcon, ChevronDownIcon, CpuChipIcon,
} from '@heroicons/react/24/outline'

// ── Mock Demo Data ─────────────────────────────────────────────────────────────
const DEMO_EQ = {
  fabricante: 'John Deere', familia: 'Série 8R', modelo: '8400R ILS',
  versao: 'ILS (Independent Link Suspension)', classe: 'Agrícola', tipo: 'Trator',
  ano_aplicavel: '2022+', faixa_serie: '100000+', tipo_plano: 'Preventiva por horas/período',
  status: 'validado', confianca: 'alto', fonte_principal: 'Documento oficial + Portal técnico JD',
  ultima_validacao: '2024-11-15',
}

const DEMO_INTERVALOS = [
  {
    id: 'i10', horas: 10, label: '10h', nome: 'Inspeção de Entrega', tipo: 'Inspeção', criticidade: 'padrao',
    sistemas: ['Motor', 'Geral'], cor: '#16a34a',
    tarefas: [
      { sistema: 'Motor', tarefa: 'Verificar nível de óleo do motor', codigo: '—', capacidade: '31 L', intervalo: 'Entrega', condicao: 'Verificar apenas', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Hidráulico', tarefa: 'Verificar nível de óleo hidráulico/transmissão', codigo: '—', capacidade: '167 L / 190 L (ILS)', intervalo: 'Entrega', condicao: 'Verificar apenas', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Arrefecimento', tarefa: 'Verificar nível de refrigerante', codigo: '—', capacidade: '32 L', intervalo: 'Entrega', condicao: 'Verificar apenas', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i100', horas: 100, label: '100h', nome: 'Revisão de 100 horas', tipo: 'Leve', criticidade: 'padrao',
    sistemas: ['Motor', 'Filtros'], cor: '#16a34a',
    tarefas: [
      { sistema: 'Motor', tarefa: 'Trocar óleo do motor (1ª troca)', codigo: 'TY26678', capacidade: '31 L', intervalo: '100h (apenas 1ª vez)', condicao: 'Óleo recémadicionado na entrega', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Motor', tarefa: 'Trocar filtro de óleo do motor (1ª troca)', codigo: 'RE509672', capacidade: '—', intervalo: '100h (apenas 1ª vez)', condicao: 'Troca inicial obrigatória', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i250', horas: 250, label: '250h', nome: 'Revisão de 250 horas', tipo: 'Preventiva', criticidade: 'padrao',
    sistemas: ['Motor', 'Geral', 'Elétrico'], cor: '#16a34a',
    tarefas: [
      { sistema: 'Motor', tarefa: 'Inspecionar correia do alternador', codigo: 'RE67185', capacidade: '—', intervalo: '250h', condicao: 'Substituir se desgastada', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Geral', tarefa: 'Lubrificar pontos de engrase', codigo: '—', capacidade: '—', intervalo: '250h', condicao: 'Conforme pontos do manual', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i500', horas: 500, label: '500h', nome: 'Revisão de 500 horas / Anual', tipo: 'Principal', criticidade: 'intermediaria',
    sistemas: ['Motor', 'Combustível', 'Arrefecimento'], cor: '#ca8a04',
    tarefas: [
      { sistema: 'Motor', tarefa: 'Trocar óleo e filtro do motor', codigo: 'RE509672', capacidade: '31 L', intervalo: '500h ou anual', condicao: 'Conforme spec de óleo e filtro', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Combustível', tarefa: 'Trocar filtro de combustível primário', codigo: 'RE525523', capacidade: '—', intervalo: '500h', condicao: 'Conforme indicado', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Combustível', tarefa: 'Trocar filtro de combustível secundário', codigo: 'RE544394', capacidade: '—', intervalo: '500h', condicao: 'Conforme indicado', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Arrefecimento', tarefa: 'Verificar/adicionar inibidor DCA4', codigo: 'RE509032', capacidade: '32 L', intervalo: '500h', condicao: 'Testar concentração antes', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i1000', horas: 1000, label: '1000h', nome: 'Revisão de 1000 horas', tipo: 'Média', criticidade: 'intermediaria',
    sistemas: ['Motor', 'Cabine', 'Geral'], cor: '#ca8a04',
    tarefas: [
      { sistema: 'Motor', tarefa: 'Trocar óleo e filtro do motor', codigo: 'RE509672', capacidade: '31 L', intervalo: '500h ou anual', condicao: 'Conforme spec', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Cabine', tarefa: 'Trocar filtro de ar da cabine (recirculação)', codigo: 'RE284091', capacidade: '—', intervalo: '1000h ou anual', condicao: 'Conforme requerido', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Cabine', tarefa: 'Trocar filtro de ar externo da cabine', codigo: 'RE183723', capacidade: '—', intervalo: '1000h ou anual', condicao: 'Conforme requerido', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i1500', horas: 1500, label: '1500h', nome: 'Revisão de 1500 horas', tipo: 'Pesada', criticidade: 'pesada',
    sistemas: ['Hidráulico', 'Transmissão', 'Motor'], cor: '#ea580c',
    tarefas: [
      { sistema: 'Hidráulico', tarefa: 'Trocar óleo hidráulico/transmissão', codigo: 'TY22074', capacidade: '167 L (MFWD) / 190 L (ILS)', intervalo: '1500h', condicao: 'Especificação: Hy-Gard™', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Hidráulico', tarefa: 'Trocar filtro de óleo hidráulico', codigo: 'RE573817', capacidade: '—', intervalo: '1500h', condicao: 'Troca inicial e recorrente', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Transmissão', tarefa: 'Trocar filtro de transmissão', codigo: 'RE504836', capacidade: '—', intervalo: '1500h', condicao: 'Trocar junto com hidráulico', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i2000', horas: 2000, label: '2000h', nome: 'Revisão de 2000 horas', tipo: 'Pesada', criticidade: 'pesada',
    sistemas: ['Motor', 'Eixo', 'ILS'], cor: '#ea580c',
    tarefas: [
      { sistema: 'Motor', tarefa: 'Trocar óleo e filtro do motor', codigo: 'RE509672', capacidade: '31 L', intervalo: '500h ou anual', condicao: 'Conforme spec', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Eixo', tarefa: 'Trocar óleo dos cubos ILS', codigo: 'TY6341', capacidade: '5,6 L cada', intervalo: '2000h', condicao: 'Conforme especificação', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Eixo', tarefa: 'Trocar óleo da carcaça do eixo MFWD', codigo: 'TY6341', capacidade: '18,7 L', intervalo: '2000h', condicao: 'Conforme especificação', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i3000', horas: 3000, label: '3000h', nome: 'Revisão Crítica de 3000h', tipo: 'Crítica', criticidade: 'critica',
    sistemas: ['Motor', 'Arrefecimento', 'Completo'], cor: '#dc2626',
    tarefas: [
      { sistema: 'Arrefecimento', tarefa: 'Trocar fluido de arrefecimento completo', codigo: 'TY26678', capacidade: '32 L', intervalo: '3000h ou a cada 3 anos', condicao: 'Drenar e reabasteer completamente', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'Motor', tarefa: 'Inspecionar/trocar correia dentada', codigo: 'RE67185', capacidade: '—', intervalo: '3000h', condicao: 'Inspecionar desgaste', fonte: 'OMN400413', status: 'validado' },
    ],
  },
  {
    id: 'i4500', horas: 4500, label: '4500h', nome: 'Revisão Major 4500h', tipo: 'Major', criticidade: 'critica',
    sistemas: ['Motor', 'Transmissão', 'ILS', 'Hidráulico'], cor: '#dc2626',
    tarefas: [
      { sistema: 'Motor', tarefa: 'Inspeção completa do motor', codigo: '—', capacidade: '—', intervalo: '4500h', condicao: 'Conforme check-list major', fonte: 'OMN400413', status: 'validado' },
      { sistema: 'ILS', tarefa: 'Revisão completa do sistema ILS', codigo: '—', capacidade: '—', intervalo: '4500h', condicao: 'Por técnico certificado JD', fonte: 'OMN400413', status: 'validado' },
    ],
  },
]

const DEMO_FILTROS = [
  { id: 1, sistema: 'Motor', item: 'Filtro de óleo', codigo: 'RE509672', descricao: 'Elemento do filtro de óleo', intervalo: '500h / anual', condicao: 'Troca obrigatória', fonte: 'Oficial', status: 'validado' },
  { id: 2, sistema: 'Motor', item: 'Filtro de combustível (primário)', codigo: 'RE525523', descricao: 'Filtro primário de combustível', intervalo: '500h', condicao: 'Conforme indicado', fonte: 'Oficial', status: 'validado' },
  { id: 3, sistema: 'Motor', item: 'Filtro de combustível (secundário)', codigo: 'RE544394', descricao: 'Filtro secundário de combustível', intervalo: '500h', condicao: 'Conforme indicado', fonte: 'Oficial', status: 'validado' },
  { id: 4, sistema: 'Cabine', item: 'Filtro de ar (recirculação)', codigo: 'RE284091', descricao: 'Filtro de ar da cabine – recirculação', intervalo: '1000h / anual', condicao: 'Conforme requerido', fonte: 'Oficial', status: 'validado' },
  { id: 5, sistema: 'Cabine', item: 'Filtro de ar (externo)', codigo: 'RE183723', descricao: 'Filtro de ar externo da cabine', intervalo: '1000h / anual', condicao: 'Conforme requerido', fonte: 'Oficial', status: 'validado' },
  { id: 6, sistema: 'Hidráulico', item: 'Filtro de óleo hidráulico', codigo: 'RE573817', descricao: 'Elemento do filtro hidráulico', intervalo: '1500h', condicao: 'Troca inicial e recorrente', fonte: 'Oficial', status: 'validado' },
  { id: 7, sistema: 'Transmissão', item: 'Filtro de transmissão', codigo: 'RE504836', descricao: 'Filtro de óleo da transmissão', intervalo: '1500h', condicao: 'Trocar junto com hidráulico', fonte: 'Oficial', status: 'validado' },
  { id: 8, sistema: 'Arrefecimento', item: 'Filtro DCA4 (inibidor)', codigo: 'RE509032', descricao: 'Inibidor de corrosão DCA4', intervalo: '500h', condicao: 'Testar concentração antes da troca', fonte: 'Oficial', status: 'validado' },
]

const DEMO_PECAS = {
  'Motor': [
    { id: 1, codigo: 'RE509672', descricao: 'Filtro de óleo do motor', aplicacao: 'Troca a cada 500h/anual', compatibilidade: '8R/8RT/8RX 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 2, codigo: 'RE525523', descricao: 'Filtro de combustível primário', aplicacao: 'Troca a cada 500h', compatibilidade: '8R/8RT/8RX 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 3, codigo: 'RE544394', descricao: 'Filtro de combustível secundário', aplicacao: 'Troca a cada 500h', compatibilidade: '8R/8RT/8RX 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 4, codigo: 'RE67185', descricao: 'Correia do alternador', aplicacao: 'Inspecionar 250h / trocar 3000h', compatibilidade: '8R 410/430', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 5, codigo: 'TY26678', descricao: 'Óleo do motor John Deere Plus-50™ II', aplicacao: '31 L — troca a cada 500h/anual', compatibilidade: 'Série 8R 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
  ],
  'Hidráulico / Transmissão': [
    { id: 6, codigo: 'RE573817', descricao: 'Filtro de óleo hidráulico', aplicacao: 'Troca a cada 1500h', compatibilidade: '8R 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 7, codigo: 'RE504836', descricao: 'Filtro de transmissão', aplicacao: 'Troca a cada 1500h', compatibilidade: '8R 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 8, codigo: 'TY22074', descricao: 'Óleo Hy-Gard™ John Deere', aplicacao: '167–190 L — troca 1500h', compatibilidade: 'Série 8R 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
  ],
  'Cabine': [
    { id: 9, codigo: 'RE284091', descricao: 'Filtro de ar da cabine (recirculação)', aplicacao: '1000h / anual', compatibilidade: '8R série 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 10, codigo: 'RE183723', descricao: 'Filtro de ar externo da cabine', aplicacao: '1000h / anual', compatibilidade: '8R série 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
  ],
  'Arrefecimento': [
    { id: 11, codigo: 'RE509032', descricao: 'Inibidor de corrosão DCA4', aplicacao: '500h — verificar concentração antes', compatibilidade: '8R série 2016+', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 12, codigo: 'TY26678', descricao: 'Fluido anticongelante Cool-Gard™ II', aplicacao: 'Troca completa a cada 3000h ou 3 anos', compatibilidade: 'Série 8R', fonte: 'Oficial', status: 'validado', substituto: null },
  ],
  'Eixo / ILS': [
    { id: 13, codigo: 'TY6341', descricao: 'Óleo do eixo MFWD (carcaça)', aplicacao: '18,7 L — troca 2000h', compatibilidade: '8R MFWD', fonte: 'Oficial', status: 'validado', substituto: null },
    { id: 14, codigo: 'TY6341', descricao: 'Óleo dos cubos ILS', aplicacao: '5,6 L cada — troca 2000h', compatibilidade: '8400R ILS', fonte: 'Oficial', status: 'validado', substituto: null },
  ],
}

const DEMO_FLUIDOS = [
  { id: 1, sistema: 'Combustível', tipo: 'Diesel B10/B12', capacidade: 715, unidade: 'L', especificacao: 'Diesel ULSD conforme norma ABNT NBR', observacao: 'Verificar qualidade e pureza', fonte: 'OMN400413', status: 'validado' },
  { id: 2, sistema: 'Motor', tipo: 'Óleo Plus-50™ II', capacidade: 31, unidade: 'L', especificacao: 'John Deere Plus-50™ II 15W-40', observacao: 'Trocar a cada 500h ou anualmente', fonte: 'OMN400413', status: 'validado' },
  { id: 3, sistema: 'Arrefecimento', tipo: 'Cool-Gard™ II', capacidade: 32, unidade: 'L', especificacao: 'Pré-misturado 50/50 anticongelante/água', observacao: 'Verificar DCA4 a cada 500h', fonte: 'OMN400413', status: 'validado' },
  { id: 4, sistema: 'Hidráulico / Trans. MFWD', tipo: 'Hy-Gard™', capacidade: 167, unidade: 'L', especificacao: 'John Deere Hy-Gard™ J20C', observacao: 'Configuração MFWD padrão', fonte: 'OMN400413', status: 'validado' },
  { id: 5, sistema: 'Hidráulico / Trans. ILS', tipo: 'Hy-Gard™', capacidade: 190, unidade: 'L', especificacao: 'John Deere Hy-Gard™ J20C', observacao: 'Configuração ILS — capacidade maior', fonte: 'OMN400413', status: 'validado' },
  { id: 6, sistema: 'Eixo MFWD (carcaça)', tipo: 'Óleo de eixo', capacidade: 18.7, unidade: 'L', especificacao: 'John Deere TY6341 / SAE 80W-90', observacao: 'Troca a cada 2000h', fonte: 'OMN400413', status: 'validado' },
  { id: 7, sistema: 'Cubos MFWD', tipo: 'Óleo de cubo', capacidade: 3.8, unidade: 'L cada', especificacao: 'John Deere TY6341 / SAE 80W-90', observacao: '2 cubos — trocar juntos', fonte: 'OMN400413', status: 'validado' },
  { id: 8, sistema: 'Cubos ILS', tipo: 'Óleo de cubo ILS', capacidade: 5.6, unidade: 'L cada', especificacao: 'John Deere TY6341 / SAE 80W-90', observacao: '2 cubos — troca 2000h', fonte: 'OMN400413', status: 'validado' },
]

const DEMO_FONTES = [
  { id: 1, titulo: 'OMN400413 — Operation & Maintenance Manual 8R/8RT/8RX 2022+', tipo: 'PDF Oficial', fabricante: 'John Deere', modelo: '8R Series', data_fonte: '2022-06-01', data_coleta: '2024-10-20', versao: 'B2', idioma: 'Português BR', confianca: 'alto', status: 'ativo', obs: 'Manual oficial de operação e manutenção — fonte primária para todos os intervalos' },
  { id: 2, titulo: 'Portal Técnico JD — Parts Catalog API REST', tipo: 'API REST', fabricante: 'John Deere', modelo: '8400R ILS', data_fonte: '2024-11-01', data_coleta: '2024-11-10', versao: 'v3.2', idioma: 'EN-US', confianca: 'alto', status: 'ativo', obs: 'Catálogo de peças consultado via API — utilizado para validar códigos RE/TY' },
  { id: 3, titulo: 'Base Interna SmartPro — Planos Validados Frota Agrícola', tipo: 'Base Interna', fabricante: 'SmartPro', modelo: '8R Series', data_fonte: '2024-11-15', data_coleta: '2024-11-15', versao: '1.0', idioma: 'PT-BR', confianca: 'medio', status: 'ativo', obs: 'Validação técnica cruzada pelos engenheiros de manutenção SmartPro com base no manual OMN400413' },
]

const DEMO_CONFLITOS = [] // Nenhum conflito no plano demo

// ── Config ────────────────────────────────────────────────────────────────────
const CONFIANCA_CFG = {
  alto:  { label: 'Alto',  color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  medio: { label: 'Médio', color: '#ca8a04', bg: 'rgba(202,138,4,0.1)' },
  baixo: { label: 'Baixo', color: '#dc2626', bg: 'rgba(220,38,38,0.1)' },
}
const STATUS_PLANO_CFG = {
  validado:   { label: 'Validado',    color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
  sugerido:   { label: 'Sugerido',    color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)' },
  conflitante:{ label: 'Conflitante', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  obsoleto:   { label: 'Obsoleto',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}
const CRIT_CFG = {
  padrao:       { label: 'Padrão',       color: '#16a34a', bg: '#16a34a' },
  intermediaria:{ label: 'Intermediária',color: '#ca8a04', bg: '#ca8a04' },
  pesada:       { label: 'Pesada',       color: '#ea580c', bg: '#ea580c' },
  critica:      { label: 'Crítica',      color: '#dc2626', bg: '#dc2626' },
}
const TIPO_FONTE_CFG = {
  'PDF Oficial':   { color: '#16a34a', icon: '📄' },
  'API REST':      { color: '#0ea5e9', icon: '🔌' },
  'Base Interna':  { color: '#8b5cf6', icon: '🗄️' },
  'Portal':        { color: '#f59e0b', icon: '🌐' },
  'Catálogo':      { color: '#64748b', icon: '📚' },
}

const TABS = [
  { id: 'resumo',     label: 'Resumo',              icon: ClipboardDocumentListIcon },
  { id: 'intervalos', label: 'Intervalos',           icon: ClockIcon },
  { id: 'filtros',    label: 'Filtros',              icon: FunnelIcon },
  { id: 'pecas',      label: 'Peças',                icon: CubeIcon },
  { id: 'fluidos',    label: 'Fluidos e Capacidades',icon: BeakerIcon },
  { id: 'fontes',     label: 'Fontes Oficiais',      icon: DocumentTextIcon },
  { id: 'conflitos',  label: 'Conflitos',            icon: ExclamationTriangleIcon },
  { id: 'frota',      label: 'Aplicação na Frota',   icon: TruckIcon },
]

// ── Helper Components ─────────────────────────────────────────────────────────
function Pill({ label, color, bg }) {
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: bg, color, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}
function StatusPlano({ s }) {
  const cfg = STATUS_PLANO_CFG[s] || { label: s, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
  return <Pill label={cfg.label} color={cfg.color} bg={cfg.bg} />
}
function ConfPill({ nivel }) {
  const cfg = CONFIANCA_CFG[nivel] || { label: nivel, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
  return <Pill label={`Confiança: ${cfg.label}`} color={cfg.color} bg={cfg.bg} />
}
function ValidPill({ status }) {
  const map = {
    validado:   { label: '✓ Validado',   color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
    pendente:   { label: '⏳ Pendente',   color: '#ca8a04', bg: 'rgba(202,138,4,0.1)' },
    conflito:   { label: '⚠ Conflito',   color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  }
  const cfg = map[status] || { label: status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' }
  return <Pill label={cfg.label} color={cfg.color} bg={cfg.bg} />
}

function MiniKpi({ label, value, color = '#16a34a', icon: Icon, note }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '12px 16px', border: '1px solid #e2e8f0', minWidth: 120 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        {Icon && <Icon style={{ width: 14, height: 14, color }} />}
        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {note && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{note}</div>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ManutencaoAPIPlanos() {
  const navigate = useNavigate()
  const workspaceId = useStore(s => s.workspaceId)

  const [form, setForm] = useState({
    classe: '', tipo: '', fabricante: 'John Deere', modelo: '8400R',
    ano: '2022', configuracao: 'ILS', numero_serie: '', chassi: '', codigo_interno: '',
  })
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('resumo')
  const [sidePanel, setSidePanel] = useState(null)         // { type: 'intervalo'|'filtro'|'peca'|'fluido'|'fonte'|'frota', data }
  const [selectedInterval, setSelectedInterval] = useState(null)
  const [pecaView, setPecaView] = useState('cards')        // 'cards' | 'table'
  const [frota, setFrota] = useState([])
  const [frotaLoading, setFrotaLoading] = useState(false)
  const [apiStatus] = useState('conectado')
  const [lastSync, setLastSync] = useState('—')
  // DB result state
  const [resultModelo, setResultModelo] = useState(null)   // row de cat_modelos
  const [resultPlanos, setResultPlanos] = useState([])     // rows de cat_planos c/ cat_planos_itens
  const [searchedTerms, setSearchedTerms] = useState(null) // { fabricante, modelo } da última busca
  const [loadingMsg, setLoadingMsg] = useState('')         // mensagem de fase do loading

  useEffect(() => {
    if (!workspaceId || !supabase) return
    setFrotaLoading(true)
    supabase.from('manut_equipamentos').select('*').eq('workspace_id', workspaceId).then(({ data }) => {
      setFrota(data || [])
      setFrotaLoading(false)
    })
  }, [workspaceId])

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSearch() {
    if (!form.fabricante && !form.modelo) {
      toast.error('Informe ao menos Fabricante ou Modelo')
      return
    }
    setLoading(true)
    setResultModelo(null)
    setResultPlanos([])
    try {
      // 1. Busca modelo em cat_modelos
      // Normaliza: remove configuracao do campo modelo se digitado junto (ex: '8400R ILS' → '8400R')
      const modeloInput = (form.modelo || '').trim()
      const configInput = (form.configuracao || '').trim()
      const modeloBase  = configInput && modeloInput.toLowerCase().endsWith(configInput.toLowerCase())
        ? modeloInput.slice(0, modeloInput.toLowerCase().lastIndexOf(configInput.toLowerCase())).trim()
        : modeloInput

      let q = supabase.from('cat_modelos').select('*')
      if (form.fabricante)   q = q.ilike('fabricante',   `%${form.fabricante}%`)
      if (modeloBase)        q = q.ilike('modelo',       `%${modeloBase}%`)
      if (form.familia)      q = q.ilike('familia',      `%${form.familia}%`)
      if (form.tipo)         q = q.ilike('tipo',         `%${form.tipo}%`)
      if (form.configuracao) q = q.ilike('configuracao', `%${form.configuracao}%`)
      if (form.ano) {
        const ano = parseInt(form.ano)
        if (!isNaN(ano)) q = q.lte('ano_inicio', ano).or(`ano_fim.is.null,ano_fim.gte.${ano}`)
      }
      const { data: modelos, error } = await q.order('ano_inicio', { ascending: false }).limit(5)
      if (error) throw error

      if (!modelos || modelos.length === 0) {
        setSearchedTerms({ fabricante: form.fabricante, modelo: form.modelo, tipo: form.tipo })

        // ── Fallback: consultar IA para modelos fora do catálogo ──────────────
        setLoadingMsg('Consultando IA...')
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const aiRes = await fetch('/api/busca-modelo-ia', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              fabricante:   form.fabricante,
              modelo:       form.modelo,
              tipo:         form.tipo,
              ano:          form.ano,
              configuracao: form.configuracao,
            }),
          })
          if (aiRes.ok) {
            const aiData = await aiRes.json()
            if (aiData.modelo) {
              setResultModelo({ ...aiData.modelo, _ia: true })
              setResultPlanos(aiData.planos || [])
              setLastSync(new Date().toLocaleString('pt-BR'))
              setSearched(true)
              setTab('resumo')
              toast.success(
                `${aiData.modelo.fabricante} ${aiData.modelo.modelo} — dados gerados por IA`,
                { icon: '🤖', duration: 5000 }
              )
              setLoadingMsg('')
              setLoading(false)
              return
            }
          }
        } catch (aiErr) {
          console.error('[busca-modelo-ia] fallback error:', aiErr)
        }
        // ─────────────────────────────────────────────────────────────────────

        setLoadingMsg('')
        toast.error(`"${[form.fabricante, form.modelo].filter(Boolean).join(' ')}" não encontrado no catálogo`)
        setResultModelo(null)
        setResultPlanos([])
        setSearched(true)
        setLoading(false)
        return
      }

      const m = modelos[0]
      setResultModelo(m)

      // 2. Busca planos de manutenção + itens
      const { data: planos } = await supabase
        .from('cat_planos')
        .select('*, cat_planos_itens(*)')
        .eq('modelo_id', m.id)
        .order('intervalo_h')

      setResultPlanos(planos || [])
      setLastSync(new Date().toLocaleString('pt-BR'))
      setSearched(true)
      setTab('resumo')
      const hasPlan = planos && planos.length > 0
      toast.success(
        `${m.fabricante} ${m.modelo} — ${
          hasPlan ? planos.length + ' intervalos encontrados' : 'modelo localizado (planos em breve)'
        }`
      )
    } catch (err) {
      setSearchedTerms({ fabricante: form.fabricante, modelo: form.modelo, tipo: form.tipo })
      toast.error('Catálogo indisponível no momento')
      setResultModelo(null)
      setResultPlanos([])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setForm({ classe: '', tipo: '', fabricante: '', modelo: '', ano: '', configuracao: '', numero_serie: '', chassi: '', codigo_interno: '' })
    setSearched(false)
    setSidePanel(null)
    setSelectedInterval(null)
    setResultModelo(null)
    setResultPlanos([])
    setSearchedTerms(null)
  }

  function openPanel(type, data) { setSidePanel({ type, data }) }
  function closePanel() { setSidePanel(null) }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => toast.success('Código copiado!'))
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HEADER
  // ─────────────────────────────────────────────────────────────────────────────
  function renderHeader() {
    const apiCfg = {
      conectado:    { label: 'Conectado',    color: '#16a34a', icon: CheckCircleIcon },
      instavel:     { label: 'Instável',     color: '#ca8a04', icon: ExclamationTriangleIcon },
      desconectado: { label: 'Desconectado', color: '#dc2626', icon: XCircleIcon },
    }[apiStatus]
    const ApiIcon = apiCfg.icon

    return (
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #16213e 100%)',
        padding: '18px 28px', borderBottom: '1px solid rgba(22,163,74,0.3)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        {/* Row 1: Title + Status */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, background: 'rgba(22,163,74,0.15)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(22,163,74,0.3)' }}>
                <CpuChipIcon style={{ width: 20, height: 20, color: '#4ade80' }} />
              </div>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.3, lineHeight: 1.2 }}>
                  API de Planos de Manutenção
                </h1>
                <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  Consulta técnica por fabricante, modelo, ano e número de série opcional
                </p>
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '6px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <ApiIcon style={{ width: 13, height: 13, color: apiCfg.color }} />
              <span style={{ fontSize: 11, color: apiCfg.color, fontWeight: 600 }}>{apiCfg.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
              <ClockIcon style={{ width: 12, height: 12, color: '#64748b' }} />
              <span style={{ fontSize: 10, color: '#64748b' }}>Sync: {lastSync}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
              <ShieldCheckIcon style={{ width: 12, height: 12, color: '#64748b' }} />
              <span style={{ fontSize: 10, color: '#64748b' }}>3 fontes processadas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
              <DocumentTextIcon style={{ width: 12, height: 12, color: '#64748b' }} />
              <span style={{ fontSize: 10, color: '#64748b' }}>1 plano encontrado</span>
            </div>
          </div>
        </div>

        {/* Row 2: Action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <button onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); toast.success('Dados atualizados!') }, 500) }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(22,163,74,0.12)', color: '#4ade80', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            <ArrowPathIcon style={{ width: 13, height: 13 }} /> Atualizar
          </button>
          <button onClick={() => toast('Funcionalidade de importação em breve', { icon: '📥' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            <ArrowUpTrayIcon style={{ width: 13, height: 13 }} /> Importar Fonte Oficial
          </button>
          <button onClick={() => toast('Biblioteca técnica em desenvolvimento', { icon: '📚' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            <BookOpenIcon style={{ width: 13, height: 13 }} /> Ver Biblioteca
          </button>
          <button onClick={() => toast('Configuração de integração em breve', { icon: '⚙️' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            <Cog6ToothIcon style={{ width: 13, height: 13 }} /> Configurar Integração
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEARCH PANEL
  // ─────────────────────────────────────────────────────────────────────────────
  function renderSearchPanel() {
    const inputStyle = {
      width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
      border: '1px solid #e2e8f0', background: '#f8fafc', color: '#1e293b',
      outline: 'none', boxSizing: 'border-box',
    }
    const labelStyle = { fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }

    return (
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '20px 24px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <MagnifyingGlassIcon style={{ width: 16, height: 16, color: '#16a34a' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>Busca Técnica de Planos</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={labelStyle}>Classe Operacional</label>
            <select value={form.classe} onChange={e => setF('classe', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">Todas</option>
              <option>Agrícola</option>
              <option>Construção</option>
              <option>Transporte</option>
              <option>Industrial</option>
              <option>Florestal</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tipo de Equipamento</label>
            <select value={form.tipo} onChange={e => setF('tipo', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">Todos</option>
              <option>Trator</option>
              <option>Colhedora</option>
              <option>Caminhão</option>
              <option>Escavadeira</option>
              <option>Moto-niveladora</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Fabricante / Marca *</label>
            <select value={form.fabricante} onChange={e => setF('fabricante', e.target.value)} style={{ ...inputStyle, appearance: 'none' }}>
              <option value="">Selecione</option>
              <optgroup label="Tratores Agrícolas">
                <option>John Deere</option>
                <option>Case IH</option>
                <option>New Holland</option>
                <option>Valtra</option>
                <option>Massey Ferguson</option>
                <option>Fendt</option>
                <option>Deutz-Fahr</option>
                <option>CLAAS</option>
              </optgroup>
              <optgroup label="Construção Civil">
                <option>Caterpillar</option>
                <option>Komatsu</option>
                <option>Volvo CE</option>
                <option>JCB</option>
              </optgroup>
              <optgroup label="Florestal">
                <option>Komatsu Forest</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Modelo *</label>
            <input value={form.modelo} onChange={e => setF('modelo', e.target.value)} placeholder="ex: 8400R ILS" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Ano</label>
            <input value={form.ano} onChange={e => setF('ano', e.target.value)} placeholder="ex: 2022" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Configuração</label>
            <input value={form.configuracao} onChange={e => setF('configuracao', e.target.value)} placeholder="ex: ILS, MFWD" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Número de Série</label>
            <input value={form.numero_serie} onChange={e => setF('numero_serie', e.target.value)} placeholder="Opcional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Chassi</label>
            <input value={form.chassi} onChange={e => setF('chassi', e.target.value)} placeholder="Opcional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Código Interno</label>
            <input value={form.codigo_interno} onChange={e => setF('codigo_interno', e.target.value)} placeholder="Opcional" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={handleSearch} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: loading ? '#e2e8f0' : '#16a34a', color: loading ? '#94a3b8' : 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? <ArrowPathIcon style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : <MagnifyingGlassIcon style={{ width: 14, height: 14 }} />}
            {loading ? (loadingMsg || 'Consultando...') : 'Buscar Plano'}
          </button>
          <button onClick={() => toast('Consultando fabricante...', { icon: '🏭' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
            <LinkIcon style={{ width: 13, height: 13 }} /> Consultar Fabricante
          </button>
          <button onClick={() => toast('Importar fonte...', { icon: '📥' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>
            <ArrowUpTrayIcon style={{ width: 13, height: 13 }} /> Importar Fonte Oficial
          </button>
          {searched && (
            <button onClick={handleClear}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>
              <XMarkIcon style={{ width: 13, height: 13 }} /> Limpar
            </button>
          )}
        </div>

        <div style={{ marginTop: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <InformationCircleIcon style={{ width: 13, height: 13, color: '#94a3b8', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>
            O número de série é opcional, mas pode aumentar a precisão do plano quando houver diferença por faixa de série, configuração ou versão.
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RESULT CARD
  // ─────────────────────────────────────────────────────────────────────────────
  const BRAND_COLORS = {
    'John Deere':      { bg: '#367C2B', text: '#FFDE00', initials: 'JD' },
    'Case IH':         { bg: '#C41230', text: '#fff',    initials: 'CIH' },
    'New Holland':     { bg: '#004A9F', text: '#fff',    initials: 'NH' },
    'Valtra':          { bg: '#B10000', text: '#fff',    initials: 'VAL' },
    'Massey Ferguson': { bg: '#CC0000', text: '#fff',    initials: 'MF' },
    'Fendt':           { bg: '#629D49', text: '#fff',    initials: 'FDT' },
    'Deutz-Fahr':      { bg: '#00A03E', text: '#fff',    initials: 'DTZ' },
    'CLAAS':           { bg: '#BACE00', text: '#000',    initials: 'CLS' },
    'Caterpillar':     { bg: '#FFCD11', text: '#000',    initials: 'CAT' },
    'Komatsu':         { bg: '#FF7A00', text: '#fff',    initials: 'KOM' },
  }

  function ModelThumb({ fabricante, imgUrl, size = 80 }) {
    const brand = BRAND_COLORS[fabricante] || { bg: '#16a34a', text: '#fff', initials: (fabricante || '?').slice(0, 3).toUpperCase() }
    const [imgError, setImgError] = useState(false)
    return (
      <div style={{ width: size, height: size, borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(0,0,0,0.08)', flexShrink: 0, position: 'relative', background: brand.bg }}>
        {imgUrl && !imgError
          ? <img src={imgUrl} alt={fabricante} onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <span style={{ fontSize: size > 60 ? 20 : 14, fontWeight: 900, color: brand.text, letterSpacing: -0.5 }}>{brand.initials}</span>
              {size > 60 && <span style={{ fontSize: 9, color: brand.text, opacity: 0.7, textAlign: 'center', padding: '0 4px', lineHeight: 1.2 }}>{fabricante}</span>}
            </div>
        }
      </div>
    )
  }

  function renderResultCard() {
    const eq = resultModelo ? {
      fabricante:      resultModelo.fabricante,
      familia:         resultModelo.familia,
      modelo:          resultModelo.modelo,
      versao:          resultModelo.configuracao || '—',
      classe:          resultModelo.classe ? resultModelo.classe.charAt(0).toUpperCase() + resultModelo.classe.slice(1) : '—',
      tipo:            resultModelo.tipo    ? resultModelo.tipo.charAt(0).toUpperCase()  + resultModelo.tipo.slice(1)    : '—',
      ano_aplicavel:   resultModelo.ano_inicio ? `${resultModelo.ano_inicio}${resultModelo.ano_fim ? '–' + resultModelo.ano_fim : '+'}` : '—',
      faixa_serie:     resultModelo.motor_litros ? `${resultModelo.motor_litros}L / ${resultModelo.motor_cilindros ?? '—'} cil.` : '—',
      tipo_plano:      resultModelo.transmissao || 'Preventiva por horas/período',
      status:          resultModelo._ia ? 'ia' : 'validado',
      confianca:       resultModelo._ia ? 'ia' : 'alto',
      fonte_principal: resultModelo._ia
        ? `IA — verificar com manual do fabricante`
        : `Catálogo SmartPro — ${resultModelo.mercado || 'Brasil'}`,
      _ia:             resultModelo._ia || false,
      ultima_validacao: new Date().toISOString().slice(0, 10),
      imagem_url:      resultModelo.imagem_url || null,
      potencia:        resultModelo.potencia_cv_max ? `${resultModelo.potencia_cv_max} cv` : '—',
      tracao:          resultModelo.tracao || '—',
    } : {
      ...DEMO_EQ,
      imagem_url: null,
      potencia: '410 cv',
      tracao: '4x4 MFWD/ILS',
    }
    return (
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 0, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        {/* Top accent bar */}
        <div style={{ height: 4, background: 'linear-gradient(90deg, #16a34a, #4ade80, #0ea5e9)' }} />

        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {/* Equipment thumbnail */}
            <ModelThumb fabricante={eq.fabricante} imgUrl={eq.imagem_url} size={80} />

            {/* Equipment info */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {eq.fabricante}
                </span>
                <span style={{ color: '#cbd5e1', fontSize: 12 }}>•</span>
                <span style={{ fontSize: 10, color: '#64748b' }}>{eq.familia}</span>
                <StatusPlano s={eq.status} />
                <ConfPill nivel={eq.confianca} />
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: -0.5 }}>
                {eq.fabricante} {eq.modelo}
              </h2>
              <p style={{ fontSize: 13, color: '#475569', margin: '4px 0 0' }}>{eq.versao}</p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', marginTop: 12 }}>
                {[
                  ['Classe', eq.classe], ['Tipo', eq.tipo], ['Ano Aplicável', eq.ano_aplicavel],
                  ['Faixa de Série', eq.faixa_serie], ['Tipo de Plano', eq.tipo_plano],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</span>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Source + validation */}
            <div style={{ minWidth: 200 }}>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', border: '1px solid #e2e8f0', marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Fonte Principal</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>{eq.fonte_principal}</div>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Última Validação</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a' }}>
                  {new Date(eq.ultima_validacao + 'T12:00:00').toLocaleDateString('pt-BR')}
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap', paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
            {[
              { label: 'Ver Plano Completo', onClick: () => setTab('resumo'), primary: true },
              { label: 'Filtros', onClick: () => setTab('filtros') },
              { label: 'Peças', onClick: () => setTab('pecas') },
              { label: 'Capacidades', onClick: () => setTab('fluidos') },
              { label: 'Vincular à Frota', onClick: () => setTab('frota') },
              { label: 'Gerar Pré-OS', onClick: () => { toast.success('Navegando para OS...'); navigate('/manutencao/operacoes/os') } },
            ].map(b => (
              <button key={b.label} onClick={b.onClick}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: b.primary ? '#16a34a' : '#f8fafc', color: b.primary ? 'white' : '#475569', border: b.primary ? 'none' : '1px solid #e2e8f0', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: b.primary ? 700 : 500, cursor: 'pointer' }}>
                {b.label}
              </button>
            ))}
          </div>

          {/* Banner IA */}
          {eq._ia && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 14, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10 }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>🤖</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>Dados gerados por Inteligência Artificial</div>
                <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
                  Este modelo não foi encontrado no catálogo. Os intervalos e especificações foram estimados pela IA com base no conhecimento técnico do fabricante.
                  Confirme os dados no manual oficial antes de executar o plano de manutenção.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB NAV
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabNav() {
    return (
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginTop: 2, overflowX: 'auto', background: 'white', borderRadius: '0 0 0 0' }}>
        {TABS.map(t => {
          const active = tab === t.id
          const Icon = t.icon
          const badge = t.id === 'conflitos' ? DEMO_CONFLITOS.length : null
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '12px 16px', fontSize: 12, fontWeight: active ? 700 : 500, color: active ? '#16a34a' : '#64748b', background: 'none', border: 'none', borderBottom: active ? '2px solid #16a34a' : '2px solid transparent', marginBottom: -2, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s' }}>
              <Icon style={{ width: 14, height: 14 }} />
              {t.label}
              {badge !== null && <span style={{ background: badge > 0 ? '#fef2f2' : '#f0fdf4', color: badge > 0 ? '#dc2626' : '#16a34a', borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{badge}</span>}
            </button>
          )
        })}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB CONTENT SWITCHER
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabContent() {
    const contentStyle = { background: 'white', borderRadius: '0 0 14px 14px', border: '1px solid #e2e8f0', borderTop: 'none', padding: '24px', marginBottom: 24 }
    return (
      <div style={contentStyle}>
        {tab === 'resumo'     && renderTabResumo()}
        {tab === 'intervalos' && renderTabIntervalos()}
        {tab === 'filtros'    && renderTabFiltros()}
        {tab === 'pecas'      && renderTabPecas()}
        {tab === 'fluidos'    && renderTabFluidos()}
        {tab === 'fontes'     && renderTabFontes()}
        {tab === 'conflitos'  && renderTabConflitos()}
        {tab === 'frota'      && renderTabFrota()}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: RESUMO
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabResumo() {
    const isReal = !!resultModelo
    const eq = resultModelo ? {
      fabricante:      resultModelo.fabricante,
      familia:         resultModelo.familia,
      modelo:          resultModelo.modelo,
      versao:          resultModelo.configuracao || '—',
      classe:          resultModelo.classe ? resultModelo.classe.charAt(0).toUpperCase() + resultModelo.classe.slice(1) : '—',
      tipo:            resultModelo.tipo    ? resultModelo.tipo.charAt(0).toUpperCase()  + resultModelo.tipo.slice(1)    : '—',
      ano_aplicavel:   resultModelo.ano_inicio ? `${resultModelo.ano_inicio}${resultModelo.ano_fim ? '–' + resultModelo.ano_fim : '+'}` : '—',
      faixa_serie:     [resultModelo.motor_litros ? `${resultModelo.motor_litros}L` : '', resultModelo.motor_cilindros ? `${resultModelo.motor_cilindros} cil.` : ''].filter(Boolean).join(' / ') || '—',
      tipo_plano:      resultModelo.transmissao || 'Preventiva por horas/período',
      status:          'validado',
      confianca:       'alto',
      fonte_principal: `Catálogo SmartPro — ${resultModelo.mercado || 'Brasil'}`,
      ultima_validacao: new Date().toISOString().slice(0, 10),
      potencia:        resultModelo.potencia_cv_max ? `${resultModelo.potencia_cv_min ? resultModelo.potencia_cv_min + '–' : ''}${resultModelo.potencia_cv_max} cv` : '—',
      tracao:          resultModelo.tracao || '—',
      transmissao:     resultModelo.transmissao || '—',
    } : {
      ...DEMO_EQ,
      potencia: '295–410 cv',
      tracao: '4x4 MFWD/ILS',
      transmissao: 'e23™ PowerShift',
    }

    const totalIntervalos = isReal ? resultPlanos.length        : DEMO_INTERVALOS.length
    const totalItens      = isReal
      ? resultPlanos.reduce((acc, p) => acc + (p.cat_planos_itens?.length || 0), 0)
      : Object.values(DEMO_PECAS).flat().length

    const miniKpis = [
      { label: 'Intervalos', value: totalIntervalos || DEMO_INTERVALOS.length, color: '#16a34a', icon: ClockIcon, note: totalIntervalos > 0 ? 'do banco de dados' : 'dados demo' },
      { label: 'Itens de Plano', value: totalItens  || DEMO_FILTROS.length + Object.values(DEMO_PECAS).flat().length, color: '#0ea5e9', icon: FunnelIcon, note: 'filtros e peças' },
      { label: 'Potência', value: eq.potencia, color: '#8b5cf6', icon: BoltIcon, note: 'potência máxima' },
      { label: 'Tração', value: eq.tracao, color: '#f59e0b', icon: Cog6ToothIcon, note: eq.transmissao },
      { label: 'Conflitos', value: DEMO_CONFLITOS.length, color: '#16a34a', icon: ExclamationTriangleIcon, note: 'nenhum conflito' },
      { label: 'Frota Vinculada', value: frota.length, color: '#64748b', icon: TruckIcon, note: 'equipamentos' },
    ]

    return (
      <div>
        {/* Fonte badge */}
        {isReal && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 12px', marginBottom: 16, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
            <CheckCircleIcon style={{ width: 13, height: 13 }} />
            Dados carregados do banco — catálogo SmartPro
          </div>
        )}
        {!isReal && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '5px 12px', marginBottom: 16, fontSize: 11, color: '#92400e', fontWeight: 600 }}>
            <InformationCircleIcon style={{ width: 13, height: 13 }} />
            Exibindo dados demonstrativos — execute o SQL do catálogo para dados reais
          </div>
        )}

        {/* Mini KPIs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {miniKpis.map(k => <MiniKpi key={k.label} {...k} />)}
        </div>

        {/* Detail grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Identificação do Equipamento</h4>
            {[
              ['Fabricante', eq.fabricante], ['Família', eq.familia], ['Modelo', eq.modelo],
              ['Versão/Config.', eq.versao], ['Classe Operacional', eq.classe], ['Tipo', eq.tipo],
              ['Ano Aplicável', eq.ano_aplicavel], isReal ? ['Transmissão', eq.transmissao] : ['Faixa de Série', eq.faixa_serie],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 14px' }}>Plano e Validação</h4>
            {[
              ['Tipo de Plano',     eq.tipo_plano],
              ['Status do Plano',   ''],
              ['Nível de Confiança', ''],
              ['Fonte Principal',   eq.fonte_principal],
              ['Sincronizado em',   lastSync],
              ['Total de Intervalos', totalIntervalos || DEMO_INTERVALOS.length],
              ['Itens de Manutenção', totalItens || DEMO_FILTROS.length + Object.values(DEMO_PECAS).flat().length],
              ['Potência Máxima',   eq.potencia],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
                <span style={{ color: '#64748b' }}>{k}</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                  {k === 'Status do Plano'      ? <StatusPlano s={eq.status} />
                  : k === 'Nível de Confiança'  ? <ConfPill nivel={eq.confianca} />
                  : v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: INTERVALOS
  // ─────────────────────────────────────────────────────────────────────────────
  function getCorHoras(h) {
    if (h <= 100)  return '#16a34a'
    if (h <= 500)  return '#ca8a04'
    if (h <= 1500) return '#ea580c'
    return '#dc2626'
  }
  function getCriticHoras(h) {
    if (h <= 100)  return 'Padrão'
    if (h <= 500)  return 'Intermediária'
    if (h <= 1500) return 'Pesada'
    return 'Crítica'
  }

  function renderTabIntervalos() {
    // Usa dados reais se disponíveis, caso contrário usa DEMO
    const isReal = resultPlanos.length > 0
    const intervalos = isReal
      ? resultPlanos.map(p => ({
          id:          `i${p.intervalo_h}`,
          horas:       p.intervalo_h,
          label:       `${p.intervalo_h}h`,
          nome:        p.titulo,
          tipo:        getCriticHoras(p.intervalo_h),
          criticidade: p.intervalo_h <= 100 ? 'padrao' : p.intervalo_h <= 500 ? 'intermediaria' : p.intervalo_h <= 1500 ? 'pesada' : 'critica',
          cor:         getCorHoras(p.intervalo_h),
          sistemas:    [...new Set((p.cat_planos_itens || []).map(i => i.categoria).filter(Boolean))],
          tarefas:     (p.cat_planos_itens || []).map(i => ({
            sistema:    i.categoria || '—',
            tarefa:     i.descricao,
            codigo:     i.referencia || '—',
            capacidade: i.quantidade ? `${i.quantidade} ${i.unidade || ''}`.trim() : '—',
            intervalo:  `${p.intervalo_h}h`,
            condicao:   i.especificacao || '—',
            fonte:      'cat_planos',
            status:     'validado',
          })),
        }))
      : DEMO_INTERVALOS

    return (
      <div>
        {isReal && !resultModelo?._ia && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '5px 12px', marginBottom: 12, fontSize: 11, color: '#16a34a', fontWeight: 600 }}>
            <CheckCircleIcon style={{ width: 13, height: 13 }} />
            {intervalos.length} intervalos carregados do banco de dados
          </div>
        )}
        {isReal && resultModelo?._ia && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '5px 12px', marginBottom: 12, fontSize: 11, color: '#b45309', fontWeight: 600 }}>
            <span style={{ fontSize: 13 }}>🤖</span>
            {intervalos.length} intervalos estimados por IA — confirmar com manual oficial
          </div>
        )}
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          Clique em um intervalo para ver as tarefas detalhadas.&nbsp;
          <span style={{ color: '#16a34a', fontWeight: 700 }}>●</span> Padrão &nbsp;
          <span style={{ color: '#ca8a04', fontWeight: 700 }}>●</span> Intermediária &nbsp;
          <span style={{ color: '#ea580c', fontWeight: 700 }}>●</span> Pesada &nbsp;
          <span style={{ color: '#dc2626', fontWeight: 700 }}>●</span> Crítica
        </p>

        {/* Timeline chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {intervalos.map(iv => {
            const isSelected = selectedInterval?.id === iv.id
            return (
              <button key={iv.id} onClick={() => { setSelectedInterval(iv); openPanel('intervalo', iv) }}
                style={{ padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `2px solid ${iv.cor}`, background: isSelected ? iv.cor : `${iv.cor}18`, color: isSelected ? 'white' : iv.cor, transition: 'all 0.15s' }}>
                {iv.label}
              </button>
            )
          })}
        </div>

        {/* Interval cards */}
        <div style={{ display: 'grid', gap: 12 }}>
          {intervalos.map(iv => (
            <div key={iv.id} onClick={() => { setSelectedInterval(iv); openPanel('intervalo', iv) }}
              style={{ background: '#f8fafc', borderRadius: 12, border: `1px solid ${iv.cor}30`, padding: '14px 18px', cursor: 'pointer', borderLeft: `4px solid ${iv.cor}`, transition: 'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: iv.cor }}>{iv.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{iv.nome}</span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: `${iv.cor}15`, color: iv.cor, fontWeight: 600 }}>{iv.tipo}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{iv.tarefas.length} tarefas</span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>|</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{iv.sistemas.length > 0 ? iv.sistemas.join(', ') : 'Geral'}</span>
                  <ChevronRightIcon style={{ width: 14, height: 14, color: '#94a3b8' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: FILTROS
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabFiltros() {
    const th = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 12px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0', textAlign: 'left', whiteSpace: 'nowrap' }
    const td = (bold = false) => ({ fontSize: 12, padding: '10px 12px', borderBottom: '1px solid #f1f5f9', color: bold ? '#1e293b' : '#475569', fontWeight: bold ? 600 : 400 })

    return (
      <div>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          {DEMO_FILTROS.length} filtros e elementos cadastrados — organizados por sistema.
        </p>
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Sistema', 'Item', 'Código', 'Descrição', 'Intervalo', 'Condição', 'Fonte', 'Status', 'Ações'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {DEMO_FILTROS.map(f => (
                <tr key={f.id} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={td(true)}>{f.sistema}</td>
                  <td style={td()}>{f.item}</td>
                  <td style={{ ...td(true), fontFamily: 'monospace', color: '#16a34a' }}>{f.codigo}</td>
                  <td style={td()}>{f.descricao}</td>
                  <td style={td(true)}>{f.intervalo}</td>
                  <td style={td()}>{f.condicao}</td>
                  <td style={{ ...td() }}><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a', fontWeight: 700 }}>{f.fonte}</span></td>
                  <td style={td()}><ValidPill status={f.status} /></td>
                  <td style={{ ...td(), padding: '10px 8px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[
                        { icon: InformationCircleIcon, title: 'Ver detalhe',  onClick: () => openPanel('filtro', f) },
                        { icon: PlusIcon,              title: 'Adicionar à OS', onClick: () => { toast.success(`${f.item} adicionado à OS`); navigate('/manutencao/operacoes/os') } },
                        { icon: DocumentDuplicateIcon, title: 'Copiar código', onClick: () => copyToClipboard(f.codigo) },
                        { icon: ArrowTopRightOnSquareIcon, title: 'Ver fonte', onClick: () => openPanel('fonte', DEMO_FONTES[0]) },
                      ].map(btn => (
                        <button key={btn.title} title={btn.title} onClick={btn.onClick}
                          style={{ width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b' }}>
                          <btn.icon style={{ width: 12, height: 12 }} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: PEÇAS
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabPecas() {
    // Se temos dados do banco, agrupa todos os itens com referencia por categoria/intervalo
    let pecasData = null
    if (resultPlanos.length > 0) {
      // Coleta todos os itens com referencia, deduplicando por referencia+descricao
      const seen = new Set()
      const allItens = []
      resultPlanos.forEach(plano => {
        ;(plano.cat_planos_itens || []).forEach(item => {
          const key = `${item.referencia || ''}_${item.descricao}`
          if (!seen.has(key)) {
            seen.add(key)
            allItens.push({
              id:             item.id,
              codigo:         item.referencia || '—',
              descricao:      item.descricao,
              aplicacao:      `Intervalo ${plano.intervalo_h}h — ${plano.titulo}`,
              compatibilidade:`${resultModelo?.fabricante || ''} ${resultModelo?.modelo || ''}`.trim(),
              quantidade:     item.quantidade,
              unidade:        item.unidade,
              especificacao:  item.especificacao,
              categoria:      item.categoria,
              status:         'validado',
              fonte:          'DB',
              _intervalo:     plano.intervalo_h,
            })
          }
        })
      })

      // Agrupa por categoria
      const grupos = {}
      const LABEL_CAT = { filtro: 'Filtros', fluido: 'Fluidos / Lubrificantes', peca: 'Peças', verificacao: 'Verificações / Calibrações', regulagem: 'Regulagens' }
      allItens.forEach(item => {
        const grp = LABEL_CAT[item.categoria] || item.categoria || 'Outros'
        if (!grupos[grp]) grupos[grp] = []
        grupos[grp].push(item)
      })
      pecasData = grupos
    }

    const source       = pecasData || DEMO_PECAS
    const totalPecas   = Object.values(source).flat().length
    const isDB         = !!pecasData

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
              {totalPecas} {isDB ? 'itens carregados do banco' : 'peças catalogadas'} em {Object.keys(source).length} grupos
            </p>
            {isDB && (
              <p style={{ fontSize: 11, color: '#16a34a', margin: '2px 0 0', fontWeight: 600 }}>
                ✓ Lista gerada a partir dos planos preventivos do banco de dados
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['cards', 'table'].map(v => (
              <button key={v} onClick={() => setPecaView(v)}
                style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: pecaView === v ? '#16a34a' : '#f1f5f9', color: pecaView === v ? 'white' : '#64748b', border: 'none' }}>
                {v === 'cards' ? 'Cards' : 'Tabela'}
              </button>
            ))}
          </div>
        </div>

        {Object.entries(source).map(([sistema, pecas]) => (
          <div key={sistema} style={{ marginBottom: 20 }}>
            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <WrenchScrewdriverIcon style={{ width: 13, height: 13 }} /> {sistema} ({pecas.length})
            </h4>
            {pecaView === 'cards' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                {pecas.map(p => (
                  <div key={p.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#16a34a' }}>{p.codigo}</span>
                      <ValidPill status={p.status} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{p.descricao}</div>
                    {p.quantidade && <div style={{ fontSize: 11, color: '#0ea5e9', fontWeight: 600, marginBottom: 4 }}>{p.quantidade} {p.unidade}{p.especificacao ? ` — ${p.especificacao}` : ''}</div>}
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>{p.aplicacao}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 8 }}>Compatível: {p.compatibilidade}</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { toast.success(`${p.codigo} adicionado à OS`); navigate('/manutencao/operacoes/os') }}
                        style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        + OS
                      </button>
                      <button onClick={() => copyToClipboard(p.codigo)}
                        style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}>
                        Copiar
                      </button>
                      <button onClick={() => openPanel('peca', p)}
                        style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 11, cursor: 'pointer' }}>
                        Detalhe
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      {['Código', 'Descrição', 'Qtd', 'Intervalo', 'Status', 'Ações'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pecas.map(p => (
                      <tr key={p.id}>
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, color: '#16a34a', fontSize: 12 }}>{p.codigo}</td>
                        <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{p.descricao}{p.especificacao ? <div style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>{p.especificacao}</div> : null}</td>
                        <td style={{ padding: '9px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{p.quantidade ? `${p.quantidade} ${p.unidade || ''}` : p.aplicacao}</td>
                        <td style={{ padding: '9px 12px', color: '#64748b' }}>{p.quantidade ? p.aplicacao : p.compatibilidade}</td>
                        <td style={{ padding: '9px 12px' }}><ValidPill status={p.status} /></td>
                        <td style={{ padding: '9px 8px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => copyToClipboard(p.codigo)} title="Copiar código"
                              style={{ width: 26, height: 26, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <DocumentDuplicateIcon style={{ width: 12, height: 12 }} />
                            </button>
                            <button onClick={() => openPanel('peca', p)} title="Ver detalhe"
                              style={{ width: 26, height: 26, background: '#f1f5f9', border: 'none', borderRadius: 6, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <InformationCircleIcon style={{ width: 12, height: 12 }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: FLUIDOS
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabFluidos() {
    const sistemaColors = {
      'Combustível': '#f59e0b', 'Motor': '#ef4444', 'Arrefecimento': '#0ea5e9',
      'Hidráulico / Trans. MFWD': '#8b5cf6', 'Hidráulico / Trans. ILS': '#7c3aed',
      'Eixo MFWD (carcaça)': '#64748b', 'Cubos MFWD': '#64748b', 'Cubos ILS': '#475569',
    }
    return (
      <div>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          {DEMO_FLUIDOS.length} sistemas de fluidos e capacidades mapeados — {DEMO_EQ.modelo}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {DEMO_FLUIDOS.map(fl => {
            const cor = sistemaColors[fl.sistema] || '#64748b'
            return (
              <div key={fl.id} onClick={() => openPanel('fluido', fl)}
                style={{ background: 'white', borderRadius: 12, border: `1px solid ${cor}25`, borderTop: `3px solid ${cor}`, padding: '14px 16px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,.04)', transition: 'box-shadow 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,.04)'}>
                <div style={{ fontSize: 10, color: cor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  {fl.sistema}
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{fl.tipo}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: cor, lineHeight: 1 }}>{fl.capacidade}</span>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>{fl.unidade}</span>
                </div>
                <div style={{ fontSize: 10, color: '#64748b', borderTop: `1px solid ${cor}15`, paddingTop: 8 }}>{fl.especificacao}</div>
                {fl.observacao && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontStyle: 'italic' }}>{fl.observacao}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                  <ValidPill status={fl.status} />
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>{fl.fonte}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: FONTES
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabFontes() {
    return (
      <div>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
          {DEMO_FONTES.length} fontes técnicas processadas — rastreabilidade completa de cada informação.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          {DEMO_FONTES.map(f => {
            const tipoCfg = TIPO_FONTE_CFG[f.tipo] || { color: '#64748b', icon: '📄' }
            return (
              <div key={f.id} style={{ background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 40, height: 40, background: `${tipoCfg.color}15`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {tipoCfg.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{f.titulo}</span>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: `${tipoCfg.color}15`, color: tipoCfg.color, fontWeight: 700 }}>{f.tipo}</span>
                      <ValidPill status={f.status === 'ativo' ? 'validado' : 'pendente'} />
                      <ConfPill nivel={f.confianca} />
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>{f.obs}</p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {[
                        ['Fabricante', f.fabricante], ['Modelo', f.modelo], ['Idioma', f.idioma],
                        ['Versão', f.versao],
                        ['Data da Fonte', new Date(f.data_fonte + 'T12:00:00').toLocaleDateString('pt-BR')],
                        ['Data Coleta', new Date(f.data_coleta + 'T12:00:00').toLocaleDateString('pt-BR')],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {[
                      { label: 'Abrir', icon: ArrowTopRightOnSquareIcon, onClick: () => toast('Abrindo documento...', { icon: '📄' }) },
                      { label: 'Ver dados', icon: InformationCircleIcon, onClick: () => openPanel('fonte', f) },
                      { label: 'Comparar', icon: DocumentDuplicateIcon, onClick: () => toast('Comparação em breve') },
                    ].map(btn => (
                      <button key={btn.label} title={btn.label} onClick={btn.onClick}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
                        <btn.icon style={{ width: 12, height: 12 }} /> {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: CONFLITOS
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabConflitos() {
    return (
      <div>
        {DEMO_CONFLITOS.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ width: 56, height: 56, background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <CheckCircleIcon style={{ width: 28, height: 28, color: '#16a34a' }} />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>Nenhum conflito técnico</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
              Todas as fontes estão alinhadas para este plano. Dados validados sem divergências.
            </p>
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', display: 'inline-block' }}>
              <p style={{ fontSize: 12, color: '#16a34a', margin: 0, fontWeight: 600 }}>
                ✓ Plano John Deere 8400R ILS — 3 fontes verificadas, 0 conflitos, pronto para uso operacional
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 14, padding: '10px 14px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>
              ⚠ Dados conflitantes não são publicados automaticamente e não geram OS sem validação
            </div>
            {/* conflict table would go here */}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // TAB: FROTA
  // ─────────────────────────────────────────────────────────────────────────────
  function renderTabFrota() {
    const frotaJD = frota.filter(e => {
      const fab = (e.fabricante || '').toLowerCase()
      const mod = (e.modelo || '').toLowerCase()
      return fab.includes('john') || fab.includes('deere') || mod.includes('8400') || mod.includes('8r')
    })
    const allEquip = frotaJD.length > 0 ? frotaJD : frota

    return (
      <div>
        {/* Mini KPIs */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <MiniKpi label="Equipamentos vinculados" value={allEquip.length} color="#16a34a" icon={TruckIcon} />
          <MiniKpi label="Em dia" value={allEquip.filter(e => e.ativo).length} color="#16a34a" icon={CheckCircleIcon} />
          <MiniKpi label="Sem plano vinculado" value={allEquip.length} color="#f59e0b" icon={ExclamationTriangleIcon} note="todos aguardando vinculação" />
        </div>

        {allEquip.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 24px', background: '#f8fafc', borderRadius: 12, border: '1px dashed #e2e8f0' }}>
            <TruckIcon style={{ width: 40, height: 40, color: '#cbd5e1', margin: '0 auto 10px' }} />
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#64748b', margin: '0 0 6px' }}>Nenhum equipamento cadastrado na frota</h4>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 14px' }}>Cadastre equipamentos para vincular planos de manutenção</p>
            <button onClick={() => navigate('/manutencao/cadastros/equipamentos')}
              style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Cadastrar Equipamento
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  {['Código', 'Nome', 'Tipo', 'Fabricante', 'Modelo', 'Ano', 'Horímetro', 'Plano', 'Status', 'Ações'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allEquip.map(eq => (
                  <tr key={eq.id}
                    onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>{eq.codigo || '—'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{eq.nome}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569' }}>{eq.tipo || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569' }}>{eq.fabricante || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569' }}>{eq.modelo || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#475569' }}>{eq.ano || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#1e293b' }}>
                      {eq.horimetro_atual ? `${eq.horimetro_atual}h` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#ca8a04', fontWeight: 600 }}>Sem plano</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: eq.ativo ? '#f0fdf4' : '#f8fafc', color: eq.ativo ? '#16a34a' : '#94a3b8', fontWeight: 600 }}>
                        {eq.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => { toast.success(`Plano vinculado a ${eq.nome}!`) }} title="Vincular plano"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
                          <LinkIcon style={{ width: 11, height: 11 }} /> Vincular
                        </button>
                        <button onClick={() => { navigate('/manutencao/operacoes/os') }} title="Gerar pré-OS"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 10, cursor: 'pointer' }}>
                          <ClipboardDocumentListIcon style={{ width: 11, height: 11 }} /> OS
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SIDE PANEL
  // ─────────────────────────────────────────────────────────────────────────────
  function renderSidePanel() {
    if (!sidePanel) return null
    const { type, data } = sidePanel

    let title = ''
    let content = null

    if (type === 'intervalo') {
      title = `${data.label} — ${data.nome}`
      content = (
        <div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: `${data.cor}15`, color: data.cor, fontWeight: 700 }}>{data.tipo}</span>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>{CRIT_CFG[data.criticidade]?.label}</span>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Sistemas</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{data.sistemas.join(', ')}</div>
          </div>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, margin: '16px 0 10px' }}>Tarefas ({data.tarefas.length})</h4>
          {data.tarefas.map((t, i) => (
            <div key={i} style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0ea5e9', background: 'rgba(14,165,233,0.08)', padding: '2px 8px', borderRadius: 20 }}>{t.sistema}</span>
                <ValidPill status={t.status} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>{t.tarefa}</div>
              {[['Código', t.codigo], ['Capacidade', t.capacidade], ['Intervalo', t.intervalo], ['Condição', t.condicao], ['Fonte', t.fonte]].map(([k, v]) => v && v !== '—' && (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#94a3b8' }}>{k}</span>
                  <span style={{ fontWeight: 600, color: '#475569', fontFamily: k === 'Código' ? 'monospace' : 'inherit' }}>{v}</span>
                </div>
              ))}
              <button onClick={() => { toast.success('Adicionado à OS'); navigate('/manutencao/operacoes/os') }}
                style={{ marginTop: 8, width: '100%', background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, padding: '7px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Adicionar à OS
              </button>
            </div>
          ))}
        </div>
      )
    }

    if (type === 'filtro') {
      title = `Filtro — ${data.item}`
      content = (
        <div>
          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#16a34a', marginBottom: 4 }}>{data.codigo}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{data.descricao}</div>
          </div>
          {[['Sistema', data.sistema], ['Intervalo', data.intervalo], ['Condição', data.condicao], ['Fonte', data.fonte], ['Status', '']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>{k}</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>
                {k === 'Status' ? <ValidPill status={data.status} /> : v}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => copyToClipboard(data.codigo)} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, cursor: 'pointer' }}>Copiar Código</button>
            <button onClick={() => { toast.success('Adicionado à OS'); navigate('/manutencao/operacoes/os') }} style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ OS</button>
          </div>
        </div>
      )
    }

    if (type === 'peca') {
      title = `Peça — ${data.codigo}`
      content = (
        <div>
          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 800, color: '#16a34a', marginBottom: 4 }}>{data.codigo}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{data.descricao}</div>
          </div>
          {[['Aplicação', data.aplicacao], ['Compatibilidade', data.compatibilidade], ['Fonte', data.fonte], ['Substituto', data.substituto || 'N/A']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>{k}</span>
              <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => copyToClipboard(data.codigo)} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, cursor: 'pointer' }}>Copiar Código</button>
            <button onClick={() => toast('Enviando para compras...')} style={{ flex: 1, background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Compras</button>
            <button onClick={() => { toast.success('Adicionado à OS'); navigate('/manutencao/operacoes/os') }} style={{ flex: 1, background: '#16a34a', color: 'white', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ OS</button>
          </div>
        </div>
      )
    }

    if (type === 'fluido') {
      title = `Fluido — ${data.sistema}`
      content = (
        <div>
          <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: '#0ea5e9', lineHeight: 1 }}>{data.capacidade}</div>
            <div style={{ fontSize: 14, color: '#64748b', marginTop: 4 }}>{data.unidade}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', marginTop: 8 }}>{data.tipo}</div>
          </div>
          {[['Sistema', data.sistema], ['Especificação', data.especificacao], ['Observação', data.observacao], ['Fonte', data.fonte]].map(([k, v]) => v && (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</span>
              <span style={{ fontWeight: 600, color: '#1e293b', marginTop: 2 }}>{v}</span>
            </div>
          ))}
        </div>
      )
    }

    if (type === 'fonte') {
      title = `Fonte — ${data.tipo}`
      content = (
        <div>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>{data.titulo}</div>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{data.obs}</p>
          </div>
          {[['Tipo', data.tipo], ['Fabricante', data.fabricante], ['Modelo', data.modelo], ['Versão', data.versao], ['Idioma', data.idioma], ['Confiança', data.confianca]].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <span style={{ color: '#64748b' }}>{k}</span>
              <span style={{ fontWeight: 600, color: '#1e293b', textTransform: 'capitalize' }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => toast('Abrindo documento...', { icon: '📄' })} style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, cursor: 'pointer' }}>Abrir Doc.</button>
            <button onClick={() => toast('Reprocessando...')} style={{ flex: 1, background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 7, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Reprocessar</button>
          </div>
        </div>
      )
    }

    return (
      <>
        {/* Backdrop */}
        <div onClick={closePanel}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }} />
        {/* Panel */}
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, background: 'white',
          zIndex: 50, boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.2s ease-out',
        }}>
          <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div>
              <div style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Detalhes</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginTop: 2 }}>{title}</div>
            </div>
            <button onClick={closePanel}
              style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', border: 'none', borderRadius: 8, cursor: 'pointer', color: '#64748b' }}>
              <XMarkIcon style={{ width: 16, height: 16 }} />
            </button>
          </div>
          {/* Panel content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {content}
          </div>
        </div>
      </>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {renderHeader()}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 32px' }}>
        {renderSearchPanel()}
        {searched && resultModelo && (
          <>
            {renderResultCard()}
            {renderTabNav()}
            {renderTabContent()}
          </>
        )}
        {searched && !resultModelo && (
          <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fecaca', padding: '40px 32px', textAlign: 'center', marginBottom: 24 }}>
            <div style={{ width: 60, height: 60, background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <MagnifyingGlassIcon style={{ width: 28, height: 28, color: '#dc2626' }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Modelo não encontrado no catálogo
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 4px' }}>
              Nenhum resultado para{' '}
              <strong style={{ color: '#1e293b' }}>
                {[searchedTerms?.fabricante, searchedTerms?.modelo].filter(Boolean).join(' ') || 'os termos informados'}
              </strong>
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
              Verifique a grafia ou tente com termos diferentes. O catálogo cobre as principais marcas do mercado agrícola e de construção.
            </p>
            <button onClick={handleClear}
              style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Nova Busca
            </button>
          </div>
        )}
        {!searched && (
          <div style={{ textAlign: 'center', padding: '64px 24px' }}>
            <div style={{ width: 72, height: 72, background: 'rgba(22,163,74,0.08)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', border: '2px solid rgba(22,163,74,0.15)' }}>
              <CpuChipIcon style={{ width: 32, height: 32, color: '#16a34a' }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Central Técnica de Planos de Manutenção
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 20px', lineHeight: 1.6 }}>
              Pesquise por fabricante e modelo para acessar o plano de manutenção oficial com intervalos, filtros, peças, fluidos e rastreabilidade técnica completa.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['John Deere 8400R ILS', 'Case IH 3150', 'Valtra BM 125i', 'Caterpillar 140M'].map(sugestao => (
                <button key={sugestao} onClick={() => {
                  const parts = sugestao.split(' ')
                  setForm(f => ({ ...f, fabricante: parts.slice(0, 2).join(' '), modelo: parts.slice(2).join(' ') }))
                  setTimeout(handleSearch, 100)
                }}
                  style={{ padding: '7px 14px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, cursor: 'pointer' }}>
                  {sugestao}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {renderSidePanel()}
    </div>
  )
}
