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
