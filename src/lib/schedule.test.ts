import { describe, expect, it } from 'vitest'
import { androidCalendarUrl, cleanAppointment, eventIcs, googleCalendarUrl } from './schedule'

const a = { title: 'יונדאי i10: טיפול תקופתי, ביטוח', details: 'שורה אחת\nשורה שתיים', location: 'מוסך אבי, חולון', date: '2026-10-20', time: '09:30', minutes: 60 }

describe('appointment in the calendar', () => {
  it('refuses a bad date or time', () => {
    expect(cleanAppointment({ ...a, date: '20.10.2026' })).toBeNull()
    expect(cleanAppointment({ ...a, time: '9' })).toBeNull()
    expect(cleanAppointment(a)).toMatchObject({ date: '2026-10-20', time: '09:30', minutes: 60 })
  })
  it('Google: the start and end in local time, an hour apart', () => {
    const u = new URL(googleCalendarUrl(a))
    expect(u.searchParams.get('dates')).toBe('20261020T093000/20261020T103000')
    expect(u.searchParams.get('text')).toBe(a.title)
  })
  it('an end past midnight moves to the next day', () => {
    const u = new URL(googleCalendarUrl({ ...a, time: '23:30' }))
    expect(u.searchParams.get('dates')).toBe('20261020T233000/20261021T003000')
  })
  it('the calendar file: escaped text, an alert an hour before, no line over 75 bytes', () => {
    const ics = eventIcs(a, 'x')
    expect(ics).toContain('DTSTART:20261020T093000')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics.replace(/\r\n /g, '')).toContain('LOCATION:מוסך אבי\\, חולון')
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
  it('Android: the new-event intent, an hour long, with Google Calendar if no app takes it', () => {
    const u = androidCalendarUrl(a)
    expect(u.startsWith('intent:#Intent;action=android.intent.action.INSERT;type=vnd.android.cursor.dir/event;')).toBe(true)
    expect(u.endsWith(';end')).toBe(true)
    const begin = Number(u.match(/l\.beginTime=(\d+)/)![1])
    expect(Number(u.match(/l\.endTime=(\d+)/)![1]) - begin).toBe(3_600_000)
    expect(new Date(begin).getHours()).toBe(9)
    expect(decodeURIComponent(u.match(/S\.eventLocation=([^;]*)/)![1])).toBe(a.location)
    expect(decodeURIComponent(u.match(/S\.browser_fallback_url=([^;]*)/)![1])).toBe(googleCalendarUrl(a))
  })
})
