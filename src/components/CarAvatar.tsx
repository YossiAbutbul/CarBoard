import { useEffect, useState } from 'react'
import type { BodyType, Car } from '../types'

/*
 * Toy-style 3D car pictures (Microsoft Fluent Emoji "Color" SVGs, MIT, in /public/cars),
 * repainted in the car's colour. Each car's body is a known list of colour codes in its SVG;
 * we swap exactly those for shades of the paint, so the glass, wheels and lights stay as
 * drawn and the edges stay sharp.
 */

type Toy = 'car' | 'suv' | 'pickup' | 'van'

const TOYS: Record<Toy, { label: string; src: string; viewBox: string; body: string[] }> = {
  car: {
    label: 'רכב',
    src: '/cars/car.svg',
    viewBox: '1.4 9.4 29.2 20.2',
    body: ['#94154B', '#DF378A', '#ED334E', '#FF4D5A', '#64023B', '#7E0B55', '#D32374', '#B60160'],
  },
  suv: {
    label: 'ג׳יפ',
    src: '/cars/suv.svg',
    viewBox: '1.4 6.4 29.2 24.2',
    // #0369DA is the top of the glass gradient, so it stays out
    body: ['#4A8FD6', '#4377DA', '#4379D8', '#131D7E', '#26439E', '#3C6FA9', '#5190E3', '#122773', '#355FC4', '#4283D7', '#3A74BE'],
  },
  pickup: {
    label: 'טנדר',
    src: '/cars/pickup.svg',
    viewBox: '1.4 10.5 29.2 20.1',
    body: [
      '#F95963', '#D8445D', '#E24658', '#D82533', '#DF1A39', '#C7385B', '#E5393E', '#C92725', '#923545', '#7A174D', '#FF5755', '#530817',
      '#6D1727', '#DB4663', '#F94947', '#7F0D28', '#4D0615', '#6C1828', '#FF406D', '#D61049', '#AC2038', '#FC5760', '#D31D2F',
    ],
  },
  van: {
    label: 'מיני-בוס',
    src: '/cars/van.svg',
    viewBox: '1.5 10.5 29 20.1',
    // body and stripe; the wheel centres (#E8E4EF, #CABFD4) stay out
    body: ['#CFC0DB', '#E7D6F4', '#E0C7F5', '#5A5080', '#8169C1', '#9A6FE2', '#B288FA'],
  },
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
  { name: 'סגול', hex: '#5b3f8c' },
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

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')
}

const sources = new Map<Toy, Promise<string>>()
const painted = new Map<string, Promise<string>>()

const loadSvg = (toy: Toy) => {
  if (!sources.has(toy)) sources.set(toy, fetch(TOYS[toy].src).then(r => r.text()))
  return sources.get(toy)!
}

/** The toy's SVG with its body colours swapped for shades of `paint`, as a data URL. */
async function paintToy(toy: Toy, paint: string): Promise<string> {
  const t = TOYS[toy]
  let svg = (await loadSvg(toy)).replace(/viewBox="[^"]*"/, `viewBox="${t.viewBox}"`)
  // keep the body's light and shade: each colour keeps its distance from the body's average lightness
  const shades = t.body.map(hexToHsl)
  const mean = shades.reduce((n, [, , l]) => n + l, 0) / shades.length
  const [ph, ps, pl] = hexToHsl(paint)
  const contrast = pl < 0.15 || pl > 0.85 ? 0.55 : 0.85 // keep very dark and very light paints from clipping
  const repaint = (s: number, l: number) => hslToHex(ph, ps * Math.min(1, 0.55 + s * 0.5), Math.min(0.96, Math.max(0.05, pl + (l - mean) * contrast)))
  t.body.forEach((hex, i) => {
    const [, s, l] = shades[i]
    svg = svg.replace(new RegExp(hex, 'gi'), repaint(s, l))
  })

  // The soft inner shadows and rim glows are filters whose colour is written as numbers
  // ("0 0 0 0 R  0 0 0 0 G  0 0 0 0 B  0 0 0 A 0"). Tint the ones in the body's hue range too.
  const hues = shades.filter(([, s]) => s > 0.2).map(([h]) => h)
  const inBodyHue = (h: number) => hues.some(b => Math.min(Math.abs(h - b), 360 - Math.abs(h - b)) < 22)
  svg = svg.replace(/(<feColorMatrix[^>]*values=")([^"]+)(")/g, (all, pre: string, values: string, post: string) => {
    const v = values.trim().split(/[\s,]+/).map(Number)
    if (v.length !== 20 || v[0] || v[1] || v[2] || v[3]) return all // only flat-colour matrices
    const hex = '#' + [v[4], v[9], v[14]].map(c => Math.round(Math.min(1, Math.max(0, c)) * 255).toString(16).padStart(2, '0')).join('')
    const [h, s, l] = hexToHsl(hex)
    if (s < 0.2 || !inBodyHue(h)) return all
    const [r, g, b] = [1, 3, 5].map(k => parseInt(repaint(s, l).slice(k, k + 2), 16) / 255)
    v[4] = +r.toFixed(4)
    v[9] = +g.toFixed(4)
    v[14] = +b.toFixed(4)
    return pre + v.join(' ') + post
  })
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
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
      .catch(() => live && setUrl(null))
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
