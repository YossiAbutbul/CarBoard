import type { Fuel } from '../types'

/*
 * Fuel numbers. Economy is measured the reliable way: between two full tanks, all the fuel put in
 * after the first (up to and including the second) was burnt over the km between them.
 * Shown as km per liter, the way it is usually said in Israel.
 */

/** Oldest first; same day by km. */
export const byDate = (a: Fuel, b: Fuel) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.km ?? 0) - (b.km ?? 0))

/**
 * A fill-up already logged as this one: same car and day, and the same time when both have one
 * (a receipt's); without a time, the same liters and total.
 */
export function findDuplicateFuel(all: Fuel[], f: Fuel) {
  return (
    all.find(x => {
      if (x.id === f.id || x.car_id !== f.car_id || x.date !== f.date) return false
      if (x.time && f.time) return x.time === f.time
      return (f.liters != null || f.price != null) && x.liters === f.liters && x.price === f.price
    }) ?? null
  )
}

export const perLiter = (f: Fuel) => (f.price != null && f.liters ? f.price / f.liters : null)

export interface Economy {
  id: string // the full tank that closes the stretch
  date: string
  km: number // driven over the stretch
  liters: number
  kmPerLiter: number
}

/** km per liter for every stretch between two full tanks that has the km and liters it needs. */
export function economy(fills: Fuel[]): Economy[] {
  const list = [...fills].sort(byDate)
  const out: Economy[] = []
  let from: Fuel | null = null // the last full tank with km
  let liters = 0
  let known = true // every fill since `from` has its liters
  for (const f of list) {
    if (from) {
      if (f.liters == null) known = false
      else liters += f.liters
    }
    if (f.full && f.km != null) {
      if (from && known && from.km != null && f.km > from.km && liters > 0)
        out.push({ id: f.id, date: f.date, km: f.km - from.km, liters, kmPerLiter: (f.km - from.km) / liters })
      from = f
      liters = 0
      known = true
    }
  }
  return out
}

/** km per liter over all measured stretches together. */
export function averageEconomy(fills: Fuel[]) {
  const e = economy(fills)
  const km = e.reduce((n, x) => n + x.km, 0)
  const l = e.reduce((n, x) => n + x.liters, 0)
  return l ? km / l : null
}

/** The economy of the stretch this full tank closes, if it has one. */
export const economyOf = (fills: Fuel[], id: string) => economy(fills).find(e => e.id === id) ?? null

/*
 * The period the fuel page shows: a month, half a year, a year, or every year, and how far back
 * (offset 0 is the current one, -1 the one before). Each period is cut into buckets for the chart:
 * a month into its fill-ups, half a year and a year into months, "all" into years.
 */
export type FuelRange = 'm1' | 'm6' | 'y1' | 'all'
export interface Bucket {
  key: string // YYYY-MM-DD (one fill-up), YYYY-MM or YYYY
  from: string // first day, inclusive
  to: string // day after the last, exclusive
}
export interface Period {
  from: string
  to: string
  buckets: Bucket[] // for 'm1', filled in by the caller from the fill-ups
  first: { y: number; m: number } // the period's first month (m: 0-11)
  last: { y: number; m: number }
}

const ymd = (y: number, m: number, d = 1) => {
  const t = new Date(y, m, d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const ym = (y: number, m: number) => ymd(y, m).slice(0, 7)

export function fuelPeriod(range: FuelRange, offset: number, fills: Fuel[], today = new Date()): Period {
  const Y = today.getFullYear()
  const M = today.getMonth()
  const months = (y: number, m0: number, n: number): Bucket[] =>
    Array.from({ length: n }, (_, i) => ({ key: ym(y, m0 + i), from: ymd(y, m0 + i), to: ymd(y, m0 + i + 1) }))
  if (range === 'm1') {
    const s = new Date(Y, M + offset, 1)
    return { from: ymd(s.getFullYear(), s.getMonth()), to: ymd(s.getFullYear(), s.getMonth() + 1), buckets: [], first: { y: s.getFullYear(), m: s.getMonth() }, last: { y: s.getFullYear(), m: s.getMonth() } }
  }
  if (range === 'm6') {
    const e = new Date(Y, M + offset * 6, 1)
    const s = new Date(e.getFullYear(), e.getMonth() - 5, 1)
    return { from: ymd(s.getFullYear(), s.getMonth()), to: ymd(e.getFullYear(), e.getMonth() + 1), buckets: months(s.getFullYear(), s.getMonth(), 6), first: { y: s.getFullYear(), m: s.getMonth() }, last: { y: e.getFullYear(), m: e.getMonth() } }
  }
  if (range === 'y1') {
    const y = Y + offset
    return { from: ymd(y, 0), to: ymd(y + 1, 0), buckets: months(y, 0, 12), first: { y, m: 0 }, last: { y, m: 11 } }
  }
  const firstYear = Math.min(Y, ...fills.map(f => Number(f.date.slice(0, 4))))
  const buckets = Array.from({ length: Y - firstYear + 1 }, (_, i) => ({ key: String(firstYear + i), from: ymd(firstYear + i, 0), to: ymd(firstYear + i + 1, 0) }))
  return { from: ymd(firstYear, 0), to: ymd(Y + 1, 0), buckets, first: { y: firstYear, m: 0 }, last: { y: Y, m: 11 } }
}

export const inRange = (f: Fuel, from: string, to: string) => f.date >= from && f.date < to

/** ₪ spent, and the price per liter (total ÷ liters), over some fill-ups. */
export function totals(fills: Fuel[]) {
  const spent = fills.reduce((n, f) => n + (f.price ?? 0), 0)
  const priced = fills.filter(f => f.price != null && f.liters)
  const liters = priced.reduce((n, f) => n + f.liters!, 0)
  return { spent, count: fills.length, perLiter: liters ? priced.reduce((n, f) => n + f.price!, 0) / liters : null }
}

/** The average price per liter in each of the last `months` months (total ₪ ÷ total liters), oldest first; null for a month with no data. */
export function monthlyPerLiter(fills: Fuel[], months = 12, today = new Date()) {
  return monthlySpend(fills, months, today).map(({ month }) => {
    const these = fills.filter(f => f.date.startsWith(month) && f.price != null && f.liters)
    const liters = these.reduce((n, f) => n + f.liters!, 0)
    return { month, avg: liters ? these.reduce((n, f) => n + f.price!, 0) / liters : null }
  })
}

/** ₪ spent in each of the last `months` months (oldest first), including months with nothing. */
export function monthlySpend(fills: Fuel[], months = 6, today = new Date()) {
  const out: { month: string; total: number; count: number }[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const these = fills.filter(f => f.date.startsWith(month))
    out.push({ month, total: these.reduce((n, f) => n + (f.price ?? 0), 0), count: these.length })
  }
  return out
}
