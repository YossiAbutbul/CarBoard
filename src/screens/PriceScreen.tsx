import { useEffect, useRef, useState } from 'react'
import { useApp } from '../data/AppData'
import { Glance, GlanceCell, PageHero, TopBar } from '../components/Chrome'
import { Icon } from '../components/Icon'
import { userMessage } from '../lib/errors'
import { fmtDate, fmtMoney, fmtNum } from '../lib/i18n'
import { formatPlate, lookupProfile, plateDigits, typingPlate, type CarProfile } from '../lib/govil'
import { estimateValue } from '../domain/value'
import { isSaved, listSaved, saveCar, unsaveCar } from '../lib/priceSaved'
import { shareCarCard } from '../lib/carCard'

/** A plate from a shared link (?price=…), kept by main.tsx: read once, cleared once a page has used it. */
let sharedPlate: string | null | undefined
function readSharedPlate() {
  if (sharedPlate === undefined) {
    try {
      const d = sessionStorage.getItem('car-records:price')
      sessionStorage.removeItem('car-records:price')
      sharedPlate = d && /^\d{7,8}$/.test(d) ? d : null
    } catch {
      sharedPlate = null
    }
  }
  return sharedPlate
}

/** "2019-04" → "04/2019" */
const monthYear = (ym: string | null) => (ym && /^\d{4}-\d{2}/.test(ym) ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : ym ?? '')

/**
 * "מחירון": a car by its plate (this car's, or any car being looked at), from the Ministry of
 * Transport's open data: trim, year, owners and how it was owned, the km at its last test, its official
 * price when new, and from all that a ballpark of what it is worth now.
 */
