import { useEffect, useId, useState, type ReactNode } from 'react'
import type { Car } from '../types'
import { colorHex, modelImageUrl } from '../lib/carImage'
import { useApp } from '../data/AppData'
import type { Status } from '../domain/due'
import { Icon } from './Icon'

/** A side-view car drawn in the car's colour. Used when no photo exists. */
export function CarArt({ color, className }: { color?: string | null; className?: string }) {
  const body = colorHex(color ?? null)
  const id = useId().replace(/:/g, '')
  const wheel = (cx: number) => (
    <g>
      <circle cx={cx} cy="118" r="27" fill="#0d0f12" />
      <circle cx={cx} cy="118" r="18" fill={`url(#rim${id})`} />
      {[0, 72, 144, 216, 288].map(a => (
        <rect key={a} x={cx - 2} y="101" width="4" height="17" rx="2" fill="#5b636e" transform={`rotate(${a} ${cx} 118)`} />
      ))}
      <circle cx={cx} cy="118" r="4.5" fill="#2a2f36" />
    </g>
  )
  return (
    <svg className={className} viewBox="0 0 420 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`b${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".55" />
          <stop offset=".18" stopColor={body} stopOpacity="0" />
          <stop offset=".62" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".45" />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9fb3cc" />
          <stop offset=".45" stopColor="#2b3a4f" />
          <stop offset="1" stopColor="#111821" />
        </linearGradient>
        <radialGradient id={`rim${id}`}>
          <stop offset="0" stopColor="#d9dde3" />
          <stop offset="1" stopColor="#8a929d" />
        </radialGradient>
        <radialGradient id={`s${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="210" cy="146" rx="200" ry="11" fill={`url(#s${id})`} />
      {/* body */}
      <path
        d="M22 112 C18 96 24 84 44 80 L108 70 C134 46 166 32 206 30 L262 30 C292 31 316 44 340 66 L382 74 C402 78 410 90 408 106 L404 122 L360 124 A40 40 0 0 0 284 124 L148 124 A40 40 0 0 0 72 124 L28 122 Z"
        fill={body}
      />
      <path
        d="M22 112 C18 96 24 84 44 80 L108 70 C134 46 166 32 206 30 L262 30 C292 31 316 44 340 66 L382 74 C402 78 410 90 408 106 L404 122 L360 124 A40 40 0 0 0 284 124 L148 124 A40 40 0 0 0 72 124 L28 122 Z"
        fill={`url(#b${id})`}
      />
      {/* shoulder line + rocker */}
      <path d="M40 88 C140 80 300 78 396 86" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" fill="none" />
      <path d="M150 118 L282 118" stroke="#000" strokeOpacity=".25" strokeWidth="3" />
      {/* glass */}
      <path d="M122 70 C144 50 170 40 204 38 L230 38 L232 70 Z" fill={`url(#g${id})`} />
      <path d="M240 38 L262 38 C288 39 308 50 326 68 L242 70 Z" fill={`url(#g${id})`} />
      <path d="M232 38 L240 38 L242 72 L232 72 Z" fill="#0d1117" />
      <path d="M132 66 C150 50 168 44 186 42 L150 66 Z" fill="#fff" opacity=".18" />
      {/* doors, handles, mirror */}
      <path d="M236 72 L238 118 M150 74 C148 90 150 106 152 118 M326 72 C330 88 330 104 326 116" stroke="#000" strokeOpacity=".22" strokeWidth="1.2" fill="none" />
      <rect x="196" y="84" width="16" height="3" rx="1.5" fill="#000" opacity=".3" />
      <rect x="282" y="84" width="16" height="3" rx="1.5" fill="#000" opacity=".3" />
      <path d="M128 70 L114 66 L112 74 L126 76 Z" fill={body} />
      {/* lights */}
      <path d="M386 80 C396 82 402 86 404 92 L384 90 Z" fill="#fff4d6" />
      <path d="M26 86 L44 84 L42 94 L24 96 Z" fill="#c8102e" />
      {wheel(110)}
      {wheel(322)}
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

/** The car's own photo, else its studio render, else a drawing in its colour. */
export function CarImage({ car, className }: { car: Pick<Car, 'image_url' | 'color' | 'make' | 'model' | 'year'>; className?: string }) {
  const own = useFileUrl(car.image_url)
  const render = car.image_url ? null : modelImageUrl(car)
  const url = own ?? render
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
