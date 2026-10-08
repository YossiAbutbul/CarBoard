import { describe, expect, it } from 'vitest'
import type { Data, Item, Reading, Table } from '../types'
import { estimateKm, kmPerDay, readingError } from './odometer'
import { dueInfo } from './due'
import { buildReminders } from './reminders'
import { notesFor, targetKey } from './notify'
import { makeActions } from '../data/actions'
import { emptyData, type Store } from '../data/store'
import { addDays, todayIso } from '../lib/dates'

const reading = (km: number, date: string, id = `${km}-${date}`): Reading => ({ id, car_id: 'c1', km, date, source: 'manual' })
const item = (p: Partial<Item>): Item => ({ id: 'i1', car_id: 'c1', kind: 'service', label: 'טיפול', every_km: null, every_months: null, due_km: null, due_date: null, ...p })

describe('km estimate', () => {
  it('is 0 with no readings', () => {
    expect(estimateKm([], '2026-10-08')).toMatchObject({ value: 0, last: null })
  })
  it('uses the national average (40/day) with one reading', () => {
    const e = estimateKm([reading(10000, '2026-10-01')], '2026-10-08')
    expect(e).toMatchObject({ value: 10280, perDay: 40, learned: false, checkedDaysAgo: 7 })
  })
  it('learns the daily average from two readings', () => {
    const rs = [reading(10000, '2026-09-01'), reading(11000, '2026-09-21')]
    expect(kmPerDay(rs)).toBe(50)
    expect(estimateKm(rs, '2026-09-25')).toMatchObject({ value: 11200, learned: true })
  })
  it('does not learn from readings less than 3 days apart', () => {
    expect(kmPerDay([reading(1000, '2026-09-01'), reading(1100, '2026-09-02')])).toBeNull()
  })
  it('reads unsorted input correctly', () => {
    const rs = [reading(11000, '2026-09-21'), reading(10000, '2026-09-01')]
    expect(estimateKm(rs, '2026-09-21').value).toBe(11000)
  })
})

describe('reading checks', () => {
  const rs = [reading(50000, '2026-09-01')]
  it('refuses a value below the last reading', () => expect(readingError(rs, 49999)).toMatch(/נמוך/))
  it('refuses negative and absurd values', () => {
    expect(readingError(rs, -1)).toBeTruthy()
    expect(readingError(rs, 3_000_000)).toBeTruthy()
  })
  it('accepts an equal or higher value', () => {
    expect(readingError(rs, 50000)).toBeNull()
    expect(readingError(rs, 50001)).toBeNull()
  })
})

describe('due status', () => {
  const km = { value: 100000, perDay: 50, learned: true, checkedDaysAgo: 0, last: null }
  const today = '2026-10-08'
  it('is unset without a km or date target', () => expect(dueInfo(item({}), km, today).status).toBe('unset'))
  it('is ok far from the target', () => expect(dueInfo(item({ due_km: 110000, every_km: 15000 }), km, today).status).toBe('ok'))
  it('is soon within 1,000 km', () => expect(dueInfo(item({ due_km: 100900 }), km, today).status).toBe('soon'))
  it('is due within 200 km', () => expect(dueInfo(item({ due_km: 100150 }), km, today).status).toBe('due'))
  it('is overdue past the km target', () => expect(dueInfo(item({ due_km: 99000 }), km, today).status).toBe('overdue'))
  it('is soon within 30 days by date', () => expect(dueInfo(item({ due_date: addDays(today, 20) }), km, today).status).toBe('soon'))
  it('is overdue past the date', () => expect(dueInfo(item({ due_date: addDays(today, -1) }), km, today).status).toBe('overdue'))
  it('takes whichever limit comes first', () => {
    // km: 5,000 left at 50/day = 100 days; date: 10 days → date wins
    const d = dueInfo(item({ due_km: 105000, due_date: addDays(today, 10) }), km, today)
    expect(d.by).toBe('date')
    expect(d.status).toBe('soon')
  })
})

