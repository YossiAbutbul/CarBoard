import { useApp } from '../data/AppData'
import { DOC_KIND } from '../domain/labels'
import { diffDays, todayIso } from '../lib/dates'
import { fmtDate, fmtDays, fmtNum } from '../lib/i18n'
import { FileThumb } from '../components/ui'
import { Icon, docIcon } from '../components/Icon'
import { Glance, GlanceCell, PageHero, TopBar } from '../components/Chrome'
import type { CarDocument } from '../types'
import type { OpenSheet } from '../App'

function expiryState(expiry: string | null): { s: string; text: string; days: number | null } {
  if (!expiry) return { s: 'unset', text: 'ללא תאריך', days: null }
  const d = diffDays(expiry, todayIso())
  if (d < 0) return { s: 'overdue', text: 'פג תוקף', days: d }
  if (d <= 7) return { s: 'due', text: `עוד ${fmtDays(d)}`, days: d }
  if (d <= 30) return { s: 'soon', text: `עוד ${fmtDays(d)}`, days: d }
  return { s: 'ok', text: 'בתוקף', days: d }
}

export function DocumentsScreen({ open, openCars, openSettings }: { open: OpenSheet; openCars(): void; openSettings(): void }) {
  const { data, car } = useApp()
  if (!car) return null
  const docs = data.documents
    .filter(d => d.car_id === car.id)
    .sort((a, b) => ((a.expiry ?? '9') < (b.expiry ?? '9') ? -1 : 1))
  const next = docs.find(d => d.expiry && diffDays(d.expiry, todayIso()) >= 0)
  const expired = docs.filter(d => d.expiry && diffDays(d.expiry, todayIso()) < 0).length
  const photos = docs.reduce((n, d) => n + d.files.length, 0)

  return (
    <div className="reveal">
      <PageHero>
        <TopBar openCars={openCars} openSettings={openSettings} />
        <div className="greet">
          <div className="date">{car.name}</div>
          <h1>תא הכפפות</h1>
        </div>
        <Glance>
          <GlanceCell k="מסמכים" v={fmtNum(docs.length)} d={expired ? `${expired} פגי תוקף` : 'הכל בתוקף'} s={expired ? 'overdue' : 'ok'} />
          <GlanceCell
            k="הבא לחידוש"
            v={next ? fmtDays(diffDays(next.expiry!, todayIso())) : '—'}
            d={next ? next.title : 'אין תאריכים'}
            onClick={next ? () => open({ t: 'doc', doc: next }) : undefined}
          />
          <GlanceCell k="צילומים" v={fmtNum(photos)} d="שמורים" />
        </Glance>
      </PageHero>

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
        <div className="doc-grid">
          {docs.map(d => (
            <DocCard key={d.id} d={d} onOpen={() => open({ t: 'doc', doc: d })} />
          ))}
          <button className="doc-card add" onClick={() => open({ t: 'doc' })}>
            <Icon name="plus" />
            <span>מסמך חדש</span>
          </button>
        </div>
      )}
    </div>
  )
}

function DocCard({ d, onOpen }: { d: CarDocument; onOpen(): void }) {
  const e = expiryState(d.expiry)
  return (
    <button className="doc-card" data-s={e.s} onClick={onOpen}>
      <div className="doc-media">
        {d.files[0] ? (
          <FileThumb fileRef={d.files[0]} />
        ) : (
          <span className="doc-ic">
            <Icon name={docIcon(d.kind)} />
          </span>
        )}
        {d.files.length > 1 && <span className="doc-count">+{d.files.length - 1}</span>}
      </div>
      <div className="doc-body">
        <div className="t">{d.title}</div>
        <div className="s">{d.provider ?? DOC_KIND[d.kind].label}</div>
        <div className="doc-foot">
          <span className="state">{e.text}</span>
          {d.expiry && <span className="s">{fmtDate(d.expiry)}</span>}
        </div>
      </div>
    </button>
  )
}
