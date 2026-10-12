/*
 * One appointment in the user's calendar ("I'll take care of it then"), with no file to download:
 *  - Google Calendar: a link that opens its "new event" page (or the Calendar app on Android) filled in;
 *  - iPhone: a calendar event served from the app's own address (/api/event), which iOS opens straight
 *    into its "Add Event" screen.
 * The event itself is built here, for both: the browser builds the links, the server the event.
 */

export interface Appointment {
  title: string
  details: string
  location: string
  date: string // YYYY-MM-DD
  time: string // HH:MM, the phone's own time
  minutes: number
}

const LIMITS = { title: 120, details: 800, location: 120 }

/** Checks and trims what came in (from the form, or from the link the server got). */
export function cleanAppointment(a: Partial<Record<keyof Appointment, unknown>>): Appointment | null {
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  const date = str(a.date, 10)
  const time = str(a.time, 5)
  const minutes = Number(a.minutes) || 60
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || minutes < 5 || minutes > 600) return null
  return { title: str(a.title, LIMITS.title) || 'CarBoard', details: str(a.details, LIMITS.details), location: str(a.location, LIMITS.location), date, time, minutes }
}

const pad = (n: number) => String(n).padStart(2, '0')
/** "2026-10-20" + "09:30" + minutes → the start and end as calendar stamps, in local (floating) time. */
function stamps(a: Appointment) {
  const [y, m, d] = a.date.split('-').map(Number)
  const [h, min] = a.time.split(':').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d, h, min))
  const end = new Date(start.getTime() + a.minutes * 60_000)
  const fmt = (t: Date) => `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}00`
  return [fmt(start), fmt(end)]
}

/** Google Calendar's "new event" page, filled in. */
export function googleCalendarUrl(a: Appointment) {
  const [start, end] = stamps(a)
  const q = new URLSearchParams({ action: 'TEMPLATE', text: a.title, dates: `${start}/${end}`, details: a.details, location: a.location, ctz: 'Asia/Jerusalem' })
  return `https://calendar.google.com/calendar/render?${q}`
}

/** The app's own address for the event (served by /api/event), for the iPhone's calendar. */
export function eventUrl(a: Appointment, origin: string) {
  const q = new URLSearchParams({ title: a.title, details: a.details, location: a.location, date: a.date, time: a.time, minutes: String(a.minutes) })
  return `${origin}/api/event?${q}`
}

const esc = (s: string) => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\r?\n/g, '\\n')
/** Calendar lines may be at most 75 bytes: longer ones continue on the next line after a space. */
function fold(line: string) {
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length
    if (bytes + b > 73) {
      out.push(cur)
      cur = ' '
      bytes = 1
    }
    cur += ch
    bytes += b
  }
  out.push(cur)
  return out.join('\r\n')
}

/** The event as a calendar file's text, with an alert an hour before. */
export function eventIcs(a: Appointment, uid: string) {
  const [start, end] = stamps(a)
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CarBoard//he',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@carboard`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(a.title)}`,
    a.details && `DESCRIPTION:${esc(a.details)}`,
    a.location && `LOCATION:${esc(a.location)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT1H',
    `DESCRIPTION:${esc(a.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .map(l => fold(l as string))
    .join('\r\n')
}