describe('reminders', () => {
  it('sorts the most urgent first', () => {
    const km = estimateKm([reading(100000, todayIso())])
    const rs = buildReminders(
      [item({ id: 'a', due_km: 120000 }), item({ id: 'b', due_km: 99000 }), item({ id: 'c', due_date: addDays(todayIso(), 20) }), item({ id: 'd' })],
      km,
    )
    expect(rs.map(r => r.item.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(rs[0].headline).toMatch(/עבר/)
  })
})

/* ─── actions against an in-memory store ─── */

const removed: string[] = []
function memoryStore(): Store & { data: Data } {
  const data = emptyData()
  const rows = (t: Table) => data[t] as unknown as { id: string }[]
  return {
    mode: 'local',
    data,
    loadAll: async () => structuredClone(data),
    insert: async (t, row) => void rows(t).push(structuredClone(row) as never),
    update: async (t, id, patch) => {
      const r = rows(t).find(x => x.id === id)
      if (r) Object.assign(r, patch)
    },
    remove: async (t, id) => {
      const list = rows(t)
      list.splice(list.findIndex(x => x.id === id), 1)
    },
    upload: async name => `mem:${name}`,
    fileUrl: async ref => ref,
    removeFile: async ref => void removed.push(ref),
  }
}

function setup() {
  const store = memoryStore()
  let snapshot = structuredClone(store.data)
  const actions = makeActions(store, () => snapshot, async () => void (snapshot = structuredClone(store.data)))
  return { store, actions, data: () => snapshot }
}

const car = { name: 'קיה', plate: '12-345-67', make: 'קיה', model: 'PICANTO', year: 2018, color: 'לבן', fuel: null, tyres: null, image_url: null }

describe('actions', () => {
  it('adds a car with a start reading and the default reminders', async () => {
    const { actions, data } = setup()
    const id = await actions.addCar(car, 50000, '2027-01-01')
    expect(data().cars).toHaveLength(1)
    expect(data().readings[0]).toMatchObject({ car_id: id, km: 50000, source: 'start' })
    const kinds = data().items.map(i => i.kind).sort()
    expect(kinds).toEqual(['battery', 'brakes', 'insurance', 'oil', 'service', 'test', 'tyres'])
    expect(data().items.find(i => i.kind === 'test')?.due_date).toBe('2027-01-01')
    expect(data().items.find(i => i.kind === 'service')?.due_km).toBe(65000)
  })

  it('a periodic service moves the service and oil reminders and records the km', async () => {
    const { actions, data } = setup()
    const id = await actions.addCar(car, 50000, null)
    await actions.saveService({ car_id: id, type: 'service', title: 'טיפול', date: todayIso(), km: 52000, price: 900, garage: null, notes: null, receipt: null })
    expect(data().items.find(i => i.kind === 'service')?.due_km).toBe(67000)
    expect(data().items.find(i => i.kind === 'oil')?.due_km).toBe(62000)
    expect(data().items.find(i => i.kind === 'tyres')?.due_km).toBe(100000) // untouched
    expect(data().readings.map(r => r.km)).toContain(52000)
  })

  it('refuses a lower reading, fixes a mistyped one, and keeps the last one', async () => {
    const { actions, data } = setup()
    const id = await actions.addCar(car, 50000, null)
    await actions.addReading(id, 95000, 'manual') // typo: meant 59,000
    await expect(actions.addReading(id, 59000, 'manual')).rejects.toThrow()
    const typo = data().readings.find(r => r.km === 95000)!
    await actions.updateReading(typo.id, 59000)
    expect(data().readings.find(r => r.id === typo.id)?.km).toBe(59000)
    await expect(actions.updateReading(typo.id, 40000)).rejects.toThrow() // below the start reading
    await actions.deleteReading(typo.id)
    await expect(actions.deleteReading(data().readings[0].id)).rejects.toThrow() // the only one left
  })

  it('an insurance document sets the insurance reminder date', async () => {
    const { actions, data } = setup()
    const id = await actions.addCar(car, 50000, null)
    await actions.saveDocument({ id: 'd1', car_id: id, kind: 'insurance', title: 'ביטוח', provider: 'הראל', number: null, expiry: '2027-03-01', files: [] })
    expect(data().items.find(i => i.kind === 'insurance')?.due_date).toBe('2027-03-01')
  })

  it('deleting a car deletes everything that belongs to it', async () => {
    const { actions, data } = setup()
    const a = await actions.addCar(car, 50000, null)
    const b = await actions.addCar({ ...car, name: 'שני' }, 1000, null)
    await actions.saveService({ car_id: a, type: 'oil', title: 'שמן', date: todayIso(), km: 50500, price: null, garage: null, notes: null, receipt: null })
    await actions.deleteCar(a)
    const d = data()
    expect(d.cars.map(c => c.id)).toEqual([b])
    for (const t of ['readings', 'items', 'services', 'documents'] as const) expect(d[t].every(r => r.car_id === b)).toBe(true)
  })
})

describe('fixes from the walk-through', () => {
  it('adds calendar days across the daylight saving change', () => {
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('2026-03-27', 1)).toBe('2026-03-28')
    expect(addDays('2026-10-26', -1)).toBe('2026-10-25')
  })

  it('a service on a km already recorded today adds no duplicate reading', async () => {
    const { actions, data } = setup()
    const id = await actions.addCar(car, 50000, null)
    await actions.addReading(id, 51000, 'manual')
    await actions.saveService({ car_id: id, type: 'oil', title: 'שמן', date: todayIso(), km: 51000, price: null, garage: null, notes: null, receipt: null })
    expect(data().readings.filter(r => r.km === 51000)).toHaveLength(1)
  })

  it('fixing the km of the latest service moves the due point again', async () => {
    const { actions, data } = setup()
    const id = await actions.addCar(car, 50000, null)
    await actions.saveService({ car_id: id, type: 'service', title: 'טיפול', date: todayIso(), km: 59000, price: null, garage: null, notes: null, receipt: null })
    const s = data().services[0]
    await actions.updateService(s.id, { km: 52000 })
    expect(data().items.find(i => i.kind === 'service')?.due_km).toBe(67000)
    expect(data().items.find(i => i.kind === 'oil')?.due_km).toBe(62000)
  })

  it('reset deletes every car and all their records', async () => {
    const { actions, data } = setup()
    const a = await actions.addCar(car, 50000, null)
    await actions.addCar({ ...car, name: 'שני' }, 1000, null)
    await actions.saveService({ car_id: a, type: 'oil', title: 'שמן', date: todayIso(), km: 50500, price: null, garage: null, notes: null, receipt: null })
    await actions.resetAll()
    expect(data()).toEqual(emptyData())
  })

  it('deleting a file takes it off its document and its service', async () => {
    const { actions, data } = setup()
    const id = await actions.addCar(car, 50000, null)
    await actions.saveDocument({ id: 'd1', car_id: id, kind: 'insurance', title: 'ביטוח', provider: null, number: null, expiry: null, files: ['mem:a', 'mem:b'] })
    await actions.saveService({ car_id: id, type: 'oil', title: 'שמן', date: todayIso(), km: 50500, price: null, garage: null, notes: null, receipt: 'mem:b' })
    await actions.deleteFile('mem:b')
    expect(data().documents[0].files).toEqual(['mem:a'])
    expect(data().services[0].receipt).toBeNull()
  })

  it('files nothing points to any more are deleted', async () => {
    const { actions } = setup()
    removed.length = 0
    const id = await actions.addCar(car, 50000, null)
    await actions.saveDocument({ id: 'd1', car_id: id, kind: 'insurance', title: 'ביטוח', provider: null, number: null, expiry: null, files: ['mem:p1', 'mem:p2'] })
    await actions.saveDocument({ id: 'd1', car_id: id, kind: 'insurance', title: 'ביטוח', provider: null, number: null, expiry: null, files: ['mem:p1'] })
    expect(removed).toEqual(['mem:p2']) // taken off the document and saved
    await actions.saveService({ car_id: id, type: 'oil', title: 'שמן', date: todayIso(), km: 50500, price: null, garage: null, notes: null, receipt: 'mem:r1' })
    await actions.deleteCar(id)
    expect(removed.sort()).toEqual(['mem:p1', 'mem:p2', 'mem:r1'])
  })

})

describe('push notifications', () => {
  const today = '2026-10-08'
  const car1 = { ...car, id: 'c1' }
  const rd = [reading(100000, today)]
  const mk = (p: Partial<Item>) => item({ car_id: 'c1', ...p })
  it('7 days before a date', () => {
    const n = notesFor(car1, [mk({ id: 'i1', label: 'ביטוח', due_date: addDays(today, 7) })], rd, {}, today)
    expect(n).toHaveLength(1)
    expect(n[0].step).toBe('d7')
    expect(n[0].title).toBe('ביטוח · קיה')
  })
  it('nothing far away, nothing without a target', () => {
    expect(notesFor(car1, [mk({ due_date: addDays(today, 40) }), mk({ id: 'i2' })], rd, {}, today)).toEqual([])
  })
  it('each step once, and not an earlier one after a later one', () => {
    const r = mk({ id: 'i1', due_date: addDays(today, 1) })
    expect(notesFor(car1, [r], rd, { [targetKey(r)]: ['d1'] }, today)).toEqual([])
    expect(notesFor(car1, [mk({ id: 'i1', due_date: addDays(today, 7) })], rd, { [targetKey(mk({ id: 'i1', due_date: addDays(today, 7) }))]: ['d1'] }, today)).toEqual([])
  })
  it('a new target starts over', () => {
    const old = mk({ id: 'i1', due_date: addDays(today, 3) })
    const moved = mk({ id: 'i1', due_date: addDays(today, 7) })
    expect(notesFor(car1, [moved], rd, { [targetKey(old)]: ['d7', 'd1'] }, today)[0].step).toBe('d7')
  })
  it('by km: how many km are left', () => {
    const n = notesFor(car1, [mk({ id: 'i1', label: 'שמן', due_km: 100200 })], rd, {}, today)
    expect(n[0].body).toMatch(/נשארו 200 ק״מ/)
  })
  it('overdue once', () => {
    const r = mk({ id: 'i1', due_date: addDays(today, -3) })
    expect(notesFor(car1, [r], rd, {}, today)[0].step).toBe('late')
    expect(notesFor(car1, [r], rd, { [targetKey(r)]: ['late'] }, today)).toEqual([])
  })
  it('follows the chosen days', () => {
    const r = mk({ id: 'i1', due_date: addDays(today, 25) })
    expect(notesFor(car1, [r], rd, {}, today, { days: [7, 0], late: false })).toEqual([])
    expect(notesFor(car1, [r], rd, {}, today, { days: [30, 7], late: false })[0].step).toBe('d30')
    const late = mk({ id: 'i2', due_date: addDays(today, -2) })
    expect(notesFor(car1, [late], rd, {}, today, { days: [7], late: false })).toEqual([])
  })
})
