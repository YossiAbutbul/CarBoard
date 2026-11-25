import { fmtDate, fmtMoney, fmtNum } from './i18n'
import { formatPlate, plateDigits, type CarProfile } from './govil'
import type { ValueEstimate } from '../domain/value'

/*
 * "מחירון" as a picture to send, made for a phone: the shape of a phone's screen (9:19.5; taller only
 * when a long ownership history needs the room), laid out in iOS points and drawn at 1080 px wide, so
 * opened full screen it reads at the sizes iOS reads at — 17 pt text, 13 pt labels.
 * Set the way iOS sets details: a quiet grey ground, the car's name at the top, then grouped white
 * lists under small titles — what it is worth, every fact the registry gives, the whole ownership
 * history in order. One accent colour; order and spacing carry the hierarchy, not size.
 * The link sent beside it opens the same lookup in the app.
 */

const PX = 1080 // the photo's width in pixels
const PT = 390 // …and in points: a phone's width
const S = PX / PT
const MIN_PT = Math.round((PT * 19.5) / 9) // a phone screen's height

const PAD = 16 // the margin
const GW = PT - PAD * 2 // a group's width
const RIGHT = PT - PAD
const IN = 16 // inside a group
const RADIUS = 20
const PAIR = 54 // a two-up cell: a label over its value
const LINE = 46 // a list row
const SEC_HEAD = 34 // a section title's room above its group
const SEC_GAP = 14 // between one group and the next title
const TOP = 178 // where the first section starts, under the name
const FOOT = 46 // the closing note

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
/** A group: facts two-up (a label over its value), or the ownership history as a numbered list. */
type Section = { title: string; kind: 'pairs'; cells: Cell[] } | { title: string; kind: 'owners'; owners: { type: string; from: string; to: string }[] }

const height = (s: Section, pair: number, line: number) =>
  s.kind === 'pairs' ? Math.ceil(s.cells.length / 2) * pair : Math.max(1, s.owners.length) * line

