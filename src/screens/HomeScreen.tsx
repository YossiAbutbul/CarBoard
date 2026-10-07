import { useState } from 'react'
import { CarArt, CarImage, Ring, statusColor } from '../components/ui'
import { useApp } from '../data/AppData'
import { KIND } from '../domain/labels'
import type { Reminder } from '../domain/reminders'
import { agoText, fmtNum, greeting } from '../lib/i18n'
import type { OpenSheet } from '../App'

const weekKey = (carId: string) => `car-records:confirm:${carId}:${Math.floor(Date.now() / (7 * 86_400_000))}`

export function HomeScreen({ open }: { open: OpenSheet }) {
  const { data, car, km, reminders, setCarId, actions } = useApp()
  const [hidden, setHidden] = useState(false)

  if (!car)
    return (
      <div className="empty">
        <CarArt className="art" color="אדום" />
        <h2>ברוך הבא לרכב שלך</h2>
        <p>כל הטיפולים, הק״מ, הטסט והביטוח במקום אחד. מתחילים במספר הרכב.</p>
        <button className="btn pri" onClick={() => open({ t: 'car' })}>＋ הוספת רכב</button>
      </div>
    )

  const service = reminders.find(r => r.item.kind === 'service' && r.status !== 'unset')
  const stale = km.checkedDaysAgo != null && km.checkedDaysAgo >= 7
  let dismissed = false
  try {
    dismissed = localStorage.getItem(weekKey(car.id)) === '1'
  } catch {
    // storage blocked
  }
  const showConfirm = stale && !dismissed && !hidden

  const dismiss = () => {
    try {
      localStorage.setItem(weekKey(car.id), '1')
    } catch {
      // storage blocked
    }
    setHidden(true)
  }

  const cars = data.cars
  const nextCar = () => {
    const i = cars.findIndex(c => c.id === car.id)
    setCarId(cars[(i + 1) % cars.length].id)
  }

  const attention = reminders.filter(r => r.status !== 'ok' && r.status !== 'unset')
  const rest = reminders.filter(r => r.status === 'ok' || r.status === 'unset')

  return (
    <>
      <div className="top">
        <div>
          <h1>{greeting()}</h1>
          <div className="sub">{attention.length ? `${attention.length} דברים דורשים תשומת לב` : 'הכל מסודר ✓'}</div>
        </div>
        {cars.length > 1 ? (
          <button className="pill" onClick={nextCar}>
            🚗 {car.name} · {cars.length} רכבים ⇄
          </button>
        ) : (
          <button className="pill" onClick={() => open({ t: 'car' })}>＋ רכב</button>
        )}
      </div>

      <div className="hero-wrap">
        <div className="hero-car">
          <CarImage car={car} />
        </div>
        <div className="hero">
          <div className="head">
            <div className="meta">{[car.make, car.year, car.color].filter(Boolean).join(' · ')}</div>
            <div className="name">{car.name}</div>
            {car.plate && <span className="plate">{car.plate}</span>}
          </div>
          <div className="kmrow">
            <button style={{ color: '#fff', textAlign: 'right' }} onClick={() => open({ t: 'odo' })} aria-label="עדכון ק״מ">
              <div className="km-big">
                {fmtNum(km.value)}
                {km.checkedDaysAgo ? <span style={{ opacity: 0.55, fontWeight: 600, marginInlineStart: 4 }}>≈</span> : null}
                <small>ק״מ</small>
              </div>
              <div className="est">
                <i className={stale ? 'stale' : ''} />
                {km.checkedDaysAgo ? 'הערכה חכמה' : 'מעודכן'} · אומת {agoText(km.checkedDaysAgo ?? 0)}
              </div>
            </button>
            {service && service.kmLeft != null && (
              <Ring progress={service.progress} color={service.status === 'ok' ? 'var(--amber)' : statusColor(service.status)}>
                <span>
                  <b>{service.kmLeft < 0 ? 'עבר' : fmtNum(service.kmLeft)}</b>
                  {service.kmLeft < 0 ? 'מועד טיפול' : 'ק״מ לטיפול'}
                </span>
              </Ring>
            )}
          </div>
          <div className="hero-acts">
            <button className="pri" onClick={() => open({ t: 'odo' })}>עדכון ק״מ</button>
            <button onClick={() => open({ t: 'service' })}>＋ טיפול</button>
            <button onClick={() => open({ t: 'odo', photo: true })}>📷 צילום</button>
          </div>
        </div>
      </div>

      {showConfirm && (
        <div className="card confirm">
          <div className="hint">בדיקה שבועית</div>
          <div className="q">הרכב על בערך</div>
          <div className="num">{fmtNum(km.value)} ק״מ?</div>
          <div className="hint" style={{ marginBottom: 12 }}>
            לפי ממוצע של {fmtNum(km.perDay)} ק״מ ביום{km.learned ? '' : ' (ממוצע ארצי, עד שנלמד את שלך)'}
          </div>
          <div className="row2">
            <button
              className="btn pri"
              onClick={async () => {
                await actions.addReading(car.id, km.value, 'confirm')
                dismiss()
              }}
            >
              ✓ כן, בערך
            </button>
            <button className="btn" onClick={() => open({ t: 'odo' })}>✎ לעדכן</button>
          </div>
          <button className="hint" style={{ display: 'block', margin: '10px auto 0' }} onClick={dismiss}>
            לא עכשיו
          </button>
        </div>
      )}

      {attention.length > 0 && (
        <>
          <div className="sec">דורש תשומת לב</div>
          <Tiles list={attention} open={open} />
        </>
      )}
      <div className="sec">
        <span>{attention.length ? 'שאר הרכב' : 'מצב הרכב'}</span>
        <button onClick={() => open({ t: 'item' })}>＋ תזכורת</button>
      </div>
      <Tiles list={rest} open={open} />
    </>
  )
}

function Tiles({ list, open }: { list: Reminder[]; open: OpenSheet }) {
  return (
    <div className="grid">
      {list.map(r => (
        <button key={r.item.id} className={`tile ${r.status}`} onClick={() => open({ t: 'item', item: r.item })}>
          <div className="l">
            <span className={`dot ${r.status}`} />
            {r.item.label}
          </div>
          <div className="v">{r.headline}</div>
          <div className="d">{r.detail}</div>
          {r.status !== 'unset' && (
            <div className="bar">
              <i style={{ width: `${Math.max(6, r.progress * 100)}%`, background: statusColor(r.status) }} />
            </div>
          )}
          <span style={{ position: 'absolute', top: 12, left: 12, fontSize: 16, opacity: 0.5 }}>{KIND[r.item.kind].icon}</span>
        </button>
      ))}
    </div>
  )
}
