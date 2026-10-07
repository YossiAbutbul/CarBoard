import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'הרכב שלי',
        short_name: 'הרכב שלי',
        description: 'כל נתוני הרכב במקום אחד: טיפולים, ק״מ, רישיון וביטוח',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        background_color: '#eef0f3',
        theme_color: '#0b1626',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      // The background-removal model (onnxruntime) loads on demand, so keep it out of the precache.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/ort*', '**/*.wasm'],
      },
    }),
  ],
})
