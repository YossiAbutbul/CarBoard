import { useRef, useState } from 'react'
import { userMessage } from '../lib/errors'
import type { BodyType, Car } from '../types'
import { Sheet, useDirty } from '../components/ui'
import { useApp } from '../data/AppData'
import { formatPlate, plateDigits } from '../lib/govil'
import { PlateInput, usePlateLookup } from '../components/PlateField'
import { fmtDate } from '../lib/i18n'
import { Icon } from '../components/Icon'
import { BODY_TYPES, PAINTS, ToyCar, bodyLabel, guessBody, paintFromRegistry } from '../components/CarAvatar'

/** Add a new car (car = undefined) or edit an existing one. */
export function CarSheet({ car, onClose }: { car?: Car; onClose(): void }) {
  const { actions, setCarId, km } = useApp()
  const editing = Boolean(car)
  const [name, setName] = useState(car?.name ?? '')
  const { plate, info, looking, lookErr, digits, type } = usePlateLookup(car?.plate ?? '', {
    // an existing car keeps its details until its number changes
    skip: d => editing && d === plateDigits(car?.plate ?? ''),
    onFound: r => setName(prev => prev || `${r.make} ${r.model}`.trim()),
  })
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

  const [refreshing, setRefreshing] = useState(false)
  const [refreshNote, setRefreshNote] = useState<string | null>(null)
  async function refreshTest() {
    if (!car) return
    setRefreshing(true)
    try {
      const r = await actions.refreshTest(car.id)
      setRefreshNote(!r.until ? 'לא נמצא תאריך במשרד התחבורה' : r.changed ? `עודכן: טסט עד ${fmtDate(r.until)}` : `אין שינוי: טסט עד ${fmtDate(r.until)}`)
    } catch {
      setRefreshNote('אין חיבור למשרד התחבורה. נסו שוב.')
    } finally {
      setRefreshing(false)
    }
  }

  async function save() {
    if (editing && !dirty) return onClose() // nothing changed: nothing to write
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
      setErr(userMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={editing ? 'עריכת רכב' : 'רכב חדש'} onClose={onClose} dirty={dirty}>
      <div className="card car-form">
        <div className="hint">הקלד מספר רכב. השאר מתמלא לבד.</div>
        <PlateInput value={plate} onChange={type} />
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
          ) : lookErr ? (
            lookErr
          ) : car?.plate && digits === plateDigits(car.plate) ? (
            // an existing car: read the test date from the registry again (after a test it moves on)
            <button className="test-link plate-refresh" disabled={refreshing} onClick={refreshTest}>
              {refreshing ? <span className="spin" /> : <Icon name="refresh" />}
              {refreshNote ?? 'עדכון תאריך הטסט ממשרד התחבורה'}
            </button>
          ) : null}
        </div>

        <label className="lbl">בחר אווטאר</label>
        <div className="studio">
          <div className="studio-top">
            <div
              key={shownBody} // a new body type drives in again, road and all
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
