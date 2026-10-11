import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../data/firebase'

/*
 * The user's name, as they typed it: never the Google account's name. Kept on the device (so the
 * greeting shows at once) and, when signed in, in users/<uid>/meta/profile, so every device and
 * the family see the same name.
 */

const KEY = 'car-records:name'

export function getLocalName(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function storeLocalName(name: string) {
  try {
    if (name) localStorage.setItem(KEY, name)
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: the name lasts for this visit only
  }
}

/** The name saved to the account, or null when there is none yet (undefined: could not tell). */
export async function loadCloudName(uid: string): Promise<string | null | undefined> {
  if (!db) return undefined
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'meta', 'profile'))
    return snap.exists() ? ((snap.data() as { name?: string }).name ?? '').trim() || null : null
  } catch {
    return undefined // offline: keep what the device knows
  }
}

export async function saveCloudName(uid: string, name: string) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'meta', 'profile'), { name: name.trim().slice(0, 40) })
}
