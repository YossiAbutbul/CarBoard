import { useEffect, useState, type ReactNode } from 'react'
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

/** The car's uploaded image, or `empty` when it has none (or it fails to load). */
export function CarImage({ car, className, empty = null }: { car: Pick<Car, 'image_url'>; className?: string; empty?: ReactNode }) {
  const url = useFileUrl(car.image_url)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  if (url && !broken) return <img className={className} src={url} alt="" onError={() => setBroken(true)} />
  return <>{empty}</>
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
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <button onClick={onClose} aria-label="סגירה">
            <Icon name="close" />
          </button>
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
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={url} alt="" />
    </div>
  )
}
