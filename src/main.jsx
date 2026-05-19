import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Quando o Service Worker instala uma nova versão e assume o controle,
// força reload para garantir que o usuário veja a versão atualizada.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })

  // Verifica atualização do SW a cada 1 hora (bypass do throttle de 24h do browser)
  setInterval(() => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) reg.update()
    })
  }, 60 * 60 * 1000)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
