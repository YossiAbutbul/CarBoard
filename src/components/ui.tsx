import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { Car } from '../types'
import { useApp } from '../data/AppData'
import type { Status } from '../domain/due'
import { Icon } from './Icon'

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

export function FileThumb({ fileRef, onOpen }: { fileRef: string; onOpen?: (url: string) => void }) {
  const url = useFileUrl(fileRef)
  if (!url)
    return (
      <span className="ic" style={{ width: 48, height: 36 }}>
        <Icon name="other" />
      </span>
    )
  return (
    <img
      src={url}
      alt=""
      onClick={e => {
        e.stopPropagation()
        onOpen?.(url)
      }}
    />
  )
}

/** A side panel. side="start" opens from the right (RTL start), "end" from the left. */
export function Drawer({ title, side, onClose, children }: { title: string; side: 'start' | 'end'; onClose(): void; children: ReactNode }) {
  const [leaving, setLeaving] = useState(false)
  const close = () => {
    setLeaving(true)
    setTimeout(onClose, 220)
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
      <aside className={`drawer ${side}`} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
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
export function useSwipeClose(onClose: () => void) {
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
      if (d.dy > el.offsetHeight * 0.25 || (fast && d.dy > 30)) {
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

export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  const { sheet, handle } = useSwipeClose(onClose)
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" ref={sheet} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="drag-zone" {...handle}>
          <div className="grab" />
          <div className="sheet-head">
            <h2>{title}</h2>
            <button onClick={onClose} aria-label="סגירה">
              <Icon name="close" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
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

export function Lightbox({ url, onClose }: { url: string; onClose(): void }) {
  // into <body>, above the bottom bar and any sheet
  return createPortal(
    <div className="lightbox" onClick={onClose}>
      <img src={url} alt="" />
    </div>,
    document.body,
  )
}
