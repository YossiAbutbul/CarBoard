import { DateField } from '../components/DateField'
import { userMessage } from '../lib/errors'
import { useMemo, useState } from 'react'
import type { ItemKind, ServiceRecord } from '../types'
import { Sheet, useDirty } from '../components/ui'
import { useApp } from '../data/AppData'
import { KIND, SERVICE_KINDS } from '../domain/labels'
import { compressImage } from '../lib/image'
import { fmtNum } from '../lib/i18n'
import { todayIso } from '../lib/dates'
import { Icon, kindIcon } from '../components/Icon'

/** Add a service, or fix one that was entered wrong (record given). */
export function ServiceSheet({ onClose, kind = 'service', record }: { onClose(): void; kind?: ItemKind; record?: ServiceRecord }) {
  const { car, km, data, actions } = useApp()
  const lastGarage = useMemo(
    () => [...data.services].filter(s => s.car_id === car?.id && s.garage).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.garage ?? '',
    [data.services, car?.id],
  )
  const [type, setType] = useState<ItemKind>(record?.type ?? kind)
  const [title, setTitle] = useState(record?.title ?? '')
  const [date, setDate] = useState(record?.date ?? todayIso())
  // the km is the one typed (or the estimate, when picked): never the estimate by itself, since saving
  // a service also saves its km as a reading of the odometer
  const [kmV, setKm] = useState(record?.km != null ? String(record.km) : '')
  const guess = !record && km.value ? Math.round(km.value) : null
  const [price, setPrice] = useState(record?.price != null ? String(record.price) : '')
  const [garage, setGarage] = useState(record?.garage ?? lastGarage)
  const [notes, setNotes] = useState(record?.notes ?? '')
  const [receipt, setReceipt] = useState<Blob | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = useDirty([type, title, date, kmV, price, garage, notes, Boolean(receipt)])

  if (!car) return null

  async function save() {
    if (record && !dirty) return onClose() // nothing changed: nothing to write
    const n = Number(kmV.replace(/\D/g, ''))
    if (!n) return setErr('חסר מספר ק״מ')
    setBusy(true)
    setErr(null)
    try {
      const ref = receipt ? await actions.upload('receipt', receipt.type.startsWith('image/') ? await compressImage(receipt) : receipt) : (record?.receipt ?? null)
      const fields = {
        car_id: car!.id,
        type,
        title: title.trim() || (type === 'service' ? `טיפול ${fmtNum(Math.round(n / 1000) * 1000)}` : KIND[type].label),
        date,
        km: n,
        price: price ? Number(price) : null,
        garage: garage.trim() || null,
        notes: notes.trim() || null,
        receipt: ref,
      }
      if (record) await actions.updateService(record.id, fields)
      else await actions.saveService(fields)
      onClose()
    } catch (e) {
      setErr(userMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={record ? 'עריכת טיפול' : 'טיפול חדש'} onClose={onClose} dirty={dirty}>
      <div className="card">
        <span className="lbl" style={{ marginTop: 0 }}>סוג</span>
        <div className="chips">
          {SERVICE_KINDS.map(k => (
            <button key={k} className={type === k ? 'on' : ''} onClick={() => setType(k)}>
              <Icon name={kindIcon(k)} /> {KIND[k].label}
            </button>
          ))}
        </div>
        <div className="row2">
          <div>
            <label className="lbl">תאריך</label>
            <DateField value={date} onChange={setDate} kind="past" max={todayIso()} clearable={false} label="תאריך הטיפול" />
          </div>
          <div>
            <label className="lbl">ק״מ</label>
            <input className="in" inputMode="numeric" value={kmV ? fmtNum(Number(kmV)) : ''} onChange={e => setKm(e.target.value.replace(/\D/g, ''))} placeholder={guess ? `כ־${fmtNum(guess)}` : 'מהלוח'} />
          </div>
        </div>
        {guess && !kmV && (
          <button className="km-guess" onClick={() => setKm(String(guess))}>
            להשתמש בהערכה: {fmtNum(guess)} ק״מ
          </button>
        )}
        <div className="row2">
          <div>
            <label className="lbl">מחיר (₪)</label>
            <input className="in" inputMode="decimal" value={price} placeholder="0" onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div>
            <label className="lbl">מוסך</label>
            <input className="in" value={garage} onChange={e => setGarage(e.target.value)} placeholder="שם המוסך" />
          </div>
        </div>
        <label className="lbl">כותרת (לא חובה)</label>
        <input className="in" value={title} onChange={e => setTitle(e.target.value)} placeholder={type === 'service' ? `טיפול ${fmtNum(Math.round(Number(kmV || 0) / 1000) * 1000)}` : KIND[type].label} />
        <label className="lbl">הערות</label>
        <textarea className="in" value={notes} onChange={e => setNotes(e.target.value)} placeholder="מה הוחלף, מה המליצו…" />
        <label className="lbl">קבלה</label>
        <label className="file-btn">
          <Icon name={receipt ? 'check' : 'camera'} /> {receipt ? (receipt.type === 'application/pdf' ? 'צורף קובץ' : 'צולמה קבלה') : 'צילום או קובץ של הקבלה'}
          <input type="file" accept="image/*,application/pdf" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          {busy ? <span className="spin" /> : 'שמירה'}
        </button>
      </div>
    </Sheet>
  )
}
