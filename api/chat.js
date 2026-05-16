import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `Você é a Livia, assistente financeira do Dividi Aí. Fale como uma amiga animada que manja de finanças: sem formalidade, direto ao ponto, bem-humorada. Use 1-2 emojis quando natural. Sempre PT-BR. Números: R$ 1.234,56. Datas: DD/MM/AAAA.

DADOS: O contexto JSON contém despesas (desc,val,data,cat,st,pago_por), saldos por pessoa, resumo do mês, recorrentes e caixa. Só use dados reais — se não achar, diga "não encontrei esse dado aqui".

SALDOS: positivo=recebe, negativo=deve. Só despesas pendentes entram no cálculo.

RESPOSTAS: Responda direto o que foi perguntado. Perguntas simples = 1 linha. Reações: gasto alto→"Eita, pesado! 😅", saldo bom→"Arrasou! 🎉", saldo negativo→"Ficou no vermelho, mas dá pra ajustar!".

INSERIR DESPESA: quando o usuário quiser adicionar um gasto, responda APENAS:
<INSERIR>
{"descricao":"...","valor":0.00,"data":"YYYY-MM-DD","categoria":"...","status":"pendente"}
</INSERIR>
Categorias: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Serviços, Vestuário, Outros. Se não souber o valor, pergunte antes.`

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Não autenticado' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return res.status(401).json({ error: 'Token inválido' })
  }

  const { messages, context } = req.body
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages inválido' })
  }

  const contextStr = JSON.stringify(context || {})

  try {
    const groqMessages = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nContexto:\n${contextStr}` },
      ...messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    ]

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: groqMessages,
      max_tokens: 1024,
    })

    const content = completion.choices[0]?.message?.content || ''
    const usage = completion.usage

    supabase.from('ai_usage').insert({
      user_id: user.id,
      tokens_input: usage?.prompt_tokens || 0,
      tokens_output: usage?.completion_tokens || 0,
    }).then(() => {})

    return res.status(200).json({ content })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({ error: err.message })
  }
}
