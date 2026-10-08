import { collection, deleteDoc, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import type { Data, Table } from '../types'
import type { Store } from './store'
import { db } from './firebase'
import { uid } from '../lib/uid'
import { blobToBase64, compressImage } from '../lib/image'
import { del as cacheDel, get as cacheGet, set as cacheSet } from 'idb-keyval'

const TABLES: Table[] = ['cars', 'readings', 'items', 'services', 'documents']
const urls = new Map<string, string>()
// Uploaded files never change, so each is read from the cloud once and then kept on the device
// (IndexedDB): later views and thumbnails cost no reads and open at once.
const cacheKey = (ref: string) => `file-cache:${ref}`
// A Firestore document holds at most 1 MiB and base64 adds a third, so a file is stored in pieces of
// 700 KB: files/<id> holds its type and piece count, files/<id>/parts/<n> hold the pieces.
const PART = 700 * 1024
const MAX_FILE = 15 * 1024 * 1024

/**
 * Cloud mode, all in Firestore (the free Spark plan has no Storage):
 * rows in users/<uid>/<table>/<row id>, photos and receipts in users/<uid>/files/<file id>.
 * The rules in firestore.rules let each user reach only their own folder.
 */
export function firebaseStore(userId: string): Store {
  if (!db) throw new Error('Firebase is not configured')
  const fs = db
  const table = (t: Table | 'files') => collection(fs, 'users', userId, t)
  const row = (t: Table | 'files', id: string) => doc(fs, 'users', userId, t, id)
  const quota = doc(fs, 'users', userId, 'meta', 'quota') // bytes and files stored, checked by the rules

  /** The pieces, then the record and the storage count together. Files from before the count (no `counted`) leave it as it is. */
  async function deleteFile(id: string) {
    const parts = await getDocs(collection(fs, 'users', userId, 'files', id, 'parts'))
    await Promise.all(parts.docs.map(p => deleteDoc(p.ref)))
    const meta = await getDoc(row('files', id))
    if (meta.exists()) {
      const m = meta.data() as { size?: number; counted?: boolean }
      const batch = writeBatch(fs)
      batch.delete(meta.ref)
      if (m.counted && m.size) batch.set(quota, { bytes: increment(-m.size), files: increment(-1), lastFile: id }, { merge: true })
      await batch.commit()
    }
    await cacheDel(cacheKey(`fs:${id}`)).catch(() => {})
    const url = urls.get(`fs:${id}`)
    if (url) URL.revokeObjectURL(url)
    urls.delete(`fs:${id}`)
  }

  return {
    mode: 'cloud',
    async loadAll() {
      const snaps = await Promise.all(TABLES.map(t => getDocs(table(t))))
      return Object.fromEntries(TABLES.map((t, i) => [t, snaps[i].docs.map(d => d.data())])) as unknown as Data
    },
    async insert(t, r) {
      await setDoc(row(t, (r as { id: string }).id), r as object)
    },
    async update(t, id, patch) {
      await updateDoc(row(t, id), patch as object)
    },
    async remove(t, id) {
      await deleteDoc(row(t, id))
    },
    async upload(name, blob) {
      let file = blob
      // a photo still too big after the usual compression gets one stronger pass
      if (file.size > PART && file.type.startsWith('image/')) file = await compressImage(file, 1100, 0.6)
      if (file.size > MAX_FILE) throw new Error('הקובץ גדול מדי (עד 15MB).')
      const id = uid()
      const parts = Math.max(1, Math.ceil(file.size / PART))
      // The file's record and the user's storage count change together (the rules check both),
      // then the pieces, which the rules accept only for a file that is already counted.
      const batch = writeBatch(fs)
      batch.set(row('files', id), { name: name.slice(0, 40), type: file.type.slice(0, 80), size: file.size, parts, created: Date.now(), counted: true })
      batch.set(quota, { bytes: increment(file.size), files: increment(1), lastFile: id }, { merge: true })
      try {
        await batch.commit()
      } catch (e) {
        if ((e as { code?: string }).code === 'permission-denied') throw new Error('נגמר המקום לקבצים בחשבון (עד 250MB). אפשר למחוק קבצים ישנים.')
        throw e
      }
      for (let n = 0; n < parts; n++)
        await setDoc(doc(fs, 'users', userId, 'files', id, 'parts', String(n)), { data: await blobToBase64(file.slice(n * PART, (n + 1) * PART)) })
      await cacheSet(cacheKey(`fs:${id}`), file).catch(() => {}) // the first view is free too
      return `fs:${id}`
    },
    async fileUrl(ref) {
      if (!ref.startsWith('fs:')) return ref
      if (urls.has(ref)) return urls.get(ref)!
      const cached = (await cacheGet(cacheKey(ref)).catch(() => undefined)) as Blob | undefined
      if (cached) {
        const url = URL.createObjectURL(cached)
        urls.set(ref, url)
        return url
      }
      const id = ref.slice(3)
      const snap = await getDoc(row('files', id))
      if (!snap.exists()) return ''
      const meta = snap.data() as { type: string; data?: string; parts?: number }
      // older files are a single record with the data inside it
      const pieces = meta.data
        ? [meta.data]
        : await Promise.all(
            Array.from({ length: meta.parts ?? 0 }, async (_, n) => {
              const p = await getDoc(doc(fs, 'users', userId, 'files', id, 'parts', String(n)))
              if (!p.exists()) throw new Error('missing piece') // still uploading, or a broken upload
              return (p.data() as { data: string }).data
            }),
          )
      const bytes = pieces.map(b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0)))
      const blob = new Blob(bytes, { type: meta.type })
      await cacheSet(cacheKey(ref), blob).catch(() => {}) // storage full or blocked: just no cache
      const url = URL.createObjectURL(blob)
      urls.set(ref, url)
      return url
    },
    async removeFile(ref) {
      if (!ref.startsWith('fs:')) return
      await deleteFile(ref.slice(3))
    },
    async wipeFiles() {
      const all = await getDocs(table('files'))
      for (const f of all.docs) await deleteFile(f.id)
      urls.clear()
    },
  }
}
