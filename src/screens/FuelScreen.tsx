import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../components/Icon'
import { Glance, GlanceCell, PageHero, TopBar, useCountUp } from '../components/Chrome'
import { useApp } from '../data/AppData'
import { useBackLayer } from '../lib/back'
import { averageEconomy, byDate, economy, economyOf, monthlySpend, perLiter } from '../domain/fuel'
import { fmtDate, fmtMoney, fmtNum, fmtShortDate } from '../lib/i18n'
import type { Fuel } from '../types'
import type { OpenSheet } from '../App'

const MONTHS = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
const money2 = (n: number) => `₪${n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function FuelScreen({ open, openCars, openSettings }: { open: OpenSheet; openCars(): void; openSettings(): void }) {
  const { data, car } = useApp()
  const [receipt, setReceipt] = useState<Fuel | null>(null)
  const fills = data.fuel.filter(f => f.car_id === car?.id)
  const list = [...fills].sort(byDate).reverse() // newest first
  const month = new Date().toISOString().slice(0, 7)
  const monthTotal = fills.filter(f => f.date.startsWith(month)).reduce((n, f) => n + (f.price ?? 0), 0)
  const monthShown = useCountUp(monthTotal)
  if (!car) return null
  const avg = averageEconomy(fills)
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
          <GlanceCell k="החודש" v={fmtMoney(monthShown)} d={`${fills.filter(f => f.date.startsWith(month)).length} תדלוקים`} />
          <GlanceCell k="ק״מ לליטר" v={avg ? avg.toFixed(1) : '—'} d={avg ? 'ממוצע, בין מילויים מלאים' : 'אחרי 2 מילויים מלאים'} />
          <GlanceCell k="מחיר לליטר" v={lastPrice ? `₪${lastPrice.toFixed(2)}` : '—'} d={lastPrice ? 'בתדלוק האחרון' : 'עוד אין'} />
        </Glance>
      </PageHero>

      {list.length === 0 ? (
        <div className="empty">
          <div className="glyph">
            <Icon name="fuel" />
          </div>
          <h2>עוד לא נרשם תדלוק</h2>
          <p>רושמים ליטרים, מחיר וק״מ, וכל השדות לא חובה. מקבלים הוצאות לפי חודש וכמה ק״מ לליטר הרכב עושה.</p>
          <button className="btn pri" onClick={() => open({ t: 'fuel' })}>
            <Icon name="plus" /> תדלוק ראשון
          </button>
        </div>
      ) : (
        <>
          <FuelChart fills={fills} />
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
                        <span className="s">
                          {[fmtShortDate(f.date), f.liters != null && `${f.liters} ל׳`, perLiter(f) != null && `₪${perLiter(f)!.toFixed(2)} לל׳`, f.km != null && `${fmtNum(f.km)} ק״מ`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className="fuel-price">{f.price != null ? fmtMoney(f.price) : ''}</span>
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

/** Spending per month (bars) or km per liter over the recent full tanks (a line). */
function FuelChart({ fills }: { fills: Fuel[] }) {
  const [view, setView] = useState<'spend' | 'economy'>('spend')
  const spend = monthlySpend(fills, 6)
  const eco = economy(fills).slice(-8)
  const W = 320
  const H = 120
  return (
    <section className="card fuel-chart">
      <div className="fuel-chart-head">
        <div className="seg" role="tablist">
          <button role="tab" aria-selected={view === 'spend'} className={view === 'spend' ? 'on' : ''} onClick={() => setView('spend')}>
            הוצאות
          </button>
          <button role="tab" aria-selected={view === 'economy'} className={view === 'economy' ? 'on' : ''} onClick={() => setView('economy')}>
            ק״מ לליטר
          </button>
        </div>
      </div>
      {view === 'spend' ? (
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="chart" role="img" aria-label="הוצאות דלק לפי חודש">
          {(() => {
            const max = Math.max(1, ...spend.map(s => s.total))
            const bw = W / spend.length
            return spend.map((s, i) => {
              const h = (s.total / max) * (H - 18)
              const x = W - (i + 1) * bw + bw * 0.2 // right to left: the latest month on the left end reads last in Hebrew
              return (
                <g key={s.month}>
                  <rect x={x} y={H - h} width={bw * 0.6} height={Math.max(h, s.total ? 2 : 0)} rx="6" className={i === spend.length - 1 ? 'bar now' : 'bar'} />
                  {s.total > 0 && (
                    <text x={x + bw * 0.3} y={H - h - 5} className="val">
                      {fmtNum(s.total)}
                    </text>
                  )}
                  <text x={x + bw * 0.3} y={H + 16} className="lab">
                    {MONTHS[Number(s.month.slice(5)) - 1]}
                  </text>
                </g>
              )
            })
          })()}
          <line x1="0" x2={W} y1={H} y2={H} className="axis" />
        </svg>
      ) : eco.length < 2 ? (
        <div className="chart-empty">צריך לפחות 3 מילויים מלאים עם ק״מ וליטרים כדי לראות מגמה.</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H + 22}`} className="chart" role="img" aria-label="ק״מ לליטר לאורך זמן">
          {(() => {
            const vals = eco.map(e => e.kmPerLiter)
            const lo = Math.min(...vals) * 0.9
            const hi = Math.max(...vals) * 1.05
            const step = (W - 40) / (eco.length - 1)
            // oldest on the right, newest on the left (Hebrew reading order)
            const pt = (v: number, i: number) => [W - 20 - i * step, H - 10 - ((v - lo) / (hi - lo || 1)) * (H - 30)] as const
            const pts = eco.map((e, i) => pt(e.kmPerLiter, i))
            const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
            const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`
            return (
              <>
                <path d={area} className="area" />
                <path d={path} className="line" />
                {eco.map((e, i) => (
                  <g key={e.id}>
                    <circle cx={pts[i][0]} cy={pts[i][1]} r="4" className={i === eco.length - 1 ? 'dot now' : 'dot'} />
                    <text x={pts[i][0]} y={pts[i][1] - 9} className="val">
                      {e.kmPerLiter.toFixed(1)}
                    </text>
                    <text x={pts[i][0]} y={H + 16} className="lab">
                      {fmtShortDate(e.date)}
                    </text>
                  </g>
                ))}
                <line x1="0" x2={W} y1={H} y2={H} className="axis" />
              </>
            )
          })()}
        </svg>
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
          <div className="r-row">
            <span>ליטרים</span>
            <span dir="ltr">{fill.liters != null ? fill.liters.toFixed(2) : '—'}</span>
          </div>
          <div className="r-row">
            <span>מחיר לליטר</span>
            <span dir="ltr">{pl != null ? money2(pl) : '—'}</span>
          </div>
          <div className="r-row">
            <span>ק״מ ברכב</span>
            <span dir="ltr">{fill.km != null ? fmtNum(fill.km) : '—'}</span>
          </div>
          <div className="r-row">
            <span>סוג מילוי</span>
            <span>{fill.full ? 'מלא' : 'חלקי'}</span>
          </div>
          <div className="r-cut" />
          <div className="r-row r-total">
            <span>סה״כ</span>
            <span dir="ltr">{fill.price != null ? money2(fill.price) : '—'}</span>
          </div>
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
