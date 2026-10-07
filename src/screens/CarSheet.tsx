import { useState } from 'react'
import type { Car } from '../types'
import { Sheet, useFileUrl } from '../components/ui'
import { CarDrop, useCarPhotoUpload } from '../components/CarPhoto'
import { useApp } from '../data/AppData'
import { formatPlate, lookupPlate, plateDigits, type PlateInfo } from '../lib/govil'
import { fmtDate } from '../lib/i18n'
import { Icon } from '../components/Icon'

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
  const [imageRef, setImageRef] = useState<string | null>(car?.image_url ?? null)
  const photo = useCarPhotoUpload()
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const imageUrl = useFileUrl(imageRef)

  const make = info?.make ?? car?.make ?? null
  const model = info?.model ?? car?.model ?? null
  const year = info?.year ?? car?.year ?? null
  const color = info?.color ?? car?.color ?? null

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
        image_url: imageRef,
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
        <input
          className="in plate-in"
          style={{ marginTop: 8 }}
          inputMode="numeric"
          placeholder="12-345-67"
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

        <label className="lbl">תמונה</label>
        {imageUrl ? (
          <>
            <div className="checker">
              <img src={imageUrl} alt="" />
            </div>
            <div className="row2" style={{ marginTop: 8 }}>
              <label className="file-btn">
                <Icon name="camera" /> החלפה
                <input type="file" accept="image/*" onChange={async e => setImageRef((await photo.upload(e.target.files?.[0])) ?? imageRef)} />
              </label>
              <button className="btn" onClick={() => setImageRef(null)}>
                <Icon name="trash" /> הסרה
              </button>
            </div>
          </>
        ) : (
          <CarDrop busy={photo.busy} error={photo.error} onFile={async f => setImageRef(await photo.upload(f))} />
        )}

        <label className="lbl">שם לרכב</label>
        <input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="למשל: הקיה של אבא" />
        {!editing && (
          <>
            <label className="lbl">כמה ק״מ יש לרכב היום?</label>
            <input className="in" inputMode="numeric" value={kmNow} onChange={e => setKmNow(e.target.value.replace(/\D/g, ''))} placeholder="48,230" />
          </>
        )}
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy || Boolean(photo.busy)} onClick={save}>
          {busy ? <span className="spin" /> : editing ? 'שמירה' : 'הוספת רכב'}
        </button>
      </div>
    </Sheet>
  )
}
