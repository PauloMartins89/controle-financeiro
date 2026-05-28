/**
 * _wa-relatorio.js
 *
 * Módulo de relatórios sob demanda via WhatsApp.
 *
 * Fluxo:
 *  1. Webhook recebe mensagem de texto
 *  2. verificarAcesso() → checa se o telefone está em wa_relatorio_acesso
 *  3. parsearPedido()   → Groq extrai tipo, cliente, período
 *  4. buscarLancamentos() → consulta Supabase filtrado por workspace
 *  5. gerarPDFBuffer()  → pdfkit gera o PDF em memória
 *  6. uploadPDF()       → armazena no Supabase Storage com URL pública temporária
 *  7. enviarDocumentoWA() → Z-API send-document/pdf
 *
 * Exporta: handleRelatorioWA(texto, fromPhone, supabase)
 *   → true  se a mensagem foi reconhecida e processada como pedido de relatório
 *   → false se não era pedido de relatório (deixa o fluxo normal seguir)
 */

import Groq from 'groq-sdk'
import PDFDocument from 'pdfkit'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const APP_URL = process.env.APP_URL || 'https://smartpro.app.br'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtBRL(v) {
  return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtData(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}

// ─── 1. Verificar acesso ──────────────────────────────────────────────────────

/**
 * Retorna { workspace_id, nome, relatorios_permitidos } ou null.
 * Usa service_role (bypassa RLS) para validar pelo telefone.
 */
export async function verificarAcesso(fromPhone, supabase) {
  const sem55  = fromPhone.replace(/^55/, '')
  const com9   = sem55.length === 10 ? sem55.slice(0, 2) + '9' + sem55.slice(2) : sem55
  const sem9   = sem55.length === 11 && sem55[2] === '9' ? sem55.slice(0, 2) + sem55.slice(3) : sem55
  const variantes = [...new Set([fromPhone, sem55, '55' + sem55, com9, '55' + com9, sem9, '55' + sem9])]

  for (const v of variantes) {
    const { data } = await supabase
      .from('wa_relatorio_acesso')
      .select('workspace_id, nome, relatorios_permitidos')
      .eq('telefone', v)
      .eq('ativo', true)
      .maybeSingle()
    if (data) return data
  }
  return null
}

// ─── 2. Parsear pedido com IA ─────────────────────────────────────────────────

/**
 * Extrai do texto livre:
 *  tipo:         'entradas' | 'saidas' | 'todos'
 *  cliente:      texto livre para filtrar descrição/categoria (ou null)
 *  data_inicio:  YYYY-MM-DD
 *  data_fim:     YYYY-MM-DD
 *  eh_relatorio: boolean — false se não for pedido de relatório
 */
export async function parsearPedido(texto, today) {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `Você é um parser de pedidos de relatório financeiro. Extraia as informações do texto e retorne APENAS JSON válido, sem explicação.

Hoje: ${today}

Saída esperada:
{
  "eh_relatorio": true,
  "tipo": "entradas|saidas|todos",
  "cliente": "nome do cliente/fornecedor/pessoa mencionada ou null",
  "data_inicio": "YYYY-MM-DD",
  "data_fim": "YYYY-MM-DD"
}

Regras:
- "entradas" = receitas/créditos
- "saidas" = despesas/débitos
- "todos" = tudo (padrão se não especificado)
- "últimos 30 dias" → data_inicio = hoje-30d, data_fim = hoje
- "este mês" → primeiro dia do mês atual até hoje
- "mês passado" → mês anterior completo
- Se não mencionar período, use os últimos 30 dias
- Se não for um pedido de relatório/extrato/lançamento, retorne {"eh_relatorio": false}`,
      },
      { role: 'user', content: texto },
    ],
  })
  const raw = completion.choices[0]?.message?.content || '{}'
  const match = raw.match(/\{[\s\S]*\}/)
  try {
    const parsed = JSON.parse(match?.[0] || '{}')
    if (!parsed.eh_relatorio) return { eh_relatorio: false }
    // Garante datas padrão
    if (!parsed.data_inicio) {
      const d = new Date(today)
      d.setDate(d.getDate() - 30)
      parsed.data_inicio = d.toISOString().slice(0, 10)
    }
    if (!parsed.data_fim) parsed.data_fim = today
    if (!parsed.tipo || !['entradas', 'saidas', 'todos'].includes(parsed.tipo)) parsed.tipo = 'todos'
    return parsed
  } catch {
    return { eh_relatorio: false }
  }
}

// ─── 3. Buscar lançamentos ────────────────────────────────────────────────────

