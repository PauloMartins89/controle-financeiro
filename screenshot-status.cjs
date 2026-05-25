const { chromium } = require('playwright')
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: 390, height: 844 })

  // Tela APROVADO (enviado_restaurante)
  await page.goto('http://localhost:8083/solicitacao/pedido-status?id=ebb4b8a6-0e19-478f-a9f4-e00a5a86d276&numero=REF-2026-000041&equipe=EQ-F07&restaurante=COMIDA%20MINEIRA&qtdRef=4&qtdCafe=0&total=72.12&data=2026-05-25')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'C:/controle financeiros/public/tela de login/screen-aprovado.png' })
  console.log('aprovado ok')

  // Tela REPROVADO
  await page.goto('http://localhost:8083/solicitacao/pedido-status?id=783345a5-3cad-4e04-b230-9e78ded0fd47&numero=REF-2026-000042&equipe=EQ-F07&restaurante=COMIDA%20MINEIRA&qtdRef=4&qtdCafe=0&total=72.12&data=2026-05-25')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'C:/controle financeiros/public/tela de login/screen-reprovado.png' })
  console.log('reprovado ok')

  await browser.close()
})()
