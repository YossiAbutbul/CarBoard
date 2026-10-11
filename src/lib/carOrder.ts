import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../data/firebase'
import type { Car } from '../types'

/*
 * Each person's own order of the cars: the first one opens when the app starts. Family members
 * share the cars but not the order. Kept on the device (so the list shows in order at once) and,
 * when signed in, in users/<uid>/meta/order, so every device of that person agrees.
 */

const KEY = 'car-records:order'

export function getLocalOrder(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function storeLocalOrder(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // storage blocked: the order lasts for this visit only
  }
}

/** The order saved to the account; undefined when there is none or it could not be read. */
export async function loadCloudOrder(uid: string): Promise<string[] | undefined> {
  if (!db) return undefined
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'meta', 'order'))
    const cars = snap.exists() ? (snap.data() as { cars?: unknown }).cars : undefined
    return Array.isArray(cars) ? cars.filter((x): x is string => typeof x === 'string') : undefined
  } catch {
    return undefined // offline: keep what the device knows
  }
}

export async function saveCloudOrder(uid: string, ids: string[]) {
  if (!db) return
  await setDoc(doc(db, 'users', uid, 'meta', 'order'), { cars: ids.slice(0, 50) })
}

/** The cars in this person's order; cars not placed yet (new, or a family member's) keep their place at the end. */
export function sortCars(cars: Car[], order: string[]): Car[] {
  const at = new Map(order.map((id, i) => [id, i]))
  return cars
    .map((c, i) => ({ c, k: at.get(c.id) ?? order.length + i }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.c)
}
