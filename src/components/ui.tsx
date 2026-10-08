import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Car } from '../types'
import { useApp } from '../data/AppData'
import type { Status } from '../domain/due'
import { Icon } from './Icon'
import { ask } from './Dialog'
import { useBackLayer } from '../lib/back'
import { PdfThumb, useFile } from './FileViewer'

/** Resolves a stored file ref (idb:/sb:/https:) to a URL the browser can show. */
export function useFileUrl(ref: string | null | undefined) {
  const { actions } = useApp()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!ref) {
      setUrl(null)
      return
    }
    actions.fileUrl(ref).then(u => live && setUrl(u || null)).catch(() => live && setUrl(null))
    return () => {
      live = false
    }
  }, [ref, actions])
  return url
}

/** A small preview of an uploaded photo or PDF. */
export function FileThumb({ fileRef, onOpen }: { fileRef: string; onOpen?: () => void }) {
  const f = useFile(fileRef)
  const open = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpen?.()
  }
  if (!f)
    return (
      <span className="ic" style={{ width: 48, height: 36 }}>
        <span className="spin" style={{ width: 14, height: 14 }} />
      </span>
    )
  if (f.pdf)
    return (
      <button type="button" className="file-thumb" onClick={open} aria-label="פתיחת הקובץ">
        <PdfThumb url={f.url} width={56} />
      </button>
    )
  return <img src={f.url} alt="" onClick={open} />
}

/** A side panel. side="start" opens from the right (RTL start), "end" from the left. */
export function Drawer({ title, side, onClose, children }: { title: string; side: 'start' | 'end'; onClose(): void; children: ReactNode }) {
  const [leaving, setLeaving] = useState(false)
  const close = () => {
    setLeaving(true)
    setTimeout(onClose, 220)
  }
  useBackLayer(true, close)
  // Drag the panel back toward its edge to close it (start = right edge in RTL, end = left).
  const panel = useRef<HTMLElement>(null)
  const drag = useRef<{ x: number; y: number; t: number; dx: number; axis: 'x' | 'y' | null } | null>(null)
  const dir = side === 'start' ? 1 : -1 // the direction that closes it
  const touch = {
    onTouchStart(e: React.TouchEvent) {
      const p = e.touches[0]
      drag.current = { x: p.clientX, y: p.clientY, t: Date.now(), dx: 0, axis: null }
    },
    onTouchMove(e: React.TouchEvent) {
      const d = drag.current
      const el = panel.current
      if (!d || !el) return
      const p = e.touches[0]
      const dx = p.clientX - d.x
      const dy = p.clientY - d.y
      if (!d.axis && Math.hypot(dx, dy) > 8) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.axis !== 'x') return
      d.dx = dir > 0 ? Math.max(0, dx) : Math.min(0, dx)
      el.style.animation = 'none'
      el.style.transition = 'none'
      el.style.transform = `translateX(${d.dx}px)`
    },
    onTouchEnd() {
      const d = drag.current
      const el = panel.current
      drag.current = null
      if (!d || !el || d.axis !== 'x') return
      const fast = Math.abs(d.dx) / Math.max(1, Date.now() - d.t) > 0.5
      el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)'
      if (Math.abs(d.dx) > el.offsetWidth * 0.3 || (fast && Math.abs(d.dx) > 30)) {
        el.style.transform = `translateX(${dir * 100}%)`
        setTimeout(onClose, 200)
      } else el.style.transform = ''
    },
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className={`drawer-overlay ${leaving ? 'out' : ''}`} onClick={close}>
      <aside ref={panel} className={`drawer ${side}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} {...touch}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button onClick={close} aria-label="סגירה">
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  )
}

/**
 * Drag a bottom sheet down by its handle to close it. Spread `handle` on the drag area
 * (the handle and title) and put `sheet` on the panel. Buttons inside the area still click.
 */
export function useSwipeClose(onClose: () => void, mustAsk?: () => boolean) {
  const sheet = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null)
  const backdrop = (o: string) => {
    const b = sheet.current?.parentElement
    if (b) b.style.background = o
  }
  const handle = {
    onPointerDown(e: React.PointerEvent<HTMLElement>) {
      if ((e.target as Element).closest('button, input')) return
      drag.current = { y: e.clientY, t: Date.now(), dy: 0 }
      e.currentTarget.setPointerCapture(e.pointerId)
      if (sheet.current) sheet.current.style.transition = 'none'
    },
    onPointerMove(e: React.PointerEvent<HTMLElement>) {
      const d = drag.current
      if (!d || !sheet.current) return
      d.dy = Math.max(0, e.clientY - d.y)
      sheet.current.style.transform = `translateY(${d.dy}px)`
      backdrop(`rgba(11, 22, 38, ${0.45 * Math.max(0, 1 - d.dy / sheet.current.offsetHeight)})`)
    },
    onPointerUp() {
      const d = drag.current
      drag.current = null
      const el = sheet.current
      if (!d || !el) return
      const fast = d.dy / Math.max(1, Date.now() - d.t) > 0.5 // a quick flick also closes
      el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)'
      if ((d.dy > el.offsetHeight * 0.25 || (fast && d.dy > 30)) && mustAsk?.()) {
        // unsaved changes: spring back and ask first
        el.style.transform = ''
        backdrop('')
        onClose()
      } else if (d.dy > el.offsetHeight * 0.25 || (fast && d.dy > 30)) {
        el.style.transform = 'translateY(100%)'
        backdrop('rgba(11, 22, 38, 0)')
        setTimeout(onClose, 200)
      } else {
        el.style.transform = ''
        backdrop('')
      }
    },
  }
  return { sheet, handle: { ...handle, onPointerCancel: handle.onPointerUp } }
}

/** True once any of `values` differs from what it was when the sheet opened. */
export function useDirty(values: unknown[]) {
  const [start] = useState(() => JSON.stringify(values))
  return JSON.stringify(values) !== start
}

/**
 * A bottom sheet. With `dirty` (unsaved edits), closing it any way (✕, tapping outside, swiping
 * down, Escape, the phone's back button) asks first.
 */
export function Sheet({ title, onClose, dirty = false, children }: { title: string; onClose(): void; dirty?: boolean; children: ReactNode }) {
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const requestClose = async () => {
    if (dirtyRef.current) {
      const leave = await ask({ title: 'לצאת בלי לשמור?', text: 'השינויים שעשית לא יישמרו.', confirm: 'יציאה', cancel: 'המשך עריכה', danger: true })
      if (!leave) return false
    }
    onClose()
    return true
  }
  useBackLayer(true, requestClose)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && requestClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps
  const { sheet, handle } = useSwipeClose(() => void requestClose(), () => dirtyRef.current)
  // into <body>: a sheet can open over another sheet (and is never caught in a page's animation)
  return createPortal(
    <div className="overlay" onClick={() => requestClose()}>
      <div className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="drag-zone" {...handle}>
          <div className="grab" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button onClick={() => requestClose()} aria-label="סגירה">
              <Icon name="close" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

const STATUS_COLOR: Record<Status, string> = {
  ok: 'var(--g)',
  soon: 'var(--y)',
  due: 'var(--o)',
  overdue: 'var(--r)',
  unset: '#c8c7c1',
}
export const statusColor = (s: Status) => STATUS_COLOR[s]

export function Ring({ progress, color, children }: { progress: number; color: string; children: ReactNode }) {
  const p = Math.round(Math.max(0, Math.min(1, progress)) * 100)
  return (
    <div className="ring" style={{ background: `conic-gradient(${color} 0 ${p}%, rgba(255,255,255,.14) 0)` }}>
      <div>{children}</div>
    </div>
  )
}

