import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackLayer } from '../lib/back'

interface Ask {
  title: string
  text?: string
  confirm?: string // the confirming button's label
  cancel?: string
  danger?: boolean // a red confirming button (delete, discard)
}

let show: ((a: Ask & { done(ok: boolean): void }) => void) | null = null

/** Ask a yes/no question in a centered dialog; resolves true when confirmed. */
export function ask(a: Ask): Promise<boolean> {
  return new Promise(done => (show ? show({ ...a, done }) : done(window.confirm(a.title))))
}

/** Mounted once next to the app; renders the dialog `ask` opens. */
export function DialogHost() {
  const [cur, setCur] = useState<(Ask & { done(ok: boolean): void }) | null>(null)
  useEffect(() => {
    show = setCur
    return () => {
      show = null
    }
  }, [])
  useEffect(() => {
    if (!cur) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' && e.key !== 'Enter') return
      e.stopImmediatePropagation() // the sheet behind must not see it
      answer(e.key === 'Enter')
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }) // eslint-disable-line react-hooks/exhaustive-deps
  useBackLayer(Boolean(cur), () => answer(false))
  if (!cur) return null
  function answer(ok: boolean) {
    cur!.done(ok)
    setCur(null)
  }
  return createPortal(
    <div className="dialog-overlay" onClick={() => answer(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={cur.title} onClick={e => e.stopPropagation()}>
        <b>{cur.title}</b>
        {cur.text && <p>{cur.text}</p>}
        <div className="dialog-btns">
          <button className="dialog-cancel" onClick={() => answer(false)}>
            {cur.cancel ?? 'ביטול'}
          </button>
          <button className={`dialog-ok ${cur.danger ? 'danger' : ''}`} onClick={() => answer(true)} autoFocus>
            {cur.confirm ?? 'אישור'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
