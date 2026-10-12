import { LoadingDial, Scene } from './Scene'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApp } from '../data/AppData'
import { MorphIcon } from './MorphIcon'
import { isWide, WIDE } from '../lib/wide'

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
      <button onClick={openCars} aria-label="הרכבים שלי" data-tour="cars">
        <MorphIcon kind="menu" open={false} />
      </button>
      <button className="title" onClick={openCars} aria-label="החלפת רכב">
        <span>
          {car?.name}
        </span>
        {car?.plate && <Plate number={car.plate} size="sm" />}
      </button>
      <button onClick={openSettings} aria-label="הגדרות" data-tour="settings">
        <MorphIcon kind="gear" open={false} />
      </button>
    </div>
  )
}

/** The dark header used by every page. */
export function PageHero({ children }: { children: ReactNode; dial?: boolean }) {
  const ref = useRef<HTMLElement>(null)
  // The card collapses as you scroll and stays pinned as a short header: the bar (CSS-sticky, so the
  // browser keeps it still), then the date and the greeting, shrunk under it. The status pill and the
  // summary row fade out. Only transforms and opacity change, so the page below never jumps.
  useEffect(() => {
    const el = ref.current
    const bar = el?.querySelector<HTMLElement>(':scope > .bar')
    const date = el?.querySelector<HTMLElement>(':scope > .greet .date') ?? null
    const title = el?.querySelector<HTMLElement>(':scope > .greet h1')
    if (!el || !bar || !title) return
    const page = el.parentElement
    const TITLE = 0.7 // greeting scale when collapsed
    let travel = 1 // how far the card scrolls before it sticks
    let dTitle = 0
    let dDate = 0
    const offset = (e: HTMLElement, upTo: HTMLElement | null) => {
      let y = 0
      for (let n: HTMLElement | null = e; n && n !== upTo; n = n.offsetParent as HTMLElement | null) y += n.offsetTop
      return y
    }
    const measure = () => {
      title.style.transform = ''
      if (date) date.style.transform = ''
      el.style.top = ''
      // a PC window: the header stays as it is (the cars and sections are beside it, not inside)
      if (isWide()) {
        el.style.removeProperty('--p')
        el.classList.remove('collapsed')
        if (page) page.style.minHeight = ''
        return
      }
      const top = offset(el, null) // ignores the page's entrance animation
      const barTop = parseFloat(getComputedStyle(bar).top) || 14
      const dateAt = barTop + bar.offsetHeight + 2
      const titleAt = dateAt + (date ? date.offsetHeight + 2 : 0)
      const headerBottom = titleAt + title.offsetHeight * TITLE + 14 // the collapsed card's bottom, on screen
      const stickAt = headerBottom - el.offsetHeight // the card's top, on screen
      el.style.top = `${stickAt}px`
      page?.style.setProperty('--hero-bottom', `${headerBottom}px`) // things that dock under the header
      travel = Math.max(1, top - stickAt)
      dTitle = titleAt - (stickAt + offset(title, el))
      dDate = date ? dateAt - (stickAt + offset(date, el)) : 0
      fitScroll()
      on()
    }
    // When the content overflows the screen, allow exactly enough scrolling to finish collapsing,
    // so a short page never stops half-way and a long one gains nothing. If it all fits, no scroll.
    const fitScroll = () => {
      if (!page) return
      page.style.minHeight = ''
      const doc = document.documentElement
      if (doc.scrollHeight - window.innerHeight <= 0) return // it all fits: no scrolling
      // Room to scroll the card fully closed, measured against the screen with the browser's
      // address bar hidden (100lvh): on phones it hides while scrolling, which makes the screen taller.
      const outside = doc.scrollHeight - page.offsetHeight // space above and below the page
      page.style.minHeight = `calc(100vh + ${Math.ceil(travel - outside)}px)`
      page.style.minHeight = `calc(100lvh + ${Math.ceil(travel - outside)}px)` // ignored where lvh is unknown
    }
    const on = () => {
      if (isWide()) return
      // a page that fits the screen never collapses (also not while a phone bounces past the edge)
      const canScroll = document.documentElement.scrollHeight - window.innerHeight > 1
      const p = canScroll ? Math.min(1, Math.max(0, window.scrollY / travel)) : 0
      el.style.setProperty('--p', String(p))
      title.style.transform = `translateY(${p * dTitle}px) scale(${1 - p * (1 - TITLE)})`
      if (date) date.style.transform = `translateY(${p * dDate}px)`
      el.classList.toggle('collapsed', p >= 1)
    }
    measure()
    // content below changes height (reminders added or deleted): fit the scroll again
    const content = page ? Array.from(page.children).filter(c => c !== el) : []
    const ro = new ResizeObserver(() => fitScroll())
    content.forEach(c => ro.observe(c))
    const mo = new MutationObserver(() => fitScroll()) // cards added or removed
    if (page) mo.observe(page, { childList: true, subtree: true })
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', measure)
    const mq = matchMedia(WIDE)
    mq.addEventListener('change', measure)
    // On a first load (or right after an update) the app's font arrives after this first measure, and
    // the header shrinks with it: measure again then, or the page keeps scroll room it does not need.
    let live = true
    document.fonts?.ready.then(() => live && measure())
    const onLoad = () => live && measure()
    window.addEventListener('load', onLoad)
    return () => {
      live = false
      window.removeEventListener('load', onLoad)
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', measure)
      mq.removeEventListener('change', measure)
      title.style.transform = ''
      if (date) date.style.transform = ''
      if (page) page.style.minHeight = ''
    }
  }, [])
  return (
    <section className="hero" ref={ref}>
      {/* the header's dial is part of the scene (drawn like the icon), on every page */}
      <Scene lite />
      {children}
    </section>
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
  tour,
}: {
  k: string
  v: ReactNode
  d: ReactNode
  s?: string
  onClick?(): void
  tour?: string
}) {
  return (
    <button data-s={s} onClick={onClick} disabled={!onClick} data-tour={tour}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
      <span className="d">
        {s && <i />}
        {d}
      </span>
    </button>
  )
}

/** When the app started; the splash can be mounted more than once while loading, and must not restart. */
const APP_START = performance.now()
export const sinceStart = () => performance.now() - APP_START

export function Splash() {
  // A negative delay picks the animations up where the first splash left them. Read once, when this
  // splash appears: a new value on a later render would move the running animation (it used to jump).
  const [since] = useState(() => -Math.round(sinceStart()))
  return (
    <div className="splash" style={{ '--since': `${since}ms` } as React.CSSProperties}>
      <LoadingDial />
      <div className="splash-name" dir="ltr">
        CarBoard
        <small>הרכב שלי</small>
      </div>
    </div>
  )
}
