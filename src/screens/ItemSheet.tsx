import { DateField } from '../components/DateField'
import { userMessage } from '../lib/errors'
import { ConfirmButton } from '../components/ConfirmButton'
import { useState } from 'react'
import type { Item, ItemKind } from '../types'
import { FileThumb, Sheet, useDirty } from '../components/ui'
import { FileViewer } from '../components/FileViewer'
import { REQUIRED, useApp } from '../data/AppData'
import { dueInfo } from '../domain/due'
import { INSURERS, KIND, STATUS_TEXT } from '../domain/labels'
import { compressImage } from '../lib/image'
import { fmtDate, fmtDays, fmtKm, fmtMoney, fmtNum } from '../lib/i18n'
import { diffDays, todayIso } from '../lib/dates'
import { uid } from '../lib/uid'
import { defaultItems } from '../domain/defaults'
import { Icon } from '../components/Icon'

const numOrNull = (s: string) => (s.trim() ? Number(s.replace(/\D/g, '')) : null)
const digits = (s: string) => s.replace(/\D/g, '')

/** Edit a reminder, or create a custom one (item = undefined). */
export function ItemSheet({ item, onClose, onDone }: { item?: Item; onClose(): void; onDone(it: Item): void }) {
  const { car, km, data, actions } = useApp()
  const isInsurance = item?.kind === 'insurance'
  const byDate = item?.kind === 'insurance' || item?.kind === 'test'
  // To the user these reminders and their documents are one thing: insurance ↔ policy, test ↔ car licence.
  const docKind = item?.kind === 'insurance' ? 'insurance' : item?.kind === 'test' ? 'licence' : null
  const doc = docKind ? data.documents.find(d => d.car_id === car?.id && d.kind === docKind) : undefined
  // Service-type reminders list every service of that type, each with its receipt.
  // Oil also lists periodic services, because a periodic service includes an oil change.
  const hasRecords = Boolean(item) && !byDate && item?.kind !== 'custom'
  const historyKinds: (ItemKind | undefined)[] = item?.kind === 'oil' ? ['oil', 'service'] : [item?.kind]
  const history = hasRecords
    ? data.services
        .filter(s => s.car_id === car?.id && historyKinds.includes(s.type))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.km - a.km))
    : []
  const [receiptBusy, setReceiptBusy] = useState<string | null>(null)

  const [label, setLabel] = useState(item?.label ?? '')
  const [everyKm, setEveryKm] = useState(item?.every_km?.toString() ?? '')
  const [everyMonths, setEveryMonths] = useState(item?.every_months?.toString() ?? '')
  const [dueKm, setDueKm] = useState(item?.due_km?.toString() ?? '')
  const [dueDate, setDueDate] = useState(item?.due_date ?? '')
  // the next time by a km target or by a booked date; switching drops the other one
  const startMode: 'km' | 'date' = item?.due_date && !item?.due_km ? 'date' : 'km'
  const [mode, setMode] = useState<'km' | 'date'>(startMode)
  const [provider, setProvider] = useState(doc?.provider ?? '')
  const [policy, setPolicy] = useState(doc?.number ?? '')
  const [files, setFiles] = useState<string[]>(doc?.files ?? [])
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = useDirty([label, everyKm, everyMonths, dueKm, dueDate, provider, policy, files, mode])
  const [adding, setAdding] = useState<Item['kind'] | null>(null) // a ready-made reminder being added
  if (!car) return null

  const draft: Item = {
    id: item?.id ?? uid(),
    car_id: car.id,
    kind: item?.kind ?? 'custom',
    label: label.trim() || KIND[item?.kind ?? 'custom'].label,
    every_km: byDate ? null : numOrNull(everyKm),
    every_months: numOrNull(everyMonths),
    due_km: byDate || (mode === 'date' && mode !== startMode) ? null : numOrNull(dueKm),
    due_date: !byDate && mode === 'km' && mode !== startMode ? null : dueDate || null,
  }
  const preview = dueInfo(draft, km)

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    setErr(null)
    try {
      const refs: string[] = []
      for (const f of Array.from(list))
        refs.push(await actions.upload(docKind ?? 'doc', f.type.startsWith('image/') ? await compressImage(f) : f))
      setFiles(fs => [...fs, ...refs])
    } catch (e) {
      setErr(userMessage(e))
    } finally {
      setUploading(false)
    }
  }

  async function setReceipt(serviceId: string, file: File | undefined) {
    if (!file) return
    setReceiptBusy(serviceId)
    setErr(null)
    try {
      const ref = await actions.upload('receipt', file.type.startsWith('image/') ? await compressImage(file) : file)
      await actions.updateService(serviceId, { receipt: ref })
    } catch (e) {
      setErr(userMessage(e))
    } finally {
      setReceiptBusy(null)
    }
  }

  async function save() {
    // nothing changed on a saved reminder: nothing to write
    if (item && !dirty && data.items.some(i => i.id === item.id)) return onClose()
    setBusy(true)
    try {
      await actions.saveItem(draft)
      if (docKind && (provider.trim() || policy.trim() || files.length || doc))
        await actions.saveDocument({
          id: doc?.id ?? uid(),
          car_id: car!.id,
          kind: docKind,
          title: doc?.title ?? (docKind === 'insurance' ? 'ביטוח' : 'רישיון רכב'),
          provider: provider.trim() || null,
          number: policy.trim() || null,
          expiry: draft.due_date,
          files,
        })
      onClose()
    } catch (e) {
      setErr(userMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item) return
    await actions.deleteItem(item.id)
    onClose()
  }

  // Ready-made reminders this car does not have yet (or deleted): one tap adds each.
  const have = new Set(data.items.filter(i => i.car_id === car.id).map(i => i.kind))
  const missing = item ? [] : defaultItems(car.id, km.value, null).filter(d => !have.has(d.kind))

  return (
    <Sheet title={item ? item.label : 'תזכורת חדשה'} onClose={onClose} dirty={dirty}>
      <div className="card">
        {missing.length > 0 && (
          <div className="restore">
            <div className="lbl" style={{ marginTop: 0 }}>תזכורות מוכנות</div>
            <div className="chips">
              {missing.map(d => (
                <button
                  key={d.kind}
                  disabled={adding !== null}
                  onClick={async () => {
                    setAdding(d.kind)
                    try {
                      await actions.saveItem(d)
                      onClose()
                    } finally {
                      setAdding(null)
                    }
                  }}
                >
                  {adding === d.kind ? <span className="spin inline" /> : <Icon name="plus" />} {d.label}
                </button>
              ))}
            </div>
            <div className="hint" style={{ marginTop: 6 }}>או צרו תזכורת חדשה משלכם:</div>
          </div>
        )}
        {item && (
          <div className="item-top">
            <span className={`chip ${preview.status}`}>{STATUS_TEXT[preview.status]}</span>
            {!isInsurance && (
              <button className="done-btn" onClick={() => onDone(item)}>
                <Icon name="check" /> סימון כבוצע
              </button>
            )}
          </div>
        )}

        {isInsurance ? (
          <>
            <label className="lbl">חברת ביטוח</label>
            <input className="in" list="insurers" value={provider} onChange={e => setProvider(e.target.value)} placeholder="בחרו או הקלידו" />
            <datalist id="insurers">
              {INSURERS.map(n => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div className="chips" style={{ marginTop: 8 }}>
              {INSURERS.slice(0, 8).map(n => (
                <button key={n} className={provider === n ? 'on' : ''} onClick={() => setProvider(n)}>
                  {n}
                </button>
              ))}
            </div>
            <label className="lbl">מספר פוליסה</label>
            <input className="in" value={policy} onChange={e => setPolicy(e.target.value)} placeholder="לא חובה" />
          </>
        ) : (
          <>
            <label className="lbl">שם</label>
            <input className="in" value={label} onChange={e => setLabel(e.target.value)} placeholder="למשל: החלפת מגבים" />
          </>
        )}

        {byDate ? (
          <>
            <label className="lbl">{isInsurance ? 'בתוקף עד' : 'המועד הבא'}</label>
            <DateField value={dueDate} onChange={setDueDate} label={isInsurance ? 'בתוקף עד' : 'המועד הבא'} />
            <label className="lbl">מתחדש כל (חודשים)</label>
            <input className="in" inputMode="numeric" placeholder="12" value={everyMonths} onChange={e => setEveryMonths(digits(e.target.value))} />
          </>
        ) : (
          <>
            <label className="lbl">המועד הבא</label>
            <div className="seg" role="radiogroup" aria-label="המועד הבא לפי">
              <button role="radio" aria-checked={mode === 'km'} className={mode === 'km' ? 'on' : ''} onClick={() => setMode('km')}>
                <Icon name="gauge" /> לפי ק״מ
              </button>
              <button role="radio" aria-checked={mode === 'date'} className={mode === 'date' ? 'on' : ''} onClick={() => setMode('date')}>
                <Icon name="calendar" /> לפי תאריך
              </button>
            </div>
            {mode === 'km' ? (
              <input className="in" inputMode="numeric" placeholder={`למשל ${fmtNum(Math.ceil((km.value + 10000) / 1000) * 1000)}`} value={dueKm ? fmtNum(Number(dueKm)) : ''} onChange={e => setDueKm(digits(e.target.value))} aria-label="יעד ק״מ" />
            ) : (
              <DateField value={dueDate} onChange={setDueDate} placeholder="תאריך התור" label="המועד הבא" />
            )}
            <DueLine mode={mode} dueKm={numOrNull(dueKm)} dueDate={dueDate} kmNow={km.value} perDay={km.perDay} />
            {mode === startMode && item?.due_km && item?.due_date && (
              <div className="hint" style={{ marginTop: 4 }}>
                {mode === 'km' ? `יש גם תאריך: ${fmtDate(item.due_date)}` : `יש גם יעד: ${fmtNum(item.due_km)} ק״מ`}. מה שמגיע קודם קובע.
              </div>
            )}
            <label className="lbl">חוזר כל</label>
            <div className="row2">
              <input className="in" inputMode="numeric" placeholder="ק״מ" value={everyKm} onChange={e => setEveryKm(digits(e.target.value))} />
              <input className="in" inputMode="numeric" placeholder="חודשים" value={everyMonths} onChange={e => setEveryMonths(digits(e.target.value))} />
            </div>
          </>
        )}

        {docKind && (
          <>
            <label className="lbl">{isInsurance ? 'הפוליסה (תמונה או קובץ)' : 'רישיון הרכב (תמונה או קובץ)'}</label>
            {files.length > 0 && <div className="hint" style={{ margin: '0 0 6px' }}>לחיצה על קובץ פותחת אותו; משם אפשר גם להסיר.</div>}
            {files.length > 0 && (
              <div className="thumbs" style={{ marginBottom: 10 }}>
                {files.map(f => (
                  <FileThumb key={f} fileRef={f} onOpen={() => setView(f)} />
                ))}
              </div>
            )}
            <label className="file-btn">
              {uploading ? (
                <span className="spin" />
              ) : (
                <>
                  <Icon name="camera" /> {files.length ? 'הוספת עוד תמונה או קובץ' : isInsurance ? 'צילום או קובץ של הפוליסה' : 'צילום או קובץ של רישיון הרכב'}
                </>
              )}
              <input type="file" accept="image/*,application/pdf" multiple onChange={e => addFiles(e.target.files)} />
            </label>
          </>
        )}

        {hasRecords && (
          <>
            <label className="lbl">טיפולים וקבלות</label>
            <div className="receipt">
              {history.length === 0 && <div className="hint" style={{ padding: '2px 2px 8px' }}>עוד לא נשמר טיפול מהסוג הזה.</div>}
              {history.slice(0, 6).map(sv => (
                <div className="receipt-row" key={sv.id}>
                  {sv.receipt ? (
                    <FileThumb fileRef={sv.receipt} onOpen={() => setView(sv.receipt)} />
                  ) : (
                    <span className="ic">
                      <Icon name={sv.type} />
                    </span>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="t">{sv.title}</div>
                    <div className="s">
                      {[fmtDate(sv.date), fmtKm(sv.km), sv.price != null && fmtMoney(sv.price)].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <label className="receipt-btn" aria-label={sv.receipt ? 'החלפת קבלה' : 'הוספת קבלה'}>
                    {receiptBusy === sv.id ? <span className="spin" /> : <Icon name="camera" />}
                    <span>{sv.receipt ? 'החלפה' : 'קבלה'}</span>
                    <input type="file" accept="image/*,application/pdf" onChange={e => setReceipt(sv.id, e.target.files?.[0])} />
                  </label>
                </div>
              ))}
              <button className="file-btn" style={{ marginTop: 10, background: '#fff' }} onClick={() => onDone(item!)}>
                <Icon name="plus" /> טיפול חדש עם קבלה
              </button>
            </div>
          </>
        )}

        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy || uploading} onClick={save}>
          שמירה
        </button>
        {item && !REQUIRED.includes(item.kind) && (
          <ConfirmButton className="btn danger" style={{ marginTop: 8 }} onConfirm={remove} question="למחוק את התזכורת?" detail={`"${draft.label}" תימחק. אפשר להחזיר תזכורת קבועה מ"תזכורת חדשה".`}>
            מחיקת תזכורת
          </ConfirmButton>
        )}
      </div>
      {view && (
        <FileViewer
          files={[
            ...files.map(ref => ({ ref, title: draft.label, sub: '', source: 'doc' as const })),
            ...history.filter(sv => sv.receipt).map(sv => ({ ref: sv.receipt!, title: sv.title, sub: `קבלה · ${fmtDate(sv.date)}`, source: 'receipt' as const })),
          ]}
          start={Math.max(0, [...files, ...history.filter(sv => sv.receipt).map(sv => sv.receipt!)].indexOf(view))}
          onClose={() => setView(null)}
          onDelete={ref => {
            if (!files.includes(ref)) return false // receipts are removed from the service itself
            setFiles(fs => fs.filter(x => x !== ref))
            return true
          }}
        />
      )}
    </Sheet>
  )
}

/** How far the next time is: km left (and about how many days), or days left (and about how many km). */
function DueLine({ mode, dueKm, dueDate, kmNow, perDay }: { mode: 'km' | 'date'; dueKm: number | null; dueDate: string; kmNow: number; perDay: number }) {
  if (mode === 'km') {
    if (!dueKm) return null
    const left = dueKm - kmNow
    if (left <= 0) return <div className="due-line late">עבר לפני {fmtNum(-left)} ק״מ</div>
    const days = perDay > 0 ? Math.round(left / perDay) : null
    return (
      <div className="due-line">
        נשארו <b>{fmtNum(left)} ק״מ</b>
        {days != null && <> · בערך {fmtDays(days)}</>}
      </div>
    )
  }
  if (!dueDate) return null
  const days = diffDays(dueDate, todayIso())
  if (days < 0) return <div className="due-line late">עבר לפני {fmtDays(-days)}</div>
  return (
    <div className="due-line">
      {days === 0 ? 'היום' : <>בעוד <b>{fmtDays(days)}</b></>}
      {days > 0 && perDay > 0 && <> · עד אז עוד כ־{fmtNum(Math.round((days * perDay) / 50) * 50)} ק״מ</>}
    </div>
  )
}
