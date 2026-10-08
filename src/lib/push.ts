import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { DEFAULT_PREFS, type NotifyPrefs } from '../domain/notify'
import { auth, db } from '../data/firebase'

/*
 * Push reminders on this phone: standard web push. The phone's subscription is saved in
 * users/<uid>/push/<id>; a daily job on the server (api/reminders) sends what is due.
 */

const VAPID = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'needs-install' | 'blocked' | 'off' | 'on'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const installed = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

export async function pushState(): Promise<PushState> {
  if (!VAPID || !('serviceWorker' in navigator)) return 'unsupported'
  // iPhones get web push only for an app added to the home screen
  if (!('PushManager' in window)) return isIos() && !installed() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}

const b64ToBytes = (b64: string) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}
// one record per phone, named after its push address
const subId = async (endpoint: string) => {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint))
  return Array.from(new Uint8Array(hash).slice(0, 12), b => b.toString(16).padStart(2, '0')).join('')
}

const SAVED_KEY = 'car-records:push-saved' // which account and phone address were saved, and when
const WEEK = 7 * 24 * 60 * 60 * 1000

/**
 * With notifications already on: save this phone again, in case an earlier save failed. Only when
 * something changed (another account, a new push address) or once a week, so it costs no write.
 */
export async function resavePush() {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  const uid = auth?.currentUser?.uid
  if (!sub || !uid) return
  try {
    const last = JSON.parse(localStorage.getItem(SAVED_KEY) ?? 'null') as { uid: string; endpoint: string; at: number } | null
    if (last && last.uid === uid && last.endpoint === sub.endpoint && Date.now() - last.at < WEEK) return
  } catch {
    // storage blocked: just save
  }
  await saveSub(sub)
}

export async function enablePush(): Promise<PushState> {
  const uid = auth?.currentUser?.uid
  if (!uid || !db || !VAPID) return 'unsupported'
  if ((await Notification.requestPermission()) !== 'granted') return 'blocked'
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID) }))
  await saveSub(sub)
  return 'on'
}

async function saveSub(sub: PushSubscription) {
  const uid = auth?.currentUser?.uid
  if (!uid || !db) return
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  await setDoc(doc(db, 'users', uid, 'push', await subId(j.endpoint)), {
    endpoint: j.endpoint,
    keys: { p256dh: j.keys.p256dh, auth: j.keys.auth },
    created: Date.now(),
    ua: navigator.userAgent.slice(0, 160),
  })
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify({ uid, endpoint: j.endpoint, at: Date.now() }))
  } catch {
    // storage blocked: it saves again next time
  }
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  const uid = auth?.currentUser?.uid
  if (sub) {
    if (uid && db) await deleteDoc(doc(db, 'users', uid, 'push', await subId(sub.endpoint))).catch(() => {})
    await sub.unsubscribe()
  }
  try {
    localStorage.removeItem(SAVED_KEY)
  } catch {
    // storage blocked
  }
  return 'off'
}

/** When to remind (saved to the account, read by the daily job). */
export async function loadPrefs(): Promise<NotifyPrefs> {
  const uid = auth?.currentUser?.uid
  if (!uid || !db) return DEFAULT_PREFS
  const snap = await getDoc(doc(db, 'users', uid, 'meta', 'prefs')).catch(() => null)
  return (snap?.data() as NotifyPrefs | undefined) ?? DEFAULT_PREFS
}
export async function savePrefs(p: NotifyPrefs) {
  const uid = auth?.currentUser?.uid
  if (uid && db) await setDoc(doc(db, 'users', uid, 'meta', 'prefs'), { days: [...p.days].sort((a, b) => b - a), late: p.late, family: Boolean(p.family) })
}

/** Asks the server to send a test notice to this account's phones. */
export async function testPush(): Promise<number> {
  const token = await auth?.currentUser?.getIdToken()
  if (!token) throw new Error('not signed in')
  const r = await fetch('/api/push-test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
  if (!r.ok) throw new Error(`push test ${r.status}`)
  return ((await r.json()) as { sent: number }).sent
}
