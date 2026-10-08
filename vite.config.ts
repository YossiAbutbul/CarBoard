import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // the app shows an update banner; the user picks when to reload
      manifest: {
        name: 'CarBoard · הרכב שלי',
        short_name: 'CarBoard',
        description: 'כל נתוני הרכב במקום אחד: טיפולים, ק״מ, רישיון וביטוח',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        background_color: '#08111f',
        theme_color: '#0b1626',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      // The background-removal model (onnxruntime) loads on demand, so keep it out of the precache.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        globIgnores: ['**/ort*', '**/*.wasm'],
      },
    }),
  ],
})
