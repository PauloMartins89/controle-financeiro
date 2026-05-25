const { execSync } = require('child_process')
try { require('qrcode') } catch(e) {
  execSync('npm install qrcode --no-save --prefix "C:/controle financeiros/public"', { stdio: 'inherit' })
}
const QRCode = require('qrcode')
const url = 'exp://192.168.0.105:8082'
QRCode.toDataURL(url, { width: 400, margin: 2 }, (err, dataUrl) => {
  if (err) { console.error(err); process.exit(1) }
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>QR Code - Expo SmartLider</title>
<style>
  body { background:#0D1B2A; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; margin:0; font-family:sans-serif; }
  img { border-radius:16px; box-shadow:0 0 40px rgba(34,197,94,0.3); }
  p { color:#22C55E; margin-top:20px; font-size:18px; font-weight:bold; }
  small { color:#94a3b8; font-size:13px; margin-top:6px; }
</style>
</head>
<body>
  <img src="${dataUrl}" width="300" height="300" />
  <p>Escaneie com a câmera do iPhone</p>
  <small>${url}</small>
</body>
</html>`
  require('fs').writeFileSync('C:/controle financeiros/public/qr-expo.html', html)
  console.log('QR gerado em: C:/controle financeiros/public/qr-expo.html')
})
