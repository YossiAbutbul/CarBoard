import type { IncomingMessage, ServerResponse } from 'node:http'
import { admin, sendTo } from './lib'

/** "Send a test notification" from settings: to the signed-in user's own phones only. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const send = (status: number, body: object) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
  if (req.method !== 'POST') return send(405, { error: 'POST only' })
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '')
  const { db, auth } = admin()
  let uid: string
  try {
    uid = (await auth.verifyIdToken(token)).uid
  } catch {
    return send(401, { error: 'not signed in' })
  }
  const sent = await sendTo(db, uid, { title: 'CarBoard', body: 'ההתראות פועלות. נזכיר לך לפני כל מועד.', tag: 'test', url: '/' })
  send(200, { sent })
}
