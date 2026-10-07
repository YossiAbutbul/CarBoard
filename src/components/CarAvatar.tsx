import { useEffect, useState } from 'react'
import type { BodyType, Car } from '../types'

/*
 * Toy-style 3D car images (Microsoft Fluent Emoji, MIT, in /public/cars), repainted in the
 * car's colour. Each image's body is found by its hue range; only those pixels get the paint,
 * keeping their light and shade, so the glass, tyres and lights stay as they are.
 */

type Toy = 'car' | 'suv' | 'pickup' | 'van'

/**
 * Which pixels are body paint, per toy. Hue picks the body colour; saturation and lightness
 * keep out the glass (the jeep's glass is the same blue, but far more saturated), the tyres
 * (too dark) and the minibus's white sides (too light). `guard` keeps a window's glint out.
 */
interface PaintRule {
  hues: [number, number][]
  s: [number, number]
  l: [number, number]
  guard?: { box: [number, number, number, number]; lMax: number }
}

const TOYS: Record<Toy, { label: string; src: string; rule: PaintRule }> = {
  car: { label: 'רכב', src: '/cars/car.png', rule: { hues: [[315, 360], [0, 12]], s: [0.35, 1], l: [0.22, 0.82] } },
  suv: {
    label: 'ג׳יפ',
    src: '/cars/suv.png',
    rule: { hues: [[200, 235]], s: [0.3, 0.82], l: [0.24, 0.8], guard: { box: [55, 80, 121, 137], lMax: 0.47 } },
  },
  pickup: { label: 'טנדר', src: '/cars/pickup.png', rule: { hues: [[325, 360], [0, 12]], s: [0.35, 1], l: [0.22, 0.82] } },
  van: { label: 'מיני-בוס', src: '/cars/van.png', rule: { hues: [[258, 295]], s: [0.3, 1], l: [0.4, 0.8] } },
}

export const BODY_TYPES: BodyType[] = ['car', 'suv', 'pickup', 'van']
/** Older saved types map onto the four toys. */
const toyOf = (b: BodyType): Toy => (b === 'suv' || b === 'pickup' || b === 'van' ? b : 'car')
export const bodyLabel = (b: BodyType) => TOYS[toyOf(b)].label

export const PAINTS: { name: string; hex: string }[] = [
  { name: 'לבן', hex: '#f2f2ef' },
  { name: 'כסוף', hex: '#b7bdc6' },
  { name: 'אפור', hex: '#6a717b' },
  { name: 'שחור', hex: '#1c1e23' },
  { name: 'אדום', hex: '#c11a2c' },
  { name: 'בורדו', hex: '#6d1a2a' },
  { name: 'כחול', hex: '#1d4f9e' },
  { name: 'תכלת', hex: '#5a9fe3' },
  { name: 'ירוק', hex: '#2d6a4a' },
  { name: 'צהוב', hex: '#eebf2b' },
  { name: 'כתום', hex: '#e5702a' },
  { name: 'חום', hex: '#6b4a33' },
  { name: 'בז׳', hex: '#cbb592' },
]

/** The registry colour ("כסוף כהה", "לבן שנהב") as a paint hex. */
export function paintFromRegistry(color: string | null | undefined): string {
  if (!color) return '#b7bdc6'
  const hit = PAINTS.find(p => color.includes(p.name.replace('׳', '')))
  let hex = hit?.hex ?? '#b7bdc6'
  if (color.includes('כהה')) hex = shade(hex, -0.3)
  if (color.includes('בהיר')) hex = shade(hex, 0.3)
  return hex
}

const SUV_MODELS = /tucson|sportage|rav4|x-?trail|qashqai|cx-?5|cx-?3|cx-?30|kona|niro|duster|jeep|wrangler|compass|renegade|grand|land|range|tiguan|kodiaq|karoq|ateca|outlander|asx|vitara|jimny|santa|sorento|seltos|stonic|t-?roc|captur|kadjar|3008|2008|5008|c-?hr|hr-?v|cr-?v|forester|xv|x1|x3|x5|q3|q5|glc|gla|ev9|ioniq 5|model y/i
const VAN_MODELS = /carnival|sienna|odyssey|touran|sharan|caddy|berlingo|partner|kangoo|transit|vito|v-?class|staria|h-?1|multivan|alhambra/i
const PICKUP_MODELS = /hilux|ranger|d-?max|navara|l200|amarok|tundra|f-?150|frontier|bt-?50|musso/i

