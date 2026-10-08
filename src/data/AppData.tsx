import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Car, Data, Item } from '../types'
import { emptyData, type Family, type Store } from './store'
import { makeActions, type Actions } from './actions'
import { estimateKm, type KmEstimate } from '../domain/odometer'
import { buildReminders, needsAttention, type Reminder } from '../domain/reminders'
import { setBadge } from '../lib/badge'
import { defaultItems } from '../domain/defaults'

interface Ctx {
  store: Store
  data: Data
  loading: boolean
  error: string | null
  setCarId(id: string): void
  actions: Actions
  car: Car | null
  km: KmEstimate
  reminders: Reminder[]
  family: Family | null // cloud only: the family this user shares cars with
  reload(): Promise<void>
}

const C = createContext<Ctx | null>(null)

/** Reminders every car always has: the home header shows service and test, and oil was added later. */
// shown in the top row of the home screen, so they cannot be deleted
export const REQUIRED: Item['kind'][] = ['test', 'insurance']

let backfill: Promise<number> | null = null
/** One run at a time, so two quick refreshes cannot add the same reminder twice. */
function addMissingDefaults(store: Store, d: Data) {
  backfill ??= addMissing(store, d).finally(() => (backfill = null))
  return backfill
}

async function addMissing(store: Store, d: Data) {
  let added = 0
  for (const car of d.cars) {
    const have = new Set(d.items.filter(i => i.car_id === car.id).map(i => i.kind))
    const km = estimateKm(d.readings.filter(r => r.car_id === car.id)).value
    for (const it of defaultItems(car.id, km, null))
      if (!have.has(it.kind) && REQUIRED.includes(it.kind)) {
        await store.insert('items', it)
        added++
      }
  }
  return added
}
const CAR_KEY = 'car-records:car'

export function AppDataProvider({ store, children }: { store: Store; children: ReactNode }) {
  const [data, setData] = useState<Data>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [carId, setCarIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(CAR_KEY)
    } catch {
      return null
    }
  })
  const dataRef = useRef(data)

  const refresh = useCallback(async () => {
    try {
      let d = await store.loadAll()
      // A car missing a required reminder (made before it existed, or deleted earlier) gets it back.
      const added = await addMissingDefaults(store, d)
      if (added) d = await store.loadAll()
      dataRef.current = d
      setData(d)
      setFamily(store.family?.current() ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [store])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setCarId = useCallback((id: string) => {
    setCarIdState(id)
    try {
      localStorage.setItem(CAR_KEY, id)
    } catch {
      // storage blocked: the choice lasts for this visit only
    }
  }, [])

  const actions = useMemo(() => makeActions(store, () => dataRef.current, refresh), [store, refresh])

  const car = data.cars.find(c => c.id === carId) ?? data.cars[0] ?? null
  const km = useMemo(() => estimateKm(data.readings.filter(r => r.car_id === car?.id)), [data.readings, car?.id])
  const reminders = useMemo(
    () => buildReminders(data.items.filter(i => i.car_id === car?.id), km),
    [data.items, car?.id, km],
  )

  useEffect(() => {
    setBadge(needsAttention(reminders))
  }, [reminders])

  return (
    <C.Provider value={{ store, data, loading, error, setCarId, actions, car, km, reminders, family, reload: refresh }}>{children}</C.Provider>
  )
}

export function useApp() {
  const v = useContext(C)
  if (!v) throw new Error('useApp outside provider')
  return v
}
