import { describe, expect, it } from 'vitest'
import { emptyData } from '../data/store'
import { monthSummary, prevMonth } from './summary'
import type { Data } from '../types'

const data = (): Data => ({
  ...emptyData(),
  readings: [
    { id: 'r1', car_id: 'c', km: 10000, date: '2026-08-31', source: 'manual' },
    { id: 'r2', car_id: 'c', km: 11200, date: '2026-09-30', source: 'manual' },
  ],
  fuel: [
    { id: 'f1', car_id: 'c', date: '2026-09-05', liters: 40, price: 280, km: null, station: null, full: true },
    { id: 'f2', car_id: 'c', date: '2026-09-20', liters: 30, price: 225, km: null, station: null, full: true },
    { id: 'f3', car_id: 'c', date: '2026-08-10', liters: 40, price: 300, km: null, station: null, full: true },
    { id: 'x', car_id: 'other', date: '2026-09-07', liters: 50, price: 400, km: null, station: null, full: true },
  ],
  services: [{ id: 's1', car_id: 'c', type: 'oil', title: 'שמן', date: '2026-09-12', km: 10500, price: 350, garage: null, notes: null, receipt: null }],
})

describe('month summary', () => {
  it('adds up the month: fuel, services, km, against the month before', () => {
    const s = monthSummary(data(), 'c', '2026-09')
    expect(s.fuel).toEqual({ spent: 505, liters: 70, count: 2, perLiter: 505 / 70 })
    expect(s.servicesSpent).toBe(350)
    expect(s.total).toBe(855)
    expect(s.prevTotal).toBe(300)
    expect(s.km).toBeGreaterThan(1100)
    expect(s.empty).toBe(false)
  })

  it('an empty month, and the month before January', () => {
    expect(monthSummary(data(), 'c', '2026-06').empty).toBe(true)
    expect(prevMonth('2026-01')).toBe('2025-12')
  })
})
