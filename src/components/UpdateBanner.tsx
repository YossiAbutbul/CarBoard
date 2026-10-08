import { useEffect, useState } from 'react'
import { Icon } from './Icon'

/** "A new version is ready": shown when the service worker has a new deploy waiting. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<(() => void) | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    // an update found before this banner was on screen
    const waiting = (window as unknown as { __pendingUpdate?: () => void }).__pendingUpdate
    if (waiting) setUpdate(() => waiting)
    const on = (e: Event) => setUpdate(() => (e as CustomEvent<() => void>).detail)
    window.addEventListener('app-update', on)
    return () => window.removeEventListener('app-update', on)
  }, [])
  if (!update) return null
  return (
    <div className="update-banner" role="status">
      <span className="update-dot" />
      <span className="update-text">גרסה חדשה זמינה</span>
      <button
        className="update-go"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          update()
        }}
      >
        {busy ? <span className="spin" /> : 'עדכון'}
      </button>
      <button className="update-x" onClick={() => setUpdate(null)} aria-label="אחר כך">
        <Icon name="close" />
      </button>
    </div>
  )
}
