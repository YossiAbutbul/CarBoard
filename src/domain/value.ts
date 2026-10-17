/*
 * A rough worth for a used car, from what the public data gives: its official list price when new
 * (the importer's), its age, its km against what is usual, how many owners it had, and whether it
 * started as a leasing or rental car. Not a price list: a ballpark, shown as a range.
 */

export interface ValueInput {
  newPrice: number // ₪, the list price when new
  year: number // model year
  km: number | null // the odometer now (or at the last test)
  hands: number // owners so far (dealers not counted); 0 when not known
  fleet: boolean // started as leasing or rental
  today?: Date
}

export interface ValueEstimate {
  value: number // ₪, rounded to the nearest 500
  low: number
  high: number
  age: number // years
}

const YEARLY_KM = 15_000 // what an Israeli private car goes in a year, about
const round500 = (n: number) => Math.round(n / 500) * 500

/** The car's worth now, as a middle value and a range (±12%). */
export function estimateValue({ newPrice, year, km, hands, fleet, today = new Date() }: ValueInput): ValueEstimate {
  // age in years, counting the model year as half gone at its middle
  const age = Math.max(0, today.getFullYear() + today.getMonth() / 12 - (year + 0.5))
  // depreciation: about 12% the first year, then 8% a year to 8 years old, 12% a year after that
  let left = age <= 1 ? 1 - 0.12 * age : 0.88
  if (age > 1) left *= 0.92 ** Math.min(age - 1, 7)
  if (age > 8) left *= 0.88 ** (age - 8)
  left = Math.max(left, 0.08) // an old car that runs is still worth something

  let adjust = 1
  // km: 2% for every 10,000 km off what is usual for its age, within ±15%
  if (km != null && age > 0.5) adjust *= 1 - Math.max(-0.15, Math.min(0.15, ((km - YEARLY_KM * age) / 10_000) * 0.02))
  // each owner after the first: 2%, up to 10%
  if (hands > 1) adjust *= 1 - Math.min(0.1, (hands - 1) * 0.02)
  // a past as a leasing or rental car: 5%
  if (fleet) adjust *= 0.95

  const value = newPrice * left * adjust
  return { value: round500(value), low: round500(value * 0.88), high: round500(value * 1.12), age: Math.round(age * 10) / 10 }
}
