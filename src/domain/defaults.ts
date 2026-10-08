import type { Item } from '../types'
import { addMonths, todayIso } from '../lib/dates'
import { uid } from '../lib/uid'
import { KIND } from './labels'

/** What a new car starts with; the rest of `defaultItems` are offered when adding a reminder. */
export const STARTER: Item['kind'][] = ['test', 'insurance', 'service']

/** Every kind of reminder, ready to add. Km items count from the current km. */
export function defaultItems(carId: string, km: number, licenceUntil: string | null): Item[] {
  const today = todayIso()
  const mk = (kind: Item['kind'], every_km: number | null, every_months: number | null, due_date?: string | null): Item => ({
    id: uid(),
    car_id: carId,
    kind,
    label: KIND[kind].label,
    every_km,
    every_months,
    due_km: every_km ? km + every_km : null,
    due_date: due_date !== undefined ? due_date : every_months ? addMonths(today, every_months) : null,
  })
  return [
    mk('service', 15000, 12),
    mk('oil', 10000, 12),
    mk('test', null, 12, licenceUntil),
    mk('insurance', null, 12, null),
    mk('tyres', 50000, null),
    mk('brakes', 40000, null),
    mk('battery', null, 36),
  ]
}
