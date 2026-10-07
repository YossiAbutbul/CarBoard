import { useState } from 'react'
import { FileThumb, Lightbox } from '../components/ui'
import { Icon, kindIcon } from '../components/Icon'
import { useApp } from '../data/AppData'
import { fmtDate, fmtKm, fmtMoney } from '../lib/i18n'
import { compressImage } from '../lib/image'
import type { OpenSheet } from '../App'

export function ServicesScreen({ open }: { open: OpenSheet }) {
  const { data, car, actions } = useApp()
  const [view, setView] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  if (!car) return null

  const list = data.services
    .filter(s => s.car_id === car.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.km - a.km))
  const years = [...new Set(list.map(s => s.date.slice(0, 4)))]
  const total = (y: string) => list.filter(s => s.date.startsWith(y)).reduce((n, s) => n + (s.price ?? 0), 0)
  const all = list.reduce((n, s) => n + (s.price ?? 0), 0)

  return (
    <div className="reveal">
      <header className="top">
        <div>
          <div className="eyebrow">{car.name}</div>
          <h1>יומן טיפולים</h1>
        </div>
        {all > 0 && <span className="pill">סה״כ {fmtMoney(all)}</span>}
      </header>

      {list.length === 0 && (
        <div className="empty">
          <div className="glyph">
            <Icon name="service" />
          </div>
          <h2>היומן ריק</h2>
          <p>כל טיפול שתוסיף מעדכן את הק״מ ומזיז את מועד הטיפול הבא.</p>
          <button className="btn pri" onClick={() => open({ t: 'service' })}>
            <Icon name="plus" /> טיפול ראשון
          </button>
        </div>
      )}

      {years.map(y => (
        <section key={y}>
          <div className="year">
            <span>{y}</span>
            <span>{fmtMoney(total(y))}</span>
          </div>
          <div className="list">
            {list
              .filter(s => s.date.startsWith(y))
              .map(s => (
                <div className="item" key={s.id}>
                  <span className="ic">
                    <Icon name={kindIcon(s.type)} />
                  </span>
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
                    {s.price != null ? fmtMoney(s.price) : '—'}
                    <div>
                      <label className="icon-btn" style={{ cursor: 'pointer', display: 'inline-block' }} aria-label={s.receipt ? 'החלפת קבלה' : 'הוספת קבלה'}>
                        {busy === s.id ? <span className="spin" style={{ width: 17, height: 17 }} /> : <Icon name="camera" />}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          style={{ display: 'none' }}
                          onChange={async e => {
                            const f = e.target.files?.[0]
                            if (!f) return
                            setBusy(s.id)
                            try {
                              const ref = await actions.upload('receipt', f.type.startsWith('image/') ? await compressImage(f) : f)
                              await actions.updateService(s.id, { receipt: ref })
                            } finally {
                              setBusy(null)
                            }
                          }}
                        />
                      </label>
                      <button
                        className="icon-btn"
                        onClick={() => confirm(`למחוק את "${s.title}"?`) && actions.deleteService(s.id)}
                        aria-label="מחיקה"
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      ))}
      {view && <Lightbox url={view} onClose={() => setView(null)} />}
    </div>
  )
}
