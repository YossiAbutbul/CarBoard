const DAY = 86_400_000

export const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const todayIso = () => toIso(new Date())

export const parseIso = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Whole days from b to a (a - b). */
export const diffDays = (a: string, b: string) =>
  Math.round((parseIso(a).getTime() - parseIso(b).getTime()) / DAY)

export const addDays = (iso: string, n: number) => toIso(new Date(parseIso(iso).getTime() + n * DAY))

export const addMonths = (iso: string, n: number) => {
  const d = parseIso(iso)
  d.setMonth(d.getMonth() + n)
  return toIso(d)
}
