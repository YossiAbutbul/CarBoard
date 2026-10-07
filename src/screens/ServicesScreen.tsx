import { useState } from 'react'
import { FileThumb, Lightbox } from '../components/ui'
import { useApp } from '../data/AppData'
import { KIND } from '../domain/labels'
import { fmtDate, fmtKm, fmtMoney } from '../lib/i18n'
import type { OpenSheet } from '../App'

export function ServicesScreen({ open }: { open: OpenSheet }) {
  const { data, car, actions } = useApp()
  const [view, setView] = useState<string | null>(null)
  if (!car) return null

  const list = data.services.filter(s => s.car_id === car.id).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.km - a.km))
  const years = [...new Set(list.map(s => s.date.slice(0, 4)))]
  const total = (y: string) => list.filter(s => s.date.startsWith(y)).reduce((n, s) => n + (s.price ?? 0), 0)
  const thisYear = String(new Date().getFullYear())

  return (
    <>
      <div className="top">
        <div>
          <h1>טיפולים</h1>
          <div className="sub">{car.name}</div>
        </div>
        <span className="pill">{thisYear} · {fmtMoney(total(thisYear))}</span>
      </div>
      {list.length === 0 && (
        <div className="empty">
          <div style={{ fontSize: 54 }}>🔧</div>
          <h2>עוד אין טיפולים</h2>
          <p>כל טיפול שתוסיף מעדכן גם את הק״מ ואת מועד הטיפול הבא.</p>
          <button className="btn pri" onClick={() => open({ t: 'service' })}>＋ טיפול ראשון</button>
        </div>
      )}
      {years.map(y => (
        <div key={y}>
          <div className="year">
            <span>{y}</span>
            <span>{fmtMoney(total(y))}</span>
          </div>
          {list
            .filter(s => s.date.startsWith(y))
            .map(s => (
              <div className="item" key={s.id}>
                <span className="ic">{KIND[s.type].icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="t">{s.title}</div>
                  <div className="s">{[fmtDate(s.date), fmtKm(s.km), s.garage].filter(Boolean).join(' · ')}</div>
                  {s.notes && <div className="s">{s.notes}</div>}
                  {s.receipt && (
                    <div className="thumbs">
                      <FileThumb fileRef={s.receipt} onOpen={setView} />
                    </div>
                  )}
                </div>
                <div className="e">
                  {s.price != null ? fmtMoney(s.price) : ''}
                  <button
                    className="hint"
                    style={{ display: 'block', marginTop: 6, fontWeight: 400 }}
                    onClick={() => confirm(`למחוק את "${s.title}"?`) && actions.deleteService(s.id)}
                    aria-label="מחיקה"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
        </div>
      ))}
      {view && <Lightbox url={view} onClose={() => setView(null)} />}
    </>
  )
}