export function PriceScreen({ openCars, openSettings }: { openCars(): void; openSettings(): void }) {
  const { car, km } = useApp()
  const [shared] = useState(readSharedPlate)
  const [plate, setPlate] = useState(shared ? typingPlate(shared) : car?.plate ? typingPlate(car.plate) : '')
  const [state, setState] = useState<{ busy: boolean; profile: CarProfile | null; err: string | null; asked: string | null }>({ busy: false, profile: null, err: null, asked: null })
  // the cars kept for later; on this device only (a lookup is not a car in the garage)
  const [saved, setSaved] = useState(listSaved)
  const [leaving, setLeaving] = useState<string | null>(null) // the card on its way off the row
  const [editing, setEditing] = useState(false) // the row in edit: every card wears a "−"
  const field = useRef<HTMLInputElement>(null)
  const row = useRef<HTMLDivElement>(null)

  async function check(p = plate) {
    const digits = plateDigits(p)
    if (digits.length < 7) return setState(s => ({ ...s, err: 'מספר רכב: 7 או 8 ספרות' }))
    setState({ busy: true, profile: null, err: null, asked: digits })
    try {
      const profile = await lookupProfile(digits)
      setState({ busy: false, profile, err: profile ? null : 'הרכב לא נמצא במאגר משרד התחבורה (רכב פרטי בלבד).', asked: digits })
    } catch (e) {
      setState({ busy: false, profile: null, err: navigator.onLine ? userMessage(e) : 'אין חיבור לאינטרנט.', asked: digits })
    }
  }
  const [sharing, setSharing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // this car's details right away (or the one a shared link opened)
  const sharedFor = useRef(car?.id) // the shared car is shown until another of one's own cars is picked
  useEffect(() => {
    const plate = shared && car?.id === sharedFor.current ? shared : car?.plate
    sharedPlate = null // used: the next visit to the page starts from this car again
    if (plate) void check(plate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car?.id])

  /*
   * The row keeps the order things were saved in — the first car stays at the start (the right, here)
   * and the newest sits at the far end — so it only moves when the car being looked at is out of
   * view, and then by the least it can. Only the row scrolls; the page never moves under the reader.
   * The sums come from the live layout in plain left and right, so right-to-left needs no special case.
   */
  useEffect(() => {
    // a frame later, so the row is laid out: on the first lookup the cards are drawn in the same pass
    const f = requestAnimationFrame(() => {
      const el = row.current
      const card = el?.querySelector<HTMLElement>('.ps-card.on')
      if (!el || !card) return
      const style = getComputedStyle(el)
      const box = el.getBoundingClientRect()
      const c = card.getBoundingClientRect()
      const past = (v: number) => (v > 1 ? v : 0)
      // how far the card hangs over each edge, inside the row's own padding
      const right = past(c.right - (box.right - (parseFloat(style.paddingRight) || 0)))
      const left = past(box.left + (parseFloat(style.paddingLeft) || 0) - c.left)
      const step = right || -left // a positive step moves the cards left, a negative one right
      if (!step) return
      el.scrollBy({ left: step, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    })
    return () => cancelAnimationFrame(f)
  }, [state.asked, saved])

  /** Empties the field and puts the caret back in it; what is already on screen stays to be read. */
  function clearPlate() {
    setPlate('')
    setState(s => ({ ...s, err: null }))
    field.current?.focus()
  }

  /** A saved car: looked up again from its plate. */
  function openSaved(digits: string) {
    setPlate(typingPlate(digits))
    void check(digits)
  }

  /**
   * Takes a car off the row. The card shrinks away on the press and the rest close the gap after it,
   * so nothing jumps out from under the finger. Nothing is lost that a search cannot bring back,
   * so it goes without asking.
   */
  function removeSaved(plate: string) {
    if (leaving) return
    const done = () => {
      setSaved(s => {
        const left = unsaveCar(s, plate)
        if (!left.length) setEditing(false) // an empty row has nothing left to edit
        return left
      })
      setLeaving(null)
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return done()
    setLeaving(plate)
    setTimeout(done, 180)
  }

  if (!car) return null
  const p = state.profile
  const hands = p ? p.owners.filter(o => o.type !== 'סוחר').length : 0
  const mine = Boolean(car.plate) && plateDigits(car.plate ?? '') === state.asked
  // a ballpark from the official new price, the age, the km (this car's own, else at its last test),
  // the owners and a leasing or rental past
  const estimate =
    p?.newPrice && p.year
      ? estimateValue({
          newPrice: p.newPrice.price,
          year: p.year,
          km: mine && km.value ? km.value : p.testKm,
          hands,
          fleet: [p.origin, ...p.owners.map(o => o.type)].some(t => t === 'ליסינג' || t === 'השכרה'),
        })
      : null

  const shownDigits = p ? plateDigits(p.plate) : ''
  const on = Boolean(p) && isSaved(saved, shownDigits)
  /** Keeps the car on screen in the list, or takes it off it. */
  const toggleSaved = () => {
    if (!p) return
    setSaved(
      on
        ? unsaveCar(saved, shownDigits)
        : saveCar(saved, {
            plate: shownDigits,
            shown: formatPlate(shownDigits),
            name: [p.make, p.model].filter(Boolean).join(' ') || formatPlate(shownDigits),
            year: p.year,
            value: estimate?.value ?? null,
            at: new Date().toISOString().slice(0, 10),
          }),
    )
  }

  /** The page as one portrait picture, through the phone's share sheet. */
  async function share() {
    if (!p || sharing) return
    setSharing(true)
    setNote(null)
    try {
      const how = await shareCarCard({ profile: p, estimate, hands })
      if (how === 'saved') setNote('התמונה נשמרה, והקישור הועתק.')
    } catch (e) {
      setNote(userMessage(e))
    } finally {
      setSharing(false)
    }
  }

  const rows: [string, string | null][] = p
    ? [
        ['יצרן ודגם', [p.make, p.model].filter(Boolean).join(' ')],
        ['רמת גימור', p.trim],
        ['שנת ייצור', p.year ? String(p.year) : null],
        ['עלה לכביש', p.onRoad ? monthYear(p.onRoad) : null],
        ['בעלות ראשונה', p.origin],
        ['בעלות היום', p.ownership],
        ['ק״מ בטסט האחרון', p.testKm ? `${fmtNum(p.testKm)}${p.lastTest ? ` · ${fmtDate(p.lastTest)}` : ''}` : null],
        ['דלק', p.fuel],
        ['צבע', p.color],
      ]
    : []

  return (
    <div className="reveal">
      <PageHero>
        <TopBar openCars={openCars} openSettings={openSettings} />
        <div className="greet">
          <div className="date">{mine || !p ? car.name : [p.make, p.model].filter(Boolean).join(' ')}</div>
          <h1>מחירון</h1>
        </div>
        <Glance>
          {estimate ? (
            <GlanceCell k="שווי" v={fmtMoney(estimate.value)} d="הערכה" />
          ) : (
            <GlanceCell k="שנה" v={p?.year ? String(p.year) : '–'} d={p?.onRoad ? `על הכביש ${monthYear(p.onRoad)}` : 'שנת ייצור'} />
          )}
          {/* the "hand" a price list asks for: the owners, not the dealers the car passed through on the way */}
          <GlanceCell k="יד" v={hands ? fmtNum(hands) : '–'} d={hands ? p?.ownership ?? '' : 'אין נתון'} />
          <GlanceCell k="ק״מ בטסט" v={p?.testKm ? fmtNum(p.testKm) : '–'} d={p?.lastTest ? fmtDate(p.lastTest) : 'בטסט האחרון'} />
        </Glance>
      </PageHero>

      {/* any plate: this car's, or one being looked at */}
      <form
        className="price-search"
        onSubmit={e => {
          e.preventDefault()
          ;(document.activeElement as HTMLElement | null)?.blur()
          void check()
        }}
      >
        <div className="in-wrap">
          <input
            ref={field}
            className="in"
            inputMode="numeric"
            value={plate}
            onChange={e => setPlate(typingPlate(e.target.value))}
            onKeyDown={e => {
              if (e.key === 'Escape' && plate) {
                e.preventDefault()
                clearPlate()
              }
            }}
            placeholder="מספר רכב"
            aria-label="מספר רכב"
            enterKeyHint="search"
          />
          {/* clears the field, and only it: the details already on screen stay to be read */}
          {plate && (
            <button
              type="button"
              className="in-x"
              // on the press itself, and without taking the focus: the keyboard stays up, as it does
              // in a native field (the click is kept for a keyboard's Enter; clearing twice is the same)
              onPointerDown={e => {
                e.preventDefault()
                clearPlate()
              }}
              onClick={clearPlate}
              aria-label="ניקוי מספר הרכב"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
        <button className="btn pri" disabled={state.busy}>
          {state.busy ? <span className="spin inline" /> : <Icon name="search" />} בדיקה
        </button>
      </form>
      {state.err && <p className="price-err">{state.err}</p>}

      {/* the cars kept for later: a tap looks one up again */}
      {saved.length > 0 && (
        <>
          <div className="ps-head">
            <span>שמורים</span>
            <button type="button" className="ps-edit" onClick={() => setEditing(e => !e)} aria-pressed={editing}>
              {editing ? 'סיום' : 'עריכה'}
            </button>
          </div>
          <div className={`price-saved ${editing ? 'editing' : ''}`} ref={row}>
            {saved.map(c => (
              // the card and its "−" are two buttons side by side, not one inside the other: a tap on
              // the "−" takes the car off the row and never starts a lookup. While the row is being
              // edited the card itself does nothing, so a thumb aiming at the "−" cannot open a car.
              <div key={c.plate} className={`ps-card ${c.plate === state.asked ? 'on' : ''} ${leaving === c.plate ? 'leaving' : ''}`}>
                <button type="button" className="ps-open" onClick={() => openSaved(c.plate)} disabled={editing}>
                  <span className="ps-name">{c.name}</span>
                  <span className="ps-plate">
                    <bdi>{c.shown}</bdi>
                    {c.year ? ` · ${c.year}` : ''}
                  </span>
                  {c.value ? <span className="ps-val">{fmtMoney(c.value)}</span> : null}
                </button>
                {editing && (
                  <button type="button" className="ps-minus" onClick={() => removeSaved(c.plate)} aria-label={`הסרה מהשמורים: ${c.name}`}>
                    <Icon name="minus" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {p && (
        <>
          <div className="sec">
            <h2>פרטי הרכב</h2>
            <div className="sec-btns">
              <button className="add-btn" onClick={() => void share()} disabled={sharing} aria-label="שיתוף פרטי הרכב כתמונה">
                שיתוף {sharing ? <span className="spin inline" /> : <Icon name="share" />}
              </button>
              <button className={`add-btn ${on ? 'on' : ''}`} onClick={toggleSaved} aria-pressed={on}>
                {on ? 'שמור' : 'שמירה'} <Icon name={on ? 'saved' : 'save'} />
              </button>
            </div>
          </div>
          {note && <p className="price-note">{note}</p>}
          <div className="card price-facts">
            {rows
              .filter((r): r is [string, string] => Boolean(r[1]))
              .map(([k, v]) => (
                <div key={k} className="pf-row">
                  <span>{k}</span>
                  <b>{v}</b>
                </div>
              ))}
            {p.changes.length > 0 && (
              <div className="pf-row warn">
                <span>שינויים</span>
                <b>{p.changes.join(', ')}</b>
              </div>
            )}
          </div>

          {p.owners.length > 0 && (
            <>
              <div className="sec">
                <h2>בעלויות</h2>
              </div>
              <div className="card price-owners">
                {p.owners.map((o, i) => (
                  <div key={`${o.date}-${i}`} className="po-row">
                    <span className="po-n">{i + 1}</span>
                    <span>{o.type || 'בעלות'}</span>
                    <small>מ־{monthYear(o.date)}</small>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* what it is worth: a ballpark from the official new price, and that price itself */}
          <div className="sec">
            <h2>כמה הוא שווה?</h2>
          </div>
          <div className="card price-value">
            {estimate && (
              <div className="pv-main">
                <span className="pv-tag">הערכה</span>
                <b>{fmtMoney(estimate.value)}</b>
                {/* each sum in its own run, so right-to-left text keeps them in order */}
                <span>
                  בין <bdi>{fmtMoney(estimate.low)}</bdi> ל־<bdi>{fmtMoney(estimate.high)}</bdi>
                </span>
              </div>
            )}
            {p.newPrice && (
              <div className="pv-lines">
                <div className="pf-row">
                  <span>מחיר כחדש ({p.newPrice.year})</span>
                  <b>{fmtMoney(p.newPrice.price)}</b>
                </div>
              </div>
            )}
            <p className="pv-note">
              {estimate
                ? 'ההערכה מחושבת ממחיר הרכב כחדש (מחירון היבואן), לפי הגיל, הק״מ, היד וסוג הבעלות. היא לא מחירון, והמחיר בפועל יכול להיות שונה.'
                : 'לדגם הזה אין מחיר כחדש במאגר, ולכן אין הערכה.'}
            </p>
          </div>
          <p className="price-src">הפרטים: מאגר הרכב הפתוח של משרד התחבורה (data.gov.il).</p>
        </>
      )}
    </div>
  )
}
