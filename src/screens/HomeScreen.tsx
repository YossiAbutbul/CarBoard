import { useState } from 'react'
import { Icon, kindIcon } from '../components/Icon'
import { Glance, GlanceCell, PageHero, TopBar, useCountUp } from '../components/Chrome'
import { useApp } from '../data/AppData'
import { STATUS_TEXT } from '../domain/labels'
import type { Reminder } from '../domain/reminders'
import { fmtDate, fmtNum, greeting, longDate } from '../lib/i18n'
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

  if (!car) return null // no car: App shows the first-run car step instead

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
    ? urgent.length === 1
      ? `${urgent[0].item.label} · ${STATUS_TEXT[urgent[0].status]}`
      : `${urgent.length} דברים לטפל בהם`
    : soon.length
      ? `הכל תקין · בקרוב ${soon[0].item.label}, ${soon[0].headline}`
      : 'הכל תקין'

  return (
    <div className="reveal home">
      <PageHero dial>
        <TopBar openCars={openCars} openSettings={openSettings} />
        <div className="greet">
          <div className="date">{longDate()}</div>
          <h1>{userName ? `שלום, ${userName}` : greeting()}</h1>
          {/* when something needs action, the pill opens "when will you take care of it?" (into the calendar) */}
          {urgent.length ? (
            <button className="state-pill go" data-s={state} onClick={() => open({ t: 'schedule' })}>
              {stateText}
              <Icon name="forward" />
            </button>
          ) : (
            <div className="state-pill" data-s={state}>
              {stateText}
            </div>
          )}
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

      {/* on a PC the actions and the weekly check sit side by side under the status cards */}
      <div className="home-duo">
      <div className="actions" data-tour="actions">
        {/* the small line under each label shows on a PC only, where the buttons are larger */}
        <button onClick={() => open({ t: 'odo' })}>
          <span className="a-ic">
            <Icon name="gauge" />
          </span>
          <span className="a-l">
            עדכון ק״מ<small>עכשיו {fmtNum(km.value)}</small>
          </span>
        </button>
        <button onClick={() => open({ t: 'item' })}>
          <span className="a-ic">
            <Icon name="reminder" />
          </span>
          <span className="a-l">
            תזכורת<small>טסט, שמן, צמיגים…</small>
          </span>
        </button>
        <button onClick={() => open({ t: 'service' })}>
          <span className="a-ic">
            <Icon name="service" />
          </span>
          <span className="a-l">
            טיפול<small>רישום עם קבלה</small>
          </span>
        </button>
        <button onClick={() => open({ t: 'doc' })}>
          <span className="a-ic">
            <Icon name="docs" />
          </span>
          <span className="a-l">
            מסמך<small>צילום או קובץ</small>
          </span>
        </button>
      </div>

      {stale && !dismissed && !hidden && (
        <div className="card confirm">
          <div className="q">בדיקה שבועית: הרכב עומד בערך על</div>
          <div className="num">{fmtNum(km.value)} ק״מ?</div>
          <div className="hint" style={{ marginBottom: 10 }}>
            {km.basis === 'learned'
              ? `לפי הממוצע שלך, ${fmtNum(km.perDay)} ק״מ ביום`
              : km.basis === 'yearly'
                ? `לפי ${fmtNum(car.yearly_km ?? 0)} ק״מ בשנה, עד שנלמד את הקצב שלך`
                : 'לפי ממוצע ארצי, עד שנלמד את שלך'}
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

      {/* PC only: what is coming up, in date order (the phone has no room for it beside the cards) */}
      <Upcoming reminders={reminders} open={open} />
      </div>

      <div className="sec">
        <h2>מצב הרכב</h2>
        <button className="add-btn" onClick={() => open({ t: 'item' })}>
          תזכורת חדשה <Icon name="plus" />
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

function Upcoming({ reminders, open }: { reminders: Reminder[]; open: OpenSheet }) {
  const next = reminders
    .filter(r => r.status !== 'unset' && r.dueOn)
    .sort((a, b) => (a.dueOn! < b.dueOn! ? -1 : 1))
    .slice(0, 5)
  if (!next.length) return null
  return (
    <div className="upcoming">
      <h3>בקרוב</h3>
      {next.map(r => (
        <button key={r.item.id} data-s={r.status} onClick={() => open({ t: 'item', item: r.item })}>
          <span className="u-ic">
            <Icon name={kindIcon(r.item.kind)} />
          </span>
          <span className="u-l">
            <b>{r.item.label}</b>
            <small>{r.by === 'km' ? `בערך ${fmtDate(r.dueOn!)}` : fmtDate(r.dueOn!)}</small>
          </span>
          <span className="u-v">{r.status === 'overdue' ? STATUS_TEXT.overdue : r.headline}</span>
        </button>
      ))}
    </div>
  )
}

function ReminderCell({ r, title, open, tour }: { r: Reminder; title: string; open: OpenSheet; tour?: string }) {
  return (
    <GlanceCell
      k={title}
      // the unit moves to the line below so the number fits the narrow cell
      v={r.status === 'unset' ? 'אין' : r.headline.replace(' ק״מ', '')}
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
      {r.status === 'unset' ? (
        // not set yet: the same three lines as the others, the bar empty and an invitation under it
        <>
          <div className="v" style={{ fontSize: 20 }}>{r.headline}</div>
          <div className="tbar unset-bar" aria-hidden="true" />
          <div className="tfoot">
            <span className="set-cta">
              הגדרת מועד <Icon name="plus" />
            </span>
          </div>
        </>
      ) : (
        <>
          {/* the time bar: empties as the date (or the km) comes closer */}
          <div className="v" style={{ fontSize: 20 }}>{r.headline}</div>
          <div className="tbar" aria-hidden="true">
            <i style={{ width: `${r.status === 'overdue' ? 100 : Math.max(4, (1 - r.progress) * 100)}%` }} />
          </div>
          <div className="tfoot">
            <span className="state">{STATUS_TEXT[r.status]}</span>
            {r.dueOn && <span className="when">{fmtDate(r.dueOn)}</span>}
          </div>
        </>
      )}
    </button>
  )
}
