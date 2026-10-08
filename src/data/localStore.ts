import { get, set, del, delMany, keys } from 'idb-keyval'
import type { Data, Table } from '../types'
import { emptyData, type Store } from './store'
import { uid } from '../lib/uid'

const KEY = 'car-records:data'
const urls = new Map<string, string>()

async function read(): Promise<Data> {
  return { ...emptyData(), ...((await get(KEY)) ?? {}) }
}

/** Demo mode: everything stays in this browser (IndexedDB). */
export const localStore: Store = {
  mode: 'local',
  loadAll: read,
  async insert(table, row) {
    const d = await read()
    ;(d[table] as unknown[]).push(row)
    await set(KEY, d)
  },
  async update(table, id, patch) {
    const d = await read()
    d[table] = (d[table] as { id: string }[]).map(r => (r.id === id ? { ...r, ...patch } : r)) as never
    await set(KEY, d)
  },
  async remove(table: Table, id) {
    const d = await read()
    d[table] = (d[table] as { id: string }[]).filter(r => r.id !== id) as never
    await set(KEY, d)
  },
  async upload(_name, blob) {
    const ref = `idb:${uid()}`
    await set(ref, blob)
    return ref
  },
  async fileUrl(ref) {
    if (!ref.startsWith('idb:')) return ref
    if (urls.has(ref)) return urls.get(ref)!
    const blob = (await get(ref)) as Blob | undefined
    if (!blob) return ''
    const url = URL.createObjectURL(blob)
    urls.set(ref, url)
    return url
  },
  async removeFile(ref) {
    if (!ref.startsWith('idb:')) return
    await del(ref)
    const url = urls.get(ref)
    if (url) URL.revokeObjectURL(url)
    urls.delete(ref)
  },
  async wipeFiles() {
    await delMany((await keys()).filter(k => String(k).startsWith('idb:')))
    urls.clear()
  },
}

export const clearLocal = () => del(KEY)
