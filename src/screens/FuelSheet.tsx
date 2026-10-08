import { useMemo, useState } from 'react'
import { DateField } from '../components/DateField'
import { ConfirmButton } from '../components/ConfirmButton'
import { Sheet, useDirty } from '../components/ui'
import { useApp } from '../data/AppData'
import type { Fuel } from '../types'
import { todayIso } from '../lib/dates'
import { fmtNum } from '../lib/i18n'
import { userMessage } from '../lib/errors'
import { uid } from '../lib/uid'

const num = (s: string) => (s.trim() === '' ? null : Number(s))

/** Log a fill-up, or fix one (record given). Everything but the date is optional. */
export function FuelSheet({ record, onClose }: { record?: Fuel; onClose(): void }) {
  const { car, data, actions } = useApp()
  const lastStation = useMemo(
    () => [...data.fuel].filter(f => f.car_id === car?.id && f.station).sort((a, b) => (a.date < b.date ? 1 : -1))[0]?.station ?? '',
    [data.fuel, car?.id],
  )
  const [date, setDate] = useState(record?.date ?? todayIso())
  const [liters, setLiters] = useState(record?.liters != null ? String(record.liters) : '')
  const [price, setPrice] = useState(record?.price != null ? String(record.price) : '')
  const [kmV, setKm] = useState(record?.km != null ? String(record.km) : '')
  const [station, setStation] = useState(record?.station ?? lastStation)
  const [full, setFull] = useState(record?.full ?? true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = useDirty([date, liters, price, kmV, station, full])
  if (!car) return null

  const l = num(liters)
  const p = num(price)
  const perLiter = l && p ? p / l : null

  async function save() {
    if (record && !dirty) return onClose() // nothing changed: nothing to write
    if (l == null && p == null && !kmV) return setErr('מלאו לפחות ליטרים, מחיר או ק״מ')
    setBusy(true)
    setErr(null)
    try {
      await actions.saveFuel({
        id: record?.id ?? uid(),
        car_id: car!.id,
        date,
        liters: l,
        price: p,
        km: kmV ? Number(kmV) : null,
        station: station.trim() || null,
        full,
      })
      onClose()
    } catch (e) {
      setErr(userMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={record ? 'עריכת תדלוק' : 'תדלוק'} onClose={onClose} dirty={dirty}>
      <div className="card">
        <div className="row2">
          <div>
            <label className="lbl" style={{ marginTop: 0 }}>ליטרים</label>
            <input className="in" inputMode="decimal" value={liters} placeholder="0" onChange={e => setLiters(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div>
            <label className="lbl" style={{ marginTop: 0 }}>סה״כ (₪)</label>
            <input className="in" inputMode="decimal" value={price} placeholder="0" onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
        </div>
        <div className="fuel-perl" aria-live="polite">{perLiter ? `₪${perLiter.toFixed(2)} לליטר` : ' '}</div>
        <div className="row2">
          <div>
            <label className="lbl">תאריך</label>
            <DateField value={date} onChange={setDate} kind="past" max={todayIso()} clearable={false} label="תאריך התדלוק" />
          </div>
          <div>
            <label className="lbl">ק״מ</label>
            <input className="in" inputMode="numeric" value={kmV ? fmtNum(Number(kmV)) : ''} placeholder="לא חובה" onChange={e => setKm(e.target.value.replace(/\D/g, ''))} />
          </div>
        </div>
        <label className="lbl">תחנה</label>
        <input className="in" value={station} onChange={e => setStation(e.target.value)} placeholder="למשל: פז, דלק, סונול" />
        <div className="fuel-full">
          <div>
            <div className="t">מילוי מלא</div>
            <div className="s">ממלאים עד הסוף? כך האפליקציה מחשבת כמה ק״מ לליטר.</div>
          </div>
          <button role="switch" aria-checked={full} aria-label="מילוי מלא" className={`switch ${full ? 'on' : ''}`} onClick={() => setFull(!full)} />
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          {busy ? <span className="spin" /> : 'שמירה'}
        </button>
        {record && (
          <ConfirmButton className="btn danger" style={{ marginTop: 8 }} question="למחוק את התדלוק?" onConfirm={async () => {
            await actions.deleteFuel(record.id)
            onClose()
          }}>
            מחיקה
          </ConfirmButton>
        )}
      </div>
    </Sheet>
  )
}