/** A first guess from the registry model name; the user can change it. */
export function guessBody(model: string | null | undefined): BodyType {
  if (!model) return 'car'
  if (PICKUP_MODELS.test(model)) return 'pickup'
  if (VAN_MODELS.test(model)) return 'van'
  if (SUV_MODELS.test(model)) return 'suv'
  return 'car'
}

export const carBody = (c: Pick<Car, 'body' | 'model'>): BodyType => c.body ?? guessBody(c.model)
export const carPaint = (c: Pick<Car, 'paint' | 'color'>): string => c.paint ?? paintFromRegistry(c.color)

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)))
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('')
}

/* ─── repainting ─── */

function rgb2hsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
  if (!s) return [l * 255, l * 255, l * 255]
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

const images = new Map<Toy, Promise<HTMLImageElement>>()
const painted = new Map<string, Promise<string>>()

function loadImage(toy: Toy) {
  if (!images.has(toy))
    images.set(
      toy,
      new Promise((res, rej) => {
        const img = new Image()
        img.onload = () => res(img)
        img.onerror = rej
        img.src = TOYS[toy].src
      }),
    )
  return images.get(toy)!
}

async function paintToy(toy: Toy, paint: string): Promise<string> {
  const img = await loadImage(toy)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0)
  const im = ctx.getImageData(0, 0, c.width, c.height)
  const d = im.data
  const r = TOYS[toy].rule
  const inBody = (h: number, s: number, l: number, px: number) => {
    if (s < r.s[0] || s > r.s[1] || l < r.l[0] || l > r.l[1]) return false
    if (!r.hues.some(([a, b]) => h >= a && h <= b)) return false
    if (r.guard) {
      const x = px % c.width
      const y = (px / c.width) | 0
      const [x0, y0, x1, y1] = r.guard.box
      if (x >= x0 && x <= x1 && y >= y0 && y <= y1 && l > r.guard.lMax) return false
    }
    return true
  }

  // the body's average lightness, so light and shade carry over to the new paint
  let sum = 0
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2])
    if (inBody(h, s, l, i / 4)) {
      sum += l
      n++
    }
  }
  const mean = n ? sum / n : 0.5
  const [ph, ps, pl] = rgb2hsl(parseInt(paint.slice(1, 3), 16), parseInt(paint.slice(3, 5), 16), parseInt(paint.slice(5, 7), 16))
  const contrast = pl < 0.15 || pl > 0.85 ? 0.55 : 0.9 // keep very dark and very light paints from clipping

  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    const [h, s, l] = rgb2hsl(d[i], d[i + 1], d[i + 2])
    if (!inBody(h, s, l, i / 4)) continue
    const nl = Math.min(0.97, Math.max(0.04, pl + (l - mean) * contrast))
    const [r, g, b] = hsl2rgb(ph, ps * Math.min(1, s / 0.75 + 0.1), nl)
    d[i] = r
    d[i + 1] = g
    d[i + 2] = b
  }
  ctx.putImageData(im, 0, 0)
  return c.toDataURL('image/png')
}

/** A toy car of `body` type painted `paint`. */
export function ToyCar({ body, paint, className }: { body: BodyType; paint: string; className?: string }) {
  const toy = toyOf(body)
  const key = `${toy}|${paint}`
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!painted.has(key)) painted.set(key, paintToy(toy, paint))
    painted
      .get(key)!
      .then(u => live && setUrl(u))
      .catch(() => live && setUrl(TOYS[toy].src))
    return () => {
      live = false
    }
  }, [key, toy, paint])
  return url ? <img className={`toy-car ${className ?? ''}`} src={url} alt={`${TOYS[toy].label}`} /> : <span className={`toy-car loading ${className ?? ''}`} />
}

/** The toy of a saved car. */
export function CarToy({ car, className }: { car: Pick<Car, 'body' | 'model' | 'paint' | 'color'>; className?: string }) {
  return <ToyCar body={carBody(car)} paint={carPaint(car)} className={className} />
}