async function buscarLancamentos(workspaceId, filtros, supabase) {
  let query = supabase
    .from('lancamentos')
    .select('id, tipo, descricao, valor, data, categoria, status')
    .eq('workspace_id', workspaceId)
    .gte('data', filtros.data_inicio)
    .lte('data', filtros.data_fim)
    .order('data', { ascending: false })

  if (filtros.tipo === 'entradas') query = query.eq('tipo', 'receita')
  if (filtros.tipo === 'saidas')   query = query.eq('tipo', 'despesa')

  if (filtros.cliente) {
    query = query.ilike('descricao', `%${filtros.cliente}%`)
  }

  const { data, error } = await query.limit(500)
  if (error) throw new Error(`Erro ao buscar lançamentos: ${error.message}`)
  return data || []
}

// ─── 4. Gerar PDF em memória ──────────────────────────────────────────────────

async function gerarPDFBuffer(lancamentos, filtros, nomeEmpresa) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const doc = new PDFDocument({ margin: 40, size: 'A4' })

    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const totalEntradas = lancamentos.filter(l => l.tipo === 'receita').reduce((s, l) => s + Number(l.valor || 0), 0)
    const totalSaidas   = lancamentos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + Number(l.valor || 0), 0)
    const saldo         = totalEntradas - totalSaidas

    const tipoLabel = filtros.tipo === 'entradas' ? 'Entradas' : filtros.tipo === 'saidas' ? 'Saídas' : 'Lançamentos'
    const periodoLabel = `${fmtData(filtros.data_inicio)} a ${fmtData(filtros.data_fim)}`
    const clienteLabel  = filtros.cliente ? ` — ${filtros.cliente}` : ''

    // ── Cabeçalho ────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 60).fill('#4f46e5')
    doc.fillColor('white').fontSize(18).font('Helvetica-Bold').text('SmartPro', 40, 18)
    doc.fontSize(10).font('Helvetica').text(`${tipoLabel}${clienteLabel}  |  ${periodoLabel}`, 40, 42)
    doc.fillColor('#1e1e2e')
    doc.moveDown(3)

    // ── Empresa ──────────────────────────────────────────────────────────────
    if (nomeEmpresa) {
      doc.fontSize(9).fillColor('#6b7280').text(`Empresa: ${nomeEmpresa}`, 40, doc.y)
      doc.moveDown(0.5)
    }

    // ── Resumo ────────────────────────────────────────────────────────────────
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text('Resumo', 40, doc.y + 4)
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')
    if (filtros.tipo !== 'saidas')   doc.fillColor('#16a34a').text(`  Entradas:  ${fmtBRL(totalEntradas)}`)
    if (filtros.tipo !== 'entradas') doc.fillColor('#dc2626').text(`  Saídas:    ${fmtBRL(totalSaidas)}`)
    if (filtros.tipo === 'todos') {
      doc.fillColor(saldo >= 0 ? '#1d4ed8' : '#7c3aed').text(`  Saldo:     ${fmtBRL(saldo)}`)
    }
    doc.fillColor('#374151').text(`  Total de registros: ${lancamentos.length}`)
    doc.moveDown(0.8)

    // ── Tabela ────────────────────────────────────────────────────────────────
    const col = { data: 40, desc: 105, tipo: 340, valor: 415, status: 490 }
    const rowH = 16

    // Cabeçalho da tabela
    doc.rect(40, doc.y, doc.page.width - 80, rowH).fill('#e0e7ff')
    doc.fillColor('#1e1b4b').font('Helvetica-Bold').fontSize(8.5)
    const headerY = doc.y + 4
    doc.text('Data',       col.data,   headerY, { width: 60 })
    doc.text('Descrição',  col.desc,   headerY, { width: 230 })
    doc.text('Tipo',       col.tipo,   headerY, { width: 70 })
    doc.text('Valor',      col.valor,  headerY, { width: 70 })
    doc.text('Status',     col.status, headerY, { width: 60 })
    doc.moveDown(1.2)

    doc.font('Helvetica').fontSize(8).fillColor('#374151')

    lancamentos.forEach((l, i) => {
      if (doc.y > doc.page.height - 60) {
        doc.addPage()
        doc.fontSize(8).fillColor('#374151')
      }

      const y = doc.y
      if (i % 2 === 0) doc.rect(40, y - 2, doc.page.width - 80, rowH).fill('#f9fafb').fillColor('#374151')

      const isEntrada = l.tipo === 'receita'
      doc.fillColor('#374151')
      doc.text(fmtData(l.data),                    col.data,   y, { width: 60 })
      doc.text(l.descricao || '—',                 col.desc,   y, { width: 230, ellipsis: true })
      doc.fillColor(isEntrada ? '#16a34a' : '#dc2626')
      doc.text(isEntrada ? 'Entrada' : 'Saída',    col.tipo,   y, { width: 70 })
      doc.fillColor(isEntrada ? '#16a34a' : '#dc2626')
      doc.text(fmtBRL(l.valor),                    col.valor,  y, { width: 70 })
      doc.fillColor('#6b7280')
      doc.text(l.status || '—',                    col.status, y, { width: 60 })

      doc.moveDown(0.85)
    })

    if (lancamentos.length === 0) {
      doc.fontSize(10).fillColor('#6b7280').text('Nenhum lançamento encontrado para os filtros informados.', 40, doc.y + 8)
    }

    // ── Rodapé ────────────────────────────────────────────────────────────────
    const pageCount = doc.bufferedPageRange ? doc.bufferedPageRange().count : 1
    doc.fontSize(7).fillColor('#9ca3af')
      .text(`Gerado em ${new Date().toLocaleString('pt-BR')} via SmartPro`, 40, doc.page.height - 30, { align: 'center', width: doc.page.width - 80 })

    doc.end()
  })
}

