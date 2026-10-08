import type { IncomingMessage, ServerResponse } from 'node:http'
import { admin, remindUser, todayInIsrael } from './lib'

/** The daily run (Vercel Cron, 09:00 in Israel): every user with notifications on. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    res.statusCode = 401
    return res.end('unauthorized')
  }
  const { db } = admin()
  const today = todayInIsrael()
  // users with at least one phone: users/<uid>/push/<id>
  const subs = await db.collectionGroup('push').get()
  const users = [...new Set(subs.docs.map(d => d.ref.parent.parent!.id))]
  let notes = 0
  for (const uid of users) {
    try {
      notes += await remindUser(db, uid, today)
    } catch (e) {
      console.error('remind', uid, e)
    }
  }
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ today, users: users.length, notes }))
}
