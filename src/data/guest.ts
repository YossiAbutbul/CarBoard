import type { Store } from './store'
import { clearLocal, localStore } from './localStore'

const KEY = 'car-records:guest'

/** Guest = no account; the data stays in this browser (localStore). */
export function isGuest() {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}
export function setGuest(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // storage blocked: guest lasts for this visit
  }
}

/**
 * A guest signed in: copy everything from this browser to their account, files included,
 * then clear the local copy. Rows keep their ids, so a second run cannot duplicate them.
 */
export async function moveGuestData(cloud: Store) {
  const local = await localStore.loadAll()
  if (local.cars.length) {
    const moved = new Map<string, string>()
    const move = async (ref: string | null) => {
      if (!ref?.startsWith('idb:')) return ref
      if (!moved.has(ref)) {
        const url = await localStore.fileUrl(ref)
        if (!url) return null
        const blob = await (await fetch(url)).blob()
        moved.set(ref, await cloud.upload('file', blob))
      }
      return moved.get(ref)!
    }
    for (const c of local.cars) await cloud.insert('cars', c)
    for (const r of local.readings) await cloud.insert('readings', r)
    for (const i of local.items) await cloud.insert('items', i)
    for (const s of local.services) await cloud.insert('services', { ...s, receipt: await move(s.receipt) })
    for (const d of local.documents) {
      const files = (await Promise.all(d.files.map(move))).filter((f): f is string => Boolean(f))
      await cloud.insert('documents', { ...d, files })
    }
  }
  await clearLocal()
  await localStore.wipeFiles?.()
  setGuest(false)
}
