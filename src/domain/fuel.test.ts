import { describe, expect, it } from 'vitest'
import type { Fuel } from '../types'
import { averageEconomy, economy, findDuplicateFuel, fuelPeriod, monthlyPerLiter, monthlySpend, perLiter, totals } from './fuel'

const f = (id: string, date: string, km: number | null, liters: number | null, full = true, price: number | null = null): Fuel => ({
  id,
  car_id: 'c',
  date,
  km,
  liters,
  price,
  station: null,
  full,
})

describe('fuel', () => {
  it('measures km per liter between full tanks', () => {
    const e = economy([f('a', '2026-09-01', 10000, 40), f('b', '2026-09-15', 10600, 40)])
    expect(e).toHaveLength(1)
    expect(e[0]).toMatchObject({ id: 'b', km: 600, liters: 40, kmPerLiter: 15 })
  })

  it('adds the partial fills in between to the next full tank', () => {
    const e = economy([f('a', '2026-09-01', 10000, 40), f('p', '2026-09-08', 10300, 10, false), f('b', '2026-09-15', 10700, 30)])
    expect(e[0]).toMatchObject({ km: 700, liters: 40, kmPerLiter: 17.5 })
  })

  it('skips a stretch with a fill of unknown liters, and starts again from the next full tank', () => {
    const e = economy([f('a', '2026-09-01', 10000, 40), f('p', '2026-09-08', null, null, false), f('b', '2026-09-15', 10700, 30), f('c', '2026-09-30', 11300, 40)])
    expect(e.map(x => x.id)).toEqual(['c'])
    expect(e[0].kmPerLiter).toBe(15)
  })

  it('averages over all stretches by total km and liters', () => {
    expect(averageEconomy([f('a', '2026-09-01', 0, 10), f('b', '2026-09-02', 100, 10), f('c', '2026-09-03', 400, 10)])).toBe(20)
    expect(averageEconomy([f('a', '2026-09-01', 0, 10)])).toBeNull()
  })

  it('knows the same fill-up: same day and time, or without a time the same liters and total', () => {
    const a = { ...f('a', '2026-09-16', null, 30.849, true, 239.08), time: '09:19' }
    expect(findDuplicateFuel([a], { ...a, id: 'b' })).toBe(a)
    expect(findDuplicateFuel([a], { ...a, id: 'b', time: '18:02' })).toBeNull() // two fills that day
    expect(findDuplicateFuel([a], { ...a, id: 'b', time: null })).toBe(a) // same numbers, typed by hand
    expect(findDuplicateFuel([a], { ...a, id: 'b', time: null, price: 200 })).toBeNull()
    expect(findDuplicateFuel([a], { ...a, id: 'b', date: '2026-09-17' })).toBeNull()
  })

  it('cuts periods: a month, half a year, a year and every year, and steps back', () => {
    const today = new Date(2026, 9, 9) // 9 Oct 2026
    expect(fuelPeriod('m1', 0, [], today)).toMatchObject({ from: '2026-10-01', to: '2026-11-01' })
    expect(fuelPeriod('m1', -10, [], today)).toMatchObject({ from: '2025-12-01', to: '2026-01-01' })
    const h = fuelPeriod('m6', 0, [], today)
    expect([h.from, h.to, h.buckets.length, h.buckets[0].key]).toEqual(['2026-05-01', '2026-11-01', 6, '2026-05'])
    expect(fuelPeriod('m6', -1, [], today)).toMatchObject({ from: '2025-11-01', to: '2026-05-01' })
    expect(fuelPeriod('y1', -1, [], today)).toMatchObject({ from: '2025-01-01', to: '2026-01-01' })
    const all = fuelPeriod('all', 0, [f('a', '2024-03-02', null, 10)], today)
    expect(all.buckets.map(b => b.key)).toEqual(['2024', '2025', '2026'])
    expect(totals([f('a', '2026-01-01', null, 10, true, 70), f('b', '2026-01-02', null, null, true, 50)])).toEqual({ spent: 120, count: 2, perLiter: 7 })
  })

  it('averages the price per liter by month, weighted by liters', () => {
    const m = monthlyPerLiter([f('a', '2026-10-01', null, 10, true, 70), f('b', '2026-10-20', null, 30, true, 225), f('c', '2026-08-03', null, 20, true, 140)], 3, new Date(2026, 9, 8))
    expect(m).toEqual([
      { month: '2026-08', avg: 7 },
      { month: '2026-09', avg: null },
      { month: '2026-10', avg: 7.375 },
    ])
  })

  it('price per liter, and monthly totals including empty months', () => {
    expect(perLiter(f('a', '2026-09-01', null, 40, true, 280))).toBe(7)
    expect(perLiter(f('a', '2026-09-01', null, null, true, 280))).toBeNull()
    const m = monthlySpend([f('a', '2026-10-02', null, null, true, 300), f('b', '2026-08-20', null, null, true, 250)], 3, new Date(2026, 9, 8))
    expect(m).toEqual([
      { month: '2026-08', total: 250, count: 1 },
      { month: '2026-09', total: 0, count: 0 },
      { month: '2026-10', total: 300, count: 1 },
    ])
  })
})
