/*
 * Reading a fuel receipt (a PDF from the station's app, or a photo of the paper one) on the phone
 * itself: the page is drawn to a picture, Tesseract (free, runs in the browser) reads its text, and
 * the numbers are found by what they must satisfy: liters × price per liter = total. That holds on
 * every receipt, whatever the station calls each line, and survives OCR mixing up a word or two.
 * When it does not add up (a line unreadable, a photo half in shadow), the labels each station uses,
 * the units next to the numbers and the VAT lines fill in; a photo that still does not add up is read
 * a second time, with its shadows evened out. Nothing is uploaded and the file is not kept.
 */

export interface ScannedFuel {
  liters: number | null
  perLiter: number | null
  total: number | null
  date: string | null // YYYY-MM-DD
  time: string | null // HH:MM
  station: string | null
}

const STATIONS = ['סונול', 'פז', 'דלק', 'דור אלון', 'אלון', 'טן', 'ten', 'yellow', 'ילו', 'סדש', 'אמישראגז', 'דלקן']

/** Every number in the text: "30.849", "239,08" (a decimal comma), "1,234.5" (a thousands comma). */
function numbers(text: string) {
  const out: number[] = []
  for (const m of text.matchAll(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?/g)) {
    let s = m[0]
    if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
    else s = s.replace(',', '.')
    const n = Number(s)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

// what a fuel receipt's numbers can be
const isLiters = (n: number) => n >= 1.5 && n <= 200
const isPrice = (n: number) => n >= 3 && n <= 15
const isTotal = (n: number) => n >= 5 && n <= 3000
const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
const fits = (l: number, p: number, t: number) => Math.abs(l * p - t) <= Math.max(0.06, t * 0.003)
const isFuelPrice = (n: number) => n >= 4 && n <= 12 // what a liter has cost, and will (₪)

// digits OCR mixes up on receipts (a pale 3 reads as 8, a 7 as 0 or 1...)
const LOOKALIKE: Record<string, string> = { '0': '78', '1': '7', '3': '8', '5': '6', '6': '58', '7': '01', '8': '306', '9': '4' }
/** A number as read, and every version of it with one look-alike digit swapped. */
function variants(s: string) {
  const out = [{ n: Number(s), swaps: 0 }]
  for (let i = 0; i < s.length; i++)
    for (const d of LOOKALIKE[s[i]] ?? '') out.push({ n: Number(s.slice(0, i) + d + s.slice(i + 1)), swaps: 1 })
  return out.filter(v => Number.isFinite(v.n))
}

// the names stations give each line (Sonol, Paz, Delek, Ten, Dor Alon, Yellow...), in Hebrew and English
const SHEKEL = `ש["״׳']?ח|₪|nis|ils`
const LABEL = {
  total: /(?:סה["״׳']?כ(?:\s*ל?תשלום)?|סכום(?:\s*ל?תשלום)?|לתשלום|שולם|total|amount|to\s*pay)/,
  price: /(?:מחיר\s*(?:ל?ליטר|ליח(?:ידה|['׳])?)|תעריף|price|rate)/,
  liters: /(?:כמות(?:\s*\(?ליטר(?:ים)?\)?)?|ליטרים|נפח|qty|quantity|volume|liters?|litres?)/,
  net: /(?:ללא\s*מע["״׳']?מ|לפני\s*מע["״׳']?מ|net)/,
}

/** The numbers right after a label, on the same line ("סה"כ: 250.12", "Total ₪ 250.12"). */
function afterLabel(text: string, label: RegExp, ok: (n: number) => boolean) {
  const re = new RegExp(`${label.source}[^\\d\\n]{0,12}(\\d[\\d.,]*)`, 'gi')
  return [...text.matchAll(re)].map(m => numbers(m[1])[0]).filter((n): n is number => n != null && ok(n))
}

/** The receipt's numbers and details from its text, and whether they check out (liters × price = total). */
export function readFuel(text: string): { fuel: ScannedFuel; sure: boolean } {
  const nums = numbers(text)

  // what the labels say; the total to pay is the biggest "total" line (others are before VAT, or the VAT)
  const labelTotals = afterLabel(text, LABEL.total, isTotal)
  const labelTotal = labelTotals.length ? Math.max(...labelTotals) : null
  const labelPrice = afterLabel(text, LABEL.price, isPrice)[0] ?? null
  // liters: by their label, or by the unit after them ("33.217 ליטר", "40.12 L")
  const unitLiters = [...text.matchAll(/(\d[\d.,]*)\s*(?:ליטר(?!\s*[/:])|ל['׳](?=\s|$)|ltr|lit\b|l\b)/gim)].map(m => numbers(m[1])[0]).filter(n => n != null && isLiters(n))
  const labelLiters = [...afterLabel(text, LABEL.liters, isLiters), ...unitLiters].find(n => !Number.isInteger(n)) ?? null
  // price by its unit: "7.530 ש"ח/ליטר", "7.53 ₪/ל'"
  const unitPrice = [...text.matchAll(new RegExp(`(\\d[\\d.,]*)\\s*(?:${SHEKEL})?\\s*/\\s*(?:ליטר|ל['׳]|l\\b|ltr)`, 'gi'))].map(m => numbers(m[1])[0]).find(n => n != null && isPrice(n)) ?? null
  // the total, when its line is unreadable: before VAT plus the VAT (at the rate printed, else 18%)
  const net = afterLabel(text, LABEL.net, isTotal)[0]
  const rate = numbers(text.match(/(\d{2}(?:[.,]\d+)?)\s*%|%\s*(\d{2}(?:[.,]\d+)?)/)?.slice(1).find(Boolean) ?? '').find(n => n >= 10 && n <= 25) ?? 18
  const vatTotal = net != null ? round(net * (1 + rate / 100), 2) : null

  // the three that fit together: liters × price = total. Small numbers elsewhere on the slip can fit
  // by chance (1.06 × 7.53 ≈ 8), so the match must be for one of the receipt's totals: its total line,
  // the VAT lines added up, or another "total" line (one of them may be misread), in that order.
  const wants = [...new Set([labelTotal, vatTotal, ...[...labelTotals].sort((x, y) => y - x)].filter((n): n is number => n != null))]
  const ls = nums.filter(n => isLiters(n) && !Number.isInteger(n))
  const ps = nums.filter(isPrice)
  const ts = nums.filter(n => isTotal(n) && n >= 10)
  /** The best match as read, for a total (or, with none known, the biggest total that fits). */
  const asRead = (want: number | null) => {
    let found: { l: number; p: number; t: number; err: number } | null = null
    for (const l of ls)
      for (const p of ps) {
        if (p === l) continue
        for (const t of ts) {
          if (t === l || t === p || !fits(l, p, t)) continue
          if (want != null && Math.abs(t - want) > 0.05) continue
          const err = Math.abs(l * p - t)
          if (!found || t > found.t || (t === found.t && err < found.err)) found = { l, p, t, err }
        }
      }
    return found
  }
  // a look-alike digit swapped in the liters or the price line: each number is tried with one digit
  // swapped; it must fit the total to the agora (the receipt's own rounding), the fewest swaps win,
  // and only when that answer is the only one
  const raw = [...text.matchAll(/\d+[.,]\d+/g)].map(m => m[0].replace(',', '.'))
  const all = raw.flatMap((s, i) => variants(s).map(v => ({ ...v, i })))
  const repaired = (want: number) => {
    let fix: { l: number; p: number; swaps: number } | null = null
    let tie = false
    for (const l of all.filter(v => isLiters(v.n) && !Number.isInteger(v.n)))
      for (const p of all.filter(v => isFuelPrice(v.n))) {
        if (l.i === p.i || Math.abs(l.n * p.n - want) > 0.03) continue
        const swaps = l.swaps + p.swaps
        if (!fix || swaps < fix.swaps) [fix, tie] = [{ l: l.n, p: p.n, swaps }, false]
        else if (swaps === fix.swaps && (l.n !== fix.l || p.n !== fix.p)) tie = true
      }
    return fix && !tie ? { l: fix.l, p: fix.p, t: want, err: 0 } : null
  }
  let best: { l: number; p: number; t: number; err: number } | null = null
  for (const w of wants) if ((best = asRead(w) ?? repaired(w))) break
  if (!wants.length) best = asRead(null)
  const want = best?.t ?? wants[0] ?? null

  let total: number | null = best?.t ?? want
  let perLiter: number | null = best?.p ?? labelPrice ?? unitPrice
  let liters: number | null = best?.l ?? labelLiters
  let sure = Boolean(best)
  if (!best) {
    if (liters != null && perLiter != null && total != null) {
      // all three read: they agree, or the liters line is the one misread (the price and total are
      // short, clear numbers; the liters line has three decimals and is the one OCR garbles)
      sure = fits(liters, perLiter, total)
      if (!sure) liters = round(total / perLiter, 2)
    } else if (total != null && perLiter != null) liters = round(total / perLiter, 2)
    else if (total != null && liters != null) perLiter = round(total / liters, 3)
    else if (liters != null && perLiter != null) total = round(liters * perLiter, 2)
    // a price no liter costs means the liters (or the price) were misread: both are left empty, to fill in
    if (perLiter != null && !isFuelPrice(perLiter)) {
      perLiter = null
      liters = null
    }
    if (liters != null && !isLiters(liters)) liters = null
  }

  // date: 16/09/26 or 16.09.2026
  let date: string | null = null
  const d = text.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/)
  if (d) {
    const y = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3])
    const mo = Number(d[2])
    const day = Number(d[1])
    if (mo >= 1 && mo <= 12 && day >= 1 && day <= 31 && y >= 2015 && y <= 2100) date = `${y}-${String(mo).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  // time: 09:19:50 or 9:19
  const tm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\b/)
  const time = tm ? `${tm[1].padStart(2, '0')}:${tm[2]}` : null
  // the station: the first line with its brand as a word of its own (not inside "שתדלקתם"), in full
  // when the line is short ("דלק שלי אנרגיה"), else the brand alone
  let station: string | null = null
  for (const line of text.split('\n')) {
    const brand = STATIONS.find(s => new RegExp(`(^|[^א-תa-z])${s}($|[^א-תa-z])`, 'i').test(line))
    if (!brand) continue
    const name = line.replace(/[^א-תa-z\s"'״׳-]/gi, ' ').replace(/\s+/g, ' ').trim()
    const plain = name.length <= 30 && name.toLowerCase() !== brand.toLowerCase() ? name : brand
    station = plain.toLowerCase() === 'ten' ? 'טן' : plain.toLowerCase() === 'yellow' ? 'ילו' : plain
    break
  }

  return { fuel: { liters, perLiter, total, date, time, station }, sure }
}

/** The receipt's numbers and details from its text (the OCR output). */
export const parseFuelReceipt = (text: string): ScannedFuel => readFuel(text).fuel

/**
 * Draws the file (PDF: its first page; or a photo) big enough for OCR. A photo is drawn grey with a
 * little more contrast ("soft"), or with its lighting evened out ("flat": each point against the paper
 * around it, so a shadow across the slip turns as white as the rest).
 */
async function toCanvas(file: Blob, look: 'soft' | 'flat' = 'soft'): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  if (file.type === 'application/pdf') {
    const { openPdf } = await import('./pdf')
    const url = URL.createObjectURL(file)
    try {
      const page = await (await openPdf(url)).getPage(1)
      const base = page.getViewport({ scale: 1 })
      const vp = page.getViewport({ scale: Math.min(6, 1800 / base.width) })
      c.width = vp.width
      c.height = vp.height
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, c.width, c.height)
      await page.render({ canvas: c, canvasContext: ctx, viewport: vp }).promise
    } finally {
      URL.revokeObjectURL(url)
    }
    return c
  }
  const img = await createImageBitmap(file)
  const scale = Math.min(1, 2200 / Math.max(img.width, img.height))
  c.width = Math.round(img.width * scale)
  c.height = Math.round(img.height * scale)
  const ctx = c.getContext('2d', { willReadFrequently: look === 'flat' })!
  // grey and a little more contrast: thermal paper photos are often pale
  ctx.filter = look === 'soft' ? 'grayscale(1) contrast(1.4)' : 'grayscale(1)'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  img.close()
  if (look === 'flat') flatten(c)
  return c
}

/** Evens out the lighting: the paper around each point (a blurred copy) is made white, the ink black. */
function flatten(c: HTMLCanvasElement) {
  const { width: w, height: h } = c
  const small = document.createElement('canvas')
  small.width = Math.max(8, Math.round(w / 32))
  small.height = Math.max(8, Math.round(h / 32))
  small.getContext('2d')!.drawImage(c, 0, 0, small.width, small.height)
  const paper = document.createElement('canvas')
  paper.width = w
  paper.height = h
  const pctx = paper.getContext('2d', { willReadFrequently: true })!
  pctx.drawImage(small, 0, 0, w, h)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, w, h)
  const bg = pctx.getImageData(0, 0, w, h).data
  const px = img.data
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / Math.max(1, bg[i]) // 1 on paper, well under it on ink, in light or in shadow
    const v = Math.max(0, Math.min(255, ((r - 0.5) / 0.4) * 255))
    px[i] = px[i + 1] = px[i + 2] = v
  }
  ctx.putImageData(img, 0, 0)
}

/** Reads a receipt file. The OCR engine and its Hebrew data load on first use (a few MB, then cached). */
export async function scanFuelReceipt(file: Blob, onProgress?: (p: number) => void): Promise<ScannedFuel & { text: string }> {
  const photo = file.type !== 'application/pdf'
  // a photo may be read twice: the first reading fills most of the bar, the second the rest
  let span: [number, number] = photo ? [0, 0.6] : [0, 1]
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['heb', 'eng'], 1, {
    logger: m => m.status === 'recognizing text' && onProgress?.(span[0] + m.progress * (span[1] - span[0])),
  })
  try {
    const read = async (look: 'soft' | 'flat') => {
      const text = (await worker.recognize(await toCanvas(file, look))).data.text
      return { ...readFuel(text), text }
    }
    const first = await read('soft')
    if (first.sure || !photo) return { ...first.fuel, text: first.text }
    span = [0.6, 1]
    const second = await read('flat')
    // the numbers from the reading that adds up (else the first); the date, time and station from the
    // first reading, any gaps filled from the second
    const nums = second.sure ? second.fuel : first.fuel
    const pick = <K extends keyof ScannedFuel>(k: K) => first.fuel[k] ?? second.fuel[k]
    return {
      liters: nums.liters ?? pick('liters'),
      perLiter: nums.perLiter ?? pick('perLiter'),
      total: nums.total ?? pick('total'),
      date: pick('date'),
      time: pick('time'),
      station: pick('station'),
      text: second.sure ? second.text : first.text,
    }
  } finally {
    await worker.terminate()
  }
}
