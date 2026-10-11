import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(new Date().toISOString()) },
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
        background_color: '#1c69d4',
        theme_color: '#1c69d4',
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
        importScripts: ['push-sw.js'], // push reminders: show the notice, open the app on tap
      },
    }),
  ],
})
