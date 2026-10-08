import { useState } from 'react'
import { Icon, kindIcon } from '../components/Icon'
import { Glance, GlanceCell, PageHero, TopBar, useCountUp } from '../components/Chrome'
import { Scene } from '../components/Scene'
import { Brand } from '../components/Brand'
import { useApp } from '../data/AppData'
import { STATUS_TEXT } from '../domain/labels'
import type { Reminder } from '../domain/reminders'
import { fmtNum, greeting, longDate } from '../lib/i18n'
import type { OpenSheet } from '../App'

const FIRST = ['test', 'insurance', 'service']
// fixed places for the main reminders; Array.sort is stable, so the rest keep their urgency order
const rank = (r: Reminder) => (FIRST.includes(r.item.kind) ? FIRST.indexOf(r.item.kind) : FIRST.length)

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
  const [confirming, setConfirming] = useState(false)
  const kmShown = useCountUp(km.value)

  if (!car)
    return (
      <div className="welcome scenic reveal">
        <Scene />
        <Brand />
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
  const insurance = reminders.find(r => r.item.kind === 'insurance')
  const test = reminders.find(r => r.item.kind === 'test')
  const state = urgent.length ? (urgent.some(r => r.status === 'overdue') ? 'overdue' : 'due') : soon.length ? 'soon' : 'ok'
  const stateText = urgent.length
    ? `${urgent.length === 1 ? 'דבר אחד' : `${urgent.length} דברים`} לטפל בהם: ${urgent.map(r => r.item.label).join(', ')}`
    : soon.length
      ? `הכל תקין · בקרוב ${soon[0].item.label}, ${soon[0].headline}`
      : 'הכל תקין'

  return (
    <div className="reveal">
      <PageHero dial>
        <TopBar openCars={openCars} openSettings={openSettings} />
        <div className="greet">
          <div className="date">{longDate()}</div>
          <h1>{userName ? `שלום, ${userName}` : greeting()}</h1>
          <div className="state-pill" data-s={state}>
            {stateText}
          </div>
        </div>
        <Glance>
          <GlanceCell
            k="ק״מ"
            v={fmtNum(kmShown)}
            d={km.checkedDaysAgo ? `הערכה · ${km.checkedDaysAgo} ימים` : 'מעודכן היום'}
            onClick={() => open({ t: 'odo' })}
            tour="km"
          />
          {insurance && <ReminderCell r={insurance} title="ביטוח" open={open} tour="insurance" />}
          {test && <ReminderCell r={test} title="טסט" open={open} tour="test" />}
        </Glance>
      </PageHero>

      <div className="actions" data-tour="actions">
        <button onClick={() => open({ t: 'odo' })}>
          <Icon name="gauge" />
          עדכון ק״מ
        </button>
        <button onClick={() => open({ t: 'item' })}>
          <Icon name="reminder" />
          תזכורת
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
              disabled={confirming}
              onClick={async () => {
                setConfirming(true)
                try {
                  await actions.addReading(car.id, km.value, 'confirm')
                  dismiss()
                } finally {
                  setConfirming(false)
                }
              }}
            >
              {confirming ? <span className="spin inline" /> : <><Icon name="check" /> נכון</>}
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
        <button className="add-btn" onClick={() => open({ t: 'item' })}>
          <Icon name="plus" /> תזכורת חדשה
        </button>
      </div>
      <div className="tiles" style={{ marginTop: 0 }} data-tour="tiles">
        {/* test, insurance and periodic service in fixed places first (right to left, row by row), the rest by urgency */}
        {[...reminders].sort((a, b) => rank(a) - rank(b)).map(r => (
          <Tile key={r.item.id} r={r} open={open} />
        ))}
      </div>
    </div>
  )
}

function ReminderCell({ r, title, open, tour }: { r: Reminder; title: string; open: OpenSheet; tour?: string }) {
  return (
    <GlanceCell
      k={title}
      // the unit moves to the line below so the number fits the narrow cell
      v={r.status === 'unset' ? '—' : r.headline.replace(' ק״מ', '')}
      d={r.headline.endsWith('ק״מ') ? `ק״מ · ${STATUS_TEXT[r.status]}` : STATUS_TEXT[r.status]}
      s={r.status}
      onClick={() => open({ t: 'item', item: r.item })}
      tour={tour}
    />
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
