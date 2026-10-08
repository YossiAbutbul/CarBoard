import type { Car } from '../types'
import type { Reminder } from '../domain/reminders'
import { addDays, todayIso } from './dates'

const esc = (s: string) => s.replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n')
const icsDate = (iso: string) => iso.replace(/-/g, '')

/** One all-day event per item, with an alert 7 days before. km items use the predicted date. */
export function buildIcs(car: Car, reminders: Reminder[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const events = reminders.map(r => {
    const when = r.dueOn ?? addDays(todayIso(), 30)
    return [
      'BEGIN:VEVENT',
      `UID:${r.item.id}@car-records`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(when)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(when, 1))}`,
      `SUMMARY:${esc(`${car.name}: ${r.item.label}`)}`,
      `DESCRIPTION:${esc(r.detail)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P7D', `DESCRIPTION:${esc(r.item.label)}`, 'END:VALARM',
      'END:VEVENT',
    ].join('\r\n')
  })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CarBoard//he', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n')
}

export function downloadIcs(car: Car, reminders: Reminder[]) {
  const blob = new Blob([buildIcs(car, reminders)], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${car.name || 'car'}-reminders.ics`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
