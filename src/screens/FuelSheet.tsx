import { useMemo, useState } from 'react'
import { DateField } from '../components/DateField'
import { ConfirmButton } from '../components/ConfirmButton'
import { Sheet, useDirty } from '../components/ui'
import { useApp } from '../data/AppData'
import type { Fuel } from '../types'
import { todayIso } from '../lib/dates'
import { fmtDate, fmtNum } from '../lib/i18n'
import { ask } from '../components/Dialog'
import { userMessage } from '../lib/errors'
import { uid } from '../lib/uid'
import { Icon } from '../components/Icon'

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
  const [time, setTime] = useState<string | null>(record?.time ?? null) // from a scanned receipt
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const dirty = useDirty([date, time, liters, price, kmV, station, full])
  const [scan, setScan] = useState<{ p: number } | null>(null)
  const [scanNote, setScanNote] = useState<string | null>(null)
  if (!car) return null

  // Read a receipt (the station app's PDF, or a photo) on the phone and fill in what it says.
  // The file is only read here: it is not uploaded and not kept.
  async function readReceipt(file: File | undefined) {
    if (!file) return
    setScan({ p: 0 })
    setScanNote(null)
    setErr(null)
    try {
      const { scanFuelReceipt } = await import('../lib/receiptScan')
      const r = await scanFuelReceipt(file, p => setScan({ p }))
      setScan(null)
      const useDate = r.date && r.date <= todayIso() ? r.date : null
      const lines = [
        r.liters != null && `ליטרים: ${r.liters}`,
        r.perLiter != null && `מחיר לליטר: ₪${r.perLiter}`,
        r.total != null && `סה״כ: ₪${r.total}`,
        useDate && `תאריך: ${fmtDate(useDate)}`,
        r.station && `תחנה: ${r.station}`,
      ].filter(Boolean)
      if (!lines.length) return setScanNote('לא הצלחנו לקרוא את הקבלה. אפשר למלא ידנית.')
      // the reading is automatic and can be wrong: show what was read, and fill in only after a yes
      const ok = await ask({
        title: 'זה מה שנקרא מהקבלה. נכון?',
        text: `${lines.join('\n')}\n\nהקריאה אוטומטית ועלולה לטעות. בדקו שהערכים נכונים.`,
        confirm: 'כן, למלא',
        cancel: 'לא, אמלא בעצמי',
      })
      if (!ok) return
      if (r.liters != null) setLiters(String(r.liters))
      if (r.total != null) setPrice(String(r.total))
      if (useDate) setDate(useDate)
      setTime(useDate ? r.time : null)
      if (r.station) setStation(r.station)
      setScanNote('מולא מהקבלה. אפשר לתקן כל שדה לפני השמירה.')
    } catch (e) {
      setScanNote(navigator.onLine ? userMessage(e) : 'בפעם הראשונה הסריקה צריכה אינטרנט (להורדת מנוע הקריאה).')
    } finally {
      setScan(null)
    }
  }

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
        time,
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
        <label className={`file-btn scan-btn ${scan ? 'busy' : ''}`}>
          {scan ? (
            <>
              <span className="spin" /> קורא את הקבלה… {Math.round(scan.p * 100)}%
              <i className="scan-progress" style={{ width: `${Math.round(scan.p * 100)}%` }} />
            </>
          ) : (
            <>
              <Icon name="scan" /> סריקת קבלה (PDF או צילום)
            </>
          )}
          <input type="file" accept="image/*,application/pdf" disabled={Boolean(scan)} onChange={e => {
            readReceipt(e.target.files?.[0])
            e.target.value = '' // the same file can be picked again
          }} />
        </label>
        <div className="scan-note">{scanNote ?? 'הקבלה נקראת בטלפון ולא נשמרת.'}</div>
        <div className="row2">
          <div>
            <label className="lbl">ליטרים</label>
            <input className="in" inputMode="decimal" value={liters} placeholder="0" onChange={e => setLiters(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
          <div>
            <label className="lbl">סה״כ (₪)</label>
            <input className="in" inputMode="decimal" value={price} placeholder="0" onChange={e => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
          </div>
        </div>
        {/* worked out from liters and total; shown as a box of its own, not typed */}
        <div className="fuel-perl-box" aria-live="polite">
          <span>מחיר לליטר</span>
          <b>{perLiter ? `₪${perLiter.toFixed(2)}` : '—'}</b>
        </div>
        <div className="row2">
          <div>
            <label className="lbl">תאריך</label>
            <DateField value={date} onChange={d => { setDate(d); setTime(null) }} kind="past" max={todayIso()} clearable={false} label="תאריך התדלוק" />
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
