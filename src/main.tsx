import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { UpdateBanner } from './components/UpdateBanner'
import './styles.css'
import './styles-pages.css'
import './styles-avatar.css'

// When a new deploy is downloaded, the update banner asks before reloading; an open app checks hourly.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('app-update', { detail: () => updateSW(true) }))
  },
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
  </StrictMode>,
)
