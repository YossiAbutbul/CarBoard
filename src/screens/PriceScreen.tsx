import { useEffect, useState } from 'react'
import { useApp } from '../data/AppData'
import { Glance, GlanceCell, PageHero, TopBar } from '../components/Chrome'
import { Icon } from '../components/Icon'
import { copyText, userMessage } from '../lib/errors'
import { fmtDate, fmtMoney, fmtNum } from '../lib/i18n'
import { diffDays, todayIso } from '../lib/dates'
import { lookupProfile, plateDigits, typingPlate, type CarProfile } from '../lib/govil'

const LEVI = 'https://www.levi-itzhak.co.il'

/** "2019-04" → "04/2019" */
const monthYear = (ym: string | null) => (ym && /^\d{4}-\d{2}/.test(ym) ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : ym ?? '')

/**
 * "מחירון": what a price list asks about a car, from the public registry by its plate (this car's, or
 * any car being looked at): trim, year, owners and how it was owned, the km at its last test. The
 * price itself is checked at לוי יצחק (a paid service, with no public data to show here): one tap
 * copies the plate and opens it.
 */
export function PriceScreen({ openCars, openSettings }: { openCars(): void; openSettings(): void }) {
  const { car, km, actions } = useApp()
  // the price checked at לוי יצחק, typed in by the owner: saved on the car with the day and the km
  const [priceDraft, setPriceDraft] = useState<string | null>(null) // null: not editing
  const [saving, setSaving] = useState(false)
  const [plate, setPlate] = useState(car?.plate ? typingPlate(car.plate) : '')
  const [state, setState] = useState<{ busy: boolean; profile: CarProfile | null; err: string | null; asked: string | null }>({ busy: false, profile: null, err: null, asked: null })
  const [copied, setCopied] = useState(false)

  async function check(p = plate) {
    const digits = plateDigits(p)
    if (digits.length < 7) return setState(s => ({ ...s, err: 'מספר רכב: 7 או 8 ספרות' }))
    setState({ busy: true, profile: null, err: null, asked: digits })
    setCopied(false)
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
  const value = car.value ?? null
  const stale = value ? diffDays(todayIso(), value.date) > 182 : false // half a year: prices move
  async function savePrice() {
    const price = Number((priceDraft ?? '').replace(/\D/g, ''))
    if (!car || !price) return
    setSaving(true)
    try {
      await actions.updateCar(car.id, { value: { price, date: todayIso(), km: Math.round(km.value) || null } })
      setPriceDraft(null)
    } finally {
      setSaving(false)
    }
  }
  const hands = p ? p.owners.filter(o => o.type !== 'סוחר').length : 0
  const mine = Boolean(car.plate) && plateDigits(car.plate ?? '') === state.asked

  async function openLevi() {
    if (p && (await copyText(plateDigits(p.plate)))) setCopied(true)
    window.open(LEVI, '_blank', 'noopener')
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
          {mine && value ? (
            <GlanceCell k="שווי" v={fmtMoney(value.price)} d={`לוי יצחק · ${fmtDate(value.date)}`} />
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

          {/* the price: at לוי יצחק (paid, no public data): the plate goes with you on the clipboard */}
          <div className="sec">
            <h2>כמה הוא שווה?</h2>
          </div>
          <div className="card price-levi">
            {/* this car's price, as checked: big, with when and at what km */}
            {mine && value && priceDraft === null && (
              <div className="pv-saved">
                <b>{fmtMoney(value.price)}</b>
                <span>
                  לפי לוי יצחק · נבדק ב־{fmtDate(value.date)}
                  {value.km ? ` · ב־${fmtNum(value.km)} ק״מ` : ''}
                </span>
                {stale && <span className="pv-stale">עברו יותר מחצי שנה. כדאי לבדוק שוב.</span>}
              </div>
            )}
            {!(mine && value) && <p>המחיר נבדק במחירון לוי יצחק. הוא מתחשב בק״מ, במספר הבעלויות ובסוג הבעלות, שמופיעים כאן.</p>}
            <button className={`btn ${mine && value && !stale ? '' : 'pri'}`} onClick={() => void openLevi()}>
              {mine && value ? 'בדיקה מחדש בלוי יצחק' : 'למחירון לוי יצחק'} <Icon name="forward" />
            </button>
            <small>{copied ? `✓ מספר הרכב (${p.plate}) הועתק. הדביקו אותו שם.` : 'מספר הרכב יועתק, כדי להדביק אותו שם.'}</small>
            {/* back from there: the price goes here (only for this car; another plate is just looked at) */}
            {mine &&
              (priceDraft === null ? (
                <button className="pv-edit" onClick={() => setPriceDraft(value ? String(value.price) : '')}>
                  {value ? 'עדכון המחיר' : 'קיבלתם מחיר? שמרו אותו כאן'}
                </button>
              ) : (
                <form
                  className="pv-form"
                  onSubmit={e => {
                    e.preventDefault()
                    void savePrice()
                  }}
                >
                  <label className="lbl">המחיר לפי לוי יצחק (₪)</label>
                  <div className="pv-row">
                    <input
                      className="in"
                      inputMode="numeric"
                      autoFocus
                      value={priceDraft ? fmtNum(Number(priceDraft.replace(/\D/g, '')) || 0).replace(/^0$/, '') : ''}
                      onChange={e => setPriceDraft(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="למשל: 85,000"
                      enterKeyHint="done"
                    />
                    <button className="btn pri" disabled={saving || !Number(priceDraft)}>
                      {saving ? <span className="spin inline" /> : 'שמירה'}
                    </button>
                  </div>
                  <button type="button" className="pv-edit" onClick={() => setPriceDraft(null)}>
                    ביטול
                  </button>
                </form>
              ))}
          </div>
          <p className="price-src">הפרטים: מאגר הרכב הפתוח של משרד התחבורה (data.gov.il).</p>
        </>
      )}
    </div>
  )
}
