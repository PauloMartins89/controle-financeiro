import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Service Worker: força atualização imediata ao carregar e a cada 1h
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return
      // Força verificação imediata de novo SW
      reg.update()
      // E a cada 1 hora
      setInterval(() => reg.update(), 60 * 60 * 1000)
    })
  })
}

// Detecta novo deploy via version.json — recarrega se versão mudou
;(function checkVersion() {
  const key = '__app_version__'
  fetch('/version.json?t=' + Date.now())
    .then(r => r.json())
    .then(({ v }) => {
      const saved = localStorage.getItem(key)
      if (saved && saved !== String(v)) {
        localStorage.setItem(key, String(v))
        window.location.reload()
      } else {
        localStorage.setItem(key, String(v))
      }
    })
    .catch(() => {})
  // Verifica a cada 5 minutos
  setInterval(checkVersion, 5 * 60 * 1000)
})()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
