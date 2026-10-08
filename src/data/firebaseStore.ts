import { arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, setDoc, updateDoc, writeBatch } from 'firebase/firestore'
import type { Data, Table } from '../types'
import type { Family, FamilyApi, Store } from './store'
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
const INVITE_DAYS = 7

/**
 * Cloud mode, all in Firestore (the free Spark plan has no Storage). Every user has a folder,
 * users/<uid>/<table>/<row id>, and photos and receipts in users/<uid>/files/<file id>.
 * In a family, the app loads every member's folder: each car stays in the folder of whoever added it,
 * and every change goes back to the folder its row came from. File refs say whose folder holds them:
 * fs:<uid>/<id> (older ones, fs:<id>, are the loader's own and are rewritten when loaded).
 */
export function firebaseStore(userId: string): Store {
  if (!db) throw new Error('Firebase is not configured')
  const fs = db
  const col = (root: string, t: Table | 'files') => collection(fs, 'users', root, t)
  const row = (root: string, t: Table | 'files', id: string) => doc(fs, 'users', root, t, id)
  const quotaOf = (root: string) => doc(fs, 'users', root, 'meta', 'quota') // bytes and files stored, checked by the rules

  let roots = [userId] // whose folders are loaded: me, and my family
  let family: Family | null = null
  const rowRoot = new Map<string, string>() // row id → the folder it lives in
  const rootOf = (id: string | undefined) => (id && rowRoot.get(id)) || userId

  const parseRef = (ref: string) => {
    const rest = ref.slice(3)
    const slash = rest.indexOf('/')
    return slash < 0 ? { root: userId, id: rest } : { root: rest.slice(0, slash), id: rest.slice(slash + 1) }
  }
  // older refs (fs:<id>) belong to the folder they were loaded from
  const fullRef = (ref: string | null, root: string) => (ref && ref.startsWith('fs:') && !ref.includes('/') ? `fs:${root}/${ref.slice(3)}` : ref)
  // the owner is shown, never stored
  const withoutOwner = (r: object) => {
    const { owner: _owner, ...rest } = r as { owner?: unknown }
    void _owner
    return rest
  }

  async function loadFamily() {
    family = null
    roots = [userId]
    const mine = await getDoc(doc(fs, 'users', userId, 'meta', 'family')).catch(() => null)
    const fid = mine?.exists() ? (mine.data() as { fid: string }).fid : null
    if (!fid) return
    const f = await getDoc(doc(fs, 'families', fid)).catch(() => null)
    if (!f?.exists()) return
    const d = f.data() as { members: string[]; names?: Record<string, string>; owner: string; title?: string }
    if (!d.members.includes(userId)) return
    family = { id: fid, owner: d.owner, me: userId, title: d.title ?? '', members: d.members.map(u => ({ uid: u, name: d.names?.[u] ?? '' })) }
    roots = [userId, ...d.members.filter(u => u !== userId)]
  }

  /** The pieces, then the record and the storage count together. Files from before the count (no `counted`) leave it as it is. */
  async function deleteFile(root: string, id: string) {
    const parts = await getDocs(collection(fs, 'users', root, 'files', id, 'parts'))
    await Promise.all(parts.docs.map(p => deleteDoc(p.ref)))
    const meta = await getDoc(row(root, 'files', id))
    if (meta.exists()) {
      const m = meta.data() as { size?: number; counted?: boolean }
      const batch = writeBatch(fs)
      batch.delete(meta.ref)
      if (m.counted && m.size) batch.set(quotaOf(root), { bytes: increment(-m.size), files: increment(-1), lastFile: id }, { merge: true })
      await batch.commit()
    }
    for (const ref of [`fs:${root}/${id}`, ...(root === userId ? [`fs:${id}`] : [])]) {
      await cacheDel(cacheKey(ref)).catch(() => {})
      const url = urls.get(ref)
      if (url) URL.revokeObjectURL(url)
      urls.delete(ref)
    }
  }

  const familyApi: FamilyApi = {
    current: () => family,
    async create(name) {
      const batch = writeBatch(fs)
      batch.set(doc(fs, 'families', userId), { members: [userId], names: { [userId]: name.slice(0, 40) }, owner: userId, created: Date.now() })
      batch.set(doc(fs, 'users', userId, 'meta', 'family'), { fid: userId })
      await batch.commit()
      await loadFamily()
    },
    async invite(name) {
      if (!family) throw new Error('no family')
      // 10 letters and digits, without look-alikes (0/O, 1/I)
      const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const code = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => abc[b % abc.length]).join('')
      await setDoc(doc(fs, 'invites', code), { family: family.id, by: userId, name: name.slice(0, 60), expires: Date.now() + INVITE_DAYS * 86400000 - 60000 })
      return code
    },
    async peek(code) {
      const s = await getDoc(doc(fs, 'invites', code.trim().toUpperCase())).catch(() => null)
      if (!s?.exists()) return null
      const d = s.data() as { family: string; name: string; expires: number }
      return d.expires > Date.now() ? { family: d.family, name: d.name } : null
    },
    async join(code, name) {
      const c = code.trim().toUpperCase()
      const inv = await familyApi.peek(c)
      if (!inv) throw new Error('ההזמנה לא נמצאה או שפג תוקפה')
      // Adds me to the family's list (the server adds to whatever the list is now; the rules check the
      // invite) and points my folder at the family, together.
      const batch = writeBatch(fs)
      batch.update(doc(fs, 'families', inv.family), { members: arrayUnion(userId), [`names.${userId}`]: name.slice(0, 40), joinCode: c })
      batch.set(doc(fs, 'users', userId, 'meta', 'family'), { fid: inv.family })
      await batch.commit()
      await loadFamily()
    },
    async leave() {
      if (!family) return
      const batch = writeBatch(fs)
      batch.update(doc(fs, 'families', family.id), { members: arrayRemove(userId), [`names.${userId}`]: deleteField() })
      batch.delete(doc(fs, 'users', userId, 'meta', 'family'))
      await batch.commit()
      await loadFamily()
    },
    async rename(name) {
      if (family) await updateDoc(doc(fs, 'families', family.id), { [`names.${userId}`]: name.slice(0, 40) })
    },
    async retitle(title) {
      if (!family) return
      await updateDoc(doc(fs, 'families', family.id), { title: title.trim().slice(0, 40) })
      family = { ...family, title: title.trim().slice(0, 40) }
    },
  }

  return {
    mode: 'cloud',
    userId,
    family: familyApi,
    owns: (_t, id) => rootOf(id) === userId,
    async loadAll() {
      await loadFamily()
      const data = Object.fromEntries(TABLES.map(t => [t, [] as unknown[]])) as unknown as Data
      rowRoot.clear()
      for (const root of roots) {
        let snaps
        try {
          snaps = await Promise.all(TABLES.map(t => getDocs(col(root, t))))
        } catch (e) {
          if (root === userId) throw e
          continue // a member who just left: their cars are no longer ours to see
        }
        TABLES.forEach((t, i) => {
          for (const d of snaps[i].docs) {
            const r = d.data() as Record<string, unknown> & { id: string }
            rowRoot.set(r.id, root)
            if (t === 'cars') r.owner = root
            if (t === 'documents') r.files = ((r.files as string[]) ?? []).map(f => fullRef(f, root))
            if (t === 'services') r.receipt = fullRef((r.receipt as string | null) ?? null, root)
            ;(data[t] as unknown[]).push(r)
          }
        })
      }
      return data
    },
    async insert(t, r) {
      const id = (r as { id: string }).id
      // a car goes into my folder; anything else into its car's folder
      const root = t === 'cars' ? userId : rootOf((r as { car_id?: string }).car_id)
      rowRoot.set(id, root)
      await setDoc(row(root, t, id), withoutOwner(r as object))
    },
    async update(t, id, patch) {
      await updateDoc(row(rootOf(id), t, id), withoutOwner(patch as object))
    },
    async remove(t, id) {
      await deleteDoc(row(rootOf(id), t, id))
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
      // Uploads always go into my own folder (and count towards my storage).
      const batch = writeBatch(fs)
      batch.set(row(userId, 'files', id), { name: name.slice(0, 40), type: file.type.slice(0, 80), size: file.size, parts, created: Date.now(), counted: true })
      batch.set(quotaOf(userId), { bytes: increment(file.size), files: increment(1), lastFile: id }, { merge: true })
      try {
        await batch.commit()
      } catch (e) {
        if ((e as { code?: string }).code === 'permission-denied') throw new Error('נגמר המקום לקבצים בחשבון (עד 250MB). אפשר למחוק קבצים ישנים.')
        throw e
      }
      for (let n = 0; n < parts; n++)
        await setDoc(doc(fs, 'users', userId, 'files', id, 'parts', String(n)), { data: await blobToBase64(file.slice(n * PART, (n + 1) * PART)) })
      const ref = `fs:${userId}/${id}`
      await cacheSet(cacheKey(ref), file).catch(() => {}) // the first view is free too
      return ref
    },
    async fileUrl(ref) {
      if (!ref.startsWith('fs:')) return ref
      if (urls.has(ref)) return urls.get(ref)!
      const { root, id } = parseRef(ref)
      // the same file under its older name (fs:<id>) may already be on the device
      const cached = ((await cacheGet(cacheKey(ref)).catch(() => undefined)) ??
        (root === userId ? await cacheGet(cacheKey(`fs:${id}`)).catch(() => undefined) : undefined)) as Blob | undefined
      if (cached) {
        const url = URL.createObjectURL(cached)
        urls.set(ref, url)
        return url
      }
      const snap = await getDoc(row(root, 'files', id))
      if (!snap.exists()) return ''
      const meta = snap.data() as { type: string; data?: string; parts?: number }
      // older files are a single record with the data inside it
      const pieces = meta.data
        ? [meta.data]
        : await Promise.all(
            Array.from({ length: meta.parts ?? 0 }, async (_, n) => {
              const p = await getDoc(doc(fs, 'users', root, 'files', id, 'parts', String(n)))
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
      const { root, id } = parseRef(ref)
      await deleteFile(root, id)
    },
    async wipeFiles() {
      const all = await getDocs(col(userId, 'files'))
      for (const f of all.docs) await deleteFile(userId, f.id)
      urls.clear()
    },
  }
}
