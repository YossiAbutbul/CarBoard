import type { Item } from '../types'
import type { KmEstimate } from './odometer'
import { dueInfo, type DueInfo } from './due'
import { fmtDays, fmtKm, fmtDate } from '../lib/i18n'

export interface Reminder extends DueInfo {
  item: Item
  headline: string // the big value on a tile
  detail: string // the small line under it
}

const RANK = { overdue: 0, due: 1, soon: 2, ok: 3, unset: 4 }

export function buildReminders(items: Item[], km: KmEstimate): Reminder[] {
  return items
    .map(item => {
      const d = dueInfo(item, km)
      let headline = 'לא הוגדר'
      let detail = 'הקש להגדרה'
      if (d.status !== 'unset') {
        if (d.by === 'km' && d.kmLeft != null) {
          headline = d.kmLeft < 0 ? `עבר ב־${fmtKm(-d.kmLeft)}` : fmtKm(d.kmLeft)
          detail = d.days != null && d.days >= 0 ? `≈ עוד ${fmtDays(d.days)}` : `יעד ${fmtKm(item.due_km!)}`
        } else if (d.days != null) {
          headline = d.days < 0 ? `עבר לפני ${fmtDays(d.days)}` : d.days === 0 ? 'היום' : fmtDays(d.days)
          detail = `עד ${fmtDate(item.due_date!)}`
        }
      }
      return { ...d, item, headline, detail }
    })
    .sort((a, b) => RANK[a.status] - RANK[b.status] || (a.days ?? 1e9) - (b.days ?? 1e9))
}

export const needsAttention = (rs: Reminder[]) => rs.filter(r => r.status === 'due' || r.status === 'overdue').length
