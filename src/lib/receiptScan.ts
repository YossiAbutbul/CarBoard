/*
 * Reading a fuel receipt (a PDF from the station's app, or a photo of the paper one) on the phone
 * itself: the page is drawn to a picture, Tesseract (free, runs in the browser) reads its text, and
 * the numbers are found by what they must satisfy: liters × price per liter = total. That holds on
 * every receipt, whatever the station calls each line, and survives OCR mixing up a word or two.
 * Nothing is uploaded and the file is not kept.
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

/** The receipt's numbers and details from its text (the OCR output). */
export function parseFuelReceipt(text: string): ScannedFuel {
  const nums = numbers(text)
  // the three that fit together: liters × price per liter ≈ total (a few agorot of rounding)
  let best: { l: number; p: number; t: number; err: number } | null = null
  const liters = nums.filter(n => n >= 1 && n <= 200 && !Number.isInteger(n))
  const prices = nums.filter(n => n >= 3 && n <= 15)
  const totals = nums.filter(n => n >= 5 && n <= 3000)
  for (const l of liters)
    for (const p of prices) {
      if (p === l) continue
      for (const t of totals) {
        if (t === l || t === p) continue
        const err = Math.abs(l * p - t)
        if (err <= Math.max(0.06, t * 0.003) && (!best || err < best.err)) best = { l, p, t, err }
      }
    }

  // without a full match, take what the labels say
  const after = (re: RegExp) => {
    const m = text.match(re)
    return m ? numbers(m[1])[0] ?? null : null
  }
  const perLiter = best?.p ?? after(/(?:מחיר\s*ל?ליטר|ליטר\s*:)[^\d]{0,6}([\d.,]+)/)
  const total = best?.t ?? after(/(?:סה["״׳']?כ(?:\s*ב?ש["״׳']?ח)?|לתשלום|total)[^\d]{0,8}([\d.,]+)/i)
  const litersFound = best?.l ?? (perLiter && total ? Math.round((total / perLiter) * 100) / 100 : null)

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
  const lower = text.toLowerCase()
  const station = STATIONS.find(s => lower.includes(s.toLowerCase())) ?? null

  return { liters: litersFound, perLiter, total, date, time, station: station && station === 'ten' ? 'טן' : station === 'yellow' ? 'ילו' : station }
}

/** Draws the file (PDF: its first page; or a photo) big enough for OCR. */
async function toCanvas(file: Blob): Promise<HTMLCanvasElement> {
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
  const ctx = c.getContext('2d')!
  // grey and a little more contrast: thermal paper photos are often pale
  ctx.filter = 'grayscale(1) contrast(1.4)'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  img.close()
  return c
}

/** Reads a receipt file. The OCR engine and its Hebrew data load on first use (a few MB, then cached). */
export async function scanFuelReceipt(file: Blob, onProgress?: (p: number) => void): Promise<ScannedFuel & { text: string }> {
  const canvas = await toCanvas(file)
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['heb', 'eng'], 1, {
    logger: m => m.status === 'recognizing text' && onProgress?.(m.progress),
  })
  try {
    const { data } = await worker.recognize(canvas)
    return { ...parseFuelReceipt(data.text), text: data.text }
  } finally {
    await worker.terminate()
  }
}
