import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/version\.json/, /^\/limpar/, /^\/ag\//, /^\/ar\//, /^\/rc\//, /^\/vr\//],
        runtimeCaching: [
          {
            urlPattern: /\/version\.json/,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/limpar/,
            handler: 'NetworkOnly',
          },
        ],
      },
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Dividi Aí — Controle Financeiro',
        short_name: 'Dividi Aí',
        description: 'Controle Financeiro Inteligente',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
