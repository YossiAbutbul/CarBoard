import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { Glance, GlanceCell, PageHero, TopBar, useCountUp } from '../components/Chrome'
import { useApp } from '../data/AppData'
import { useBackLayer } from '../lib/back'
import { byDate, economyOf, fuelPeriod, inRange, perLiter, totals, type FuelRange, type Period } from '../domain/fuel'
import { fmtDate, fmtDays, fmtMoney, fmtNum, fmtShortDate } from '../lib/i18n'
import { diffDays, todayIso } from '../lib/dates'
import type { Fuel } from '../types'
import type { OpenSheet } from '../App'

const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
const money2 = (n: number) => `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function FuelScreen({ open, openCars, openSettings }: { open: OpenSheet; openCars(): void; openSettings(): void }) {
  const { data, car } = useApp()
  const [receipt, setReceipt] = useState<Fuel | null>(null)
  const fills = data.fuel.filter(f => f.car_id === car?.id)
  const list = [...fills].sort(byDate).reverse() // newest first
  // the period the chart shows; the header's first box adds up the same period
  const [range, setRange] = useState<FuelRange>('m6')
  const [offset, setOffset] = useState(0)
  const period = fuelPeriod(range, offset, fills)
  const sum = totals(fills.filter(f => inRange(f, period.from, period.to)))
  const sumShown = useCountUp(sum.spent)
  if (!car) return null
  const last = list[0] ?? null // the newest fill-up
  const lastPrice = list.map(perLiter).find(p => p != null) ?? null
  const months = [...new Set(list.map(f => f.date.slice(0, 7)))]

  return (
    <div className="reveal">
      <PageHero>
        <TopBar openCars={openCars} openSettings={openSettings} />
        <div className="greet">
          <div className="date">{car.name}</div>
          <h1>יומן דלק</h1>
        </div>
        <Glance>
          <GlanceCell k={range === 'm1' && offset === 0 ? 'החודש' : range === 'm6' ? `${MONTHS[period.first.m]}–${MONTHS[period.last.m]}` : periodLabel(range, period)} v={fmtMoney(sumShown)} d={`${sum.count} תדלוקים`} />
          <GlanceCell
            k="תדלוק אחרון"
            v={last ? (diffDays(todayIso(), last.date) <= 0 ? 'היום' : `לפני ${fmtDays(diffDays(todayIso(), last.date))}`) : 'אין'}
            d={last ? [last.price != null && fmtMoney(last.price), last.station].filter(Boolean).join(' · ') || fmtShortDate(last.date) : 'עוד לא נרשם'}
          />
          <GlanceCell k="מחיר לליטר" v={lastPrice ? `₪${lastPrice.toFixed(2)}` : 'אין'} d={lastPrice ? 'בתדלוק האחרון' : 'עוד אין'} />
        </Glance>
      </PageHero>

      {list.length === 0 ? (
        <div className="empty">
          <div className="glyph">
            <Icon name="fuel" />
          </div>
          <h2>עוד לא נרשם תדלוק</h2>
          <p>רושמים ליטרים, מחיר וק״מ, וכל השדות לא חובה. מקבלים הוצאות לפי חודש ומעקב אחרי המחיר לליטר.</p>
          <button className="btn pri" onClick={() => open({ t: 'fuel' })}>
            <Icon name="plus" /> תדלוק ראשון
          </button>
        </div>
      ) : (
        <>
          <FuelChart fills={fills} range={range} setRange={r => { setRange(r); setOffset(0) }} offset={offset} setOffset={setOffset} period={period} />
          <div className="sec">
            <h2>התדלוקים</h2>
            <button className="add-btn" onClick={() => open({ t: 'fuel' })}>
              <Icon name="plus" /> תדלוק
            </button>
          </div>
          {months.map(m => (
            <section key={m}>
              <div className="year">
                <span>{MONTHS[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</span>
                <span>{fmtMoney(list.filter(f => f.date.startsWith(m)).reduce((n, f) => n + (f.price ?? 0), 0))}</span>
              </div>
              <div className="fuel-list">
                {list
                  .filter(f => f.date.startsWith(m))
                  .map(f => (
                    <button key={f.id} className="fuel-row" onClick={() => setReceipt(f)}>
                      <span className="fuel-ic">
                        <Icon name="fuel" />
                      </span>
                      <span className="fuel-main">
                        <span className="t">{f.station ?? 'תדלוק'}</span>
                        {/* when and how much; the km is on the receipt, to keep the row light */}
                        <span className="s">{[f.time ? `${fmtShortDate(f.date)} ${f.time}` : fmtShortDate(f.date), f.liters != null && `${f.liters} ל׳`].filter(Boolean).join(' · ')}</span>
                      </span>
                      <span className="fuel-price">
                        {f.price != null ? fmtMoney(f.price) : ''}
                        {perLiter(f) != null && <small>₪{perLiter(f)!.toFixed(2)} לל׳</small>}
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          ))}
        </>
      )}
      {receipt && (
        <FuelReceipt
          fill={receipt}
          fills={fills}
          onClose={() => setReceipt(null)}
          onEdit={() => {
            setReceipt(null)
            open({ t: 'fuel', record: receipt })
          }}
        />
      )}
    </div>
  )
}

interface Point {
  key: string
  label: string
  value: number
}

const RANGES: [FuelRange, string][] = [
  ['m1', 'חודש'],
  ['m6', 'חצי שנה'],
  ['y1', 'שנה'],
  ['all', 'שנים'],
]

/** "ספט׳ 2026", "מאי–אוק׳ 2026", "2025", "כל השנים". */
export function periodLabel(range: FuelRange, p: Period) {
  if (range === 'all') return 'כל השנים'
  if (range === 'y1') return String(p.first.y)
  if (range === 'm1') return `${MONTHS[p.first.m]} ${p.first.y}`
  return p.first.y === p.last.y ? `${MONTHS[p.first.m]}–${MONTHS[p.last.m]} ${p.last.y}` : `${MONTHS[p.first.m]} ${p.first.y}–${MONTHS[p.last.m]} ${p.last.y}`
}

/**
 * Spending (bars) or the price per liter (a line) over the chosen period: a month (each fill-up),
 * half a year or a year (by month), or every year. The arrows step to the period before or after.
 */
function FuelChart({ fills, range, setRange, offset, setOffset, period }: { fills: Fuel[]; range: FuelRange; setRange(r: FuelRange): void; offset: number; setOffset(o: number): void; period: Period }) {
  const [view, setView] = useState<'spend' | 'price'>('spend')
  const earliest = fills.reduce((m, f) => (f.date < m ? f.date : m), todayIso())
  const canBack = range !== 'all' && period.from > earliest
  const canForward = range !== 'all' && offset < 0
  const inPeriod = [...fills].filter(f => inRange(f, period.from, period.to)).sort(byDate)
  const bucketLabel = (key: string) => (key.length === 4 ? key : MONTHS[Number(key.slice(5, 7)) - 1])
  const points: Point[] =
    range === 'm1'
      ? view === 'spend'
        ? inPeriod.filter(f => f.price != null).map(f => ({ key: f.id, label: fmtShortDate(f.date), value: f.price! }))
        : inPeriod.filter(f => perLiter(f) != null).map(f => ({ key: f.id, label: fmtShortDate(f.date), value: perLiter(f)! }))
      : period.buckets
          .map(b => {
            const t = totals(fills.filter(f => inRange(f, b.from, b.to)))
            return { key: b.key, label: bucketLabel(b.key), value: view === 'spend' ? t.spent : t.perLiter }
          })
          .filter((p): p is Point => p.value != null)
  const W = 320
  const H = 120
  const many = points.length > 8
  const top = Math.max(...points.map(p => p.value))
  // the highest bar (or point) is the blue one: where the most money went
  const peak = points.findIndex(p => p.value === top)
  // with many points, only the latest and the highest carry their number
  const showValue = (i: number) => !many || i === points.length - 1 || i === peak
  const fmtValue = (v: number) => (view === 'spend' ? fmtNum(v) : v.toFixed(2))
  const empty = view === 'spend' ? !points.some(p => p.value > 0) : points.length < 2

  return (
    <section className="card fuel-chart">
      <div className="seg" role="tablist">
        <button role="tab" aria-selected={view === 'spend'} className={view === 'spend' ? 'on' : ''} onClick={() => setView('spend')}>
          הוצאות
        </button>
        <button role="tab" aria-selected={view === 'price'} className={view === 'price' ? 'on' : ''} onClick={() => setView('price')}>
          מחיר לליטר
        </button>
      </div>
      <div className="chart-range" role="radiogroup" aria-label="טווח">
        {RANGES.map(([r, label]) => (
          <button key={r} role="radio" aria-checked={range === r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
            {label}
          </button>
        ))}
      </div>
      {empty ? (
        <div className="chart-empty">{view === 'spend' ? 'אין תדלוקים בתקופה הזאת.' : 'צריך לפחות 2 תדלוקים עם ליטרים וסכום בתקופה הזאת.'}</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H + 22}`} className={`chart ${many ? 'many' : ''}`} role="img" aria-label={view === 'spend' ? 'הוצאות דלק' : 'מחיר לליטר'}>
          {view === 'spend'
            ? (() => {
                const max = Math.max(1, top)
                const bw = W / Math.max(points.length, 4)
                const x0 = W - bw * points.length // a few bars stay at the right (start), not stretched across
                return points.map((p, i) => {
                  const h = (p.value / max) * (H - 18)
                  // oldest on the right, newest on the left (Hebrew reading order)
                  const x = x0 + (points.length - 1 - i) * bw + bw * 0.2
                  return (
                    <g key={p.key}>
                      <rect x={x} y={H - h} width={bw * 0.6} height={Math.max(h, p.value ? 2 : 0)} rx={many ? 3 : 6} className={i === peak ? 'bar now' : 'bar'} />
                      {p.value > 0 && showValue(i) && (
                        <text x={x + bw * 0.3} y={H - h - 5} className="val">
                          {fmtValue(p.value)}
                        </text>
                      )}
                      <text x={x + bw * 0.3} y={H + 16} className="lab">
                        {p.label}
                      </text>
                    </g>
                  )
                })
              })()
            : (() => {
                const vals = points.map(p => p.value)
                const lo = Math.min(...vals) * 0.97
                const hi = Math.max(...vals) * 1.02
                const step = (W - 40) / (points.length - 1)
                const pts = points.map((p, i) => [W - 20 - i * step, H - 10 - ((p.value - lo) / (hi - lo || 1)) * (H - 30)] as const)
                const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
                const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`
                return (
                  <>
                    <path d={area} className="area" />
                    <path d={path} className="line" />
                    {points.map((p, i) => (
                      <g key={p.key}>
                        <circle cx={pts[i][0]} cy={pts[i][1]} r={many ? 3 : 4} className={i === peak ? 'dot now' : 'dot'} />
                        {showValue(i) && (
                          <text x={pts[i][0]} y={pts[i][1] - 9} className="val">
                            {fmtValue(p.value)}
                          </text>
                        )}
                        <text x={pts[i][0]} y={H + 16} className="lab">
                          {p.label}
                        </text>
                      </g>
                    ))}
                  </>
                )
              })()}
          <line x1="0" x2={W} y1={H} y2={H} className="axis" />
        </svg>
      )}
      {range !== 'all' && (
        <div className="chart-nav">
          {/* RTL: › (right) goes back in time, ‹ (left) forward */}
          <button onClick={() => setOffset(offset - 1)} disabled={!canBack} aria-label="התקופה הקודמת">
            <Icon name="back" />
          </button>
          <b>{periodLabel(range, period)}</b>
          <button onClick={() => setOffset(offset + 1)} disabled={!canForward} aria-label="התקופה הבאה">
            <Icon name="forward" />
          </button>
        </div>
      )}
    </section>
  )
}
/** A fill-up drawn as a paper receipt. Only a view: nothing here is a photo or saved as a file. */
function FuelReceipt({ fill, fills, onClose, onEdit }: { fill: Fuel; fills: Fuel[]; onClose(): void; onEdit(): void }) {
  useBackLayer(true, onClose)
  const pl = perLiter(fill)
  const eco = economyOf(fills, fill.id)
  const no = fill.id.replace(/\W/g, '').slice(-6).toUpperCase()
  return createPortal(
    <div className="dialog-overlay" onClick={onClose}>
      <div className="fuel-receipt" role="dialog" aria-modal="true" aria-label="קבלת תדלוק" onClick={e => e.stopPropagation()}>
        <div className="receipt-paper">
          <div className="r-head">
            <Icon name="fuel" />
            <b>{fill.station ?? 'תחנת דלק'}</b>
            <span>{fmtDate(fill.date)}{fill.time ? ` · ${fill.time}` : ''}</span>
            <span dir="ltr">#{no}</span>
          </div>
          <div className="r-cut" />
          {/* only what was logged: a missing value is left out, not shown as a dash */}
          {fill.liters != null && (
            <div className="r-row">
              <span>ליטרים</span>
              <span dir="ltr">{fill.liters.toFixed(2)}</span>
            </div>
          )}
          {pl != null && (
            <div className="r-row">
              <span>מחיר לליטר</span>
              <span dir="ltr">{money2(pl)}</span>
            </div>
          )}
          {fill.km != null && (
            <div className="r-row">
              <span>ק״מ ברכב</span>
              <span dir="ltr">{fmtNum(fill.km)}</span>
            </div>
          )}
          <div className="r-row">
            <span>סוג מילוי</span>
            <span>{fill.full ? 'מלא' : 'חלקי'}</span>
          </div>
          {fill.price != null && (
            <>
              <div className="r-cut" />
              <div className="r-row r-total">
                <span>סה״כ</span>
                <span dir="ltr">{money2(fill.price)}</span>
              </div>
            </>
          )}
          {eco && (
            <div className="r-eco">
              {eco.kmPerLiter.toFixed(1)} ק״מ לליטר · {fmtNum(eco.km)} ק״מ מאז המילוי המלא הקודם
            </div>
          )}
          <div className="r-bars" aria-hidden="true" />
          <div className="r-foot">קבלה לתצוגה בלבד · CarBoard</div>
        </div>
        <div className="receipt-btns">
          <button className="btn" onClick={onEdit}>
            <Icon name="edit" /> עריכה
          </button>
          <button className="btn pri" onClick={onClose}>
            סגירה
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
