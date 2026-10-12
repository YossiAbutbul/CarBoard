import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { userMessage } from '../lib/errors'
import type { Car, Data, Item, Table } from '../types'

type Row = { id: string } & Record<string, unknown>
import { emptyData, type Family, type Store } from './store'
import { makeActions, type Actions } from './actions'
import { estimateKm, type KmEstimate } from '../domain/odometer'
import { buildReminders, needsAttention, type Reminder } from '../domain/reminders'
import { setBadge } from '../lib/badge'
import { defaultItems } from '../domain/defaults'
import { tracked } from '../lib/activity'
import { getLocalOrder, loadCloudOrder, saveCloudOrder, sortCars, storeLocalOrder } from '../lib/carOrder'

interface Ctx {
  store: Store
  data: Data
  loading: boolean
  error: string | null
  setCarId(id: string): void
  setCarOrder(ids: string[]): void // this person's order of the cars; the first opens at start
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
    const km = estimateKm(d.readings.filter(r => r.car_id === car.id), undefined, car.yearly_km).value
    for (const it of defaultItems(car.id, km, null))
      if (!have.has(it.kind) && REQUIRED.includes(it.kind)) {
        await store.insert('items', it)
        added++
      }
  }
  return added
}
const CAR_KEY = 'car-records:car'

export function AppDataProvider({ store: raw, children }: { store: Store; children: ReactNode }) {
  const [data, setData] = useState<Data>(emptyData)
  const dataRef = useRef(data)
  // Every request counts for the activity bar (family requests too). Everything is read once; after
  // that each save, change or delete is also applied to the copy in memory, so the screen updates
  // without reading everything again (a full read costs ~5 requests per family member).
  const store = useMemo(() => {
    const s = tracked({ ...raw, family: raw.family && tracked(raw.family) } as Store)
    const apply = (t: Table, f: (rows: Row[]) => Row[]) => {
      dataRef.current = { ...dataRef.current, [t]: f(dataRef.current[t] as unknown as Row[]) }
    }
    return {
      ...s,
      family: s.family,
      loadAll: () => s.loadAll(),
      async insert(t, r) {
        await s.insert(t, r)
        // a car I add is mine (shown in the family's list as such; never stored)
        const row = t === 'cars' && raw.userId ? { ...(r as unknown as Row), owner: raw.userId } : (r as unknown as Row)
        apply(t, rows => [...rows.filter(x => x.id !== row.id), row])
      },
      async update(t, id, patch) {
        await s.update(t, id, patch)
        apply(t, rows => rows.map(x => (x.id === id ? { ...x, ...(patch as object) } : x)))
      },
      async remove(t, id) {
        await s.remove(t, id)
        apply(t, rows => rows.filter(x => x.id !== id))
      },
    } as Store
  }, [raw])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  // The car picked during this visit (kept over a reload); a new start opens the first car in the order.
  const [carId, setCarIdState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(CAR_KEY)
    } catch {
      return null
    }
  })
  const [order, setOrder] = useState<string[]>(getLocalOrder)
  const lastFull = useRef(0)

  /** Read everything again: at start, after joining or leaving a family, and on return after a while. */
  const reload = useCallback(async () => {
    try {
      lastFull.current = Date.now()
      let d = await store.loadAll()
      // A car missing a required reminder (made before it existed, or deleted earlier) gets it back.
      const added = await addMissingDefaults(store, d)
      if (added) d = await store.loadAll()
      dataRef.current = d
      setData(d)
      setFamily(store.family?.current() ?? null)
      // the order saved to the account wins over this device's copy
      if (store.mode === 'cloud' && store.userId) {
        const saved = await loadCloudOrder(store.userId)
        if (saved) {
          setOrder(saved)
          storeLocalOrder(saved)
        }
      }
      setError(null)
    } catch (e) {
      setError(userMessage(e))
    } finally {
      setLoading(false)
    }
  }, [store])

  /** After a change: show the copy in memory, which the store has already updated. No requests. */
  const refresh = useCallback(async () => {
    setData(dataRef.current)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  // Family members change things too: back in the app after 5 minutes away, read everything again.
  useEffect(() => {
    if (store.mode !== 'cloud') return
    const onShow = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFull.current > 5 * 60 * 1000) reload()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [store, reload])

  const setCarId = useCallback((id: string) => {
    setCarIdState(id)
    try {
      sessionStorage.setItem(CAR_KEY, id)
    } catch {
      // storage blocked: the choice lasts until the page reloads
    }
  }, [])

  const setCarOrder = useCallback(
    (ids: string[]) => {
      setOrder(ids)
      storeLocalOrder(ids)
      if (store.mode === 'cloud' && store.userId) saveCloudOrder(store.userId, ids).catch(e => console.error('saving the car order failed', e))
    },
    [store],
  )
  const sorted = useMemo(() => ({ ...data, cars: sortCars(data.cars, order) }), [data, order])

  const actions = useMemo(() => makeActions(store, () => dataRef.current, refresh), [store, refresh])

  const car = sorted.cars.find(c => c.id === carId) ?? sorted.cars[0] ?? null
  const km = useMemo(() => estimateKm(data.readings.filter(r => r.car_id === car?.id), undefined, car?.yearly_km), [data.readings, car?.id, car?.yearly_km])
  const reminders = useMemo(
    () => buildReminders(data.items.filter(i => i.car_id === car?.id), km),
    [data.items, car?.id, km],
  )

  useEffect(() => {
    setBadge(needsAttention(reminders))
  }, [reminders])

  return (
    <C.Provider value={{ store, data: sorted, loading, error, setCarId, setCarOrder, actions, car, km, reminders, family, reload }}>{children}</C.Provider>
  )
}

export function useApp() {
  const v = useContext(C)
  if (!v) throw new Error('useApp outside provider')
  return v
}
