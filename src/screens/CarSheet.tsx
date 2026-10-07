import { useState } from 'react'
import type { BodyType, Car } from '../types'
import { Sheet } from '../components/ui'
import { useApp } from '../data/AppData'
import { formatPlate, lookupPlate, plateDigits, type PlateInfo } from '../lib/govil'
import { fmtDate } from '../lib/i18n'
import { Icon } from '../components/Icon'
import { BODY_TYPES, CarAvatar, PAINTS, bodyLabel, guessBody, paintFromRegistry } from '../components/CarAvatar'

/** Add a new car (car = undefined) or edit an existing one. */
export function CarSheet({ car, onClose }: { car?: Car; onClose(): void }) {
  const { actions, setCarId, km } = useApp()
  const editing = Boolean(car)
  const [plate, setPlate] = useState(car?.plate ?? '')
  const [info, setInfo] = useState<PlateInfo | null>(null)
  const [looking, setLooking] = useState(false)
  const [lookErr, setLookErr] = useState<string | null>(null)
  const [name, setName] = useState(car?.name ?? '')
  const [kmNow, setKmNow] = useState(editing ? String(km.value) : '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Avatar: null means "automatic" (body guessed from the model, paint from the registry colour).
  const [body, setBody] = useState<BodyType | null>(car?.body ?? null)
  const [paint, setPaint] = useState<string | null>(car?.paint ?? null)

  const make = info?.make ?? car?.make ?? null
  const model = info?.model ?? car?.model ?? null
  const year = info?.year ?? car?.year ?? null
  const color = info?.color ?? car?.color ?? null
  const shownBody = body ?? guessBody(model)
  const shownPaint = paint ?? paintFromRegistry(color)

  async function lookup(p = plate) {
    if (plateDigits(p).length < 7) return
    setLooking(true)
    setLookErr(null)
    try {
      const r = await lookupPlate(p)
      if (!r) setLookErr('הרכב לא נמצא במאגר משרד התחבורה. אפשר להמשיך ידנית.')
      else {
        setInfo(r)
        setPlate(r.plate)
        if (!name) setName(`${r.make} ${r.model}`.trim())
      }
    } catch {
      setLookErr('אין חיבור למאגר משרד התחבורה כרגע. אפשר להמשיך ידנית.')
    } finally {
      setLooking(false)
    }
  }

  async function save() {
    const kmN = Number(kmNow.replace(/\D/g, ''))
    if (!plateDigits(plate) && !name.trim()) return setErr('צריך מספר רכב או שם')
    if (!editing && !kmNow) return setErr('כמה ק״מ יש לרכב היום?')
    setBusy(true)
    setErr(null)
    try {
      const fields: Omit<Car, 'id'> = {
        name: name.trim() || formatPlate(plate),
        plate: formatPlate(plate),
        make,
        model,
        year,
        color,
        fuel: info?.fuel ?? car?.fuel ?? null,
        tyres: info?.tyres ?? car?.tyres ?? null,
        image_url: null,
        body,
        paint,
      }
      if (car) await actions.updateCar(car.id, fields)
      else setCarId(await actions.addCar(fields, kmN, info?.licenceUntil ?? null))
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={editing ? 'עריכת רכב' : 'רכב חדש'} onClose={onClose}>
      <div className="card">
        <div className="hint">הקלד מספר רכב. השאר מתמלא לבד.</div>
        <label className="plate-il lg plate-input" dir="ltr">
          <span className="band" aria-hidden="true">
            <svg className="flag" viewBox="0 0 22 16">
              <rect width="22" height="16" fill="#fff" />
              <rect y="1.6" width="22" height="2.2" fill="#0038b8" />
              <rect y="12.2" width="22" height="2.2" fill="#0038b8" />
              <path d="M11 4.6 L14.2 10.1 H7.8 Z M11 11.4 L7.8 5.9 H14.2 Z" fill="none" stroke="#0038b8" strokeWidth="0.9" />
            </svg>
            <b>IL</b>
            <small>ישראל</small>
            <small className="ar">إسرائيل</small>
          </span>
          <input
            className="num"
            inputMode="numeric"
            placeholder="123-45-678"
            value={plate}
            onChange={e => {
              setPlate(e.target.value)
              setInfo(null)
              const d = plateDigits(e.target.value)
              if (d.length === 7 || d.length === 8) lookup(e.target.value)
            }}
            onBlur={() => !info && lookup()}
            aria-label="מספר רכב"
          />
        </label>
        {looking && (
          <div className="hint center" style={{ marginTop: 8 }}>
            <span className="spin" style={{ width: 14, height: 14, verticalAlign: 'middle' }} /> מחפש במשרד התחבורה…
          </div>
        )}
        {info && (
          <div className="found">
            <Icon name="check" />
            <div>
              {info.make} {info.model} · {info.year} · {info.color}
              {info.licenceUntil && <div className="hint">טסט בתוקף עד {fmtDate(info.licenceUntil)}</div>}
            </div>
          </div>
        )}
        {lookErr && <div className="err">{lookErr}</div>}

        <div className="avatar-stage">
          <CarAvatar body={shownBody} paint={shownPaint} />
        </div>
        <label className="lbl">סוג רכב</label>
        <div className="body-grid">
          {BODY_TYPES.map(b => (
            <button key={b} className={shownBody === b ? 'on' : ''} onClick={() => setBody(b)} aria-pressed={shownBody === b}>
              <CarAvatar body={b} paint={shownPaint} />
              <span>{bodyLabel(b)}</span>
            </button>
          ))}
        </div>
        <label className="lbl">צבע</label>
        <div className="paints">
          <button
            className={`paint auto ${paint === null ? 'on' : ''}`}
            onClick={() => setPaint(null)}
            aria-label="צבע לפי משרד הרישוי"
            title={color ? `לפי הרישוי: ${color}` : 'אוטומטי'}
            style={{ '--p': paintFromRegistry(color) } as React.CSSProperties}
          >
            <span>אוטו׳</span>
          </button>
          {PAINTS.map(p => (
            <button
              key={p.hex}
              className={`paint ${paint === p.hex ? 'on' : ''}`}
              onClick={() => setPaint(p.hex)}
              aria-label={p.name}
              title={p.name}
              style={{ '--p': p.hex } as React.CSSProperties}
            />
          ))}
        </div>

        <label className="lbl">שם לרכב</label>
        <input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="למשל: הקיה של אבא" />
        {!editing && (
          <>
            <label className="lbl">כמה ק״מ יש לרכב היום?</label>
            <input className="in" inputMode="numeric" value={kmNow} onChange={e => setKmNow(e.target.value.replace(/\D/g, ''))} placeholder="48,230" />
          </>
        )}
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          {busy ? <span className="spin" /> : editing ? 'שמירה' : 'הוספת רכב'}
        </button>
      </div>
    </Sheet>
  )
}
