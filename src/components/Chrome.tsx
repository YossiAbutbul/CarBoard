import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../data/AppData'
import { Icon } from './Icon'

/**
 * An Israeli plate: black digits on yellow, and on the left a blue euroband
 * with the flag, "IL", and the country name in Hebrew and Arabic.
 */
export function Plate({ number, size = 'md' }: { number: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className={`plate-il ${size}`} dir="ltr" aria-label={`מספר רישוי ${number}`}>
      <span className="band" aria-hidden="true">
        <svg className="flag" viewBox="0 0 22 16">
          <rect width="22" height="16" fill="#fff" />
          <rect y="1.6" width="22" height="2.2" fill="#0038b8" />
          <rect y="12.2" width="22" height="2.2" fill="#0038b8" />
          <path d="M11 4.6 L14.2 10.1 H7.8 Z M11 11.4 L7.8 5.9 H14.2 Z" fill="none" stroke="#0038b8" strokeWidth="0.9" />
        </svg>
        <b>IL</b>
        <small>ישראל</small>
        <small className="ar">إسرائيل</small>
      </span>
      <span className="num">{number}</span>
    </span>
  )
}

/** The bar on top of every page: cars on the right, the car in the middle, settings on the left. */
export function TopBar({ openCars, openSettings }: { openCars(): void; openSettings(): void }) {
  const { car } = useApp()
  return (
    <div className="bar">
      <button onClick={openCars} aria-label="הרכבים שלי">
        <Icon name="swap" />
      </button>
      <button className="title" onClick={openCars} aria-label="החלפת רכב">
        <span>
          {car?.name} <span className="caret">▾</span>
        </span>
        {car?.plate && <Plate number={car.plate} size="sm" />}
      </button>
      <button onClick={openSettings} aria-label="הגדרות">
        <Icon name="settings" />
      </button>
    </div>
  )
}

/** The dark header used by every page. */
export function PageHero({ children, dial }: { children: ReactNode; dial?: boolean }) {
  return (
    <section className="hero">
      {dial && <Dial />}
      {children}
    </section>
  )
}

/** A faint speedometer dial; the needle sweeps into place on load. */
export function Dial({ className = 'dial' }: { className?: string }) {
  const ticks = Array.from({ length: 41 }, (_, i) => -210 + i * 6)
  return (
    <svg className={className} viewBox="0 0 300 300" aria-hidden="true">
      <circle cx="150" cy="150" r="128" />
      <circle cx="150" cy="150" r="96" className="thin" />
      {ticks.map((a, i) => {
        const r1 = i % 5 === 0 ? 108 : 116
        const rad = (a * Math.PI) / 180
        return (
          <line
            key={a}
            x1={150 + Math.cos(rad) * r1}
            y1={150 + Math.sin(rad) * r1}
            x2={150 + Math.cos(rad) * 124}
            y2={150 + Math.sin(rad) * 124}
            className={i % 5 === 0 ? 'major' : ''}
          />
        )
      })}
      <g className="needle-g">
        <path d="M150 150 L232 92" className="needle" />
      </g>
      <circle cx="150" cy="150" r="5" className="hub" />
    </svg>
  )
}

/** Counts a number up from where it was (0 at first) to `value`. */
export function useCountUp(value: number, ms = 900) {
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(a + (value - a) * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return shown
}

/** Glass cells in the header. */
export function Glance({ children }: { children: ReactNode }) {
  return <div className="glance">{children}</div>
}

export function GlanceCell({
  k,
  v,
  d,
  s,
  onClick,
}: {
  k: string
  v: ReactNode
  d: ReactNode
  s?: string
  onClick?(): void
}) {
  return (
    <button data-s={s} onClick={onClick} disabled={!onClick}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      <span className="d">
        {s && <i />}
        {d}
      </span>
    </button>
  )
}

export function Splash() {
  return (
    <div className="splash">
      <Dial className="splash-dial" />
      <div className="splash-name">הרכב שלי</div>
    </div>
  )
}
