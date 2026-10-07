import { useApp } from '../data/AppData'
import { DOC_KIND } from '../domain/labels'
import { diffDays, todayIso } from '../lib/dates'
import { fmtDate, fmtDays } from '../lib/i18n'
import { FileThumb } from '../components/ui'
import type { OpenSheet } from '../App'

function expiryChip(expiry: string | null) {
  if (!expiry) return null
  const d = diffDays(expiry, todayIso())
  const cls = d < 0 ? 'overdue' : d <= 7 ? 'due' : d <= 30 ? 'soon' : 'ok'
  const text = d < 0 ? 'פג תוקף' : d <= 30 ? fmtDays(d) : 'תקין'
  return <span className={`chip ${cls}`}>{text}</span>
}

export function DocumentsScreen({ open }: { open: OpenSheet }) {
  const { data, car } = useApp()
  if (!car) return null
  const docs = data.documents.filter(d => d.car_id === car.id).sort((a, b) => (a.expiry ?? '9') < (b.expiry ?? '9') ? -1 : 1)

  return (
    <>
      <div className="top">
        <div>
          <h1>מסמכים</h1>
          <div className="sub">{car.name}</div>
        </div>
        <button className="pill" onClick={() => open({ t: 'doc' })}>＋ הוספה</button>
      </div>
      {docs.length === 0 && (
        <div className="empty">
          <div style={{ fontSize: 54 }}>🗂️</div>
          <h2>כל המסמכים בכיס</h2>
          <p>רישיון רכב, ביטוח חובה ומקיף, רישיון נהיגה. עם תאריך תפוגה ותזכורת.</p>
          <button className="btn pri" onClick={() => open({ t: 'doc' })}>＋ מסמך ראשון</button>
        </div>
      )}
      {docs.map(d => (
        <button className="item" key={d.id} onClick={() => open({ t: 'doc', doc: d })}>
          <span className="ic">{DOC_KIND[d.kind].icon}</span>
          <div style={{ minWidth: 0 }}>
            <div className="t">{d.title}</div>
            <div className="s">{[d.provider, d.number && `פוליסה ${d.number}`, d.expiry && `עד ${fmtDate(d.expiry)}`].filter(Boolean).join(' · ')}</div>
            {d.files.length > 0 && (
              <div className="thumbs">
                {d.files.slice(0, 4).map(f => (
                  <FileThumb key={f} fileRef={f} />
                ))}
              </div>
            )}
          </div>
          <div className="e">{expiryChip(d.expiry)}</div>
        </button>
      ))}
    </>
  )
}
