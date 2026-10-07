import { useState } from 'react'
import type { Item } from '../types'
import { FileThumb, Lightbox, Sheet } from '../components/ui'
import { useApp } from '../data/AppData'
import { dueInfo } from '../domain/due'
import { INSURERS, KIND, STATUS_TEXT } from '../domain/labels'
import { compressImage } from '../lib/image'
import { uid } from '../lib/uid'
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
    if (!item || !confirm(`למחוק את התזכורת "${item.label}"?`)) return
    await actions.deleteItem(item.id)
    onClose()
  }

  return (
    <Sheet title={item ? item.label : 'תזכורת חדשה'} onClose={onClose}>
      <div className="card">
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

        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy || uploading} onClick={save}>
          שמירה
        </button>
        {item && (
          <button className="btn danger" style={{ marginTop: 8 }} onClick={remove}>
            מחיקת תזכורת
          </button>
        )}
      </div>
      {view && <Lightbox url={view} onClose={() => setView(null)} />}
    </Sheet>
  )
}
