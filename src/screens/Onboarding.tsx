import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { Scene } from '../components/Scene'
import { Brand } from '../components/Brand'
import { Plate } from '../components/Chrome'
import { CarToy } from '../components/CarAvatar'
import type { Car } from '../types'
import { useApp } from '../data/AppData'
import { PlateInput, usePlateLookup } from '../components/PlateField'
import { formatPlate, plateDigits } from '../lib/govil'
import { userMessage } from '../lib/errors'
import { YEARLY_CHOICES } from '../domain/odometer'

const KEY = 'car-records:onboarded'

export function isOnboarded() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
/** Signing out: whoever uses the app next on this device (a guest, another account) gets the first run. */
export function resetOnboarded() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // storage blocked
  }
}
export function markOnboarded() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // storage blocked: the guide shows again next visit
  }
}

/** The top of every first-run screen: a back arrow (none on the first screen) and the progress dots. */
function OnbTop({ step, onBack }: { step: number; onBack?: () => void }) {
  return (
    <div className="onb-top">
      {onBack && (
        <button className="onb-arrow" onClick={onBack} aria-label="חזרה">
          <Icon name="back" />
        </button>
      )}
      <div className="onb-dots" aria-hidden="true">
        {[0, 1, 2, 3, 4].map(i => (
          <i key={i} className={i === step ? 'on' : i < step ? 'done' : ''} />
        ))}
      </div>
    </div>
  )
}

/** First run, before there is a car: hello, your name, then your car. */
// `startAt` / `afterName`: back from the car screen when the car is already saved: the name step, then the
// car screen again (not a second new car)
export function Intro({ name, onName, onAdding, startAt = 0, afterName }: { name: string; onName(n: string): void; onAdding(): void; startAt?: number; afterName?(): void }) {
  const [step, setStep] = useState(startAt)
  const [draft, setDraft] = useState(name)
  const next = () => {
    if (step === 1) onName(draft.trim())
    if (step === 1 && afterName) return afterName()
    setStep(s => Math.min(s + 1, 2))
  }
  const first = draft.trim().split(' ')[0]

  return (
    <div className="onb">
      <Scene one />
      <OnbTop step={step} onBack={step > 0 ? () => setStep(s => s - 1) : undefined} />

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
          <div className="eyebrow">שלב 1 מתוך 3</div>
          <h1>איך קוראים לך?</h1>
          <p>כדי שנדע איך לפנות אליך.</p>
          <input className="in onb-in" autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="השם שלך" enterKeyHint="next" />
          <button className="btn onb-cta" type="submit">
            {draft.trim() ? 'המשך' : 'דילוג'} <Icon name="forward" />
          </button>
        </form>
      )}

      {step === 2 && <CarStep first={first} onAdding={onAdding} />}
    </div>
  )
}

/**
 * First run, step 2: the car, in the first-run look (not the white form). The plate fills in the rest
 * from the Ministry of Transport; then today's km. The look of the car can be changed later.
 */
