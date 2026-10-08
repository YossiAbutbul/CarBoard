import type { Car, Item, Reading } from '../types'
import { dueInfo } from './due'
import { estimateKm } from './odometer'
import { fmtDate, fmtDays, fmtNum } from '../lib/i18n'
import { todayIso } from '../lib/dates'

/*
 * Which push notifications to send today. A reminder notifies when it is 14, 7 and 1 days away,
 * on the day, and once when it is overdue; each step once. The steps already sent are kept per
 * reminder *target* (its due km and date), so after a service moves the target they start over.
 */

export type Step = 'd14' | 'd7' | 'd1' | 'd0' | 'late'
export type Sent = Record<string, Step[]> // target key → steps sent

export interface Note {
  key: string
  step: Step
  title: string
  body: string
  tag: string // one notification per reminder on the phone: a newer one replaces the older
}

export const targetKey = (it: Item) => `${it.id}:${it.due_km ?? ''}:${it.due_date ?? ''}`

function stepFor(days: number): Step | null {
  if (days < 0) return 'late'
  if (days === 0) return 'd0'
  if (days <= 1) return 'd1'
  if (days <= 7) return 'd7'
  if (days <= 14) return 'd14'
  return null
}

export function notesFor(car: Car, items: Item[], readings: Reading[], sent: Sent, today = todayIso()): Note[] {
  const km = estimateKm(readings.filter(r => r.car_id === car.id), today)
  const notes: Note[] = []
  for (const it of items.filter(i => i.car_id === car.id)) {
    const d = dueInfo(it, km, today)
    if (d.status === 'unset' || d.days == null) continue
    const step = stepFor(d.days)
    if (!step) continue
    const key = targetKey(it)
    const done = sent[key] ?? []
    // already sent this step, or a later one (a day was missed): nothing new to say
    const order: Step[] = ['d14', 'd7', 'd1', 'd0', 'late']
    if (done.some(s => order.indexOf(s) >= order.indexOf(step))) continue
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
