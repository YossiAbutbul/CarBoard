import { fmtDate, fmtMoney, fmtNum } from './i18n'
import { formatPlate, plateDigits, type CarProfile } from './govil'
import type { ValueEstimate } from '../domain/value'

/*
 * "מחירון" as a picture to send, made for a chat: 4:5 (1080 × 1350), the portrait shape WhatsApp shows
 * whole in the conversation, taller only when a long ownership history needs the room. Laid out in
 * points and drawn at 1080 px wide.
 * Set the way iOS sets details: a quiet grey ground, the car's name across the top, then grouped
 * white lists under small titles in two columns — on the right (read first) what it is worth and the
 * whole ownership history in order, on the left every fact the registry gives. One accent colour;
 * order and spacing carry the hierarchy, not size.
 * The link sent beside it opens the same lookup in the app.
 */

const PX = 1080 // the photo's width in pixels
const PT = 520 // …and in points
const S = PX / PT
const MIN_PT = Math.round((PT * 5) / 4) // 4:5

const PAD = 16 // the margin
const COL_GAP = 14 // between the two columns
const COL = (PT - PAD * 2 - COL_GAP) / 2 // a column's width
const RIGHT = PT - PAD
const IN = 14 // inside a group
const RADIUS = 18
const PAIR = 50 // a two-up cell: a label over its value
const LINE = 40 // a list row
const SEC_HEAD = 30 // a section title's room above its group
const SEC_GAP = 14 // between one group and the next title
const TOP = 148 // where the columns start, under the name
const FOOT = 40 // the closing note

const FONT = "'Noto Sans Hebrew', 'Noto Sans', 'Segoe UI', sans-serif"
const LATIN = "'Noto Sans', 'Segoe UI', sans-serif"
const PLATE_FONT = "'Barlow Semi Condensed', 'Noto Sans', sans-serif"

// iOS's grouped-list colours, with the app's blue as the one accent
const C = {
  ground: '#f2f2f7',
  group: '#ffffff',
  label: '#1c1c1e',
  second: '#6d6d72',
  third: '#8e8e93',
  hair: '#e3e3e8',
  blue: '#1c69d4',
  blueTint: '#e8f0fc',
  red: '#d6322b',
}

/** The address that opens this car in מחירון. */
export const shareLink = (plate: string) => `${location.origin}/?price=${plateDigits(plate)}`

const monthYear = (ym: string | null) => (ym && /^\d{4}-\d{2}/.test(ym) ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : ym ?? '')

export interface CardInput {
  profile: CarProfile
  estimate: ValueEstimate | null
  hands: number
}

type Ctx = CanvasRenderingContext2D
type TextOpts = { size: number; weight?: number; color?: string; align?: CanvasTextAlign; dir?: CanvasDirection; max?: number; font?: string; track?: number }

/** Tracking where the browser can set it (older Safari ignores it; the text is still right). */
function track(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px.toFixed(2)}px`
}

function setFont(ctx: Ctx, o: TextOpts) {
  ctx.font = `${o.weight ?? 400} ${o.size}px ${o.font ?? FONT}`
  ctx.textAlign = o.align ?? 'right'
  ctx.direction = o.dir ?? 'rtl'
  ctx.textBaseline = 'alphabetic'
  // as iOS tracks: the title a little tight, small text a hair open
  track(ctx, (o.track ?? (o.size >= 22 ? -0.02 : o.size <= 13 ? 0.006 : -0.005)) * o.size)
}

function text(ctx: Ctx, s: string, x: number, y: number, o: TextOpts) {
  setFont(ctx, o)
  ctx.fillStyle = o.color ?? C.label
  ctx.fillText(o.max ? fit(ctx, s, o.max) : s, x, y)
  track(ctx, 0)
}

function measure(ctx: Ctx, s: string, o: TextOpts) {
  setFont(ctx, o)
  const w = ctx.measureText(s).width
  track(ctx, 0)
  return w
}

/** Cuts a line to fit, with an ellipsis. */
function fit(ctx: Ctx, s: string, max: number) {
  if (ctx.measureText(s).width <= max) return s
  let t = s
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t.trimEnd()}…`
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Numbers and dates read left to right; words right to left. */
const dirOf = (s: string): CanvasDirection => (/^[\d₪\s–\-/.,]+(היום)?$/.test(s) ? 'ltr' : 'rtl')

