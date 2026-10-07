import { useEffect, useRef, useState } from 'react'
import { Sheet } from '../components/ui'
import { useApp } from '../data/AppData'
import { readOdometer } from '../data/functions'
import { cloudEnabled } from '../data/supabase'
import { readingError } from '../domain/odometer'
import { agoText, fmtDate, fmtNum } from '../lib/i18n'
import { sortReadings } from '../domain/odometer'
import { ConfirmButton } from '../components/ConfirmButton'
import { Icon } from '../components/Icon'

export function OdometerSheet({ onClose, startWithPhoto = false }: { onClose(): void; startWithPhoto?: boolean }) {
  const { car, km, data, actions } = useApp()
  const [value, setValue] = useState(String(km.value || ''))
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [source, setSource] = useState<'manual' | 'photo'>('manual')
  const [editId, setEditId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [histErr, setHistErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (startWithPhoto) fileRef.current?.click()
    else inputRef.current?.select()
  }, [startWithPhoto])

  if (!car) return null
  const n = Number(value.replace(/\D/g, ''))
  const readings = data.readings.filter(r => r.car_id === car.id)
  const last = km.last
  const history = sortReadings(readings).reverse()
  // A new value below the last reading usually means the last one was a typo.
  const prev = history[1]
  const canFixLast = Boolean(last && n && n < last.km && (!prev || n >= prev.km))

  async function fixLast() {
    if (!last) return
    setBusy(true)
    try {
      await actions.updateReading(last.id, n)
      onClose()
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit(id: string) {
    setHistErr(null)
    try {
      await actions.updateReading(id, Number(editValue.replace(/\D/g, '')))
      setEditId(null)
    } catch (x) {
      setHistErr(x instanceof Error ? x.message : String(x))
    }
  }

  async function removeReading(id: string) {
    setHistErr(null)
    try {
      await actions.deleteReading(id)
    } catch (x) {
      setHistErr(x instanceof Error ? x.message : String(x))
    }
  }

  const SOURCE: Record<string, string> = { start: 'התחלה', manual: 'ידני', confirm: 'אישור שבועי', photo: 'מתמונה', service: 'מטיפול' }

  async function onPhoto(f: File | undefined) {
    if (!f) return
    setPhoto(URL.createObjectURL(f))
    setErr(null)
    setReading(true)
    try {
      const v = await readOdometer(f)
      setValue(String(v))
      setSource('photo')
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setReading(false)
    }
  }

  async function save() {
    const e = readingError(readings, n)
    if (e) return setErr(canFixLast ? `${e}. אם הקריאה הקודמת הוקלדה בטעות, אפשר לתקן אותה:` : e)
    setBusy(true)
    try {
      await actions.addReading(car!.id, n, source)
      onClose()
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x))
    } finally {
      setBusy(false)
    }
  }

  const bump = (d: number) => {
    setValue(String((n || last?.km || 0) + d))
    setSource('manual')
  }

  return (
    <Sheet title="כמה ק״מ ברכב?" onClose={onClose}>
      <div className="card">
        {photo && (
          <div className="cam" style={{ marginBottom: 12 }}>
            <img src={photo} alt="" />
            {reading && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.35)' }}>
                <span className="spin" />
              </div>
            )}
          </div>
        )}
        <input
          ref={inputRef}
          className="big-in"
          inputMode="numeric"
          value={value ? fmtNum(n) : ''}
          placeholder="0"
          onChange={e => {
            setValue(e.target.value.replace(/\D/g, ''))
            setSource('manual')
            setErr(null)
          }}
          aria-label="ק״מ"
        />
        <div className="hint center" style={{ marginTop: 8 }}>
          {last
            ? `קודם: ${fmtNum(last.km)} · ${agoText(km.checkedDaysAgo ?? 0)}${n > last.km ? ` · +${fmtNum(n - last.km)} ק״מ` : ''}`
            : 'הקריאה הראשונה של הרכב'}
          {source === 'photo' && !reading && ' · זוהה מהתמונה'}
        </div>
        <div className="chips" style={{ justifyContent: 'center', marginTop: 12 }}>
          <button onClick={() => bump(100)}>+100</button>
          <button onClick={() => bump(500)}>+500</button>
          <button onClick={() => bump(1000)}>+1,000</button>
        </div>
        {err && <div className="err center">{err}</div>}
        {canFixLast && (
          <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={fixLast}>
            <Icon name="edit" /> הקריאה הקודמת שגויה? לתקן ל־{fmtNum(n)}
          </button>
        )}
        <div className="stack" style={{ marginTop: 16 }}>
          <button className="btn pri" disabled={busy || reading || !n} onClick={save}>
            {busy ? <span className="spin" /> : 'שמירה'}
          </button>
          <label className="file-btn" style={{ opacity: cloudEnabled ? 1 : 0.6 }}>
            <Icon name="camera" /> צילום לוח המחוונים
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={e => onPhoto(e.target.files?.[0])} />
          </label>
          {!cloudEnabled && <div className="hint center">קריאה מתמונה פועלת אחרי חיבור לענן</div>}
        </div>

        {history.length > 0 && (
          <>
            <label className="lbl" style={{ marginTop: 22 }}>קריאות קודמות</label>
            <div className="readings">
              {history.slice(0, 8).map(r => (
                <div key={r.id} className="reading">
                  {editId === r.id ? (
                    <>
                      <input
                        className="in"
                        inputMode="numeric"
                        autoFocus
                        value={editValue ? fmtNum(Number(editValue)) : ''}
                        onChange={e => setEditValue(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={e => e.key === 'Enter' && saveEdit(r.id)}
                        aria-label="ק״מ מתוקן"
                      />
                      <button className="icon-btn" onClick={() => saveEdit(r.id)} aria-label="שמירה">
                        <Icon name="check" />
                      </button>
                      <button className="icon-btn" onClick={() => setEditId(null)} aria-label="ביטול">
                        <Icon name="close" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="reading-km">{fmtNum(r.km)}</span>
                      <span className="reading-meta">
                        {fmtDate(r.date)} · {SOURCE[r.source] ?? r.source}
                      </span>
                      <button
                        className="icon-btn"
                        onClick={() => {
                          setEditId(r.id)
                          setEditValue(String(r.km))
                          setHistErr(null)
                        }}
                        aria-label={`עריכת קריאה ${fmtNum(r.km)}`}
                      >
                        <Icon name="edit" />
                      </button>
                      {history.length > 1 && <ConfirmButton icon label={`מחיקת קריאה ${fmtNum(r.km)}`} onConfirm={() => removeReading(r.id)} />}
                    </>
                  )}
                </div>
              ))}
            </div>
            {histErr && <div className="err">{histErr}</div>}
          </>
        )}
      </div>
    </Sheet>
  )
}
