import type { Car, CarDocument, Data, Item, Reading, ReadingSource, ServiceRecord } from '../types'
import type { Store } from './store'
import { defaultItems } from '../domain/defaults'
import { readingError } from '../domain/odometer'
import { addMonths, todayIso } from '../lib/dates'
import { uid } from '../lib/uid'

export function makeActions(store: Store, getData: () => Data, refresh: () => Promise<void>) {
  const readingsOf = (carId: string) => getData().readings.filter(r => r.car_id === carId)

  async function insertReading(carId: string, km: number, source: ReadingSource, date = todayIso()) {
    const err = readingError(readingsOf(carId).filter(r => r.date <= date), km)
    if (err) throw new Error(err)
    const r: Reading = { id: uid(), car_id: carId, km: Math.round(km), date, source }
    await store.insert('readings', r)
  }

  return {
    async addCar(car: Omit<Car, 'id'>, km: number, licenceUntil: string | null) {
      const c: Car = { ...car, id: uid() }
      await store.insert('cars', c)
      await store.insert('readings', { id: uid(), car_id: c.id, km, date: todayIso(), source: 'start' })
      for (const it of defaultItems(c.id, km, licenceUntil)) await store.insert('items', it)
      await refresh()
      return c.id
    },
    async updateCar(id: string, patch: Partial<Car>) {
      await store.update('cars', id, patch)
      await refresh()
    },
    async deleteCar(id: string) {
      const d = getData()
      for (const t of ['readings', 'items', 'services', 'documents'] as const)
        for (const r of d[t].filter(x => x.car_id === id)) await store.remove(t, r.id)
      await store.remove('cars', id)
      await refresh()
    },
    async addReading(carId: string, km: number, source: ReadingSource) {
      await insertReading(carId, km, source)
      await refresh()
    },
    /** Saves the record, a km reading, and moves the next due point of the same kind. */
    async saveService(rec: Omit<ServiceRecord, 'id'>) {
      await store.insert('services', { ...rec, id: uid() })
      const later = readingsOf(rec.car_id).some(r => r.date > rec.date)
      if (!later) {
        try {
          await insertReading(rec.car_id, rec.km, 'service', rec.date)
        } catch {
          // lower than the last reading: keep the record, skip the reading
        }
      }
      const item = getData().items.find(i => i.car_id === rec.car_id && i.kind === rec.type)
      if (item)
        await store.update('items', item.id, {
          due_km: item.every_km ? rec.km + item.every_km : item.due_km,
          due_date: item.every_months ? addMonths(rec.date, item.every_months) : item.due_date,
        })
      await refresh()
    },
    async updateService(id: string, patch: Partial<ServiceRecord>) {
      await store.update('services', id, patch)
      await refresh()
    },
    async deleteService(id: string) {
      await store.remove('services', id)
      await refresh()
    },
    async saveItem(item: Item) {
      const exists = getData().items.some(i => i.id === item.id)
      if (exists) await store.update('items', item.id, item)
      else await store.insert('items', item)
      await refresh()
    },
    async deleteItem(id: string) {
      await store.remove('items', id)
      await refresh()
    },
    /** A licence or insurance expiry also sets the matching reminder. */
    async saveDocument(doc: CarDocument) {
      const exists = getData().documents.some(d => d.id === doc.id)
      if (exists) await store.update('documents', doc.id, doc)
      else await store.insert('documents', doc)
      const kind = doc.kind === 'licence' ? 'test' : doc.kind === 'insurance' ? 'insurance' : null
      const item = kind ? getData().items.find(i => i.car_id === doc.car_id && i.kind === kind) : undefined
      if (item && doc.expiry) await store.update('items', item.id, { due_date: doc.expiry })
      await refresh()
    },
    async deleteDocument(id: string) {
      await store.remove('documents', id)
      await refresh()
    },
    upload: (name: string, blob: Blob) => store.upload(name, blob),
    fileUrl: (ref: string) => store.fileUrl(ref),
  }
}

export type Actions = ReturnType<typeof makeActions>
