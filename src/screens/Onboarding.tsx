import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { Scene } from '../components/Scene'
import { Brand } from '../components/Brand'
import { Plate } from '../components/Chrome'
import { CarToy } from '../components/CarAvatar'
import type { Car } from '../types'

const KEY = 'car-records:onboarded'

export function isOnboarded() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
export function markOnboarded() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: the guide shows again next visit
  }
}

/** First run, before there is a car: hello, your name, then your car. */
export function Intro({ name, onName, onAddCar }: { name: string; onName(n: string): void; onAddCar(): void }) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState(name)
  const next = () => {
    if (step === 1) onName(draft.trim())
    setStep(s => s + 1)
  }
  const first = draft.trim().split(' ')[0]

  return (
    <div className="onb">
      <Scene />
      <div className="onb-dots" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <i key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="onb-step" key="0">
          <Brand />
          <h1>
            כל הרכב.
            <br />
            במקום אחד.
          </h1>
          <p>טסט, ביטוח, טיפולים וק״מ. נזכיר לך לפני שמשהו מגיע, ונשמור כל קבלה ומסמך.</p>
          <button className="btn onb-cta" onClick={next}>
            בואו נתחיל <Icon name="forward" />
          </button>
        </div>
      )}

      {step === 1 && (
        <form
          className="onb-step"
          key="1"
          onSubmit={e => {
            e.preventDefault()
            next()
          }}
        >
          <div className="eyebrow">שלב 1 מתוך 2</div>
          <h1>איך קוראים לך?</h1>
          <p>כדי שנדע איך לפנות אליך.</p>
          <input className="in onb-in" autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="השם שלך" enterKeyHint="next" />
          <button className="btn onb-cta" type="submit">
            {draft.trim() ? 'המשך' : 'דילוג'} <Icon name="forward" />
          </button>
        </form>
      )}

      {step === 2 && (
        <div className="onb-step" key="2">
          <div className="eyebrow">שלב 2 מתוך 2</div>
          <h1>{first ? `נעים מאוד, ${first}.` : 'נעים מאוד.'}</h1>
          <p>עכשיו הרכב. מספיק מספר הרישוי: את היצרן, הדגם, הצבע ותוקף הטסט נביא ממשרד התחבורה.</p>
          <button className="btn onb-cta" onClick={onAddCar}>
            <Icon name="plus" /> הוספת הרכב
          </button>
          <button className="onb-back" onClick={() => setStep(1)}>
            חזרה
          </button>
        </div>
      )}
    </div>
  )
}

/** After the first car is saved: a pause before the tour. */
export function Ready({ name, car, onStart, onSkip }: { name: string; car: Car; onStart(): void; onSkip(): void }) {
  const first = name.trim().split(' ')[0]
  return (
    <div className="onb">
      <Scene />
      <div className="onb-dots" aria-hidden="true">
        {[0, 1, 2, 3].map(i => (
          <i key={i} className={i === 3 ? 'on' : 'done'} />
        ))}
      </div>
      <div className="onb-step ready">
        <div className="ready-car">
          <CarToy car={car} className="ready-toy" />
          {car.plate && <Plate number={car.plate} />}
        </div>
        <div className="eyebrow">
          <Icon name="check" /> הרכב נוסף
        </div>
        <h1>{first ? `הכל מוכן, ${first}.` : 'הכל מוכן.'}</h1>
        <p>הוספנו תזכורות לטסט, לטיפול, לביטוח ועוד. בוא נעשה סיור קצר במסך הבית, פחות מדקה.</p>
        <button className="btn onb-cta" onClick={onStart}>
          בוא נתחיל <Icon name="forward" />
        </button>
        <button className="onb-back" onClick={onSkip}>
          דילוג על הסיור
        </button>
      </div>
    </div>
  )
}

interface Stop {
  target: string // data-tour value; empty = no spotlight
  title: string
  text: string
}

