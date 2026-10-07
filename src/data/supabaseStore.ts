import type { Data, Table } from '../types'
import type { Store } from './store'
import { supabase } from './supabase'
import { uid } from '../lib/uid'

const BUCKET = 'files'
const TABLES: Table[] = ['cars', 'readings', 'items', 'services', 'documents']
const signed = new Map<string, { url: string; until: number }>()

function sb() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

async function check<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data
}

/** Cloud mode: Postgres tables with row level security; files in a private bucket under <user id>/. */
export function supabaseStore(userId: string): Store {
  return {
    mode: 'cloud',
    async loadAll() {
      const rows = await Promise.all(TABLES.map(t => check(sb().from(t).select('*'))))
      return Object.fromEntries(TABLES.map((t, i) => [t, rows[i] ?? []])) as unknown as Data
    },
    async insert(table, row) {
      await check(sb().from(table).insert(row as never))
    },
    async update(table, id, patch) {
      await check(sb().from(table).update(patch as never).eq('id', id))
    },
    async remove(table, id) {
      await check(sb().from(table).delete().eq('id', id))
    },
    async upload(name, blob) {
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'application/pdf' ? 'pdf' : 'jpg'
      const path = `${userId}/${name}-${uid()}.${ext}`
      await check(sb().storage.from(BUCKET).upload(path, blob, { contentType: blob.type }))
      return `sb:${path}`
    },
    async fileUrl(ref) {
      if (!ref.startsWith('sb:')) return ref
      const hit = signed.get(ref)
      if (hit && hit.until > Date.now()) return hit.url
      const res = await check(sb().storage.from(BUCKET).createSignedUrl(ref.slice(3), 3600))
      const signedUrl = res?.signedUrl ?? ''
      signed.set(ref, { url: signedUrl, until: Date.now() + 3_300_000 })
      return signedUrl
    },
  }
}
