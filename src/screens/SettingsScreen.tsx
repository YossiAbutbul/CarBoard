import { CarImage } from '../components/ui'
import { Icon } from '../components/Icon'
import { useApp } from '../data/AppData'
import { supabase } from '../data/supabase'
import { downloadIcs } from '../lib/ics'
import { fmtNum } from '../lib/i18n'
import type { OpenSheet } from '../App'

export function SettingsScreen({ open, email }: { open: OpenSheet; email: string | null }) {
  const { data, car, km, reminders, store, setCarId, actions } = useApp()

  return (
    <div className="reveal">
      <header className="top">
        <div>
          <div className="eyebrow">חשבון ורכבים</div>
          <h1>הגדרות</h1>
        </div>
      </header>

      <div className="sec">
        <h2>הרכבים שלי</h2>
        <button onClick={() => open({ t: 'car' })}>
          <Icon name="plus" /> רכב
        </button>
      </div>
      <div className="list">
        {data.cars.map(c => (
          <div className="item" key={c.id}>
            <span style={{ width: 76, flex: 'none' }}>
              <CarImage car={c} />
            </span>
            <button style={{ textAlign: 'right', minWidth: 0 }} onClick={() => setCarId(c.id)}>
              <div className="t">
                {c.name}
                {c.id === car?.id && <span className="tag">נבחר</span>}
              </div>
              <div className="s">{[c.plate, c.year].filter(Boolean).join(' · ')}</div>
            </button>
            <div className="e">
              <button className="icon-btn" onClick={() => open({ t: 'car', car: c })} aria-label="עריכה">
                <Icon name="edit" />
              </button>
              <button
                className="icon-btn"
                onClick={() => confirm(`למחוק את ${c.name} וכל הנתונים שלו?`) && actions.deleteCar(c.id)}
                aria-label="מחיקה"
              >
                <Icon name="trash" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {car && (
        <>
          <div className="sec">
            <h2>יומן</h2>
          </div>
          <div className="card">
            <div className="item" style={{ border: 0, padding: 0 }}>
              <span className="ic">
                <Icon name="calendar" />
              </span>
              <div>
                <div className="t">הוספה ליומן של הטלפון</div>
                <div className="s">התראה 7 ימים לפני כל מועד. מועדי ק״מ לפי {fmtNum(km.perDay)} ק״מ ביום.</div>
              </div>
            </div>
            <button
              className="btn"
              style={{ marginTop: 16 }}
              onClick={() => downloadIcs(car, reminders.filter(r => r.status !== 'unset'))}
            >
              ייצוא ליומן
            </button>
          </div>
        </>
      )}

      <div className="sec">
        <h2>חשבון</h2>
      </div>
      <div className="card">
        <div className="item" style={{ border: 0, padding: 0 }}>
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
          <button className="btn" style={{ marginTop: 16 }} onClick={() => supabase?.auth.signOut()}>
            התנתקות
          </button>
        )}
      </div>
      <div className="foot">הרכב שלי</div>
    </div>
  )
}