/** An Israeli plate: the blue band with the flag, IL and ישראל; black on yellow. Left edge at `x`. */
function drawPlate(ctx: Ctx, plate: string, x: number, y: number, h: number) {
  ctx.save()
  const label = formatPlate(plate)
  const w = plateWidth(ctx, plate, h)
  const band = h * 0.62
  const r = h * 0.14
  rr(ctx, x, y, w, h, r)
  ctx.fillStyle = '#f9cf1a'
  ctx.fill()
  const b = h * 0.04
  rr(ctx, x + b, y + b, band - b, h - b * 2, [r * 0.7, 0, 0, r * 0.7])
  ctx.fillStyle = '#0038b8'
  ctx.fill()
  const bx = x + b + (band - b) / 2
  // the flag
  const fw = band * 0.62
  const fh = fw * (16 / 22)
  const fx = bx - fw / 2
  const fy = y + h * 0.12
  ctx.fillStyle = '#fff'
  ctx.fillRect(fx, fy, fw, fh)
  ctx.fillStyle = '#0038b8'
  ctx.fillRect(fx, fy + fh * 0.1, fw, fh * 0.14)
  ctx.fillRect(fx, fy + fh * 0.76, fw, fh * 0.14)
  ctx.strokeStyle = '#0038b8'
  ctx.lineWidth = fh * 0.06
  const s = fh * 0.22
  const mx = fx + fw / 2
  const my = fy + fh / 2
  ctx.beginPath()
  ctx.moveTo(mx, my - s)
  ctx.lineTo(mx + s * 0.87, my + s * 0.5)
  ctx.lineTo(mx - s * 0.87, my + s * 0.5)
  ctx.closePath()
  ctx.moveTo(mx, my + s)
  ctx.lineTo(mx - s * 0.87, my - s * 0.5)
  ctx.lineTo(mx + s * 0.87, my - s * 0.5)
  ctx.closePath()
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  track(ctx, 0)
  ctx.font = `700 ${h * 0.24}px ${LATIN}`
  ctx.fillText('IL', bx, y + h * 0.66)
  ctx.font = `600 ${h * 0.13}px ${FONT}`
  ctx.direction = 'rtl'
  ctx.fillText('ישראל', bx, y + h * 0.84)
  ctx.strokeStyle = '#111'
  ctx.lineWidth = h * 0.03
  rr(ctx, x + h * 0.015, y + h * 0.015, w - h * 0.03, h - h * 0.03, r)
  ctx.stroke()
  ctx.direction = 'ltr'
  ctx.fillStyle = '#111'
  ctx.font = `600 ${h * 0.72}px ${PLATE_FONT}`
  track(ctx, h * 0.72 * 0.03)
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + band + (w - band) / 2 + h * 0.03, y + h / 2 + h * 0.03)
  track(ctx, 0)
  ctx.restore()
}

/** How wide the plate is drawn at height `h`. */
function plateWidth(ctx: Ctx, plate: string, h: number) {
  ctx.save()
  ctx.font = `600 ${h * 0.72}px ${PLATE_FONT}`
  track(ctx, h * 0.72 * 0.03)
  const w = h * 0.62 + ctx.measureText(formatPlate(plate)).width + h * 0.58
  track(ctx, 0)
  ctx.restore()
  return w
}

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>(res => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => res(null)
    img.src = src
  })

/** A fact: its label, its value, and how the value is coloured. */
interface Cell {
  k: string
  v: string
  tone?: 'accent' | 'warn' | 'quiet'
}
/**
 * A group: rows of a label and its value (`list`), facts two-up with the label over the value
 * (`pairs`), or the ownership history as a numbered list.
 */
