import type { Reading } from '../types'
import { diffDays, todayIso } from '../lib/dates'

export const DEFAULT_KM_PER_DAY = 40 // a normal Israeli average

/** About how far a car goes in a year, as the owner picks it; the middle of each range is what is kept. */
export const YEARLY_CHOICES: [string, number][] = [
  ['עד 10,000', 8000],
  ['10–15 אלף', 12500],
  ['15–20 אלף', 17500],
  ['20–30 אלף', 25000],
  ['מעל 30 אלף', 35000],
]

export interface KmEstimate {
  value: number
  perDay: number
  learned: boolean // perDay comes from the user's own readings
  basis: 'learned' | 'yearly' | 'average' // where perDay came from: readings, the owner's yearly km, or the national average
  checkedDaysAgo: number | null
  last: Reading | null
}

export const sortReadings = (rs: Reading[]) =>
  [...rs].sort((a, b) => (a.date === b.date ? a.km - b.km : a.date < b.date ? -1 : 1))

/** Average km per day over the last 90 days of readings (or the last two). */
export function kmPerDay(rs: Reading[]): number | null {
  const sorted = sortReadings(rs)
  if (sorted.length < 2) return null
  const last = sorted[sorted.length - 1]
  let window = sorted.filter(r => diffDays(last.date, r.date) <= 90)
  if (window.length < 2) window = sorted.slice(-2)
  const first = window[0]
  const days = diffDays(last.date, first.date)
  if (days < 3) return null
  return Math.max(0, (last.km - first.km) / days)
}

/**
 * Today's km, from the last reading and a pace: the owner's own readings once there are enough, before
 * that the yearly km they told us (if any), and failing both the national average.
 */
export function estimateKm(rs: Reading[], today = todayIso(), yearlyKm?: number | null): KmEstimate {
  const sorted = sortReadings(rs)
  const last = sorted[sorted.length - 1] ?? null
  const told = yearlyKm && yearlyKm > 0 ? yearlyKm / 365 : null
  const fallback = told ?? DEFAULT_KM_PER_DAY
  const fallbackBasis = told ? 'yearly' : 'average'
  if (!last) return { value: 0, perDay: fallback, learned: false, basis: fallbackBasis, checkedDaysAgo: null, last: null }
  const learnedRate = kmPerDay(sorted)
  const perDay = learnedRate ?? fallback
  const days = Math.max(0, diffDays(today, last.date))
  return {
    value: Math.round(last.km + perDay * days),
    perDay,
    learned: learnedRate !== null,
    basis: learnedRate !== null ? 'learned' : fallbackBasis,
    checkedDaysAgo: days,
    last,
  }
}

export function readingError(rs: Reading[], km: number): string | null {
  if (!Number.isFinite(km) || km < 0) return 'מספר ק״מ לא תקין'
  if (km > 2_000_000) return 'מספר ק״מ גבוה מדי'
  const last = sortReadings(rs).at(-1)
  if (last && km < last.km) return `הק״מ נמוך מהקריאה הקודמת (${last.km.toLocaleString('he-IL')})`
  return null
}
