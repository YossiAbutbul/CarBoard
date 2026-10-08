import type { Car, Item, Reading } from '../types'
import { dueInfo } from './due'
import { estimateKm } from './odometer'
import { fmtDate, fmtDays, fmtNum } from '../lib/i18n'
import { todayIso } from '../lib/dates'

/*
 * Which push notifications to send today. The user picks when: some of 30, 14, 7 and 1 days before,
 * on the day (0), and once when overdue. Each step once. The steps already sent are kept per
 * reminder *target* (its due km and date), so after a service moves the target they start over.
 */

export type Step = string // 'd30' | 'd14' | 'd7' | 'd1' | 'd0' | 'late'
export type Sent = Record<string, Step[]> // target key → steps sent

export interface NotifyPrefs {
  days: number[] // days before: some of 30, 14, 7, 1, 0 (0 = on the day)
  late: boolean // once when overdue
  family?: boolean // also the other family members' cars
}
export const NOTIFY_DAYS = [30, 14, 7, 1, 0]
export const DEFAULT_PREFS: NotifyPrefs = { days: [7, 1, 0], late: true }

export interface Note {
  key: string
  step: Step
  title: string
  body: string
  tag: string // one notification per reminder on the phone: a newer one replaces the older
}

export const targetKey = (it: Item) => `${it.id}:${it.due_km ?? ''}:${it.due_date ?? ''}`

// how far ahead a step is: later steps have smaller numbers ('late' is the last)
const ahead = (s: Step) => (s === 'late' ? -1 : Number(s.slice(1)))

/** The step for `days` left: the nearest chosen point at or after it, e.g. 5 days left → 'd7'. */
function stepFor(days: number, prefs: NotifyPrefs): Step | null {
  if (days < 0) return prefs.late ? 'late' : null
  const t = [...prefs.days].sort((a, b) => a - b).find(d => days <= d)
  return t == null ? null : `d${t}`
}

export function notesFor(car: Car, items: Item[], readings: Reading[], sent: Sent, today = todayIso(), prefs: NotifyPrefs = DEFAULT_PREFS): Note[] {
  const km = estimateKm(readings.filter(r => r.car_id === car.id), today)
  const notes: Note[] = []
  for (const it of items.filter(i => i.car_id === car.id)) {
    const d = dueInfo(it, km, today)
    if (d.status === 'unset' || d.days == null) continue
    const step = stepFor(d.days, prefs)
    if (!step) continue
    const key = targetKey(it)
    const done = sent[key] ?? []
    // already sent this step, or a later one (a day was missed): nothing new to say
    if (done.some(s => ahead(s) <= ahead(step))) continue
    const when =
      step === 'late'
        ? 'עבר המועד. כדאי לטפל בהקדם.'
        : d.by === 'km' && d.kmLeft != null
          ? `נשארו ${fmtNum(d.kmLeft)} ק״מ (בערך ${fmtDays(d.days)})`
          : step === 'd0'
            ? `היום${it.due_date ? `, ${fmtDate(it.due_date)}` : ''}`
            : `בעוד ${fmtDays(d.days)}${it.due_date ? `, ${fmtDate(it.due_date)}` : ''}`
    notes.push({ key, step, title: `${it.label} · ${car.name}`, body: when, tag: `${car.id}:${it.id}` })
  }
  return notes
}