type Section =
  | { title: string; kind: 'list'; cells: Cell[] }
  | { title: string; kind: 'pairs'; cells: Cell[] }
  | { title: string; kind: 'owners'; owners: { type: string; from: string; to: string }[] }

const bodyHeight = (s: Section, pair: number, line: number) =>
  s.kind === 'pairs' ? Math.ceil(s.cells.length / 2) * pair : s.kind === 'list' ? s.cells.length * line : Math.max(1, s.owners.length) * line
const columnHeight = (col: Section[], pair: number, line: number) =>
  col.reduce((h, s) => h + SEC_HEAD + bodyHeight(s, pair, line), 0) + Math.max(0, col.length - 1) * SEC_GAP

/** What goes on the card: on the right the worth and the ownership history, on the left every fact. */
function columns({ profile: p, estimate, hands }: CardInput): [Section[], Section[]] {
  const keep = (cells: (Cell | null | false)[]) => cells.filter((c): c is Cell => Boolean(c && c.v))
  const worth = keep([
    estimate && { k: 'הערכת שווי', v: fmtMoney(estimate.value), tone: 'accent' },
    estimate && { k: 'טווח', v: `${fmtMoney(estimate.low)} – ${fmtMoney(estimate.high)}` },
    p.newPrice && { k: `מחיר כחדש (${p.newPrice.year})`, v: fmtMoney(p.newPrice.price) },
    p.newPrice?.importer ? { k: 'יבואן', v: p.newPrice.importer } : null,
    !estimate && !p.newPrice && { k: 'אין מחיר כחדש במאגר', v: '–', tone: 'quiet' },
  ])
  const facts = keep([
    { k: 'רמת גימור', v: p.trim ?? '' },
    { k: 'שנת ייצור', v: p.year ? String(p.year) : '' },
    { k: 'עלה לכביש', v: p.onRoad ? monthYear(p.onRoad) : '' },
    { k: 'יד', v: hands ? fmtNum(hands) : '' },
    { k: 'ק״מ בטסט האחרון', v: p.testKm ? fmtNum(p.testKm) : '' },
    { k: 'טסט אחרון', v: p.lastTest ? fmtDate(p.lastTest) : '' },
    { k: 'רישיון בתוקף עד', v: p.licenceUntil ? fmtDate(p.licenceUntil) : '' },
    { k: 'בעלות היום', v: p.ownership ?? '' },
    { k: 'בעלות ראשונה', v: p.origin ?? '' },
    { k: 'דלק', v: p.fuel ?? '' },
    { k: 'צבע', v: p.color ?? '' },
    p.changes.length > 0 && { k: 'שינויים', v: p.changes.join(', '), tone: 'warn' },
  ])
  // each owner from the month they took it to the month the next one did; the last one to today
  const owners = p.owners.map((o, i) => ({ type: o.type || 'בעלות', from: monthYear(o.date), to: p.owners[i + 1] ? monthYear(p.owners[i + 1].date) : 'היום' }))
  const right: Section[] = [
    { title: 'שווי', kind: 'list', cells: worth },
    { title: owners.length ? `היסטוריית בעלות · ${owners.length}` : 'היסטוריית בעלות', kind: 'owners', owners },
  ]
  const left: Section[] = facts.length ? [{ title: 'פרטי הרכב', kind: 'pairs', cells: facts }] : []
  return [right, left]
}

const hair = (2 / PX) * PT // a 2 px hairline, in points

