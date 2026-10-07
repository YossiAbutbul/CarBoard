import { collection, deleteDoc, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { deleteObject, getDownloadURL, listAll, ref as fileRef, uploadBytes } from 'firebase/storage'
import type { Data, Table } from '../types'
import type { Store } from './store'
import { db, storage } from './firebase'
import { uid } from '../lib/uid'

const TABLES: Table[] = ['cars', 'readings', 'items', 'services', 'documents']
const urls = new Map<string, string>()

/**
 * Cloud mode. Firestore: users/<uid>/<table>/<row id>. Storage: users/<uid>/files/<name>.
 * The security rules (firestore.rules, storage.rules) let each user reach only their own folder.
 */
export function firebaseStore(userId: string): Store {
  if (!db || !storage) throw new Error('Firebase is not configured')
  const fs = db
  const st = storage
  const table = (t: Table) => collection(fs, 'users', userId, t)
  const row = (t: Table, id: string) => doc(fs, 'users', userId, t, id)

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
      const ext = ({ 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' } as Record<string, string>)[blob.type] ?? 'jpg'
      const path = `users/${userId}/files/${name}-${uid()}.${ext}`
      await uploadBytes(fileRef(st, path), blob, { contentType: blob.type })
      return `fb:${path}`
    },
    async fileUrl(ref) {
      if (!ref.startsWith('fb:')) return ref
      if (urls.has(ref)) return urls.get(ref)!
      const url = await getDownloadURL(fileRef(st, ref.slice(3)))
      urls.set(ref, url)
      return url
    },
    async wipeFiles() {
      const all = await listAll(fileRef(st, `users/${userId}/files`))
      await Promise.all(all.items.map(i => deleteObject(i)))
      urls.clear()
    },
  }
}