const stops = (name: string): Stop[] => [
  { target: 'km', title: 'הק״מ של הרכב', text: 'נעריך אותו כל יום לפי הנסיעות שלך, ופעם בשבוע נבקש לאשר. לחיצה מעדכנת.' },
  { target: 'service', title: 'הטיפול הבא', text: 'לפי ק״מ או לפי תאריך, מה שמגיע קודם. אחרי טיפול הוא זז לבד.' },
  { target: 'test', title: 'טסט', text: 'התאריך הגיע ממשרד התחבורה. אפשר לצרף צילום של הרישיון.' },
  { target: 'actions', title: 'פעולות מהירות', text: 'עדכון ק״מ, תזכורת חדשה, טיפול שעשית או מסמך.' },
  { target: 'tiles', title: 'מצב הרכב', text: 'כל התזכורות. לחיצה על כרטיס פותחת פרטים, היסטוריה וקבלות.' },
  { target: 'cars', title: 'הרכבים שלך', text: 'כאן מחליפים רכב או מוסיפים עוד אחד.' },
  { target: 'settings', title: 'הגדרות', text: 'השם שלך, ייצוא ליומן של הטלפון, והסיור הזה שוב.' },
  { target: 'nav', title: 'טיפולים ומסמכים', text: 'כל הטיפולים לפי סדר, וכל המסמכים והקבצים במקום אחד.' },
  { target: '', title: name ? `זהו, ${name}.` : 'זהו.', text: 'הכל מוכן. נזכיר לך לפני כל מועד.' },
]

type Rect = { top: number; left: number; width: number; height: number }

/** A spotlight walk over the home screen. Elements opt in with data-tour="…". */
export function Tour({ name, onDone }: { name: string; onDone(): void }) {
  const list = stops(name)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  // Hidden until the first target stops moving (the home screen slides in under it),
  // so the spotlight starts in place instead of sliding after it.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 1200) // never wait longer than this
    return () => clearTimeout(t)
  }, [])
  const stop = list[i]
  const last = i === list.length - 1

  // follow the target while it scrolls into view and the page settles
  useLayoutEffect(() => {
    const el = stop.target ? document.querySelector<HTMLElement>(`[data-tour="${stop.target}"]`) : null
    if (!el) {
      setRect(null)
      setSettled(true)
      return
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    let raf = 0
    let last: Rect | null = null
    let still = performance.now()
    const tick = () => {
      const r = el.getBoundingClientRect()
      const same = (p: Rect | null) => p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height
      setRect(p => (same(p) ? p : { top: r.top, left: r.left, width: r.width, height: r.height }))
      if (!same(last)) {
        last = { top: r.top, left: r.left, width: r.width, height: r.height }
        still = performance.now()
      } else if (performance.now() - still > 120) setSettled(true)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [stop.target])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      if (e.key === 'ArrowLeft' || e.key === 'Enter') last ? onDone() : setI(x => x + 1)
      if (e.key === 'ArrowRight') setI(x => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onDone])

  const pad = 8
  const vh = window.innerHeight
  const below = rect ? rect.top + rect.height / 2 < vh / 2 : false
  const cardStyle: React.CSSProperties = !rect
    ? { top: '50%', transform: 'translateY(-50%)' }
    : below
      ? { top: Math.min(rect.top + rect.height + pad + 12, vh - 220) }
      : { bottom: Math.max(vh - rect.top + pad + 12, 16) }

  return createPortal(
    <div className={`tour ${settled ? '' : 'settling'}`} role="dialog" aria-modal="true" aria-label="סיור באפליקציה">
      <div
        className={`tour-hole ${rect ? '' : 'none'}`}
        style={rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : undefined}
      />
      <div className="tour-card" style={cardStyle}>
        <div className="tour-progress" aria-hidden="true">
          <i style={{ width: `${((i + 1) / list.length) * 100}%` }} />
        </div>
        <div className="tour-body" key={i}>
          <span className="tour-count">
            {i + 1} מתוך {list.length}
          </span>
          <b>{stop.title}</b>
          <p>{stop.text}</p>
        </div>
        <div className="tour-bar">
          <button className="tour-btn pri" onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? 'יאללה' : 'הבא'}
            {!last && <Icon name="forward" />}
          </button>
          {i > 0 && (
            <button className="tour-btn" onClick={() => setI(i - 1)}>
              הקודם
            </button>
          )}
          {!last && (
            <button className="tour-skip" onClick={onDone}>
              דילוג
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