/** Draws one group (its title above it) with its right edge at `right`; returns where it ends. */
function drawSection(ctx: Ctx, s: Section, right: number, y: number, pair: number, line: number) {
  const x = right - COL
  text(ctx, s.title, right - IN, y + 21, { size: 12.5, weight: 600, color: C.second, max: COL - IN * 2 })
  y += SEC_HEAD
  const gh = bodyHeight(s, pair, line)
  rr(ctx, x, y, COL, gh, RADIUS)
  ctx.fillStyle = C.group
  ctx.fill()
  const inR = right - IN
  const inL = x + IN
  const rule = (ry: number, to = inR) => {
    ctx.fillStyle = C.hair
    ctx.fillRect(inL, ry - hair / 2, to - inL, hair)
  }

  if (s.kind === 'list') {
    // a label on the right, its value on the left
    s.cells.forEach((c, i) => {
      const ry = y + i * line
      const base = ry + line / 2 + 5
      // the value keeps its room (up to a little over half); the label takes the rest
      const vw = Math.min(measure(ctx, c.v, { size: c.tone === 'accent' ? 16 : 14.5, weight: 700 }), COL * 0.55)
      text(ctx, c.k, inR, base, { size: 14, color: c.tone === 'quiet' ? C.third : C.second, max: COL - IN * 2 - vw - 12 })
      text(ctx, c.v, inL, base, {
        size: c.tone === 'accent' ? 16 : 14.5,
        weight: c.tone === 'accent' ? 700 : 600,
        color: c.tone === 'accent' ? C.blue : c.tone === 'quiet' ? C.third : C.label,
        align: 'left',
        dir: dirOf(c.v),
        max: COL - IN * 2 - measure(ctx, c.k, { size: 14 }) - 12,
      })
      if (i > 0) rule(ry)
    })
  } else if (s.kind === 'pairs') {
    // two-up: the right column read first; a label over its value
    const cw = COL / 2
    ctx.fillStyle = C.hair
    ctx.fillRect(x + cw - hair / 2, y + 10, hair, gh - 20)
    s.cells.forEach((c, i) => {
      const r = Math.floor(i / 2)
      const col = i % 2
      const tx = right - col * cw - IN
      const max = cw - IN * 2 + 4
      const cy = y + r * pair
      const mid = cy + pair / 2
      text(ctx, c.k, tx, mid - 3, { size: 12, color: C.third, max })
      text(ctx, c.v, tx, mid + 14, { size: 14.5, weight: 600, color: c.tone === 'warn' ? C.red : C.label, dir: dirOf(c.v), max })
      if (r > 0 && col === 0) rule(cy)
    })
  } else if (!s.owners.length) {
    text(ctx, 'אין נתוני בעלות במאגר', inR, y + line / 2 + 5, { size: 14, color: C.third })
  } else {
    // the history: a numbered disc, how it was owned, and from when to when; today's owner in blue
    s.owners.forEach((o, i) => {
      const ry = y + i * line
      const mid = ry + line / 2
      const d = 22
      const cx = inR - d / 2
      const now = i === s.owners.length - 1
      ctx.beginPath()
      ctx.arc(cx, mid, d / 2, 0, Math.PI * 2)
      ctx.fillStyle = now ? C.blue : C.blueTint
      ctx.fill()
      text(ctx, String(i + 1), cx, mid + 4, { size: 11.5, weight: 700, color: now ? '#fff' : C.blue, align: 'center', dir: 'ltr' })
      const tx = inR - d - 9
      const period = `${o.from} – ${o.to}`
      text(ctx, period, inL, mid + 5, { size: 13, color: C.second, align: 'left', dir: 'ltr' })
      text(ctx, o.type, tx, mid + 5, { size: 14.5, weight: 600, max: tx - inL - measure(ctx, period, { size: 13 }) - 10 })
      if (i > 0) rule(ry, tx)
    })
  }
  return y + gh
}

