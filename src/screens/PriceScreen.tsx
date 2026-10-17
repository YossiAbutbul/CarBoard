import { useEffect, useState } from 'react'
import { useApp } from '../data/AppData'
import { Glance, GlanceCell, PageHero, TopBar } from '../components/Chrome'
import { Icon } from '../components/Icon'
import { userMessage } from '../lib/errors'
import { fmtDate, fmtMoney, fmtNum } from '../lib/i18n'
import { lookupProfile, plateDigits, typingPlate, type CarProfile } from '../lib/govil'
import { estimateValue } from '../domain/value'

/** "2019-04" → "04/2019" */
const monthYear = (ym: string | null) => (ym && /^\d{4}-\d{2}/.test(ym) ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : ym ?? '')

/**
 * "מחירון": a car by its plate (this car's, or any car being looked at), from the Ministry of
 * Transport's open data: trim, year, owners and how it was owned, the km at its last test, its official
 * price when new, and from all that a ballpark of what it is worth now.
 */
export function PriceScreen({ openCars, openSettings }: { openCars(): void; openSettings(): void }) {
  const { car, km } = useApp()
  const [plate, setPlate] = useState(car?.plate ? typingPlate(car.plate) : '')
  const [state, setState] = useState<{ busy: boolean; profile: CarProfile | null; err: string | null; asked: string | null }>({ busy: false, profile: null, err: null, asked: null })

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
  // this car's details right away
  useEffect(() => {
    if (car?.plate) void check(car.plate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [car?.id])

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
        <input className="in" inputMode="numeric" value={plate} onChange={e => setPlate(typingPlate(e.target.value))} placeholder="מספר רכב" aria-label="מספר רכב" enterKeyHint="search" />
        <button className="btn pri" disabled={state.busy}>
          {state.busy ? <span className="spin inline" /> : <Icon name="search" />} בדיקה
        </button>
      </form>
      {state.err && <p className="price-err">{state.err}</p>}

      {p && (
        <>
          <div className="sec">
            <h2>פרטי הרכב</h2>
          </div>
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