// ─── 5. Upload para Supabase Storage ─────────────────────────────────────────

async function uploadPDF(buffer, supabase) {
  const fileName = `relatorios/${Date.now()}_rel.pdf`
  const { data, error } = await supabase.storage
    .from('comprovantes')
    .upload(fileName, buffer, { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error(`Upload falhou: ${error.message}`)
  const { data: urlData } = supabase.storage.from('comprovantes').getPublicUrl(data.path)
  return urlData?.publicUrl
}

// ─── 6. Enviar documento via Z-API ───────────────────────────────────────────

async function enviarDocumentoWA(phone, pdfUrl, caption) {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token      = process.env.ZAPI_TOKEN
  if (!instanceId || !token) throw new Error('Z-API não configurado')

  const res = await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/send-document/pdf`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
      },
      body: JSON.stringify({
        phone,
        document: pdfUrl,
        fileName: 'relatorio.pdf',
        caption: caption || 'Seu relatório está pronto ✅',
      }),
    }
  )
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Z-API send-document falhou ${res.status}: ${err}`)
  }
}

// ─── Enviar texto simples (fallback) ─────────────────────────────────────────

async function enviarTextoWA(phone, message) {
  const instanceId = process.env.ZAPI_INSTANCE_ID
  const token      = process.env.ZAPI_TOKEN
  if (!instanceId || !token) return
  await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
      },
      body: JSON.stringify({ phone, message }),
    }
  )
}

// ─── Handler principal ────────────────────────────────────────────────────────

/**
 * Ponto de entrada chamado pelo webhook ANTES do parseIntent normal.
 * Retorna true  → mensagem foi tratada como relatório (não continuar o fluxo)
 * Retorna false → não era pedido de relatório (continuar fluxo normal)
 */
export async function handleRelatorioWA(texto, fromPhone, supabase) {
  try {
    // 1. Verificar acesso
    const acesso = await verificarAcesso(fromPhone, supabase)
    if (!acesso) return false

    const today = new Date().toISOString().slice(0, 10)

    // 2. Parsear intenção
    const pedido = await parsearPedido(texto, today)
    if (!pedido.eh_relatorio) return false

    // Confirma ao usuário que está gerando
    await enviarTextoWA(fromPhone, '⏳ Gerando seu relatório, aguarde...')

    // 3. Buscar nome da empresa (workspace)
    const { data: ws } = await supabase
      .from('workspaces')
      .select('nome')
      .eq('id', acesso.workspace_id)
      .maybeSingle()
    const nomeEmpresa = ws?.nome || null

    // 4. Buscar lançamentos
    const lancamentos = await buscarLancamentos(acesso.workspace_id, pedido, supabase)

    // 5. Gerar PDF
    const pdfBuffer = await gerarPDFBuffer(lancamentos, pedido, nomeEmpresa)

    // 6. Upload
    const pdfUrl = await uploadPDF(pdfBuffer, supabase)

    // 7. Enviar
    const tipoLabel = pedido.tipo === 'entradas' ? 'Entradas' : pedido.tipo === 'saidas' ? 'Saídas' : 'Lançamentos'
    const caption = `📊 *${tipoLabel}${pedido.cliente ? ' — ' + pedido.cliente : ''}*\n` +
      `📅 ${pedido.data_inicio.split('-').reverse().join('/')} a ${pedido.data_fim.split('-').reverse().join('/')}\n` +
      `📋 ${lancamentos.length} registro(s) encontrado(s)`

    await enviarDocumentoWA(fromPhone, pdfUrl, caption)
    return true

  } catch (err) {
    console.error('[WA Relatório] erro:', err?.message || err)
    await enviarTextoWA(fromPhone, '❌ Não consegui gerar o relatório agora. Tente novamente em instantes.')
    return true // consumiu a mensagem mesmo com erro
  }
}
