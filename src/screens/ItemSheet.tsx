import { ConfirmButton } from '../components/ConfirmButton'
import { useState } from 'react'
import type { Item, ItemKind } from '../types'
import { FileThumb, Lightbox, Sheet } from '../components/ui'
import { useApp } from '../data/AppData'
import { dueInfo } from '../domain/due'
import { INSURERS, KIND, STATUS_TEXT } from '../domain/labels'
import { compressImage } from '../lib/image'
import { fmtDate, fmtKm, fmtMoney } from '../lib/i18n'
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
  const [provider, setProvider] = useState(doc?.provider ?? '')
  const [policy, setPolicy] = useState(doc?.number ?? '')
  const [files, setFiles] = useState<string[]>(doc?.files ?? [])
  const [uploading, setUploading] = useState(false)
  const [view, setView] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!car) return null

  const draft: Item = {
    id: item?.id ?? uid(),
    car_id: car.id,
    kind: item?.kind ?? 'custom',
    label: label.trim() || KIND[item?.kind ?? 'custom'].label,
    every_km: byDate ? null : numOrNull(everyKm),
    every_months: numOrNull(everyMonths),
    due_km: byDate ? null : numOrNull(dueKm),
    due_date: dueDate || null,
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
      setErr(e instanceof Error ? e.message : String(e))
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
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setReceiptBusy(null)
    }
  }

  async function save() {
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
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (!item) return
    await actions.deleteItem(item.id)
    onClose()
  }

  // Default reminders this car no longer has (deleted by mistake): one tap brings each back.
  const have = new Set(data.items.filter(i => i.car_id === car.id).map(i => i.kind))
  const missing = item ? [] : defaultItems(car.id, km.value, null).filter(d => !have.has(d.kind))

  return (
    <Sheet title={item ? item.label : 'תזכורת חדשה'} onClose={onClose}>
      <div className="card">
        {missing.length > 0 && (
          <div className="restore">
            <div className="lbl" style={{ marginTop: 0 }}>תזכורות קבועות שנמחקו</div>
            <div className="chips">
              {missing.map(d => (
                <button
                  key={d.kind}
                  onClick={async () => {
                    await actions.saveItem(d)
                    onClose()
                  }}
                >
                  <Icon name="plus" /> {d.label}
                </button>
              ))}
            </div>
            <div className="hint" style={{ marginTop: 6 }}>או צרו תזכורת חדשה משלכם:</div>
          </div>
        )}
        {item && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className={`chip ${preview.status}`}>{STATUS_TEXT[preview.status]}</span>
            {!isInsurance && (
              <button className="pill" onClick={() => onDone(item)}>
                <Icon name="check" /> בוצע עכשיו
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
              {INSURERS.slice(0, 6).map(n => (
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
            <input className="in" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            <label className="lbl">מתחדש כל (חודשים)</label>
            <input className="in" inputMode="numeric" placeholder="12" value={everyMonths} onChange={e => setEveryMonths(digits(e.target.value))} />
          </>
        ) : (
          <>
            <label className="lbl">המועד הבא</label>
            <div className="row2">
              <input className="in" inputMode="numeric" placeholder="בק״מ" value={dueKm} onChange={e => setDueKm(digits(e.target.value))} />
              <input className="in" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="hint" style={{ marginTop: 6 }}>מה שמגיע קודם קובע. אפשר למלא רק אחד.</div>
            <label className="lbl">חוזר כל</label>
            <div className="row2">
              <input className="in" inputMode="numeric" placeholder="ק״מ" value={everyKm} onChange={e => setEveryKm(digits(e.target.value))} />
              <input className="in" inputMode="numeric" placeholder="חודשים" value={everyMonths} onChange={e => setEveryMonths(digits(e.target.value))} />
            </div>
          </>
        )}

        {docKind && (
          <>
            <label className="lbl">{isInsurance ? 'תמונה של הביטוח' : 'תמונה של רישיון הרכב'}</label>
            {files.length > 0 && (
              <div className="thumbs" style={{ marginBottom: 10 }}>
                {files.map(f => (
                  <span key={f} className="thumb-x">
                    <FileThumb fileRef={f} onOpen={setView} />
                    <button onClick={() => setFiles(fs => fs.filter(x => x !== f))} aria-label="הסרת תמונה">
                      <Icon name="close" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <label className="file-btn">
              {uploading ? (
                <span className="spin" />
              ) : (
                <>
                  <Icon name="camera" /> {files.length ? 'הוספת עוד תמונה' : isInsurance ? 'צילום או העלאת הפוליסה' : 'צילום או העלאת רישיון הרכב'}
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
                    <FileThumb fileRef={sv.receipt} onOpen={setView} />
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
        {item && (
          <ConfirmButton className="btn danger" style={{ marginTop: 8 }} onConfirm={remove}>
            מחיקת תזכורת
          </ConfirmButton>
        )}
      </div>
      {view && <Lightbox url={view} onClose={() => setView(null)} />}
    </Sheet>
  )
}
