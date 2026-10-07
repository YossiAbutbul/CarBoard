import { useEffect, useState } from 'react'
import type { Car } from '../types'
import { CarArt, Sheet, useFileUrl } from '../components/ui'
import { useApp } from '../data/AppData'
import { formatPlate, lookupPlate, plateDigits, type PlateInfo } from '../lib/govil'
import { hasModelImages, modelImageUrl } from '../lib/carImage'
import { cutoutCar } from '../lib/cutout'
import { fmtDate } from '../lib/i18n'

type PhotoMode = 'model' | 'own' | 'none'

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
  const [mode, setMode] = useState<PhotoMode>(car?.image_url ? (car.image_url.startsWith('http') ? 'model' : 'own') : 'model')
  const [ownRef, setOwnRef] = useState<string | null>(car?.image_url && !car.image_url.startsWith('http') ? car.image_url : null)
  const [cutting, setCutting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ownUrl = useFileUrl(ownRef)

  const make = info?.make ?? car?.make ?? null
  const model = info?.model ?? car?.model ?? null
  const year = info?.year ?? car?.year ?? null
  const color = info?.color ?? car?.color ?? null
  const modelUrl = modelImageUrl({ make, model, year })
  const [modelBroken, setModelBroken] = useState(false)
  useEffect(() => setModelBroken(false), [modelUrl])

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

  async function onOwnPhoto(f: File | undefined) {
    if (!f) return
    setCutting(true)
    setErr(null)
    try {
      const png = await cutoutCar(f)
      setOwnRef(await actions.upload('car', png))
      setMode('own')
    } catch {
      setErr('לא הצלחנו להסיר את הרקע. נסה תמונה אחרת, מהצד ועם רקע פשוט.')
    } finally {
      setCutting(false)
    }
  }

  const image_url = mode === 'model' ? (modelUrl && !modelBroken ? modelUrl : null) : mode === 'own' ? ownRef : null

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
        image_url,
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
            <span className="spin dark" style={{ width: 14, height: 14, verticalAlign: 'middle' }} /> מחפש במשרד התחבורה…
          </div>
        )}
        {info && (
          <div className="found">
            ✓ {info.make} {info.model} · {info.year} · {info.color}
            {info.licenceUntil && <div>טסט בתוקף עד {fmtDate(info.licenceUntil)}</div>}
          </div>
        )}
        {lookErr && <div className="err">{lookErr}</div>}

        <div className="checker">
          {mode === 'own' && cutting ? (
            <div className="hint">
              <span className="spin dark" /> <div style={{ marginTop: 8 }}>מסיר את הרקע… (בפעם הראשונה זה לוקח רגע)</div>
            </div>
          ) : mode === 'own' && ownUrl ? (
            <img src={ownUrl} alt="" />
          ) : mode === 'model' && modelUrl && !modelBroken ? (
            <img src={modelUrl} alt="" onError={() => setModelBroken(true)} />
          ) : (
            <CarArt color={color} />
          )}
        </div>
        <div className="pick">
          <button className={mode === 'model' ? 'on' : ''} onClick={() => setMode('model')}>
            תמונת דגם
          </button>
          <label className={mode === 'own' ? 'on' : ''}>
            📷 צילום שלי
            <input type="file" accept="image/*" onChange={e => onOwnPhoto(e.target.files?.[0])} />
          </label>
          <button className={mode === 'none' ? 'on' : ''} onClick={() => setMode('none')}>
            איור בלבד
          </button>
        </div>
        {mode === 'model' && !modelUrl && (
          <div className="hint" style={{ marginTop: 6 }}>
            {hasModelImages() ? 'לא נמצאה תמונת דגם. מוצג איור בצבע הרכב.' : 'תמונות דגם דורשות מפתח imagin.studio. בינתיים מוצג איור בצבע הרכב.'}
          </div>
        )}

        <label className="lbl">שם לרכב</label>
        <input className="in" value={name} onChange={e => setName(e.target.value)} placeholder="למשל: המאזדה של אבא" />
        {!editing && (
          <>
            <label className="lbl">כמה ק״מ יש לרכב היום?</label>
            <input className="in" inputMode="numeric" value={kmNow} onChange={e => setKmNow(e.target.value.replace(/\D/g, ''))} placeholder="48,230" />
          </>
        )}
        {err && <div className="err">{err}</div>}
        <button className="btn pri" style={{ marginTop: 16 }} disabled={busy || cutting} onClick={save}>
          {busy ? <span className="spin" /> : editing ? 'שמירה' : 'הוספת רכב'}
        </button>
      </div>
    </Sheet>
  )
}
