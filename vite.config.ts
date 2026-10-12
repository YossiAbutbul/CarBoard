import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// The calendar event (/api/event) is a Vercel function; in development the dev server runs it itself
const devEvent: Plugin = {
  name: 'dev-api-event',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/event', async (req, res) => {
      req.url = req.originalUrl ?? req.url
      const { default: handler } = await server.ssrLoadModule('/server/event.ts')
      handler(req, res)
    })
  },
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    devEvent,
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
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,woff2}'], // mjs: the PDF worker, so it matches the app's version
        globIgnores: ['**/ort*', '**/*.wasm'],
        navigateFallbackDenylist: [/^\/api\//], // the server's own pages (the calendar event), never the app
        importScripts: ['push-sw.js'], // push reminders: show the notice, open the app on tap
      },
    }),
  ],
})
