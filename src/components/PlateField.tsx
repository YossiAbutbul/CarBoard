import { useEffect, useRef, useState } from 'react'
import { lookupPlate, plateDigits, typingPlate, type PlateInfo } from '../lib/govil'

/**
 * The plate as typed, looked up at the Ministry of Transport once typing stops (a reply for an older
 * number is ignored). Used by the car form and by the first-run car step.
 */
export function usePlateLookup(initial: string, opts: { skip?: (digits: string) => boolean; onFound?: (info: PlateInfo) => void } = {}) {
  const [plate, setPlate] = useState(initial)
  const [info, setInfo] = useState<PlateInfo | null>(null)
  const [looking, setLooking] = useState(false)
  const [lookErr, setLookErr] = useState<string | null>(null)
  const asked = useRef(0)
  const digits = plateDigits(plate)
  useEffect(() => {
    if (opts.skip?.(digits)) return
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
          opts.onFound?.(r)
        }
      } catch {
        if (n === asked.current) setLookErr('אין חיבור למשרד התחבורה כרגע. אפשר להמשיך ידנית.')
      } finally {
        if (n === asked.current) setLooking(false)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [digits]) // eslint-disable-line react-hooks/exhaustive-deps

  /** For the input's onChange: keeps the dashes in place, and a new number clears the old lookup. */
  const type = (e: React.ChangeEvent<HTMLInputElement>) => {
    // backspace on a dash takes the digit before it (else the dash just comes back)
    const v = e.target.value
    const onlyDash = v.length < plate.length && plateDigits(v) === plateDigits(plate)
    const at = e.target.selectionStart ?? v.length
    setPlate(typingPlate(onlyDash ? v.slice(0, Math.max(0, at - 1)) + v.slice(at) : v))
    if (plateDigits(v) !== plateDigits(plate)) setInfo(null)
  }
  return { plate, setPlate, info, looking, lookErr, digits, type }
}

/** An Israeli plate to type the number into: the blue band on the left, yellow behind the digits. */
export function PlateInput({ value, onChange, autoFocus }: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; autoFocus?: boolean }) {
  return (
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
      <input className="num" inputMode="numeric" placeholder="12-345-67" value={value} onChange={onChange} autoFocus={autoFocus} aria-label="מספר רכב" />
    </label>
  )
}
