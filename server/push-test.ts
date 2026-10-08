import type { IncomingMessage, ServerResponse } from 'node:http'
import { admin, sendTo, userFromToken } from './lib'

/** "Send a test notification" from settings: to the signed-in user's own phones only. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const send = (status: number, body: object) => {
    res.statusCode = status
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
  }
  if (req.method !== 'POST') return send(405, { error: 'POST only' })
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '')
  const uid = await userFromToken(token)
  if (!uid) return send(401, { error: 'not signed in' })
  const { db } = admin()
  const sent = await sendTo(db, uid, { title: 'CarBoard', body: 'ההתראות פועלות. נזכיר לך לפני כל מועד.', tag: 'test', url: '/' })
  send(200, { sent })
}
