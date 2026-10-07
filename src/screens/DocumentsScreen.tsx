import { useApp } from '../data/AppData'
import { DOC_KIND } from '../domain/labels'
import { diffDays, todayIso } from '../lib/dates'
import { fmtDate, fmtDays } from '../lib/i18n'
import { FileThumb } from '../components/ui'
import { Icon, docIcon } from '../components/Icon'
import type { OpenSheet } from '../App'

function expiryChip(expiry: string | null) {
  if (!expiry) return null
  const d = diffDays(expiry, todayIso())
  const cls = d < 0 ? 'overdue' : d <= 7 ? 'due' : d <= 30 ? 'soon' : 'ok'
  const text = d < 0 ? 'פג תוקף' : d <= 30 ? fmtDays(d) : 'בתוקף'
  return <span className={`chip ${cls}`}>{text}</span>
}

export function DocumentsScreen({ open }: { open: OpenSheet }) {
  const { data, car } = useApp()
  if (!car) return null
  const docs = data.documents
    .filter(d => d.car_id === car.id)
    .sort((a, b) => ((a.expiry ?? '9') < (b.expiry ?? '9') ? -1 : 1))

  return (
    <div className="reveal">
      <header className="top">
        <div>
          <div className="eyebrow">{car.name}</div>
          <h1>מסמכים</h1>
        </div>
      </header>

      {docs.length === 0 && (
        <div className="empty">
          <div className="glyph">
            <Icon name="docs" />
          </div>
          <h2>תא הכפפות, דיגיטלי</h2>
          <p>רישיון רכב, ביטוח חובה ומקיף, רישיון נהיגה. עם תאריך תפוגה ותזכורת.</p>
          <button className="btn pri" onClick={() => open({ t: 'doc' })}>
            <Icon name="plus" /> מסמך ראשון
          </button>
        </div>
      )}

      {docs.length > 0 && (
        <div className="list" style={{ marginTop: 22 }}>
          {docs.map(d => (
            <button className="item" key={d.id} onClick={() => open({ t: 'doc', doc: d })}>
              <span className="ic">
                <Icon name={docIcon(d.kind)} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="t">{d.title}</div>
                <div className="s">
                  {[d.provider, d.number && `פוליסה ${d.number}`, d.expiry && `עד ${fmtDate(d.expiry)}`]
                    .filter(Boolean)
                    .join(' · ') || DOC_KIND[d.kind].label}
                </div>
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
        </div>
      )}
    </div>
  )
}
