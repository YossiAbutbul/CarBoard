import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { UpdateBanner } from './components/UpdateBanner'
import { DialogHost } from './components/Dialog'
import './styles.css'
import './styles-pages.css'
import './styles-avatar.css'

// When a new deploy is downloaded, the update banner asks before reloading; an open app checks hourly.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // often found at startup, before the banner is on screen: keep it for the banner to pick up
    const apply = () => updateSW(true)
    ;(window as unknown as { __pendingUpdate?: () => void }).__pendingUpdate = apply
    window.dispatchEvent(new CustomEvent('app-update', { detail: apply }))
  },
  onRegisteredSW(_url, reg) {
    if (reg) setInterval(() => reg.update(), 60 * 60 * 1000)
  },
})

// A family invite link (?join=CODE): keep the code (through sign-in, if needed) and tidy the address.
const join = new URLSearchParams(location.search).get('join')
if (join) {
  try {
    localStorage.setItem('car-records:join', join)
  } catch {
    // storage blocked: the code can still be typed in settings
  }
  history.replaceState(null, '', location.pathname)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <UpdateBanner />
    <DialogHost />
  </StrictMode>,
)