// `car`: back from the next step to the car just added: the same screen, filled in, saved as changes
// `extra`: another car, or one of them opened again, from the 'all set' screen (own title, no step count)
function CarStep({ first, car, extra, onAdding, onAdded, onSaved }: { first: string; car?: Car; extra?: boolean; onAdding?(): void; onAdded?(): void; onSaved?(): void }) {
  const { actions, setCarId, data } = useApp()
  const [name, setName] = useState(car?.name ?? '')
  // the km it was added with (its first reading)
  const start = car ? data.readings.filter(r => r.car_id === car.id).sort((a, b) => a.km - b.km)[0] : undefined
  const [km, setKm] = useState(start ? String(start.km) : '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { plate, info, looking, lookErr, type } = usePlateLookup(car?.plate ?? '', {
    skip: d => Boolean(car) && d === plateDigits(car?.plate ?? ''),
    onFound: r => setName(prev => (prev && prev !== car?.name ? prev : `${r.make} ${r.model}`.trim())),
  })

  async function add() {
    if (!plateDigits(plate) && !name.trim()) return setErr('צריך מספר רכב או שם')
    if (!km) return setErr('כמה ק״מ יש לרכב היום?')
    setBusy(true)
    setErr(null)
    try {
      const fields: Omit<Car, 'id'> = {
        name: name.trim() || formatPlate(plate),
        plate: formatPlate(plate),
        make: info?.make ?? car?.make ?? null,
        model: info?.model ?? car?.model ?? null,
        year: info?.year ?? car?.year ?? null,
        color: info?.color ?? car?.color ?? null,
        fuel: info?.fuel ?? car?.fuel ?? null,
        tyres: info?.tyres ?? car?.tyres ?? null,
        image_url: null,
        body: car?.body ?? null,
        paint: car?.paint ?? null,
      }
      if (car) {
        await actions.updateCar(car.id, fields)
        const kmN = Number(km)
        if (start && kmN !== start.km) {
          await actions.updateReading(start.id, kmN)
          // the reminders set from the first km (service, oil…) move with it
          const shift = kmN - start.km
          for (const it of data.items.filter(i => i.car_id === car.id && i.due_km != null)) await actions.saveItem({ ...it, due_km: it.due_km! + shift })
        }
        onSaved?.()
      } else {
        onAdding?.()
        setCarId(await actions.addCar(fields, Number(km), info?.licenceUntil ?? null))
        onAdded?.()
      }
    } catch (e) {
      setErr(userMessage(e))
      setBusy(false)
    }
  }

  return (
    <form
      className="onb-step onb-car"
      key="2"
      onSubmit={e => {
        e.preventDefault()
        add()
      }}
    >
      {extra ? (
        <>
          <h1>{car ? 'פרטי הרכב' : 'רכב נוסף'}</h1>
          <p>{car ? 'אפשר לתקן את המספר, השם או הק״מ.' : 'גם כאן מספיק מספר הרישוי, ואת השאר נביא ממשרד התחבורה.'}</p>
        </>
      ) : (
        <>
          <div className="eyebrow">שלב 2 מתוך 3</div>
          <h1>{first ? `נעים מאוד, ${first}.` : 'נעים מאוד.'}</h1>
          <p>עכשיו הרכב. מספיק מספר הרישוי: את היצרן, הדגם, הצבע ותוקף הטסט נביא ממשרד התחבורה.</p>
        </>
      )}
      <PlateInput value={plate} onChange={type} autoFocus={!car} />
      <div className={`onb-plate-status ${info ? 'ok' : ''}`} aria-live="polite">
        {looking ? (
          <>
            <span className="spin" /> מחפש במשרד התחבורה…
          </>
        ) : info ? (
          <>
            <Icon name="check" /> {[info.make, info.model, info.year, info.color].filter(Boolean).join(' · ')}
          </>
        ) : (
          (lookErr ?? (car ? [car.make, car.model, car.year, car.color].filter(Boolean).join(' · ') : null) ?? ' ')
        )}
      </div>
      <div className="onb-fields">
        <label>
          <span>שם לרכב</span>
          <input className="in onb-in" value={name} onChange={e => setName(e.target.value)} placeholder="הקיה של אבא" />
        </label>
        <label>
          <span>ק״מ היום</span>
          <input className="in onb-in" inputMode="numeric" value={km ? Number(km).toLocaleString('he-IL') : ''} onChange={e => setKm(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="48,230" enterKeyHint="done" />
        </label>
      </div>
      {err && <div className="onb-err">{err}</div>}
      <button className="btn onb-cta" type="submit" disabled={busy}>
        {busy ? <span className="spin" /> : car ? <>{extra ? 'שמירה' : 'המשך'} <Icon name="forward" /></> : <>הוספת הרכב <Icon name="plus" /></>}
      </button>
    </form>
  )
}

/** First run: back from the yearly-km question to fix the car just added, in the same look. */
export function CarFix({ car, name, onDone, onBack }: { car: Car; name: string; onDone(): void; onBack(): void }) {
  return (
    <div className="onb">
      <Scene one />
      <OnbTop step={2} onBack={onBack} />
      <CarStep first={name.trim().split(' ')[0]} car={car} onSaved={onDone} />
    </div>
  )
}

/** From the 'all set' screen: add another car, or open one of them again, in the first-run look. */
export function ExtraCar({ car, onDone }: { car?: Car; onDone(): void }) {
  return (
    <div className="onb">
      <Scene one />
      <OnbTop step={4} onBack={onDone} />
      <CarStep first="" car={car} extra onAdded={onDone} onSaved={onDone} />
    </div>
  )
}

const YEARLY = YEARLY_CHOICES

/**
 * After the first car is saved: about how far it goes in a year. Until the owner's own km updates show
 * the real pace, the app's km guess runs on this instead of the national average. Can be skipped.
 */
export function KmSurvey({ car, onPick, onNext, onBack }: { car: Car; onPick(yearly: number | null): void; onNext(): void; onBack(): void }) {
  // saved as soon as it is picked, so going back and forth keeps the choice
  const [pick, setPick] = useState<number | null>(YEARLY.some(([, km]) => km === car.yearly_km) ? car.yearly_km! : null)
  const choose = (km: number) => {
    setPick(km)
    onPick(km)
  }
  return (
    <div className="onb">
      <Scene one />
      <OnbTop step={3} onBack={onBack} />
      <div className="onb-step">
        <div className="eyebrow">שלב 3 מתוך 3</div>
        <h1>כמה ק״מ בשנה, בערך?</h1>
        <p>כך נדע לנחש את הק״מ של ה{car.name} בין עדכון לעדכון. אחרי כמה עדכונים נלמד את הקצב האמיתי.</p>
        <div className="km-picks" role="radiogroup" aria-label="ק״מ בשנה">
          {YEARLY.map(([label, km]) => (
            <button key={km} role="radio" aria-checked={pick === km} className={pick === km ? 'on' : ''} onClick={() => choose(km)}>
              {label}
            </button>
          ))}
        </div>
        <div className="km-month" aria-live="polite">
          {pick ? `≈ ${(Math.round(pick / 12 / 50) * 50).toLocaleString('he-IL')} ק״מ בחודש` : ' '}
        </div>
        <button className="btn onb-cta" disabled={!pick} onClick={onNext}>
          המשך <Icon name="forward" />
        </button>
        <button
          className="onb-back"
          onClick={() => {
            if (pick) onPick(null) // skipping drops a choice made a moment ago
            onNext()
          }}
        >
          לא יודע, דלג
        </button>
      </div>
    </div>
  )
}

/** After the first car is saved: a pause before the tour. */
export function Ready({ name, car, onStart, onSkip, onBack, onAddAnother, onEdit }: { name: string; car: Car; onStart(): void; onSkip(): void; onBack(): void; onAddAnother(): void; onEdit(): void }) {
  const { data, setCarId } = useApp()
  const first = name.trim().split(' ')[0]
  const many = data.cars.length > 1
  return (
    <div className="onb">
      <Scene one />
      <OnbTop step={4} onBack={onBack} />
      <div className="onb-step ready">
        {/* more than one car: switch between them here, and fix any of them */}
        {many && (
          <div className="ready-switch" role="tablist" aria-label="הרכבים">
            {data.cars.map(c => (
              <button key={c.id} role="tab" aria-selected={c.id === car.id} className={c.id === car.id ? 'on' : ''} onClick={() => setCarId(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
        <div className="ready-car" key={car.id}>
          <CarToy car={car} className="ready-toy" />
          {car.plate && <Plate number={car.plate} />}
          <button className="ready-edit" onClick={onEdit} aria-label={`עריכת ${car.name}`}>
            <Icon name="edit" /> עריכה
          </button>
        </div>
        <div className="eyebrow">
          <Icon name="check" /> {many ? `${data.cars.length} רכבים נוספו` : 'הרכב נוסף'}
        </div>
        <h1>{first ? `הכל מוכן, ${first}.` : 'הכל מוכן.'}</h1>
        <p>הוספנו תזכורות לטסט, לטיפול, לביטוח ועוד. בוא נעשה סיור קצר במסך הבית, פחות מדקה.</p>
        <button className="btn onb-cta" onClick={onStart}>
          בוא נתחיל <Icon name="forward" />
        </button>
        <div className="ready-links">
          <button className="onb-back" onClick={onAddAnother}>
            יש עוד רכב? הוספה
          </button>
          <button className="onb-back" onClick={onSkip}>
            דילוג על הסיור
          </button>
        </div>
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
  { target: 'km', title: 'הק״מ של הרכב', text: 'נעריך אותו כל יום לפי הנסיעות שלך, ופעם בשבוע נבקש לאשר.' },
  { target: 'insurance', title: 'ביטוח', text: 'מתי הפוליסה נגמרת. לחיצה פותחת את החברה, מספר הפוליסה והצילום.' },
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
  const vw = window.innerWidth
  const below = rect ? rect.top + rect.height / 2 < vh / 2 : false
  // a target as tall as the screen (on a PC: the icon strip, the cars pane) leaves no room above or
  // below it: the card goes beside it instead, in the middle of the free side
  const tall = rect ? rect.height > vh * 0.5 : false
  const onRight = rect ? rect.left + rect.width / 2 > vw / 2 : false
  const cardStyle: React.CSSProperties = !rect
    ? { top: '50%', transform: 'translateY(-50%)' }
    : tall
      ? onRight
        ? { top: '50%', transform: 'translateY(-50%)', right: vw - rect.left + pad + 16 }
        : { top: '50%', transform: 'translateY(-50%)', left: rect.left + rect.width + pad + 16 }
      : below
        ? { top: Math.min(rect.top + rect.height + pad + 12, vh - 220) }
        : { bottom: Math.min(Math.max(vh - rect.top + pad + 12, 16), vh - 240) }

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
