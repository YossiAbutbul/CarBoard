import { ConfirmButton } from '../components/ConfirmButton'
import { useState } from 'react'
import { FileThumb } from '../components/ui'
import { FileViewer } from '../components/FileViewer'
import { Icon, kindIcon, serviceIcon, type IconName } from '../components/Icon'
import type { ItemKind, ServiceRecord } from '../types'
import { Glance, GlanceCell, PageHero, TopBar, useCountUp } from '../components/Chrome'
import { useApp } from '../data/AppData'
import { KIND } from '../domain/labels'
import { diffDays, todayIso } from '../lib/dates'
import { fmtDate, fmtDays, fmtKm, fmtMoney, fmtNum } from '../lib/i18n'
import { compressImage } from '../lib/image'
import type { OpenSheet } from '../App'

export function ServicesScreen({ open, openCars, openSettings }: { open: OpenSheet; openCars(): void; openSettings(): void }) {
  const { data, car, actions } = useApp()
  const [view, setView] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const list = data.services
    .filter(s => s.car_id === car?.id)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.km - a.km))
  const receipts = list.filter(s => s.receipt)
  const thisYear = String(new Date().getFullYear())
  const yearTotal = list.filter(s => s.date.startsWith(thisYear)).reduce((n, s) => n + (s.price ?? 0), 0)
  const totalShown = useCountUp(yearTotal)
  if (!car) return null

  const years = [...new Set(list.map(s => s.date.slice(0, 4)))]
  const total = (y: string) => list.filter(s => s.date.startsWith(y)).reduce((n, s) => n + (s.price ?? 0), 0)
  const last = list[0]

  async function addReceipt(id: string, f: File | undefined) {
    if (!f) return
    setBusy(id)
    try {
      const ref = await actions.upload('receipt', f.type.startsWith('image/') ? await compressImage(f) : f)
      await actions.updateService(id, { receipt: ref })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="reveal">
      <PageHero>
        <TopBar openCars={openCars} openSettings={openSettings} />
        <div className="greet">
          <div className="date">{car.name}</div>
          <h1>יומן טיפולים</h1>
        </div>
        <Glance>
          <GlanceCell k={`הוצאות ${thisYear}`} v={fmtMoney(totalShown)} d={`${list.filter(s => s.date.startsWith(thisYear)).length} טיפולים`} />
          <GlanceCell k="סה״כ טיפולים" v={fmtNum(list.length)} d={years.length ? `מאז ${years[years.length - 1]}` : 'עוד אין'} />
          <GlanceCell
            k="טיפול אחרון"
            v={last ? (diffDays(todayIso(), last.date) <= 0 ? 'היום' : `לפני ${fmtDays(diffDays(todayIso(), last.date))}`) : 'אין'}
            d={last ? fmtKm(last.km) : 'לא נרשם'}
          />
        </Glance>
      </PageHero>

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

      {list.some(s => s.price) && <SpendByType list={list} years={years} />}

      {years.map(y => (
        <section key={y}>
          <div className="year">
            <span>{y}</span>
            <span>{fmtMoney(total(y))}</span>
          </div>
          <ol className="timeline">
            {list
              .filter(s => s.date.startsWith(y))
              .map(s => (
                <li key={s.id} className="tl-item">
                  <span className="tl-dot">
                    <Icon name={serviceIcon(s)} />
                  </span>
                  <div
                    className="tl-card"
                    role="button"
                    tabIndex={0}
                    onClick={e => (e.target as HTMLElement).closest('button, label, img') || open({ t: 'service', record: s })}
                    onKeyDown={e => e.key === 'Enter' && open({ t: 'service', record: s })}
                    aria-label={`עריכת ${s.title}`}
                  >
                    <div className="tl-top">
                      <div style={{ minWidth: 0 }}>
                        <div className="t">{s.title}</div>
                        <div className="s">
                          {[fmtDate(s.date), fmtKm(s.km), s.garage].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <div className="tl-price">{s.price != null ? fmtMoney(s.price) : ''}</div>
                    </div>
                    {s.notes && <div className="tl-notes">{s.notes}</div>}
                    <div className="tl-foot">
                      <span className="tl-kind">{KIND[s.type].label}</span>
                      <span className="tl-acts">
                        {s.receipt && (
                          <span className="thumbs" style={{ margin: 0 }}>
                            <FileThumb fileRef={s.receipt} onOpen={() => setView(s.id)} />
                          </span>
                        )}
                        <label className="icon-btn" aria-label={s.receipt ? 'החלפת קבלה' : 'הוספת קבלה'}>
                          {busy === s.id ? <span className="spin" style={{ width: 17, height: 17 }} /> : <Icon name="receipt" />}
                          <input type="file" accept="image/*,application/pdf" hidden onChange={e => addReceipt(s.id, e.target.files?.[0])} />
                        </label>
                        <ConfirmButton icon label={`מחיקת ${s.title}`} question="למחוק את הטיפול?" detail={`${s.title} · ${fmtDate(s.date)}`} onConfirm={() => actions.deleteService(s.id)} />
                      </span>
                    </div>
                  </div>
                </li>
              ))}
          </ol>
        </section>
      ))}
      {view && (
        <FileViewer
          files={receipts.map(s => ({ ref: s.receipt!, title: s.title, sub: `קבלה · ${fmtDate(s.date)}`, source: 'receipt' as const }))}
          start={Math.max(0, receipts.findIndex(s => s.id === view))}
          onClose={() => setView(null)}
        />
      )}
    </div>
  )
}

// names for the groups that are not a reminder kind
const EXTRA: Partial<Record<IconName, string>> = { wipers: 'מגבים', aircon: 'מיזוג', lights: 'תאורה', wash: 'שטיפה וניקוי', key: 'מפתחות' }
const serviceLabel = (k: IconName) => EXTRA[k] ?? (k in KIND ? KIND[k as ItemKind].label : 'אחר')

/** Where the money goes: a year's service spending by type, biggest first, with a bar for each one's share. */
function SpendByType({ list, years }: { list: ServiceRecord[]; years: string[] }) {
  const withPrice = years.filter(y => list.some(s => s.date.startsWith(y) && s.price))
  const [year, setYear] = useState(withPrice[0] ?? years[0])
  // grouped by what each service is: its kind, or for a custom one what its title says (wipers, A/C…)
  const totals = new Map<IconName, number>()
  for (const s of list)
    if (s.date.startsWith(year) && s.price) {
      const k = serviceIcon(s)
      totals.set(k, (totals.get(k) ?? 0) + s.price)
    }
  let rows = [...totals].map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total)
  // every group shows; only custom services the app cannot name go together as "other", last
  const other = rows.filter(r => r.type === 'custom').reduce((n, r) => n + r.total, 0)
  rows = rows.filter(r => r.type !== 'custom')
  const all = rows.reduce((n, r) => n + r.total, 0) + other
  const max = Math.max(...rows.map(r => r.total), other)
  const line = (key: string, icon: IconName, label: string, total: number) => (
    <li key={key}>
      <span className="bt-ic">
        <Icon name={icon} />
      </span>
      <span className="bt-main">
        <span className="bt-top">
          <span>{label}</span>
          <b>{fmtMoney(total)}</b>
        </span>
        <span className="bt-bar">
          <i style={{ width: `${Math.max(3, (total / max) * 100)}%` }} />
        </span>
      </span>
      <span className="bt-pct">{Math.round((total / all) * 100)}%</span>
    </li>
  )
  return (
    <section className="card by-type">
      <div className="by-type-head">
        <b>לאן הולך הכסף</b>
        {withPrice.length > 1 && (
          <div className="chart-range" role="radiogroup" aria-label="שנה">
            {withPrice.slice(0, 3).map(y => (
              <button key={y} role="radio" aria-checked={year === y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>
                {y}
              </button>
            ))}
          </div>
        )}
      </div>
      <ul className="by-type-list">
        {rows.map(r => line(r.type, r.type, serviceLabel(r.type), r.total))}
        {other > 0 && line('other', 'custom', 'אחר', other)}
      </ul>
    </section>
  )
}
