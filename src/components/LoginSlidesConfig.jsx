import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { TrashIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const MAX_SLIDES = 5
const BUCKET = 'login-slides'

export default function LoginSlidesConfig() {
  const [slides, setSlides]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef()

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('login_slides')
      .select('*')
      .order('ordem', { ascending: true })
    if (!error) setSlides(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (slides.length >= MAX_SLIDES) {
      toast.error(`Limite de ${MAX_SLIDES} imagens atingido`)
      inputRef.current.value = ''
      return
    }
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${crypto.randomUUID()}.${ext}`
    setUploading(true)
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: false })
    if (upErr) {
      toast.error('Erro ao enviar: ' + upErr.message)
      setUploading(false)
      inputRef.current.value = ''
      return
    }
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    const { error: dbErr } = await supabase.from('login_slides').insert({
      nome: file.name,
      url: publicUrl,
      ordem: slides.length,
    })
    if (dbErr) {
      toast.error('Erro ao salvar: ' + dbErr.message)
      setUploading(false)
      inputRef.current.value = ''
      return
    }
    toast.success('Imagem adicionada!')
    setUploading(false)
    inputRef.current.value = ''
    load()
  }

  async function handleDelete(slide) {
    const parts = slide.url.split(`/${BUCKET}/`)
    const storagePath = parts[1]?.split('?')[0]
    if (storagePath) {
      await supabase.storage.from(BUCKET).remove([storagePath])
    }
    await supabase.from('login_slides').delete().eq('id', slide.id)
    toast.success('Imagem removida')
    load()
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Imagens do Slideshow de Login
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            {slides.length}/{MAX_SLIDES} imagens — exibidas em sequência na tela de login.
            {slides.length === 0 && ' Enquanto vazio, as imagens padrão do sistema serão usadas.'}
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading || slides.length >= MAX_SLIDES}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 8,
            cursor: (uploading || slides.length >= MAX_SLIDES) ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600,
            opacity: (uploading || slides.length >= MAX_SLIDES) ? 0.5 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          <ArrowUpTrayIcon style={{ width: 15, height: 15 }} />
          {uploading ? 'Enviando…' : 'Adicionar Imagem'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
          Carregando…
        </div>
      ) : slides.length === 0 ? (
        <div style={{
          padding: '40px 24px', textAlign: 'center', borderRadius: 12,
          border: '2px dashed var(--border)', background: 'var(--bg-secondary)',
        }}>
          <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}
            style={{ margin: '0 auto 10px', display: 'block', color: 'var(--text-secondary)', opacity: 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3 3h18M3 9.75h18" />
          </svg>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Nenhuma imagem configurada — as padrão do sistema serão exibidas
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {slides.map((s, i) => (
            <div
              key={s.id}
              style={{
                position: 'relative', borderRadius: 10, overflow: 'hidden',
                border: '1px solid var(--border)', aspectRatio: '16/9',
                background: '#0a1628',
              }}
            >
              <img
                src={s.url}
                alt={s.nome || `Slide ${i + 1}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Gradiente inferior */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
                pointerEvents: 'none',
              }} />
              {/* Número */}
              <div style={{
                position: 'absolute', bottom: 8, left: 10,
                fontSize: 11, color: '#fff', fontWeight: 700,
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}>
                #{i + 1}
              </div>
              {/* Botão excluir */}
              <button
                onClick={() => handleDelete(s)}
                title="Remover imagem"
                style={{
                  position: 'absolute', top: 7, right: 7,
                  background: 'rgba(239,68,68,0.88)', border: 'none',
                  borderRadius: 6, cursor: 'pointer', padding: 5,
                  display: 'flex', alignItems: 'center',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <TrashIcon style={{ width: 13, height: 13, color: '#fff' }} />
              </button>
            </div>
          ))}

          {/* Slot vazio indicando espaço restante */}
          {slides.length < MAX_SLIDES && (
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                aspectRatio: '16/9', border: '2px dashed var(--border)',
                borderRadius: 10, background: 'var(--bg-secondary)',
                cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, color: 'var(--text-secondary)', fontSize: 12,
                transition: 'border-color 0.15s',
              }}
            >
              <ArrowUpTrayIcon style={{ width: 20, height: 20, opacity: 0.5 }} />
              Adicionar
            </button>
          )}
        </div>
      )}
    </div>
  )
}
