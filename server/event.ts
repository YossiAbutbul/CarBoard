import type { IncomingMessage, ServerResponse } from 'node:http'
import { cleanAppointment, eventIcs } from '../src/lib/schedule'

/**
 * One appointment as a calendar event, for the iPhone: opened from the app, iOS shows its own
 * "Add Event" screen (nothing is downloaded). Everything comes from the link; nothing is stored.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const q = new URL(req.url ?? '', 'http://x').searchParams
  const a = cleanAppointment(Object.fromEntries(q))
  if (!a) {
    res.statusCode = 400
    res.setHeader('content-type', 'text/plain; charset=utf-8')
    return res.end('bad appointment')
  }
  const uid = `${a.date}-${a.time.replace(':', '')}-${Math.random().toString(36).slice(2, 8)}`
  res.statusCode = 200
  res.setHeader('content-type', 'text/calendar; charset=utf-8')
  res.setHeader('content-disposition', 'inline; filename="carboard.ics"')
  res.setHeader('cache-control', 'no-store')
  res.end(eventIcs(a, uid))
}
