import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import type { Data, Table } from '../types'
import type { Store } from './store'
import { db } from './firebase'
import { uid } from '../lib/uid'
import { blobToBase64, compressImage } from '../lib/image'

const TABLES: Table[] = ['cars', 'readings', 'items', 'services', 'documents']
const urls = new Map<string, string>()
// A Firestore document holds at most 1 MiB, and base64 adds a third.
const MAX_FILE = 700 * 1024

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
      if (file.size > MAX_FILE && file.type.startsWith('image/')) file = await compressImage(file, 1100, 0.6)
      if (file.size > MAX_FILE) throw new Error('הקובץ גדול מדי (עד 700KB). אפשר לצלם אותו במקום להעלות PDF.')
      const id = uid()
      await setDoc(row('files', id), { name, type: file.type, size: file.size, data: await blobToBase64(file), created: Date.now() })
      return `fs:${id}`
    },
    async fileUrl(ref) {
      if (!ref.startsWith('fs:')) return ref
      if (urls.has(ref)) return urls.get(ref)!
      const snap = await getDoc(row('files', ref.slice(3)))
      if (!snap.exists()) return ''
      const { type, data } = snap.data() as { type: string; data: string }
      const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type }))
      urls.set(ref, url)
      return url
    },
    async wipeFiles() {
      const all = await getDocs(table('files'))
      await Promise.all(all.docs.map(d => deleteDoc(d.ref)))
      urls.clear()
    },
  }
}
