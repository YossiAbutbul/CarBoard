import { describe, expect, it } from 'vitest'
import { estimateValue } from './value'

const today = new Date('2026-10-17')

describe('car value estimate', () => {
  it('a new car keeps most of its price; an old one little of it', () => {
    const fresh = estimateValue({ newPrice: 150_000, year: 2026, km: 5_000, hands: 1, fleet: false, today })
    expect(fresh.value).toBeGreaterThan(135_000)
    const old = estimateValue({ newPrice: 114_990, year: 2011, km: null, hands: 0, fleet: false, today })
    expect(old.value).toBeGreaterThan(9_000)
    expect(old.value).toBeLessThan(30_000)
  })

  it('more km, more owners and a leasing past each take something off', () => {
    const base = { newPrice: 141_900, year: 2021, km: 80_000, hands: 1, fleet: false, today }
    const plain = estimateValue(base).value
    expect(estimateValue({ ...base, km: 140_000 }).value).toBeLessThan(plain)
    expect(estimateValue({ ...base, hands: 3 }).value).toBeLessThan(plain)
    expect(estimateValue({ ...base, fleet: true }).value).toBeLessThan(plain)
    expect(estimateValue({ ...base, km: 30_000 }).value).toBeGreaterThan(plain)
  })

  it('gives a range around the value, rounded to ₪500', () => {
    const e = estimateValue({ newPrice: 141_900, year: 2021, km: 92_502, hands: 3, fleet: true, today })
    expect(e.low).toBeLessThan(e.value)
    expect(e.high).toBeGreaterThan(e.value)
    for (const n of [e.value, e.low, e.high]) expect(n % 500).toBe(0)
  })
})
