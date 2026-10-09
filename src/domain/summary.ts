import type { Data, Item, ServiceRecord } from '../types'
import { estimateKm } from './odometer'
import { dueInfo } from './due'
import { totals } from './fuel'
import { addDays } from '../lib/dates'

/*
 * A car's month in numbers, for the summary that opens at the start of each month: what it cost
 * (fuel and services), how far it went, against the month before, and what is due next.
 */

export interface MonthSummary {
  month: string // YYYY-MM
  km: number | null // driven that month (null: no readings to tell)
  fuel: { spent: number; liters: number; count: number; perLiter: number | null }
  services: ServiceRecord[]
  servicesSpent: number
  total: number // fuel + services
  prevTotal: number // the month before, for the comparison
  upcoming: { item: Item; days: number }[] // due within 30 days of the month's end
  empty: boolean // nothing logged that month
}

/** "2026-09" → the month before, "2026-08". */
export const prevMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const nextMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function spentIn(data: Data, carId: string, month: string) {
  const fuel = totals(data.fuel.filter(f => f.car_id === carId && f.date.startsWith(month)))
  const services = data.services.filter(s => s.car_id === carId && s.date.startsWith(month))
  return { fuel, services, servicesSpent: services.reduce((n, s) => n + (s.price ?? 0), 0) }
}

export function monthSummary(data: Data, carId: string, month: string): MonthSummary {
  const start = `${month}-01`
  const end = addDays(`${nextMonth(month)}-01`, -1) // the month's last day
  const readings = data.readings.filter(r => r.car_id === carId)
  // km at each end of the month, from what was known by then
  const before = readings.filter(r => r.date <= start)
  const by = readings.filter(r => r.date <= end)
  const km = before.length && by.length ? Math.max(0, Math.round(estimateKm(by, end).value - estimateKm(before, start).value)) : null

  const now = spentIn(data, carId, month)
  const prev = spentIn(data, carId, prevMonth(month))
  const liters = data.fuel.filter(f => f.car_id === carId && f.date.startsWith(month)).reduce((n, f) => n + (f.liters ?? 0), 0)
  const kmNow = estimateKm(readings)
  const upcoming = data.items
    .filter(i => i.car_id === carId)
    .map(item => ({ item, days: dueInfo(item, kmNow).days }))
    .filter((u): u is { item: Item; days: number } => u.days != null && u.days <= 30)
    .sort((a, b) => a.days - b.days)

  const total = now.fuel.spent + now.servicesSpent
  return {
    month,
    km,
    fuel: { spent: now.fuel.spent, liters, count: now.fuel.count, perLiter: now.fuel.perLiter },
    services: now.services.sort((a, b) => (a.date < b.date ? -1 : 1)),
    servicesSpent: now.servicesSpent,
    total,
    prevTotal: prev.fuel.spent + prev.servicesSpent,
    upcoming,
    empty: now.fuel.count === 0 && now.services.length === 0 && !km,
  }
}
