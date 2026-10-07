import { useEffect, useState, type ReactNode } from 'react'
import type { Car } from '../types'
import { colorHex } from '../lib/carImage'
import { useApp } from '../data/AppData'
import type { Status } from '../domain/due'

/** A side-view car drawn in the car's colour. Used when no photo exists. */
export function CarArt({ color, className }: { color?: string | null; className?: string }) {
  const body = colorHex(color ?? null)
  return (
    <svg className={className} viewBox="0 0 260 104" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <ellipse cx="132" cy="94" rx="112" ry="6" fill="rgba(0,0,0,.28)" />
      <path d="M14 74 Q12 58 28 54 L68 47 Q94 24 124 20 L166 20 Q192 22 214 44 L238 49 Q252 53 250 68 L248 78 L16 80 Z" fill={body} />
      <path d="M14 74 L250 70 L248 78 L16 80 Z" fill="rgba(0,0,0,.28)" />
      <path d="M80 47 Q100 28 124 25 L142 25 L142 47 Z M148 25 L166 25 Q186 27 204 46 L148 47 Z" fill="#1a2232" opacity=".92" />
      <path d="M86 44 Q102 31 120 28 L124 28 Z" fill="#fff" opacity=".28" />
      <rect x="236" y="56" width="12" height="5" rx="2" fill="#ffe7a8" />
      <rect x="15" y="58" width="8" height="5" rx="2" fill="#ff6b6b" />
      <circle cx="64" cy="78" r="17" fill="#111" />
      <circle cx="64" cy="78" r="9" fill="#a9b0bd" />
      <circle cx="202" cy="78" r="17" fill="#111" />
      <circle cx="202" cy="78" r="9" fill="#a9b0bd" />
    </svg>
  )
}

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

export function CarImage({ car, className }: { car: Pick<Car, 'image_url' | 'color'>; className?: string }) {
  const url = useFileUrl(car.image_url)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  if (url && !broken) return <img className={className} src={url} alt="" onError={() => setBroken(true)} />
  return <CarArt className={className} color={car.color} />
}

export function FileThumb({ fileRef, onOpen }: { fileRef: string; onOpen?: (url: string) => void }) {
  const url = useFileUrl(fileRef)
  if (!url) return <span className="ic" style={{ width: 48, height: 36 }}>📎</span>
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
          <button onClick={onClose} aria-label="סגירה">✕</button>
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
