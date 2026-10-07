import { useMemo, useState } from 'react'
import type { ItemKind } from '../types'
import { Sheet } from '../components/ui'
import { useApp } from '../data/AppData'
import { KIND, SERVICE_KINDS } from '../domain/labels'
import { compressImage } from '../lib/image'
import { fmtNum } from '../lib/i18n'
import { todayIso } from '../lib/dates'
import { Icon, kindIcon } from '../components/Icon'

export function ServiceSheet({ onClose, kind = 'service' }: { onClose(): void; kind?: ItemKind }) {
  const { car, km, data, actions } = useApp()
  const lastGarage = useMemo(
    () => [...data.services].filter(s => s.car_id === car?.id && s.garage).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.garage ?? '',
    [data.services, car?.id],
  )
  const [type, setType] = useState<ItemKind>(kind)
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayIso())
  const [kmV, setKm] = useState(String(km.value || ''))
  const [price, setPrice] = useState('')
  const [garage, setGarage] = useState(lastGarage)
  const [notes, setNotes] = useState('')
  const [receipt, setReceipt] = useState<Blob | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!car) return null

  async function save() {
    const n = Number(kmV.replace(/\D/g, ''))
    if (!n) return setErr('חסר מספר ק״מ')
    setBusy(true)
    setErr(null)
    try {
      const ref = receipt ? await actions.upload('receipt', await compressImage(receipt)) : null
      await actions.saveService({
        car_id: car!.id,
        type,
        title: title.trim() || (type === 'service' ? `טיפול ${fmtNum(Math.round(n / 1000) * 1000)}` : KIND[type].label),
        date,
        km: n,
        price: price ? Number(price) : null,
        garage: garage.trim() || null,
        notes: notes.trim() || null,
        receipt: ref,
      })
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="טיפול חדש" onClose={onClose}>
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
            <input className="in" type="date" value={date} max={todayIso()} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label className="lbl">ק״מ</label>
            <input className="in" inputMode="numeric" value={kmV ? fmtNum(Number(kmV)) : ''} onChange={e => setKm(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
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
          <Icon name={receipt ? 'check' : 'camera'} /> {receipt ? 'צולמה קבלה' : 'צילום קבלה'}
          <input type="file" accept="image/*" capture="environment" onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          {busy ? <span className="spin" /> : 'שמירה'}
        </button>
      </div>
    </Sheet>
  )
}
