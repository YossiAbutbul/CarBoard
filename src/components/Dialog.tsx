import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackLayer } from '../lib/back'
import { useKeyboardInset } from '../lib/keyboard'

interface Ask {
  title: string
  text?: string
  confirm?: string // the confirming button's label
  cancel?: string
  danger?: boolean // a red confirming button (delete, discard)
  input?: { value: string; placeholder?: string } // a text field: the answer is its text
}

type Open = Ask & { done(ok: boolean, text: string): void }
let show: ((a: Open) => void) | null = null

/** Ask a yes/no question in a centered dialog; resolves true when confirmed. */
export function ask(a: Ask): Promise<boolean> {
  return new Promise(done => (show ? show({ ...a, done: ok => done(ok) }) : done(window.confirm(a.title))))
}

/** Ask for a line of text in a centered dialog; resolves to the text, or null when cancelled. */
export function askText(a: Ask & { input: { value: string; placeholder?: string } }): Promise<string | null> {
  return new Promise(done => (show ? show({ ...a, done: (ok, text) => done(ok ? text : null) }) : done(window.prompt(a.title, a.input.value))))
}

/** Mounted once next to the app; renders the dialog `ask` opens. */
export function DialogHost() {
  const [cur, setCur] = useState<Open | null>(null)
  const [text, setText] = useState('')
  useEffect(() => {
    show = a => {
      setText(a.input?.value ?? '')
      setCur(a)
    }
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
  const overlay = useKeyboardInset<HTMLDivElement>(Boolean(cur)) // keeps the dialog above the phone's keyboard
  if (!cur) return null
  function answer(ok: boolean) {
    cur!.done(ok, text.trim())
    setCur(null)
  }
  return createPortal(
    <div className="dialog-overlay" ref={overlay} onClick={() => answer(false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={cur.title} onClick={e => e.stopPropagation()}>
        <b>{cur.title}</b>
        {cur.text && <p>{cur.text}</p>}
        {cur.input && (
          <input className="in dialog-in" autoFocus value={text} placeholder={cur.input.placeholder} onChange={e => setText(e.target.value)} />
        )}
        <div className="dialog-btns">
          <button className="dialog-cancel" onClick={() => answer(false)}>
            {cur.cancel ?? 'ביטול'}
          </button>
          <button className={`dialog-ok ${cur.danger ? 'danger' : ''}`} onClick={() => answer(true)} autoFocus={!cur.input}>
            {cur.confirm ?? 'אישור'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
