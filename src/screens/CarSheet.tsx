import { useEffect, useRef, useState } from 'react'
import type { BodyType, Car } from '../types'
import { Sheet, useDirty } from '../components/ui'
import { useApp } from '../data/AppData'
import { formatPlate, lookupPlate, plateDigits, typingPlate, type PlateInfo } from '../lib/govil'
import { fmtDate } from '../lib/i18n'
import { Icon } from '../components/Icon'
import { BODY_TYPES, PAINTS, ToyCar, bodyLabel, guessBody, paintFromRegistry } from '../components/CarAvatar'

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
  // Body and paint: null means "automatic" (guessed from the model, painted in the registry colour).
  const [body, setBody] = useState<BodyType | null>(car?.body ?? null)
  const [paint, setPaint] = useState<string | null>(car?.paint ?? null)

  const make = info?.make ?? car?.make ?? null
  const model = info?.model ?? car?.model ?? null
  const year = info?.year ?? car?.year ?? null
  const color = info?.color ?? car?.color ?? null
  const shownPaint = paint ?? paintFromRegistry(color)
  const shownBody: BodyType = body === 'small' || body === 'family' || body === 'sport' ? 'car' : (body ?? guessBody(model))
  // compared by what you see: choosing the colour or body that was already showing is not a change
  const dirty = useDirty([plateDigits(plate), name, kmNow, shownBody, shownPaint])
  const swipeX = useRef(0)
  const stepBody = (d: number) => setBody(BODY_TYPES[(BODY_TYPES.indexOf(shownBody) + d + BODY_TYPES.length) % BODY_TYPES.length])

  // Look the plate up once typing stops; a reply for an older number is ignored.
  const asked = useRef(0)
  const digits = plateDigits(plate)
  useEffect(() => {
    if (editing && digits === plateDigits(car?.plate ?? '')) return
    setLookErr(null)
    if (digits.length < 7 || info) return setLooking(false)
    setLooking(true)
    const n = ++asked.current
    const t = setTimeout(async () => {
      try {
        const r = await lookupPlate(digits)
        if (n !== asked.current) return
        if (!r) setLookErr('לא נמצא במאגר משרד התחבורה. אפשר להמשיך ידנית.')
        else {
          setInfo(r)
          setPlate(r.plate)
          setName(prev => prev || `${r.make} ${r.model}`.trim())
        }
      } catch {
        if (n === asked.current) setLookErr('אין חיבור למשרד התחבורה כרגע. אפשר להמשיך ידנית.')
      } finally {
        if (n === asked.current) setLooking(false)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [digits]) // eslint-disable-line react-hooks/exhaustive-deps

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
    <Sheet title={editing ? 'עריכת רכב' : 'רכב חדש'} onClose={onClose} dirty={dirty}>
      <div className="card car-form">
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
            placeholder="12-345-67"
            value={plate}
            onChange={e => {
              // backspace on a dash takes the digit before it (else the dash just comes back)
              const v = e.target.value
              const onlyDash = v.length < plate.length && plateDigits(v) === plateDigits(plate)
              const at = e.target.selectionStart ?? v.length
              setPlate(typingPlate(onlyDash ? v.slice(0, Math.max(0, at - 1)) + v.slice(at) : v))
              if (plateDigits(e.target.value) !== plateDigits(plate)) setInfo(null)
            }}
            aria-label="מספר רכב"
          />
        </label>
        {/* one short status line in a fixed slot, so the sheet does not jump */}
        <div className={`plate-status ${info ? 'ok' : lookErr ? 'bad' : ''}`} aria-live="polite">
          {looking ? (
            <>
              <span className="spin" /> מחפש במשרד התחבורה…
            </>
          ) : info ? (
            <>
              <Icon name="check" />
              <span>
                {info.make} {info.model} · {info.year} · {info.color}
                {info.licenceUntil && <small> · טסט עד {fmtDate(info.licenceUntil)}</small>}
              </span>
            </>
          ) : (
            lookErr
          )}
        </div>

        <label className="lbl">בחר אווטאר</label>
        <div className="studio">
          <div className="studio-top">
            <div
              className="studio-stage"
              onTouchStart={e => (swipeX.current = e.touches[0].clientX)}
              onTouchEnd={e => {
                const dx = e.changedTouches[0].clientX - swipeX.current
                if (Math.abs(dx) > 40) stepBody(dx > 0 ? 1 : -1) // RTL: a swipe to the right shows the next one
              }}
            >
              <ToyCar key={shownBody} body={shownBody} paint={shownPaint} className="studio-toy" />
            </div>
            <div className="studio-types" role="radiogroup" aria-label="סוג רכב">
              {BODY_TYPES.map(b => (
                <button key={b} role="radio" aria-checked={shownBody === b} className={shownBody === b ? 'on' : ''} onClick={() => setBody(b)}>
                  {bodyLabel(b)}
                </button>
              ))}
            </div>
          </div>
          <div className="studio-paints paints" role="radiogroup" aria-label="צבע">
            <button
              className={`paint auto ${paint === null ? 'on' : ''}`}
              onClick={() => setPaint(null)}
              aria-label="צבע לפי משרד הרישוי"
              title={color ? `לפי הרישוי: ${color}` : 'אוטומטי'}
              style={{ '--p': paintFromRegistry(color) } as React.CSSProperties}
            >
              <span>מקורי</span>
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
        </div>

        <div className={editing ? '' : 'row2'}>
          <div>
            <label className="lbl">שם לרכב</label>
            <input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="הקיה של אבא" />
          </div>
          {!editing && (
            <div>
              <label className="lbl">ק״מ היום</label>
              <input className="in" inputMode="numeric" value={kmNow ? Number(kmNow).toLocaleString('he-IL') : ''} onChange={e => setKmNow(e.target.value.replace(/\D/g, ''))} placeholder="48,230" />
            </div>
          )}
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
          {busy ? <span className="spin" /> : editing ? 'שמירה' : 'הוספת רכב'}
        </button>
      </div>
    </Sheet>
  )
}
