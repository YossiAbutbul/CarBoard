import { CarImage } from '../components/ui'
import { useApp } from '../data/AppData'
import { supabase } from '../data/supabase'
import { downloadIcs } from '../lib/ics'
import { fmtNum } from '../lib/i18n'
import type { OpenSheet } from '../App'

export function SettingsScreen({ open, email }: { open: OpenSheet; email: string | null }) {
  const { data, car, km, reminders, store, setCarId, actions } = useApp()

  return (
    <>
      <div className="top">
        <h1>הגדרות</h1>
      </div>

      <div className="sec">הרכבים שלי</div>
      {data.cars.map(c => (
        <div className="item" key={c.id}>
          <span style={{ width: 72, flex: 'none' }}>
            <CarImage car={c} />
          </span>
          <button style={{ textAlign: 'right', minWidth: 0 }} onClick={() => setCarId(c.id)}>
            <div className="t">
              {c.name} {c.id === car?.id && <span className="chip ok">נבחר</span>}
            </div>
            <div className="s">{[c.plate, c.make, c.model, c.year].filter(Boolean).join(' · ')}</div>
          </button>
          <div className="e" style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => open({ t: 'car', car: c })} aria-label="עריכה">✎</button>
            <button
              onClick={() => confirm(`למחוק את ${c.name} וכל הנתונים שלו?`) && actions.deleteCar(c.id)}
              aria-label="מחיקה"
            >
              🗑
            </button>
          </div>
        </div>
      ))}
      <button className="btn" onClick={() => open({ t: 'car' })}>＋ הוספת רכב</button>

      {car && (
        <>
          <div className="sec">תזכורות</div>
          <div className="card">
            <div className="t" style={{ fontWeight: 700 }}>📅 הוספה ליומן של הטלפון</div>
            <div className="hint" style={{ margin: '4px 0 12px' }}>
              כל תזכורת הופכת לאירוע עם התראה 7 ימים לפני. מועדי ק״מ מחושבים לפי ממוצע של {fmtNum(km.perDay)} ק״מ ביום.
              אחרי שינוי מועדים, ייצא שוב.
            </div>
            <button className="btn pri" onClick={() => downloadIcs(car, reminders.filter(r => r.status !== 'unset'))}>
              ייצוא ליומן
            </button>
          </div>
        </>
      )}

      <div className="sec">חשבון</div>
      <div className="card">
        {store.mode === 'cloud' ? (
          <>
            <div className="t" style={{ fontWeight: 700 }}>☁️ מחובר לענן</div>
            <div className="hint" style={{ margin: '4px 0 12px' }}>{email}</div>
            <button className="btn" onClick={() => supabase?.auth.signOut()}>התנתקות</button>
          </>
        ) : (
          <>
            <div className="t" style={{ fontWeight: 700 }}>📱 מצב מקומי</div>
            <div className="hint" style={{ marginTop: 4 }}>
              הנתונים נשמרים רק בדפדפן הזה. כדי לסנכרן בין מכשירים ולהתחבר עם Google, צריך להגדיר את Supabase (ראה README).
            </div>
          </>
        )}
      </div>
      <div className="hint center" style={{ marginTop: 20 }}>הרכב שלי · גרסה 0.1</div>
    </>
  )
}
