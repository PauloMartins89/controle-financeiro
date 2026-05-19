# Investigação: `(t || e).trim is not a function`

**Data:** 19/05/2026
**Bundle reportado pelo usuário:** `index-C1X-KTbM.js`
**Bundle atual no `dist/`:** `index-Bfkmr649.js`

---

## 1. O erro

```
index-C1X-KTbM.js:394 Uncaught (in promise) TypeError: (t || e).trim is not a function
    at y  (index-C1X-KTbM.js:394:336879)
    at wd (index-C1X-KTbM.js:8:126494)     ← React beginWork
    at en (index-C1X-KTbM.js:8:15080)
    at Ad (index-C1X-KTbM.js:8:127722)     ← React performUnitOfWork
    at mp (index-C1X-KTbM.js:9:28486)      ← React workLoop
    at fp (index-C1X-KTbM.js:9:28308)
```

- Padrão minificado `(t || e).trim()` ↔ no fonte: `(x || y).trim()`
- Stack `wd / Ad / mp / fp` = render do React → ocorre durante `beginWork`
- Promessa não tratada → resultado de `useEffect`/handler async que retorna do servidor com tipo errado

---

## 2. Causa raiz identificada

Campos retornados pela API da Receita Federal / BrasilAPI no fluxo **Consultar CNPJ** chegam às vezes como `null`/`number` em vez de `string`. O JSX antigo fazia:

```js
(d.situacao_especial || '').trim()
(d.descricao_motivo_situacao_cadastral || '').trim()
```

Quando o campo vinha como `0`, `null` literal ou número, o resultado da `||` ainda era não-string → `.trim()` quebrava.

Mesmo padrão existia em:

| Arquivo | Linha original | Status |
|---|---|---|
| `src/pages/ComprasBuscaFornecedor.jsx` | 208 (penalidade situação) | ✅ blindado |
| `src/pages/ComprasBuscaFornecedor.jsx` | 212 (motivo situação) | ✅ blindado |
| `src/pages/ComprasBuscaFornecedor.jsx` | 369 (render `situacao_especial`) | ✅ blindado |
| `src/pages/ComprasBuscaFornecedor.jsx` | 628–638 (`buscar()`) | ✅ blindado |
| `src/pages/Compras.jsx` | 72 (`itensValidos.filter`) | ✅ blindado |

Pattern aplicado: `String(valor || '').trim()`.

---

## 3. Varredura completa do código fonte

Comando: `grep -nr "\([^()]*\|\|[^()]*\)\.trim()" src/`

Resultado: **todos** os `(x || y).trim()` restantes já têm `String(...)` na frente:

```
src/pages/Cadastros.jsx:310,321,324      → String(... || '').trim()  ✅
src/pages/Compras.jsx:72                  → String(it.descricao || '').trim()  ✅
src/pages/ComprasBuscaFornecedor.jsx:208,212,628,630,634,638  → String(... || '').trim()  ✅
src/pages/ComprasCatalogo.jsx:153–175     → String(... || '').trim()  ✅
src/pages/Faturamento.jsx:541             → String(... || ... || 'Sem Cliente').trim()  ✅
src/pages/LotesCliente.jsx:271            → String(... || ... || 'Sem Cliente').trim()  ✅
src/lib/supabase.js:3,4                   → (import.meta.env.X || '').trim()  ✅ (env vars são string|undefined)
```

`.trim()` em outros locais opera em variáveis de `useState('')` ou retorno de `String()` / template literal — todos type-safe.

---

## 4. Teste end-to-end local

Reproduzido o cenário exato que crashava antes:

1. `npm run build` → produziu `dist/assets/index-Bfkmr649.js`
2. `npm run preview -- --port 4173`
3. Navegador automatizado:
   - `/compras/cadastros/buscar`
   - Tab **Consultar CNPJ**
   - CNPJ `33.000.167/0001-01` (Petrobras)
   - Botão **Consultar**
4. Resultado: card renderizou completo (razão social, score 74 pts, situação ATIVA, regime fiscal, QSA com 9 sócios). **Zero erros no console.**

Conclusão: **o erro NÃO existe mais no código fonte atual.**

---

## 5. Por que o usuário ainda vê o erro

> O stack trace **continua referenciando `index-C1X-KTbM.js`**, que é o hash do bundle **anterior à correção**.

Vite gera um novo hash em cada build:
- Bundle com bug: `index-C1X-KTbM.js`
- Bundle corrigido: `index-Bfkmr649.js`

Se o navegador ainda carrega `C1X-KTbM`, **uma destas duas coisas está acontecendo**:

### Hipótese A — Deploy não foi feito
O Vercel (ou qualquer host) só serve o que foi deployado. As correções estão apenas no `dist/` local e/ou no working tree do git. Necessário:

```powershell
git add -A
git commit -m "fix: blindar .trim() em campos da API CNPJ"
git push
# aguardar Vercel buildar
```

Ou deploy manual (`vercel --prod`, etc.).

### Hipótese B — Cache do navegador / Service Worker
Mesmo após o deploy, o `index.html` antigo cacheado pode continuar pedindo `index-C1X-KTbM.js`. Soluções:

1. **Ctrl + Shift + R** (hard refresh)
2. DevTools → aba **Application** → **Clear storage** → "Clear site data"
3. DevTools → aba **Network** → marcar **"Disable cache"** e recarregar
4. Modo anônimo para confirmar

### Como validar
Em DevTools → **Network** → recarregar → procurar o arquivo `index-*.js`.
- Se for `index-C1X-KTbM.js` → ainda servindo bundle antigo (deploy ou cache)
- Se for `index-Bfkmr649.js` (ou outro hash novo) e o erro persistir → reabrir investigação

---

## 6. Histórico de edições aplicadas

| # | Arquivo | O que foi feito |
|---|---|---|
| 1 | `ComprasBuscaFornecedor.jsx` L208 | `(d.situacao_especial \|\| '')` → `String(d.situacao_especial \|\| '')` |
| 2 | `ComprasBuscaFornecedor.jsx` L212 | idem em `descricao_motivo_situacao_cadastral` |
| 3 | `ComprasBuscaFornecedor.jsx` L369 | `d.situacao_especial.trim()` → `String(d.situacao_especial).trim()` |
| 4 | `ComprasBuscaFornecedor.jsx` L628–638 (`buscar()`) | todos `produto`/`cidade` → `String(... \|\| '')` |
| 5 | `Compras.jsx` L72 | `it.descricao.trim()` → `String(it.descricao \|\| '').trim()` |
| 6 | `Compras.jsx` L72 | corrigida corrupção textual herdada de edição anterior (`'')scricao'`) |
| 7 | `ComprasBuscaFornecedor.jsx` L638 | corrigida corrupção textual (`String(cidade \|\| '')cidade: ...`) |

Build final: ✅ sucesso · hash `index-Bfkmr649.js` · SHA256 `7002EA54D500861DE5020B4A8FE9C772D182570E1C57291A3AB3422D17537AED`.

---

## 7. Próxima ação do usuário

1. `git push` (ou deploy direto) para publicar o bundle novo.
2. No navegador onde aparece o erro: **Ctrl+Shift+R** + verificar no DevTools que o arquivo carregado tem hash diferente de `C1X-KTbM`.
3. Reportar de volta com o **novo hash** se o erro persistir — só assim faz sentido continuar a investigação.
