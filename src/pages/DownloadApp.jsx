import { useState, useEffect } from 'react'

const GITHUB_REPO = 'PauloMartins89/smartpro-mobile'
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`

export default function DownloadApp() {
  const [release, setRelease] = useState(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(null)

  useEffect(() => {
    fetch(GITHUB_API)
      .then(r => r.json())
      .then(data => {
        if (data.message) throw new Error('Nenhum release encontrado')
        setRelease(data)
      })
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [])

  const apk = release?.assets?.find(a => a.name.endsWith('.apk'))
  const data = release?.published_at
    ? new Date(release.published_at).toLocaleString('pt-BR')
    : ''

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      fontFamily: 'Inter, sans-serif', padding: 24
    }}>
      <div style={{
        background: '#1e293b', borderRadius: 20, padding: '48px 40px',
        maxWidth: 480, width: '100%', textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0,0,0,0.4)', border: '1px solid #334155'
      }}>
        {/* Ícone */}
        <div style={{
          width: 80, height: 80, borderRadius: 20, background: '#3b82f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', fontSize: 36
        }}>
          📱
        </div>

        <h1 style={{ color: '#f1f5f9', margin: '0 0 8px', fontSize: 26, fontWeight: 700 }}>
          SmartLíder
        </h1>
        <p style={{ color: '#94a3b8', margin: '0 0 32px', fontSize: 15 }}>
          Aplicativo Android para líderes de campo
        </p>

        {loading && (
          <p style={{ color: '#64748b', fontSize: 14 }}>Buscando versão mais recente...</p>
        )}

        {erro && (
          <div style={{
            background: '#450a0a', border: '1px solid #7f1d1d',
            borderRadius: 10, padding: 16, color: '#fca5a5', fontSize: 14
          }}>
            Não foi possível carregar o download: {erro}
          </div>
        )}

        {release && apk && (
          <>
            <div style={{
              background: '#0f172a', borderRadius: 12, padding: '16px 20px',
              marginBottom: 24, textAlign: 'left', border: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>Versão</span>
                <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>{release.tag_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>Tamanho</span>
                <span style={{ color: '#e2e8f0', fontSize: 13 }}>{(apk.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: 13 }}>Publicado em</span>
                <span style={{ color: '#e2e8f0', fontSize: 13 }}>{data}</span>
              </div>
            </div>

            <a
              href={apk.browser_download_url}
              style={{
                display: 'block', background: '#3b82f6', color: '#fff',
                padding: '16px 24px', borderRadius: 12, textDecoration: 'none',
                fontWeight: 700, fontSize: 17, letterSpacing: 0.3,
                boxShadow: '0 4px 20px rgba(59,130,246,0.4)',
                transition: 'background 0.2s'
              }}
              onMouseOver={e => e.currentTarget.style.background = '#2563eb'}
              onMouseOut={e => e.currentTarget.style.background = '#3b82f6'}
            >
              ⬇ Baixar APK
            </a>

            <p style={{ color: '#475569', fontSize: 12, marginTop: 16 }}>
              Após baixar, abra o arquivo no Android e permita "Instalar apps de fontes desconhecidas"
            </p>
          </>
        )}

        {release && !apk && (
          <p style={{ color: '#f59e0b', fontSize: 14 }}>APK não encontrado neste release.</p>
        )}
      </div>
    </div>
  )
}
