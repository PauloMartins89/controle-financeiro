import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `Você é um especialista técnico em manutenção preventiva de equipamentos agrícolas, de construção civil e florestais. Seu papel é gerar planos de manutenção preventiva detalhados e confiáveis, baseados nos manuais técnicos reais dos fabricantes.

REGRAS:
- Retorne APENAS JSON válido, sem texto extra, sem markdown, sem explicações
- Use sempre português do Brasil
- Baseie-se em dados reais dos fabricantes (John Deere OMT, Case IH, New Holland, Valtra, etc.)
- Se não souber um código de peça exato, use null
- Inclua todos os intervalos padrão do fabricante (100h, 250h, 500h, 1000h, 1500h, 2000h conforme aplicável)
- A classe deve ser: "agricola", "construcao" ou "florestal"
- A criticidade dos intervalos: "padrao" (≤250h), "intermediaria" (500h), "pesada" (1000-1500h), "critica" (≥2000h)`

const USER_TEMPLATE = ({ fabricante, modelo, tipo, ano, configuracao }) => `Gere o plano de manutenção preventiva completo para:
- Fabricante: ${fabricante || 'desconhecido'}
- Modelo: ${modelo}
- Tipo: ${tipo || 'trator'}
- Ano: ${ano || 'atual'}
${configuracao ? `- Configuração/versão: ${configuracao}` : ''}

Retorne exatamente este JSON:
{
  "modelo": {
    "fabricante": "string",
    "familia": "string — linha/série do equipamento",
    "modelo": "string — nome exato do modelo",
    "configuracao": "string ou null",
    "classe": "agricola|construcao|florestal",
    "tipo": "string — ex: trator, colheitadeira, escavadeira",
    "ano_inicio": número,
    "ano_fim": número ou null,
    "potencia_cv_min": número ou null,
    "potencia_cv_max": número ou null,
    "transmissao": "string ou null",
    "tracao": "string ou null — ex: MFWD, 4WD",
    "motor_cilindros": número ou null,
    "motor_litros": número ou null,
    "mercado": "Brasil"
  },
  "planos": [
    {
      "intervalo_h": número,
      "titulo": "string — ex: Revisão de 500 horas",
      "tipo_servico": "preventiva",
      "criticidade": "padrao|intermediaria|pesada|critica",
      "cat_planos_itens": [
        {
          "categoria": "string — sistema: Motor, Hidráulico, Transmissão, Combustível, Arrefecimento, Filtros, Cabine, Elétrico, Geral",
          "descricao": "string — ação: ex: Trocar óleo do motor",
          "referencia": "string ou null — código da peça/filtro",
          "quantidade": número ou null,
          "unidade": "string ou null — L, un, kg",
          "especificacao": "string ou null — spec do produto ou condição"
        }
      ]
    }
  ]
}`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  // Auth: requer JWT Supabase válido
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'nao_autenticado' })

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return res.status(401).json({ error: 'token_invalido' })

  const { fabricante, modelo, tipo, ano, configuracao } = req.body || {}
  if (!modelo) return res.status(400).json({ error: 'modelo_obrigatorio' })

  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'groq_nao_configurado' })
  }

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 4096,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: USER_TEMPLATE({ fabricante, modelo, tipo, ano, configuracao }) },
      ],
    })

    const raw = completion.choices?.[0]?.message?.content || '{}'
    let parsed
    try {
      parsed = JSON.parse(raw)
    } catch {
      return res.status(502).json({ error: 'resposta_ia_invalida', raw: raw.slice(0, 200) })
    }

    if (!parsed.modelo || !parsed.planos) {
      return res.status(502).json({ error: 'estrutura_invalida' })
    }

    // Normaliza campos obrigatórios do modelo
    parsed.modelo.fabricante = parsed.modelo.fabricante || fabricante || 'Desconhecido'
    parsed.modelo.modelo     = parsed.modelo.modelo     || modelo
    parsed.modelo.mercado    = parsed.modelo.mercado    || 'Brasil'

    return res.status(200).json({
      modelo: parsed.modelo,
      planos: Array.isArray(parsed.planos) ? parsed.planos : [],
    })
  } catch (err) {
    console.error('[busca-modelo-ia] Groq error:', err.message)
    return res.status(500).json({ error: 'erro_groq', detail: err.message?.slice(0, 200) })
  }
}
