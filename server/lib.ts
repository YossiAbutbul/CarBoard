import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import webpush from 'web-push'
import type { Car, Item, Reading } from '../src/types'
import { notesFor, type Sent } from '../src/domain/notify'

/*
 * Server side of push reminders (Vercel functions). Firebase Admin reads every user's reminders;
 * web-push delivers to the phones. Secrets live only in Vercel's environment:
 *   FIREBASE_SERVICE_ACCOUNT  the Admin key (JSON)
 *   VAPID_PRIVATE_KEY         the push key's private half (the public half is VITE_VAPID_PUBLIC_KEY)
 *   CRON_SECRET               Vercel sends it with the daily run
 */

export function admin() {
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)) })
  return { db: getFirestore(), auth: getAuth() }
}

let vapidSet = false
function vapid() {
  if (vapidSet) return
  webpush.setVapidDetails('https://carboard-teal.vercel.app', process.env.VITE_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!)
  vapidSet = true
}

export interface Payload {
  title: string
  body: string
  tag?: string
  url?: string
}

/** Sends to every phone the user turned notifications on; drops phones that are gone. */
export async function sendTo(db: Firestore, uid: string, payload: Payload) {
  vapid()
  const subs = await db.collection(`users/${uid}/push`).get()
  let sent = 0
  for (const s of subs.docs) {
    const { endpoint, keys } = s.data() as { endpoint: string; keys: { p256dh: string; auth: string } }
    try {
      await webpush.sendNotification({ endpoint, keys }, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'normal' })
      sent++
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode
      if (code === 404 || code === 410) await s.ref.delete() // unsubscribed or the app was removed
    }
  }
  return sent
}

/** Today's date in Israel, as YYYY-MM-DD. */
export const todayInIsrael = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date())

/** One user's reminders for today: sends what is due and records it, so nothing repeats. */
export async function remindUser(db: Firestore, uid: string, today: string) {
  const [cars, items, readings, mark] = await Promise.all([
    db.collection(`users/${uid}/cars`).get(),
    db.collection(`users/${uid}/items`).get(),
    db.collection(`users/${uid}/readings`).get(),
    db.doc(`users/${uid}/meta/notified`).get(),
  ])
  const sent: Sent = (mark.data()?.sent as Sent) ?? {}
  const all = {
    items: items.docs.map(d => d.data() as Item),
    readings: readings.docs.map(d => d.data() as Reading),
  }
  let count = 0
  for (const c of cars.docs) {
    for (const n of notesFor(c.data() as Car, all.items, all.readings, sent, today)) {
      if ((await sendTo(db, uid, { title: n.title, body: n.body, tag: n.tag, url: '/' })) > 0) count++
      sent[n.key] = [...(sent[n.key] ?? []), n.step]
    }
  }
  await db.doc(`users/${uid}/meta/notified`).set({ sent, at: Date.now() })
  return count
}
