import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackLayer } from '../lib/back'

/*
 * Opened in the browser instead of from the home screen: suggest installing, on the sign-in screen
 * or once the person is in the app (not during the first-run guide or the tour). Android and desktop Chrome get the
 * browser's own install; iPhones get the two steps, since Safari has no install button for sites.
 * "Not now" is remembered for two weeks.
 */

interface InstallEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const KEY = 'car-records:install-later'
const LATER = 14 * 24 * 60 * 60 * 1000

let deferred: InstallEvent | null = null
// fires early, often before React is up: keep it
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault() // no mini-bar of the browser's own; we ask at a better moment
  deferred = e as InstallEvent
  window.dispatchEvent(new Event('install-ready'))
})
window.addEventListener('appinstalled', () => {
  deferred = null
})

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const snoozed = () => {
  try {
    return Date.now() - Number(localStorage.getItem(KEY) ?? 0) < LATER
  } catch {
    return false
  }
}
// on the sign-in screen, or in the app itself, with nothing else on top
const settled = () =>
  Boolean(document.querySelector('[data-tour=cars], .welcome.login')) && !document.querySelector('.tour, .onb, .sheet, .drawer, .dialog-overlay')

export function InstallPrompt() {
  // after "install": `installing` until the browser says it is done, then `installed`
  const [mode, setMode] = useState<'prompt' | 'ios' | 'installing' | 'installed' | null>(null)

  useEffect(() => {
    const done = () => setMode(m => (m === 'installing' ? 'installed' : m))
    window.addEventListener('appinstalled', done)
    return () => window.removeEventListener('appinstalled', done)
  }, [])

  useEffect(() => {
    if (standalone() || snoozed()) return
    let timer = 0
    const check = () => {
      if (!(deferred || isIos())) return
      if (!settled()) return void (timer = window.setTimeout(check, 3000))
      setMode(deferred ? 'prompt' : 'ios')
    }
    timer = window.setTimeout(check, 4000)
    const onReady = () => {
      clearTimeout(timer)
      timer = window.setTimeout(check, 4000)
    }
    window.addEventListener('install-ready', onReady)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('install-ready', onReady)
    }
  }, [])

  const later = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()))
    } catch {
      // storage blocked: it may ask again next visit
    }
    setMode(null)
  }
  const after = mode === 'installing' || mode === 'installed'
  const close = after ? () => setMode(null) : later
  useBackLayer(mode !== null, close)
  if (!mode) return null

  const install = async () => {
    const e = deferred
    if (!e) return later()
    await e.prompt()
    const { outcome } = await e.userChoice
    deferred = null
    if (outcome === 'accepted') setMode('installing')
    else later()
  }

  return createPortal(
    <div className="dialog-overlay" onClick={close}>
      <div className="dialog install" role="dialog" aria-modal="true" aria-label="התקנת CarBoard" onClick={e => e.stopPropagation()}>
        <img src="/icon-192.png" alt="" width={64} height={64} />
        {mode === 'installing' ? (
          <>
            <b>
              <span className="spin install-spin" /> מתקינים…
            </b>
            <p>אפשר לסגור את הדפדפן. בעוד רגע CarBoard תופיע במסך הבית, ומשם פותחים אותה.</p>
          </>
        ) : mode === 'installed' ? (
          <>
            <b>CarBoard מותקנת</b>
            <p>פותחים אותה מהמסך הראשי. את הדפדפן אפשר לסגור.</p>
          </>
        ) : (
          <>
            <b>התקינו את CarBoard</b>
            <p>נפתחת מהמסך הראשי כמו אפליקציה, במסך מלא, ושולחת תזכורות לטלפון.</p>
          </>
        )}
        {after ? (
          <div className="dialog-btns one">
            <button className="dialog-ok" onClick={close}>
              הבנתי
            </button>
          </div>
        ) : mode === 'ios' ? (
          <>
            <ol className="install-steps">
              <li>
                מקישים על <ShareGlyph /> <span>שיתוף</span>
              </li>
              <li>
                בוחרים <span>הוספה למסך הבית</span>
              </li>
            </ol>
            <div className="dialog-btns one">
              <button className="dialog-ok" onClick={later}>
                הבנתי
              </button>
            </div>
          </>
        ) : (
          <div className="dialog-btns">
            <button className="dialog-cancel" onClick={later}>
              לא עכשיו
            </button>
            <button className="dialog-ok" onClick={install} autoFocus>
              התקנה
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

// the iPhone share icon: a box with an arrow up
function ShareGlyph() {
  return (
    <svg className="share-glyph" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
