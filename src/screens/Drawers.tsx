import { ConfirmButton } from '../components/ConfirmButton'
import { Drawer } from '../components/ui'
import { Plate } from '../components/Chrome'
import { CarBadge } from '../components/CarAvatar'
import { Icon } from '../components/Icon'
import { useApp } from '../data/AppData'
import { supabase } from '../data/supabase'
import { downloadIcs } from '../lib/ics'
import { fmtNum } from '../lib/i18n'
import type { OpenSheet } from '../App'

/** Car switcher: opens from the right, where its button is. */
export function CarsDrawer({ open, onClose }: { open: OpenSheet; onClose(): void }) {
  const { data, car, setCarId, actions } = useApp()
  return (
    <Drawer title="הרכבים שלי" side="start" onClose={onClose}>
      <div className="car-list">
        {data.cars.map(c => (
          <div key={c.id} className={`car-row ${c.id === car?.id ? 'on' : ''}`}>
            <button
              className="car-row-main"
              onClick={() => {
                setCarId(c.id)
                onClose()
              }}
              aria-current={c.id === car?.id}
            >
              <span className="car-row-pic">
                <CarBadge car={c} />
              </span>
              <span className="car-row-info">
                <span className="t">
                  {c.name}
                  {c.id === car?.id && <Icon name="check" className="car-row-check" />}
                </span>
                <span className="s">{[c.year, c.color].filter(Boolean).join(' · ')}</span>
                {c.plate && <Plate number={c.plate} size="sm" />}
              </span>
            </button>
            <span className="car-row-acts">
              <button
                className="icon-btn"
                onClick={() => {
                  onClose()
                  open({ t: 'car', car: c })
                }}
                aria-label={`עריכת ${c.name}`}
              >
                <Icon name="edit" />
              </button>
              <ConfirmButton icon label={`מחיקת ${c.name} וכל הנתונים שלו`} onConfirm={() => actions.deleteCar(c.id)} />
            </span>
          </div>
        ))}
      </div>
      <button
        className="btn pri"
        style={{ marginTop: 14 }}
        onClick={() => {
          onClose()
          open({ t: 'car' })
        }}
      >
        <Icon name="plus" /> הוספת רכב
      </button>
    </Drawer>
  )
}

/** Settings: opens from the left, where its button is. */
export function SettingsDrawer({
  email,
  name,
  onName,
  onClose,
}: {
  email: string | null
  name: string
  onName(n: string): void
  onClose(): void
}) {
  const { car, km, reminders, store } = useApp()
  return (
    <Drawer title="הגדרות" side="end" onClose={onClose}>
      <section className="drawer-sec">
        <div className="drawer-label">השם שלך</div>
        <input className="in" defaultValue={name} placeholder="למשל: יוסי" onBlur={e => onName(e.target.value.trim())} onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        <div className="hint" style={{ marginTop: 6 }}>מופיע בברכה במסך הבית.</div>
      </section>
      {car && (
        <section className="drawer-sec">
          <div className="drawer-label">יומן</div>
          <div className="card">
            <div className="item" style={{ padding: 0 }}>
              <span className="ic">
                <Icon name="calendar" />
              </span>
              <div>
                <div className="t">הוספה ליומן של הטלפון</div>
                <div className="s">התראה 7 ימים לפני כל מועד. מועדי ק״מ לפי {fmtNum(km.perDay)} ק״מ ביום.</div>
              </div>
            </div>
            <button className="btn" style={{ marginTop: 14, background: '#fff' }} onClick={() => downloadIcs(car, reminders.filter(r => r.status !== 'unset'))}>
              ייצוא ליומן
            </button>
          </div>
        </section>
      )}

      <section className="drawer-sec">
        <div className="drawer-label">חשבון</div>
        <div className="card">
          <div className="item" style={{ padding: 0 }}>
            <span className="ic">
              <Icon name={store.mode === 'cloud' ? 'cloud' : 'device'} />
            </span>
            <div>
              <div className="t">{store.mode === 'cloud' ? 'מסונכרן לענן' : 'שמור במכשיר הזה'}</div>
              <div className="s">
                {store.mode === 'cloud' ? email : 'כדי לסנכרן בין מכשירים ולהתחבר עם Google, צריך לחבר Supabase (ראה README).'}
              </div>
            </div>
          </div>
          {store.mode === 'cloud' && (
            <button className="btn" style={{ marginTop: 14, background: '#fff' }} onClick={() => supabase?.auth.signOut()}>
              התנתקות
            </button>
          )}
        </div>
      </section>
      <div className="foot">הרכב שלי · 0.1</div>
    </Drawer>
  )
}
