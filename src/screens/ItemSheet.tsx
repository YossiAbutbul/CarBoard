import { useState } from 'react'
import type { Item } from '../types'
import { Sheet } from '../components/ui'
import { useApp } from '../data/AppData'
import { dueInfo } from '../domain/due'
import { KIND, STATUS_TEXT } from '../domain/labels'
import { uid } from '../lib/uid'

const numOrNull = (s: string) => (s.trim() ? Number(s.replace(/\D/g, '')) : null)

/** Edit a reminder, or create a custom one (item = undefined). */
export function ItemSheet({ item, onClose, onDone }: { item?: Item; onClose(): void; onDone(it: Item): void }) {
  const { car, km, actions } = useApp()
  const [label, setLabel] = useState(item?.label ?? '')
  const [everyKm, setEveryKm] = useState(item?.every_km?.toString() ?? '')
  const [everyMonths, setEveryMonths] = useState(item?.every_months?.toString() ?? '')
  const [dueKm, setDueKm] = useState(item?.due_km?.toString() ?? '')
  const [dueDate, setDueDate] = useState(item?.due_date ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (!car) return null

  const draft: Item = {
    id: item?.id ?? uid(),
    car_id: car.id,
    kind: item?.kind ?? 'custom',
    label: label.trim() || KIND[item?.kind ?? 'custom'].label,
    every_km: numOrNull(everyKm),
    every_months: numOrNull(everyMonths),
    due_km: numOrNull(dueKm),
    due_date: dueDate || null,
  }
  const preview = dueInfo(draft, km)

  async function save() {
    setBusy(true)
    try {
      await actions.saveItem(draft)
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
    <Sheet title={item ? `${KIND[item.kind].icon} ${item.label}` : 'תזכורת חדשה'} onClose={onClose}>
      <div className="card">
        {item && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span className={`chip ${preview.status}`}>{STATUS_TEXT[preview.status]}</span>
            <button className="pill dark" onClick={() => onDone(item)}>✓ בוצע עכשיו</button>
          </div>
        )}
        <label className="lbl">שם</label>
        <input className="in" value={label} onChange={e => setLabel(e.target.value)} placeholder="למשל: החלפת מגבים" />
        <label className="lbl">המועד הבא</label>
        <div className="row2">
          <input className="in" inputMode="numeric" placeholder="בק״מ" value={dueKm} onChange={e => setDueKm(e.target.value.replace(/\D/g, ''))} />
          <input className="in" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
        <div className="hint" style={{ marginTop: 6 }}>מה שמגיע קודם קובע. אפשר למלא רק אחד.</div>
        <label className="lbl">חוזר כל</label>
        <div className="row2">
          <input className="in" inputMode="numeric" placeholder="ק״מ" value={everyKm} onChange={e => setEveryKm(e.target.value.replace(/\D/g, ''))} />
          <input className="in" inputMode="numeric" placeholder="חודשים" value={everyMonths} onChange={e => setEveryMonths(e.target.value.replace(/\D/g, ''))} />
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          שמירה
        </button>
        {item && (
          <button className="btn danger" style={{ marginTop: 8 }} onClick={remove}>
            מחיקת תזכורת
          </button>
        )}
      </div>
    </Sheet>
  )
}
