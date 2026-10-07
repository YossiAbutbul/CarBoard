import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Car, Data } from '../types'
import { emptyData, type Store } from './store'
import { makeActions, type Actions } from './actions'
import { estimateKm, type KmEstimate } from '../domain/odometer'
import { buildReminders, needsAttention, type Reminder } from '../domain/reminders'
import { setBadge } from '../lib/badge'

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
}

const C = createContext<Ctx | null>(null)
const CAR_KEY = 'car-records:car'

export function AppDataProvider({ store, children }: { store: Store; children: ReactNode }) {
  const [data, setData] = useState<Data>(emptyData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
      const d = await store.loadAll()
      dataRef.current = d
      setData(d)
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
    <C.Provider value={{ store, data, loading, error, setCarId, actions, car, km, reminders }}>{children}</C.Provider>
  )
}

export function useApp() {
  const v = useContext(C)
  if (!v) throw new Error('useApp outside provider')
  return v
}