/** Draws the card and returns it as a PNG. */
export async function renderCarCard(input: CardInput): Promise<Blob> {
  const { profile: p } = input
  // the page's fonts, so the picture is not drawn in a fallback face
  await Promise.all(
    [`700 28px ${FONT}`, `600 15px ${FONT}`, `500 15px ${FONT}`, `400 13px ${FONT}`, `600 14px ${LATIN}`, `600 20px ${PLATE_FONT}`].map(f =>
      document.fonts?.load(f).catch(() => null),
    ),
  )
  const icon = await loadImage('/icon.svg')

  // both columns end on one line: the 4:5's own bottom, or the taller column's when a long history
  // needs more (then the photo grows rather than crams). Each column's rows open up to reach it.
  const [right, left] = columns(input)
  const target = Math.max(MIN_PT - TOP - FOOT, columnHeight(right, PAIR, LINE), columnHeight(left, PAIR, LINE))
  const HPT = Math.ceil(TOP + target + FOOT)
  const sizes = (col: Section[]) => {
    const fixed = col.length * SEC_HEAD + Math.max(0, col.length - 1) * SEC_GAP
    const body = col.reduce((h, s) => h + bodyHeight(s, PAIR, LINE), 0)
    const g = body ? Math.min(1.6, Math.max(1, (target - fixed) / body)) : 1
    return [PAIR * g, LINE * g] as const
  }

  const canvas = document.createElement('canvas')
  canvas.width = PX
  canvas.height = Math.round(HPT * S)
  const ctx = canvas.getContext('2d')!
  ctx.scale(S, S) // everything below is in points
  ctx.fillStyle = C.ground
  ctx.fillRect(0, 0, PT, HPT)

  // ── the top line: the app on the left, the page and the day on the right ──
  if (icon) {
    ctx.save()
    rr(ctx, PAD, 20, 20, 20, 5)
    ctx.clip()
    ctx.drawImage(icon, PAD, 20, 20, 20)
    ctx.restore()
  }
  text(ctx, 'CarBoard', PAD + (icon ? 27 : 0), 35, { size: 13.5, weight: 600, align: 'left', dir: 'ltr', font: LATIN })
  text(ctx, `מחירון · ${fmtDate(new Date().toISOString().slice(0, 10))}`, RIGHT, 35, { size: 12.5, color: C.second })

  // ── the name across the top: make, the model; trim and year with the plate beside them ──
  const GW = PT - PAD * 2
  const model = p.model || p.make || formatPlate(p.plate)
  const make = p.model ? p.make : ''
  if (make) text(ctx, make, RIGHT, 70, { size: 14.5, weight: 500, color: C.second, max: GW })
  let size = 28
  while (size > 20 && measure(ctx, model, { size, weight: 700 }) > GW) size -= 1
  text(ctx, model, RIGHT, 101, { size, weight: 700, max: GW })
  const plateH = 26
  const plateW = plateWidth(ctx, p.plate, plateH)
  drawPlate(ctx, p.plate, PAD, 110, plateH)
  const sub = [p.trim, p.year ? String(p.year) : null].filter(Boolean).join(' · ')
  if (sub) text(ctx, sub, RIGHT, 129, { size: 13.5, color: C.second, max: GW - plateW - 14 })

  // ── the two columns: the right one read first ──
  for (const [col, edge] of [[right, RIGHT], [left, RIGHT - COL - COL_GAP]] as const) {
    const [pair, line] = sizes(col)
    let y = TOP
    for (const s of col) y = drawSection(ctx, s, edge, y, pair, line) + SEC_GAP
  }

  // ── a closing note ──
  text(ctx, 'הערכה בלבד ולא מחירון · מאגר הרכב הפתוח של משרד התחבורה', PT / 2, HPT - 16, { size: 10.5, color: C.third, align: 'center' })

  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('card render failed')
  return blob
}

/**
 * Sends the card through the phone's share sheet (the picture, with the link beside it). Where a
 * browser cannot share files, the picture is saved and the link copied instead.
 * Returns what happened, for a word on screen; null when the sheet was closed.
 */
export async function shareCarCard(input: CardInput): Promise<'shared' | 'saved' | null> {
  const blob = await renderCarCard(input)
  const digits = plateDigits(input.profile.plate)
  const file = new File([blob], `carboard-${digits}.png`, { type: 'image/png' })
  const name = [input.profile.make, input.profile.model].filter(Boolean).join(' ')
  const url = shareLink(digits)
  const text = `${name} ${formatPlate(digits)}${input.estimate ? ` · הערכת שווי ${fmtMoney(input.estimate.value)}` : ''}\n${url}`
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name, text })
      return 'shared'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return null
      // some browsers refuse files with text: fall through to saving
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
  await navigator.clipboard?.writeText(url).catch(() => null)
  return 'saved'
}
