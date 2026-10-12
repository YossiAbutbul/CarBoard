import { useState } from 'react'
import { Sheet } from '../components/ui'
import { DateField } from '../components/DateField'
import { TimeField } from '../components/TimeField'
import { Icon, kindIcon } from '../components/Icon'
import { useApp } from '../data/AppData'
import { STATUS_TEXT } from '../domain/labels'
import type { Reminder } from '../domain/reminders'
import { addDays, todayIso } from '../lib/dates'
import { fmtDate } from '../lib/i18n'
import { androidCalendarUrl, eventUrl, googleCalendarUrl, type Appointment } from '../lib/schedule'

const isAndroid = () => /android/i.test(navigator.userAgent)
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

// tomorrow, or Sunday when tomorrow is Saturday (most garages are closed)
const nextDay = () => {
  const t = addDays(todayIso(), 1)
  return new Date(`${t}T12:00:00`).getDay() === 6 ? addDays(t, 1) : t
}

interface Plan {
  date: string
  time: string
  place: string
  added: boolean
}

/**
 * "When will you take care of it?" From the home screen's status, when things need action. Each thing
 * gets its own appointment: open it, pick a day, a time and a place, and it goes straight into the
 * phone's calendar (no file to download). Then the next one opens.
 */
export function ScheduleSheet({ onClose }: { onClose(): void }) {
  const { car, reminders, data } = useApp()
  const [urgent] = useState(() => reminders.filter(r => r.status === 'due' || r.status === 'overdue'))
  const [plans, setPlans] = useState<Record<string, Plan>>(() =>
    Object.fromEntries(urgent.map(r => [r.item.id, { date: nextDay(), time: '09:00', place: '', added: false }])),
  )
  const [openId, setOpenId] = useState<string | null>(urgent[0]?.item.id ?? null)
  if (!car) return null
  const ios = isIos()
  // the main button: the phone's own calendar where there is a way in, else Google's page
  const main = ios ? 'phone' : isAndroid() ? 'android' : 'google'
  const set = (id: string, patch: Partial<Plan>) => setPlans(p => ({ ...p, [id]: { ...p[id], ...patch } }))

  const appointment = (r: Reminder, p: Plan): Appointment => ({
    title: `${car.name}: ${r.item.label}`,
    details: [`${r.item.label}: ${STATUS_TEXT[r.status]} (${r.headline})`, '', 'נקבע ב־CarBoard'].join('\n'),
    location: p.place.trim(),
    date: p.date,
    time: p.time,
    minutes: 60,
  })
  // into the calendar, then on to the next one not added yet
  const add = (r: Reminder, where: 'phone' | 'android' | 'google') => {
    const a = appointment(r, plans[r.item.id])
    if (where === 'phone') window.location.assign(eventUrl(a, location.origin)) // iOS: its "Add Event" screen
    else if (where === 'android') window.location.assign(androidCalendarUrl(a)) // Android: pick a calendar app
    else window.open(googleCalendarUrl(a), '_blank', 'noopener')
    set(r.item.id, { added: true })
    setOpenId(urgent.find(x => x.item.id !== r.item.id && !plans[x.item.id].added)?.item.id ?? null)
  }
  const allAdded = urgent.every(r => plans[r.item.id].added)

  const current = urgent.find(r => r.item.id === openId) ?? null
  // the garages already used for this car, most recent first
  const garages = [...new Set(data.services.filter(x => x.car_id === car.id && x.garage?.trim()).sort((a, b) => (a.date < b.date ? 1 : -1)).map(x => x.garage!.trim()))].slice(0, 4)
  const ready = (r: Reminder) => Boolean(plans[r.item.id].date) && /^\d{2}:\d{2}$/.test(plans[r.item.id].time)

  const many = urgent.length > 1

  return (
    <Sheet title="קביעת מועד" onClose={onClose}>
      <div className="card schedule">
        <p className="hint">{many ? 'לכל אחד מועד משלו. נוסיף ליומן, עם תזכורת שעה לפני.' : 'מתי תטפלו בזה? נוסיף ליומן, עם תזכורת שעה לפני.'}</p>
        {/* the things to schedule, side by side: the one being set, and a tick on what is in the calendar */}
        {many && (
          <div className="sched-tabs" role="tablist">
            {urgent.map(r => (
              <button key={r.item.id} role="tab" aria-selected={openId === r.item.id} className={`${openId === r.item.id ? 'on' : ''} ${plans[r.item.id].added ? 'added' : ''}`} data-s={r.status} onClick={() => setOpenId(r.item.id)}>
                {plans[r.item.id].added ? <Icon name="check" /> : <i className="dot" />}
                {r.item.label}
              </button>
            ))}
          </div>
        )}
        {current ? (
          planCard(current)
        ) : (
          <div className="sched-done">
            <span className="ic">
              <Icon name="check" />
            </span>
            {many ? 'הכל ביומן. אפשר לבחור למעלה כדי לשנות.' : 'נוסף ליומן.'}
          </div>
        )}
        {/* one button, always in view at the bottom: for the item that is open, or "done" */}
        <div className="sched-foot">
          {current ? (
            <button className="btn pri" disabled={!ready(current)} onClick={() => add(current, main)}>
              {plans[current.item.id].added ? 'הוספה שוב ליומן' : main === 'google' ? 'הוספה ליומן Google' : 'הוספה ליומן'} <Icon name="calendar" />
            </button>
          ) : (
            <button className={`btn ${allAdded ? 'pri' : ''}`} onClick={onClose}>
              {allAdded ? (
                <>
                  סיום <Icon name="check" />
                </>
              ) : (
                'סגירה'
              )}
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )

  // the one being set: what it is, then the day, the time and the place
  function planCard(r: Reminder) {
    const p = plans[r.item.id]
    return (
      <div key={r.item.id} className={`sched-now ${p.added ? 'added' : ''}`} data-s={r.status}>
        <div className="sched-head">
          <span className="ic">
            <Icon name={kindIcon(r.item.kind)} />
          </span>
          <span className="t">
            {r.item.label}
            <small>{p.added ? `נוסף ליומן · ${fmtDate(p.date)} ${p.time}` : `${STATUS_TEXT[r.status]} · ${r.headline}`}</small>
          </span>
        </div>
        <div className="row2">
          <div>
            <label className="lbl">יום</label>
            <DateField value={p.date} onChange={date => set(r.item.id, { date })} clearable={false} />
          </div>
          <div>
            <label className="lbl">שעה</label>
            <TimeField value={p.time} onChange={time => set(r.item.id, { time })} />
          </div>
        </div>
        <label className="lbl">איפה (לא חובה)</label>
        <input
          className="in"
          value={p.place}
          onChange={e => set(r.item.id, { place: e.target.value })}
          onKeyDown={e => {
            // the keyboard's action key adds it, no need to close the keyboard first
            if (e.key === 'Enter' && ready(r)) {
              ;(e.target as HTMLInputElement).blur()
              add(r, main)
            }
          }}
          enterKeyHint="send"
          placeholder="למשל: מוסך אבי, חולון"
        />
        {/* places already used, from the service history: usually one tap, no keyboard */}
        {garages.length > 0 && (
          <div className="chips place-chips">
            {garages.map(g => (
              <button key={g} className={p.place === g ? 'on' : ''} onClick={() => set(r.item.id, { place: p.place === g ? '' : g })}>
                {g}
              </button>
            ))}
          </div>
        )}
        {/* the other calendar, for whoever uses it: a small link, the main button is below */}
        <button className="sched-other" disabled={!ready(r)} onClick={() => add(r, main === 'google' ? 'phone' : 'google')}>
          {main === 'google' ? 'להוסיף ליומן אחר (אייפון, Outlook)' : 'להוסיף ליומן Google במקום'}
        </button>
      </div>
    )
  }
}
