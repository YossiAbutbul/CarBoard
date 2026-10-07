import type { Reading } from '../types'
import { diffDays, todayIso } from '../lib/dates'

export const DEFAULT_KM_PER_DAY = 40 // a normal Israeli average

export interface KmEstimate {
  value: number
  perDay: number
  learned: boolean // perDay comes from the user's own readings
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

export function estimateKm(rs: Reading[], today = todayIso()): KmEstimate {
  const sorted = sortReadings(rs)
  const last = sorted[sorted.length - 1] ?? null
  if (!last) return { value: 0, perDay: DEFAULT_KM_PER_DAY, learned: false, checkedDaysAgo: null, last: null }
  const learnedRate = kmPerDay(sorted)
  const perDay = learnedRate ?? DEFAULT_KM_PER_DAY
  const days = Math.max(0, diffDays(today, last.date))
  return {
    value: Math.round(last.km + perDay * days),
    perDay,
    learned: learnedRate !== null,
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
