import { useEffect, useRef, useState } from 'react'
import { Sheet, useDirty } from '../components/ui'
import { useApp } from '../data/AppData'
import { readingError } from '../domain/odometer'
import { agoText, fmtDate, fmtNum } from '../lib/i18n'
import { sortReadings } from '../domain/odometer'
import { ConfirmButton } from '../components/ConfirmButton'
import { Icon } from '../components/Icon'

export function OdometerSheet({ onClose }: { onClose(): void }) {
  const { car, km, data, actions } = useApp()
  const [value, setValue] = useState(String(km.value || ''))
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const source = 'manual' as const
  const [showHistory, setShowHistory] = useState(false)
  const dirty = useDirty([value])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.select()
  }, [])

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
  }

  return (
    <Sheet title="כמה ק״מ ברכב?" onClose={onClose} dirty={dirty}>
      <div className="card">
        <input
          ref={inputRef}
          className="big-in"
          inputMode="numeric"
          value={value ? fmtNum(n) : ''}
          placeholder="0"
          onChange={e => {
            setValue(e.target.value.replace(/\D/g, ''))
            setErr(null)
          }}
          aria-label="ק״מ"
        />
        <div className="hint center" style={{ marginTop: 8 }}>
          {last
            ? `קודם: ${fmtNum(last.km)} · ${agoText(km.checkedDaysAgo ?? 0)}${n > last.km ? ` · +${fmtNum(n - last.km)} ק״מ` : ''}`
            : 'הקריאה הראשונה של הרכב'}
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
          <button className="btn pri" disabled={busy || !n} onClick={save}>
            {busy ? <span className="spin" /> : 'שמירה'}
          </button>
        </div>

        {history.length > 0 && (
          <button className="history-btn" onClick={() => setShowHistory(true)}>
            <Icon name="list" />
            <span>היסטוריית ק״מ</span>
            <small>{history.length === 1 ? 'קריאה אחת' : `${history.length} קריאות`}</small>
          </button>
        )}
      </div>
      {showHistory && <KmHistorySheet onClose={() => setShowHistory(false)} />}
    </Sheet>
  )
}

const SOURCE: Record<string, string> = { start: 'התחלה', manual: 'ידני', confirm: 'אישור שבועי', photo: 'מתמונה', service: 'מטיפול' }

/** Every km reading of the car, in its own window: fix a mistyped one or delete it. */
function KmHistorySheet({ onClose }: { onClose(): void }) {
  const { car, data, actions } = useApp()
  const [editId, setEditId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [histErr, setHistErr] = useState<string | null>(null)
  if (!car) return null
  const history = sortReadings(data.readings.filter(r => r.car_id === car.id)).reverse()

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

  return (
    <Sheet title="היסטוריית ק״מ" onClose={onClose} dirty={editId !== null}>
      <div className="card">
            <div className="readings">
              {history.map(r => (
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
                      {history.length > 1 && <ConfirmButton icon label={`מחיקת קריאה ${fmtNum(r.km)}`} question="למחוק את הקריאה?" detail={`${fmtNum(r.km)} ק״מ · ${fmtDate(r.date)}`} onConfirm={() => removeReading(r.id)} />}
                    </>
                  )}
                </div>
              ))}
            </div>
            {histErr && <div className="err">{histErr}</div>}
      </div>
    </Sheet>
  )
}
