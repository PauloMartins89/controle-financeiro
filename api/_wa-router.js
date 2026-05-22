/**
 * _wa-router.js
 * Roteador inteligente de mensagens WhatsApp.
 *
 * Quando um telefone está cadastrado em múltiplos módulos (ex: agenda + refeição),
 * usa IA (LLaMA) para detectar a intenção e rotear para o módulo correto,
 * sem exibir menus ou interromper o fluxo natural da conversa.
 *
 * Exporta: rotearMensagem(body, fromPhone, phoneVariants, supabase)
 *   → 'agenda'  = rotear para handleAgendaWA
 *   → null      = deixar o fluxo normal prosseguir (financeiro / refeição / OCR)
 */

import Groq from 'groq-sdk'

// ─── Classificador de intenção via LLaMA ─────────────────────────────────────
async function classificarIntent(texto) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0,
    max_tokens: 10,
    messages: [
      {
        role: 'system',
        content: [
          'Classifique a mensagem abaixo em um dos módulos. Responda APENAS com a palavra do módulo, sem pontuação ou explicação.',
          '',
          'Módulos:',
          '- agenda: agendamento de serviços, equipamentos (caminhão, guindaste, retroescavadeira, maquinário, pá carregadeira), transporte de carga, obra, agendar, serviço',
          '- refeicao: refeição, almoço, café, marmita, lanche, pedido de comida, cardápio, janta, alimentação',
          '- indefinido: mensagem ambígua, saudação, confirmação ou que não se encaixa claramente em nenhum módulo',
        ].join('\n'),
      },
      { role: 'user', content: texto },
    ],
  })
  const resp = (completion.choices[0]?.message?.content || '').trim().toLowerCase()
  if (resp.startsWith('refeicao') || resp.includes('refeição')) return 'refeicao'
  if (resp.startsWith('agenda')) return 'agenda'
  return 'indefinido'
}

// ─── Verifica se telefone está registrado no módulo de refeições ─────────────
async function isRefeicaoRegistrado(phoneVariants, supabase) {
  for (const v of phoneVariants) {
    const [{ data: eq }, { data: rest }] = await Promise.all([
      supabase.from('refei_equipes').select('id').eq('lider_telefone', v).limit(1).maybeSingle(),
      supabase.from('refei_restaurantes').select('id').eq('telefone_wa', v).limit(1).maybeSingle(),
    ])
    if (eq || rest) return true
  }
  return false
}

/**
 * Decide para qual módulo rotear a mensagem.
 *
 * Lógica:
 *   1. Se o telefone NÃO está em agenda_gestores → retorna null (fluxo normal)
 *   2. Se está só em agenda → retorna 'agenda'
 *   3. Se está em agenda + refeições:
 *      - Áudio: agenda se audio_habilitado, senão null
 *      - Imagem: null (OCR/comprovante)
 *      - Texto: LLaMA classifica → 'agenda' ou null
 *
 * @returns {Promise<'agenda' | null>}
 */
export async function rotearMensagem(body, fromPhone, phoneVariants, supabase) {
  // ── Verifica agenda_gestores ──────────────────────────────────────────────
  let gestor = null
  for (const v of phoneVariants) {
    const { data } = await supabase
      .from('agenda_gestores')
      .select('id, audio_habilitado')
      .eq('telefone', v)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    if (data) { gestor = data; break }
  }

  // Não é gestor de agenda → fluxo normal
  if (!gestor) return null

  // ── Verifica conflito com refeições ───────────────────────────────────────
  let temRefeicao = false
  try {
    temRefeicao = await isRefeicaoRegistrado(phoneVariants, supabase)
  } catch (e) {
    console.error('[_wa-router] refei check error:', e.message)
  }

  // Só agenda, sem conflito → agenda
  if (!temRefeicao) return 'agenda'

  // ── Conflito agenda + refeição: roteamento inteligente ───────────────────

  // Áudio: se audio_habilitado → agenda; senão → fluxo normal (pode ser pedido de refeição)
  if (body.audio || body.ptt) {
    return gestor.audio_habilitado ? 'agenda' : null
  }

  // Imagem: sempre fluxo normal (OCR de comprovante / diário do motorista)
  if (body.image) return null

  // Texto: IA classifica a intenção
  const texto = (body.text?.message || body.text || body.body || '').trim()

  // Mensagem muito curta (ex: "oi", "ok", "sim") → agenda como padrão (é gestor cadastrado)
  if (!texto || texto.length < 4) return 'agenda'

  try {
    const modulo = await classificarIntent(texto)
    console.log(`[_wa-router] ${fromPhone} → intent="${modulo}" | "${texto.slice(0, 60)}"`)
    return modulo === 'refeicao' ? null : 'agenda'
  } catch (e) {
    console.error('[_wa-router] classify error:', e.message)
    return 'agenda' // fallback seguro: gestor registrado vai para agenda
  }
}
