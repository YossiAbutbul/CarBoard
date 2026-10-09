import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../data/AppData'
import { useBackLayer } from '../lib/back'
import { monthSummary, prevMonth } from '../domain/summary'
import { fmtMoney, fmtNum, fmtShortDate, fmtDays } from '../lib/i18n'
import { Icon } from './Icon'
import { Plate } from './Chrome'

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
const monthName = (m: string) => `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`
const thisMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * A car's month at a glance: what it cost, how far it went, against the month before, and what is
 * due next. Opens by itself once at the start of each month (for the month that ended), and any
 * time from settings; the arrows go back through earlier months.
 */
export function MonthSummarySheet({ onClose, start }: { onClose(): void; start?: string }) {
  const { data, car } = useApp()
  const [month, setMonth] = useState(start ?? prevMonth(thisMonth()))
  const [carId, setCarId] = useState(car?.id ?? data.cars[0]?.id)
  useBackLayer(true, onClose)
  const shown = data.cars.find(c => c.id === carId) ?? car
  if (!shown) return null
  const s = monthSummary(data, shown.id, month)
  const prevName = MONTH_NAMES[Number(prevMonth(month).slice(5)) - 1]
  // back as far as the car's first record; forward up to the month that just ended
  const firstMonth = [...data.fuel, ...data.services, ...data.readings].filter(r => r.car_id === shown.id).reduce((m, r) => (r.date.slice(0, 7) < m ? r.date.slice(0, 7) : m), month)
  const canBack = month > firstMonth
  const canForward = month < prevMonth(thisMonth())
  const step = (d: number) =>
    setMonth(m => {
      const [y, mo] = m.split('-').map(Number)
      const t = new Date(y, mo - 1 + d, 1)
      return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`
    })

  const share = s.total > 0 ? (s.fuel.spent / s.total) * 100 : 0
  const diff = s.total - s.prevTotal
  const perKm = s.km ? s.total / s.km : null

  return createPortal(
    <div className="dialog-overlay ms-overlay" onClick={onClose}>
      <article className="ms" role="dialog" aria-modal="true" aria-label={`סיכום ${monthName(month)}`} onClick={e => e.stopPropagation()}>
        <header className="ms-head">
          <div className="ms-meta">
            <span>סיכום חודשי · {shown.name}</span>
            {shown.plate && <Plate number={shown.plate} size="sm" />}
          </div>
          <div className="ms-title">
            <h2>
              {MONTH_NAMES[Number(month.slice(5)) - 1]}
              <span> {month.slice(0, 4)}</span>
            </h2>
            <div className="ms-step">
              <button onClick={() => step(-1)} disabled={!canBack} aria-label="החודש הקודם">
                <Icon name="back" />
              </button>
              <button onClick={() => step(1)} disabled={!canForward} aria-label="החודש הבא">
                <Icon name="forward" />
              </button>
            </div>
          </div>
          {data.cars.length > 1 && (
            <div className="ms-cars">
              {data.cars.map(c => (
                <button key={c.id} className={c.id === shown.id ? 'on' : ''} onClick={() => setCarId(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </header>

        {s.empty ? (
          <p className="ms-empty">לא נרשם כלום ב{MONTH_NAMES[Number(month.slice(5)) - 1]}.</p>
        ) : (
          <>
            <section className="ms-total">
              <small>הוצאת החודש</small>
              <b>{fmtMoney(s.total)}</b>
              {s.prevTotal > 0 && diff !== 0 && (
                <p>
                  <em className={diff > 0 ? 'more' : 'less'}>{fmtMoney(Math.abs(diff))}</em> {diff > 0 ? 'יותר' : 'פחות'} מ{prevName}
                </p>
              )}
              {s.total > 0 && (
                <div className="ms-split" aria-hidden="true">
                  <i className="fuel" style={{ width: `${share}%` }} />
                  <i className="svc" style={{ width: `${100 - share}%` }} />
                </div>
              )}
              <dl className="ms-ledger">
                <div>
                  <dt>
                    <i className="dot fuel" /> דלק
                    <small>{s.fuel.count ? `${s.fuel.count} תדלוקים · ${fmtNum(s.fuel.liters)} ל׳` : 'לא היה תדלוק'}</small>
                  </dt>
                  <dd>{fmtMoney(s.fuel.spent)}</dd>
                </div>
                <div>
                  <dt>
                    <i className="dot svc" /> טיפולים
                    <small>{s.services.length ? (s.services.length === 1 ? 'טיפול אחד' : `${s.services.length} טיפולים`) : 'לא היו טיפולים'}</small>
                  </dt>
                  <dd>{fmtMoney(s.servicesSpent)}</dd>
                </div>
              </dl>
            </section>

            {(s.km != null || s.fuel.perLiter != null) && (
              <section className="ms-drive">
                {s.km != null && (
                  <div>
                    <b>{fmtNum(s.km)}</b>
                    <small>ק״מ נסעת</small>
                  </div>
                )}
                {perKm != null && (
                  <div>
                    <b>₪{perKm.toFixed(2)}</b>
                    <small>לכל ק״מ</small>
                  </div>
                )}
                {s.fuel.perLiter != null && (
                  <div>
                    <b>₪{s.fuel.perLiter.toFixed(2)}</b>
                    <small>ממוצע לליטר</small>
                  </div>
                )}
              </section>
            )}

            {s.services.length > 0 && (
              <section className="ms-rows">
                <h3>טיפולים</h3>
                {s.services.map(sv => (
                  <div key={sv.id}>
                    <time>{fmtShortDate(sv.date)}</time>
                    <span>{sv.title}</span>
                    <b>{sv.price != null ? fmtMoney(sv.price) : ''}</b>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        {month === prevMonth(thisMonth()) && s.upcoming.length > 0 && (
          <section className="ms-rows">
            <h3>בחודש הקרוב</h3>
            {s.upcoming.slice(0, 4).map(u => (
              <div key={u.item.id}>
                <time className={u.days < 0 ? 'late' : ''}>{u.days < 0 ? 'עבר' : u.days === 0 ? 'היום' : `בעוד ${fmtDays(u.days)}`}</time>
                <span>{u.item.label}</span>
              </div>
            ))}
          </section>
        )}

        <button className="ms-close" onClick={onClose}>
          סגירה
        </button>
      </article>
    </div>,
    document.body,
  )
}
const SEEN_KEY = 'car-records:summary-seen'

/** Once a month (the first time the app opens in a new month): the month that ended, if anything happened in it. */
export function summaryDue(data: ReturnType<typeof useApp>['data']): string | null {
  const month = prevMonth(thisMonth())
  try {
    if (localStorage.getItem(SEEN_KEY) === month) return null
  } catch {
    return null // storage blocked: never nag
  }
  return data.cars.some(c => !monthSummary(data, c.id, month).empty) ? month : null
}
export function markSummarySeen(month: string) {
  try {
    localStorage.setItem(SEEN_KEY, month)
  } catch {
    // storage blocked
  }
}
