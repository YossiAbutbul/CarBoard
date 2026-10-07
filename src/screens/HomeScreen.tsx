import { useState } from 'react'
import { CarImage } from '../components/ui'
import { CarDrop, useCarPhotoUpload } from '../components/CarPhoto'
import { Icon, kindIcon } from '../components/Icon'
import { useApp } from '../data/AppData'
import { STATUS_TEXT } from '../domain/labels'
import type { Reminder } from '../domain/reminders'
import { agoText, fmtNum, greeting } from '../lib/i18n'
import type { OpenSheet } from '../App'

const weekKey = (carId: string) => `car-records:confirm:${carId}:${Math.floor(Date.now() / (7 * 86_400_000))}`

export function HomeScreen({
  open,
  openCars,
  openSettings,
  userName,
}: {
  open: OpenSheet
  openCars(): void
  openSettings(): void
  userName: string | null
}) {
  const { car, km, reminders, actions } = useApp()
  const [hidden, setHidden] = useState(false)
  const photo = useCarPhotoUpload()

  if (!car)
    return (
      <div className="welcome reveal">
        <div className="eyebrow" style={{ color: 'rgba(255,255,255,.7)' }}>הרכב שלי</div>
        <div className="status">
          <span>כל</span>
          <span>הרכב.</span>
          <span>במקום</span>
          <span>אחד.</span>
        </div>
        <button className="btn pri" onClick={() => open({ t: 'car' })}>
          <Icon name="plus" /> הוספת רכב לפי מספר רישוי
        </button>
      </div>
    )

  const stale = km.checkedDaysAgo != null && km.checkedDaysAgo >= 7
  let dismissed = false
  try {
    dismissed = localStorage.getItem(weekKey(car.id)) === '1'
  } catch {
    // storage blocked
  }
  const dismiss = () => {
    try {
      localStorage.setItem(weekKey(car.id), '1')
    } catch {
      // storage blocked
    }
    setHidden(true)
  }

  const urgent = reminders.filter(r => r.status === 'due' || r.status === 'overdue')
  const soon = reminders.filter(r => r.status === 'soon')
  const service = reminders.find(r => r.item.kind === 'service')
  const others = reminders.filter(r => r !== service)

  // Greeting first, like the BMW app; the car's state sits under it as one short line.
  const [line1, line2] = userName ? ['שלום,', userName] : greeting().split(' ')
  const state = urgent.length ? (urgent.some(r => r.status === 'overdue') ? 'overdue' : 'due') : soon.length ? 'soon' : 'ok'
  const stateText = urgent.length
    ? `${urgent.length === 1 ? 'דבר אחד' : `${urgent.length} דברים`} לטפל בהם: ${urgent.map(r => r.item.label).join(', ')}`
    : soon.length
      ? `הכל תקין · בקרוב ${soon[0].item.label}, ${soon[0].headline}`
      : 'הכל תקין'

  return (
    <div className="reveal">
      <section className="hero">
        <div className="bar">
          <button onClick={openSettings} aria-label="הגדרות">
            <Icon name="settings" />
          </button>
          <button className="title" onClick={openCars} aria-label="החלפת רכב">
            <span>
              {car.name} <span className="caret">▾</span>
            </span>
            {car.plate && <small>{car.plate}</small>}
          </button>
          <button onClick={openCars} aria-label="הרכבים שלי">
            <Icon name="swap" />
          </button>
        </div>
        <div className="status">
          <span>{line1}</span>
          <span>{line2}</span>
          <div className="sm state-line" data-s={state}>
            {stateText}
          </div>
        </div>
        <div className="car">
          <CarImage
            car={car}
            empty={
              <CarDrop
                dark
                progress={photo.progress}
                error={photo.error}
                onFile={async f => {
                  const ref = await photo.upload(f)
                  if (ref) await actions.updateCar(car.id, { image_url: ref })
                }}
              />
            }
          />
        </div>
      </section>

      <div className="tiles">
        <button className="tile" onClick={() => open({ t: 'odo' })}>
          <div className="l">ק״מ</div>
          <div className="s">{km.checkedDaysAgo ? `הערכה · אומת ${agoText(km.checkedDaysAgo)}` : 'מעודכן היום'}</div>
          <div className="v">
            {fmtNum(km.value)}
            <small>ק״מ</small>
          </div>
        </button>
        {service && <Tile r={service} open={open} />}
      </div>

      <div className="actions">
        <button onClick={() => open({ t: 'odo' })}>
          <Icon name="gauge" />
          עדכון ק״מ
        </button>
        <button onClick={() => open({ t: 'odo', photo: true })}>
          <Icon name="camera" />
          צילום לוח
        </button>
        <button onClick={() => open({ t: 'service' })}>
          <Icon name="service" />
          טיפול
        </button>
        <button onClick={() => open({ t: 'doc' })}>
          <Icon name="docs" />
          מסמך
        </button>
      </div>

      {stale && !dismissed && !hidden && (
        <div className="card confirm">
          <div className="q">בדיקה שבועית: הרכב עומד בערך על</div>
          <div className="num">{fmtNum(km.value)} ק״מ?</div>
          <div className="hint" style={{ marginBottom: 10 }}>
            {km.learned ? `לפי הממוצע שלך, ${fmtNum(km.perDay)} ק״מ ביום` : 'לפי ממוצע ארצי, עד שנלמד את שלך'}
          </div>
          <div className="row2">
            <button
              className="btn pri"
              onClick={async () => {
                await actions.addReading(car.id, km.value, 'confirm')
                dismiss()
              }}
            >
              <Icon name="check" /> נכון
            </button>
            <button className="btn" onClick={() => open({ t: 'odo' })}>
              לעדכן
            </button>
          </div>
          <button className="hint" style={{ marginTop: 6 }} onClick={dismiss}>
            לא עכשיו
          </button>
        </div>
      )}

      <div className="sec">
        <h2>מצב הרכב</h2>
        <button onClick={() => open({ t: 'item' })}>
          <Icon name="plus" /> תזכורת
        </button>
      </div>
      <div className="tiles" style={{ marginTop: 0 }}>
        {others.map(r => (
          <Tile key={r.item.id} r={r} open={open} />
        ))}
      </div>
    </div>
  )
}

function Tile({ r, open }: { r: Reminder; open: OpenSheet }) {
  const { data } = useApp()
  const insurer =
    r.item.kind === 'insurance' ? data.documents.find(d => d.car_id === r.item.car_id && d.kind === 'insurance')?.provider : null
  return (
    <button className="tile" data-s={r.status} onClick={() => open({ t: 'item', item: r.item })}>
      <div className="l" style={{ display: 'flex', justifyContent: 'space-between' }}>
        {r.item.label}
        <Icon name={kindIcon(r.item.kind)} />
      </div>
      {insurer && <span className="s">{insurer}</span>}
      <span className="state">{STATUS_TEXT[r.status]}</span>
      <div className="v" style={{ fontSize: 20 }}>{r.headline}</div>
    </button>
  )
}
