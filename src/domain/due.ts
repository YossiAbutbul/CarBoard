import type { Item } from '../types'
import type { KmEstimate } from './odometer'
import { addDays, diffDays, todayIso } from '../lib/dates'

export type Status = 'ok' | 'soon' | 'due' | 'overdue' | 'booked' | 'unset'

export interface DueInfo {
  status: Status
  days: number | null // days left, by whichever limit comes first
  kmLeft: number | null
  by: 'km' | 'date' | null
  dueOn: string | null // the date, real or predicted from km
  progress: number // 0..1 of the interval used
}

export function dueInfo(it: Item, km: KmEstimate, today = todayIso()): DueInfo {
  const daysByDate = it.due_date ? diffDays(it.due_date, today) : null
  const kmLeft = it.due_km != null ? it.due_km - km.value : null
  const daysByKm = kmLeft != null ? Math.floor(kmLeft / Math.max(km.perDay, 1)) : null

  if (daysByDate == null && daysByKm == null)
    return { status: 'unset', days: null, kmLeft: null, by: null, dueOn: null, progress: 0 }

  const by: 'km' | 'date' =
    daysByDate == null ? 'km' : daysByKm == null ? 'date' : daysByKm < daysByDate ? 'km' : 'date'
  const days = by === 'km' ? daysByKm! : daysByDate!
  const dueOn = by === 'date' ? it.due_date! : addDays(today, days)

  let status: Status = 'ok'
  if (days < 0 || (kmLeft != null && kmLeft < 0)) status = 'overdue'
  else if (days <= 7 || (kmLeft != null && kmLeft <= 200)) status = 'due'
  else if (days <= 30 || (kmLeft != null && kmLeft <= 1000)) status = 'soon'
  // due, but an appointment is set for it: taken care of, until the day of the appointment passes
  if ((status === 'due' || status === 'overdue') && it.booked && it.booked.date >= today) status = 'booked'

  let progress = 0
  if (by === 'km' && it.every_km && kmLeft != null) progress = 1 - kmLeft / it.every_km
  else if (it.every_months && daysByDate != null) progress = 1 - daysByDate / (it.every_months * 30.4)
  else progress = status === 'ok' ? 0.3 : status === 'soon' ? 0.8 : 1

  return { status, days, kmLeft, by, dueOn, progress: Math.max(0, Math.min(1, progress)) }
}
