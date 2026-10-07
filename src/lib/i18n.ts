import { parseIso } from './dates'

const num = new Intl.NumberFormat('he-IL')
const date = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
const shortDate = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' })

export const fmtNum = (n: number) => num.format(Math.round(n))
export const fmtKm = (n: number) => `${fmtNum(n)} ק״מ`
export const fmtDate = (iso: string) => date.format(parseIso(iso))
export const fmtShortDate = (iso: string) => shortDate.format(parseIso(iso))
export const fmtMoney = (n: number) => `₪${fmtNum(n)}`

export function fmtDays(n: number) {
  const a = Math.abs(n)
  if (a === 0) return 'היום'
  if (a === 1) return 'יום אחד'
  if (a === 2) return 'יומיים'
  if (a < 60) return `${a} ימים`
  const months = Math.round(a / 30.4)
  return months < 24 ? `${months} חודשים` : `${Math.round(a / 365)} שנים`
}

export function agoText(days: number) {
  if (days <= 0) return 'היום'
  if (days === 1) return 'אתמול'
  return `לפני ${fmtDays(days)}`
}

export function greeting(d = new Date()) {
  const h = d.getHours()
  if (h < 5) return 'לילה טוב'
  if (h < 12) return 'בוקר טוב'
  if (h < 17) return 'צהריים טובים'
  if (h < 21) return 'ערב טוב'
  return 'לילה טוב'
}

const longDateFmt = new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
/** e.g. "יום רביעי, 8 באוקטובר" */
export const longDate = (d = new Date()) => longDateFmt.format(d)