/** What goes on the card, in order: the worth, every fact, the whole ownership history. */
function sections({ profile: p, estimate, hands }: CardInput): Section[] {
  const keep = (cells: (Cell | null | false)[]) => cells.filter((c): c is Cell => Boolean(c && c.v))
  const worth = keep([
    estimate && { k: 'הערכת שווי', v: fmtMoney(estimate.value), tone: 'accent' },
    estimate && { k: 'טווח', v: `${fmtMoney(estimate.low)} – ${fmtMoney(estimate.high)}` },
    p.newPrice && { k: `מחיר כחדש (${p.newPrice.year})`, v: fmtMoney(p.newPrice.price) },
    p.newPrice?.importer ? { k: 'יבואן', v: p.newPrice.importer } : null,
    !estimate && !p.newPrice && { k: 'הערכת שווי', v: 'אין מחיר כחדש במאגר', tone: 'quiet' },
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
  const out: Section[] = [
    { title: 'שווי', kind: 'pairs', cells: worth },
    { title: 'פרטי הרכב', kind: 'pairs', cells: facts },
    { title: owners.length ? `היסטוריית בעלות · ${owners.length}` : 'היסטוריית בעלות', kind: 'owners', owners },
  ]
  return out.filter(s => s.kind === 'owners' || s.cells.length)
}

/** Draws the card and returns it as a PNG. */
export async function renderCarCard(input: CardInput): Promise<Blob> {
  const { profile: p } = input
  // the page's fonts, so the picture is not drawn in a fallback face
  await Promise.all(
    [`700 28px ${FONT}`, `600 16px ${FONT}`, `500 16px ${FONT}`, `400 13px ${FONT}`, `600 14px ${LATIN}`, `600 22px ${PLATE_FONT}`].map(f =>
      document.fonts?.load(f).catch(() => null),
    ),
  )
  const icon = await loadImage('/icon.svg')

  // the room the groups need; on a short card the rows open up a little to fill the screen, and a
  // long history makes the photo taller rather than cramming it
  const secs = sections(input)
  const fixed = TOP + secs.length * SEC_HEAD + (secs.length - 1) * SEC_GAP + FOOT
  const base = secs.reduce((n, s) => n + height(s, PAIR, LINE), 0)
  const grow = Math.min(1.18, Math.max(1, (MIN_PT - fixed) / base))
  const pair = PAIR * grow
  const line = LINE * grow
  const HPT = Math.max(MIN_PT, Math.ceil(fixed + base * grow))

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
    rr(ctx, PAD, 22, 22, 22, 5.5)
    ctx.clip()
    ctx.drawImage(icon, PAD, 22, 22, 22)
    ctx.restore()
  }
  text(ctx, 'CarBoard', PAD + (icon ? 29 : 0), 38, { size: 14, weight: 600, align: 'left', dir: 'ltr', font: LATIN })
  text(ctx, `מחירון · ${fmtDate(new Date().toISOString().slice(0, 10))}`, RIGHT, 38, { size: 13, color: C.second })

  // ── the name: make, then the model across the full width; trim and year, the plate beside them ──
  const model = p.model || p.make || formatPlate(p.plate)
  const make = p.model ? p.make : ''
  if (make) text(ctx, make, RIGHT, 84, { size: 15, weight: 500, color: C.second, max: GW })
  let size = 28
  while (size > 20 && measure(ctx, model, { size, weight: 700 }) > GW) size -= 1
  text(ctx, model, RIGHT, 116, { size, weight: 700, max: GW })
  const plateH = 30
  const plateW = plateWidth(ctx, p.plate, plateH)
  drawPlate(ctx, p.plate, PAD, 130, plateH)
  const sub = [p.trim, p.year ? String(p.year) : null].filter(Boolean).join(' · ')
  if (sub) text(ctx, sub, RIGHT, 150, { size: 14, color: C.second, max: GW - plateW - 14 })

  // ── the groups ──
  const hair = 1 / S * 2 // a 2 px hairline
  let y = TOP
  for (const s of secs) {
    text(ctx, s.title, RIGHT - IN, y + 24, { size: 13, weight: 600, color: C.second })
    y += SEC_HEAD
    const gh = height(s, pair, line)
    rr(ctx, PAD, y, GW, gh, RADIUS)
    ctx.fillStyle = C.group
    ctx.fill()

    if (s.kind === 'pairs') {
      // two-up: the right column read first; a label over its value (a lone cell takes the whole width)
      const cols = s.cells.length > 1 ? 2 : 1
      const cw = GW / cols
      ctx.fillStyle = C.hair
      if (cols === 2) ctx.fillRect(PAD + cw - hair / 2, y + 10, hair, gh - 20)
      s.cells.forEach((c, i) => {
        const r = Math.floor(i / cols)
        const col = i % cols
        const x = RIGHT - col * cw - IN
        const max = cw - IN * 2
        const cy = y + r * pair
        const mid = cy + pair / 2
        text(ctx, c.k, x, mid - 3, { size: 12.5, color: C.third, max })
        text(ctx, c.v, x, mid + 16, {
          size: c.tone === 'accent' ? 17 : 15.5,
          weight: c.tone === 'accent' ? 700 : 600,
          color: c.tone === 'accent' ? C.blue : c.tone === 'warn' ? C.red : c.tone === 'quiet' ? C.third : C.label,
          dir: dirOf(c.v),
          max,
        })
        if (r > 0 && col === 0) {
          ctx.fillStyle = C.hair
          ctx.fillRect(PAD + IN, cy - hair / 2, GW - IN * 2, hair)
        }
      })
    } else if (!s.owners.length) {
      text(ctx, 'אין נתוני בעלות במאגר', RIGHT - IN, y + line / 2 + 6, { size: 15.5, color: C.third })
    } else {
      // the history: a numbered disc, how it was owned, and from when to when
      s.owners.forEach((o, i) => {
        const ry = y + i * line
        const mid = ry + line / 2
        const d = 24
        const cx = RIGHT - IN - d / 2
        ctx.beginPath()
        ctx.arc(cx, mid, d / 2, 0, Math.PI * 2)
        ctx.fillStyle = i === s.owners.length - 1 ? C.blue : C.blueTint
        ctx.fill()
        text(ctx, String(i + 1), cx, mid + 4.5, { size: 12.5, weight: 700, color: i === s.owners.length - 1 ? '#fff' : C.blue, align: 'center', dir: 'ltr' })
        const tx = RIGHT - IN - d - 10
        text(ctx, o.type, tx, mid + 5.5, { size: 15.5, weight: 600, max: GW / 2 - d })
        text(ctx, `${o.from} – ${o.to}`, PAD + IN, mid + 5.5, { size: 14, color: C.second, align: 'left', dir: 'ltr' })
        if (i > 0) {
          ctx.fillStyle = C.hair
          ctx.fillRect(PAD + IN, ry - hair / 2, tx - PAD - IN, hair)
        }
      })
    }
    y += gh + SEC_GAP
  }

  // ── a closing note ──
  text(ctx, 'הערכה בלבד ולא מחירון · מאגר הרכב הפתוח של משרד התחבורה', PT / 2, HPT - 20, { size: 11, color: C.third, align: 'center' })

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
