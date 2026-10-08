import type { Car, CarDocument, Data, Item, Reading, ReadingSource, ServiceRecord } from '../types'
import type { Store } from './store'
import { defaultItems } from '../domain/defaults'
import { readingError } from '../domain/odometer'
import { addMonths, todayIso } from '../lib/dates'
import { uid } from '../lib/uid'

export function makeActions(store: Store, getData: () => Data, refresh: () => Promise<void>) {
  const readingsOf = (carId: string) => getData().readings.filter(r => r.car_id === carId)
  // uploaded files nothing points to any more are deleted, so they stop taking space
  const dropFiles = async (refs: (string | null | undefined)[]) => {
    for (const ref of refs) if (ref) await store.removeFile?.(ref).catch(() => {})
  }

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
      const files = [...d.documents.filter(x => x.car_id === id).flatMap(x => x.files), ...d.services.filter(x => x.car_id === id).map(x => x.receipt)]
      for (const t of ['readings', 'items', 'services', 'documents'] as const)
        for (const r of d[t].filter(x => x.car_id === id)) await store.remove(t, r.id)
      await store.remove('cars', id)
      await dropFiles(files)
      await refresh()
    },
    /** Deletes every car and everything that belongs to it. */
    async resetAll() {
      const d = getData()
      // only my own rows: a family member's cars stay theirs
      for (const t of ['readings', 'items', 'services', 'documents', 'cars'] as const)
        for (const r of d[t]) if (store.owns?.(t, r.id) !== false) await store.remove(t, r.id)
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
      const same = readingsOf(rec.car_id).some(r => r.date === rec.date && r.km === rec.km)
      if (!later && !same) {
        try {
          await insertReading(rec.car_id, rec.km, 'service', rec.date)
        } catch {
          // lower than the last reading: keep the record, skip the reading
        }
      }
      // A periodic service includes an oil change, so it moves both reminders.
      const kinds = rec.type === 'service' ? ['service', 'oil'] : [rec.type]
      for (const item of getData().items.filter(i => i.car_id === rec.car_id && kinds.includes(i.kind)))
        await store.update('items', item.id, {
          due_km: item.every_km ? rec.km + item.every_km : item.due_km,
          due_date: item.every_months ? addMonths(rec.date, item.every_months) : item.due_date,
        })
      await refresh()
    },
    /** Fix a mistyped reading. It must stay between its neighbours in time. */
    async updateReading(id: string, km: number) {
      const r = getData().readings.find(x => x.id === id)
      if (!r) return
      const others = readingsOf(r.car_id).filter(x => x.id !== id)
      const before = others.filter(x => x.date < r.date || (x.date === r.date && x.km <= r.km)).sort((a, b) => b.km - a.km)[0]
      const after = others.filter(x => x.date > r.date).sort((a, b) => a.km - b.km)[0]
      if (!Number.isFinite(km) || km < 0) throw new Error('מספר ק״מ לא תקין')
      if (before && km < before.km) throw new Error(`נמוך מהקריאה שלפניה (${before.km.toLocaleString('he-IL')})`)
      if (after && km > after.km) throw new Error(`גבוה מהקריאה שאחריה (${after.km.toLocaleString('he-IL')})`)
      await store.update('readings', id, { km: Math.round(km) })
      await refresh()
    },
    async deleteReading(id: string) {
      const r = getData().readings.find(x => x.id === id)
      if (!r) return
      if (readingsOf(r.car_id).length <= 1) throw new Error('זו הקריאה היחידה. אפשר לערוך אותה במקום למחוק.')
      await store.remove('readings', id)
      await refresh()
    },
    async updateService(id: string, patch: Partial<ServiceRecord>) {
      const before = getData().services.find(s => s.id === id)
      await store.update('services', id, patch)
      if (patch.receipt !== undefined && before?.receipt && before.receipt !== patch.receipt) await dropFiles([before.receipt]) // replaced
      const rec = before && { ...before, ...patch }
      // if this is still the latest service of its type, its (fixed) km and date set the next due point
      const latest =
        rec &&
        !getData().services.some(s => s.id !== id && s.car_id === rec.car_id && s.type === rec.type && (s.date > rec.date || (s.date === rec.date && s.km > rec.km)))
      if (rec && latest && (patch.km !== undefined || patch.date !== undefined || patch.type !== undefined)) {
        const kinds = rec.type === 'service' ? ['service', 'oil'] : [rec.type]
        for (const item of getData().items.filter(i => i.car_id === rec.car_id && kinds.includes(i.kind)))
          await store.update('items', item.id, {
            due_km: item.every_km ? rec.km + item.every_km : item.due_km,
            due_date: item.every_months ? addMonths(rec.date, item.every_months) : item.due_date,
          })
      }
      await refresh()
    },
    async deleteService(id: string) {
      const receipt = getData().services.find(s => s.id === id)?.receipt
      await store.remove('services', id)
      await dropFiles([receipt])
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
      const before = getData().documents.find(d => d.id === doc.id)
      const exists = Boolean(before)
      if (exists) await store.update('documents', doc.id, doc)
      else await store.insert('documents', doc)
      const kind = doc.kind === 'licence' ? 'test' : doc.kind === 'insurance' ? 'insurance' : null
      const item = kind ? getData().items.find(i => i.car_id === doc.car_id && i.kind === kind) : undefined
      if (item && doc.expiry) await store.update('items', item.id, { due_date: doc.expiry })
      await dropFiles((before?.files ?? []).filter(f => !doc.files.includes(f))) // files taken off this document
      await refresh()
    },
    async deleteDocument(id: string) {
      const files = getData().documents.find(d => d.id === id)?.files ?? []
      await store.remove('documents', id)
      await dropFiles(files)
      await refresh()
    },
    /** Deletes an uploaded file: takes it off its document or service, then removes the file itself. */
    async deleteFile(ref: string) {
      const d = getData()
      for (const doc of d.documents.filter(x => x.files.includes(ref)))
        await store.update('documents', doc.id, { files: doc.files.filter(f => f !== ref) })
      for (const s of d.services.filter(x => x.receipt === ref)) await store.update('services', s.id, { receipt: null })
      await store.removeFile?.(ref).catch(() => {}) // already gone is fine
      await refresh()
    },
    upload: (name: string, blob: Blob) => store.upload(name, blob),
    fileUrl: (ref: string) => store.fileUrl(ref),
  }
}

export type Actions = ReturnType<typeof makeActions>
