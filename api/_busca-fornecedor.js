// api/busca-fornecedor.js
// Busca empresas por produto + cidade usando o banco de dados público da Receita Federal
// via Casa dos Dados (api.casadosdados.com.br) — sem autenticação, dados públicos

// Mapeamento produto → CNAE(s) mais relevantes
const CNAE_MAP = {
  // Automotivo
  'pneus':          ['4530703','4530701','4741500'],
  'peças auto':     ['4530705','4530706','4541203'],
  'lubrificantes':  ['4682600','4530704','1922501'],
  'baterias':       ['4741500','4530701'],
  'veículos':       ['4511101','4511102','4512901'],
  'combustível':    ['4731800','4732600'],
  // Ferramentas / Segurança
  'ferramentas':    ['4744001','4744003','4744002'],
  'epi':            ['4789005','4763601','4679699'],
  'equipamentos':   ['4669999','4672900','3314714'],
  // Elétrica / TI
  'elétrica':       ['4742300','4759801','4321500'],
  'informática':    ['4751201','4751202','6319400'],
  'eletrônicos':    ['4752100','4759801'],
  // Construção
  'hidráulica':     ['4744099','4321500','4322301'],
  'construção':     ['4744099','4679699','4741500'],
  'tintas':         ['4741500','4744099','2212900'],
  // Escritório / Limpeza
  'escritório':     ['4761001','4761003','4647801'],
  'limpeza':        ['4789099','4646001','2012000'],
  'embalagens':     ['4686900','4649408'],
  // Alimentação
  'alimentos':      ['4711301','4712100','4639701'],
  'bebidas':        ['4635401','4635499'],
  // Serviços
  'manutenção':     ['3314714','4520001','4520005'],
  'transporte':     ['4930201','4930202','5320202'],
  'segurança':      ['8011101','8011102'],
  // Genérico
  'outros':         ['4669999'],
}

function normalizarProduto(produto) {
  const p = produto.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [key, cnaes] of Object.entries(CNAE_MAP)) {
    const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (p.includes(keyNorm) || keyNorm.includes(p)) return cnaes
  }
  return null // busca por termo livre
}

function normalizarCidade(cidade) {
  return cidade.toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { produto, cidade, uf, pagina = 1 } = req.body || {}

  if (!produto || !cidade) {
    return res.status(400).json({ error: 'Informe produto e cidade.' })
  }

  const cnaes    = normalizarProduto(produto)
  const cidadeNorm = normalizarCidade(cidade)

  const body = {
    query: {
      termo: cnaes ? [] : [produto],
      atividade_principal: cnaes || [],
      municipio: [cidadeNorm],
      ...(uf ? { uf: [uf.toUpperCase()] } : {}),
      situacao_cadastral: 'ATIVA',
    },
    extras: {
      somente_mei: false,
      excluir_mei: false,
      com_contato_telefonico: true,
      somente_fixo: false,
      somente_celular: false,
      somente_matriz: true,
    },
    page: pagina,
  }

  try {
    const resp = await fetch('https://api.casadosdados.com.br/v2/public/cnpj/pesquisa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      // Fallback: tenta busca por termo livre se cnae falhou
      if (cnaes) {
        const fallback = await fetch('https://api.casadosdados.com.br/v2/public/cnpj/pesquisa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: {
              termo: [produto],
              municipio: [cidadeNorm],
              situacao_cadastral: 'ATIVA',
            },
            extras: {
              com_contato_telefonico: true,
              somente_matriz: true,
            },
            page: pagina,
          }),
        })
        if (fallback.ok) {
          const fb = await fallback.json()
          return res.json({ data: fb.data?.cnpj || [], total: fb.data?.count || 0, pagina, source: 'termo' })
        }
      }
      return res.status(resp.status).json({ error: 'Erro ao consultar base de dados.' })
    }

    const json = await resp.json()
    const empresas = (json.data?.cnpj || []).map(e => ({
      cnpj:           e.cnpj,
      razao_social:   e.razao_social,
      nome_fantasia:  e.nome_fantasia,
      telefone:       e.ddd_telefone_1 ? `(${e.ddd_telefone_1}) ${e.telefone_1}` : (e.ddd_telefone_2 ? `(${e.ddd_telefone_2}) ${e.telefone_2}` : null),
      email:          e.email,
      logradouro:     e.logradouro,
      numero:         e.numero,
      bairro:         e.bairro,
      municipio:      e.municipio,
      uf:             e.uf,
      cep:            e.cep,
      cnae_principal: e.cnae_fiscal_descricao || e.cnae_descricao,
      porte:          e.porte,
      capital_social: e.capital_social,
    }))

    return res.json({ data: empresas, total: json.data?.count || empresas.length, pagina })
  } catch (err) {
    return res.status(500).json({ error: 'Falha na consulta: ' + err.message })
  }
}
