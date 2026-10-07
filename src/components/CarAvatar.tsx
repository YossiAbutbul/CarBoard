import { useId } from 'react'
import type { BodyType, Car } from '../types'

/**
 * Side-view car illustrations, front to the left, in a 240×96 box with the ground at y=90.
 * Each body type gives its outline, its glass, its wheels and where the details go;
 * the shading, arches, pillars, doors, lights and alloy wheels are drawn the same way for all.
 */
interface Shape {
  label: string
  body: string // outer paint outline
  glass: string // the whole greenhouse
  pillars: [number, number][] // dark pillar bands across the glass (x from, x to)
  wheels: [number, number] // front and rear wheel centre x
  r: number // tyre radius
  belt: number // window line y
  sill: number // where the lower body starts (darker)
  doors: number[] // door shut lines (x)
  handles: number[] // door handle x
  mirror: [number, number] // mirror base (x, y)
  head: string
  drl: string // daytime running light stroke
  tail: string
  extra?: { d: string; kind: 'line' | 'rail' | 'cladding' }[]
}

const SHAPES: Record<BodyType, Shape> = {
  small: {
    label: 'קטן',
    body: 'M16 70 C16 61 22 57 34 55 L70 50 C82 34 96 22 118 20 L176 20 C192 20 200 28 206 42 L212 58 C214 64 214 72 212 76 C211 79 209 80 206 80 L16 80 C14 80 14 78 16 70 Z',
    glass: 'M76 50 C88 35 100 25 118 24 L172 24 C186 24 194 32 200 48 L200 50 Z',
    pillars: [[127, 133], [164, 178]],
    wheels: [60, 172],
    r: 17,
    belt: 50,
    sill: 73,
    doors: [84, 130, 166],
    handles: [114, 152],
    mirror: [80, 50],
    head: 'M18 59 C24 56 34 55 41 55 L39 61 C30 62 22 63 18 63 Z',
    drl: 'M21 59.5 C27 57.5 33 57 38 57',
    tail: 'M206 42 L212 57 L209 59 L203 46 Z',
  },
  family: {
    label: 'משפחתי',
    body: 'M10 70 C10 60 16 56 28 54 L70 49 C84 34 100 27 122 26 L160 26 C178 27 192 36 204 48 L222 52 C230 54 232 60 231 68 L230 76 C230 79 228 80 225 80 L12 80 C10 80 10 78 10 70 Z',
    glass: 'M78 49 C92 36 106 31 124 30 L158 30 C174 31 186 39 196 49 Z',
    pillars: [[132, 137]],
    wheels: [58, 186],
    r: 17,
    belt: 49,
    sill: 73,
    doors: [86, 135, 184],
    handles: [118, 166],
    mirror: [82, 49],
    head: 'M12 60 C20 57 30 56 38 56 L36 61 C27 62 18 63 12 64 Z',
    drl: 'M15 60.5 C22 58.5 29 58 35 57.8',
    tail: 'M221 52 L230 55 L231 61 L222 59.5 Z',
  },
  suv: {
    label: 'ג׳יפ / SUV',
    body: 'M12 66 L12 52 C12 47 16 45 24 44 L60 40 L78 20 C81 16 85 15 92 15 L206 15 C214 15 218 19 220 26 L226 44 C229 47 230 52 230 58 L230 74 C230 78 228 79 225 79 L14 79 C12 79 12 76 12 66 Z',
    glass: 'M82 40 L95 20 L204 20 C209 20 212 22 214 26 L220 40 Z',
    pillars: [[134, 140], [178, 185]],
    wheels: [62, 186],
    r: 20,
    belt: 40,
    sill: 68,
    doors: [90, 137, 182],
    handles: [122, 168],
    mirror: [84, 40],
    head: 'M13 46 L30 44 L29 51 L13 52.5 Z',
    drl: 'M15 47.5 L28 46',
    tail: 'M223 30 L229 44 L229.5 54 L225 52 Z',
    extra: [
      { d: 'M98 12 L204 12', kind: 'rail' },
      { d: 'M12 68 L230 68 L230 74 C230 78 228 79 225 79 L14 79 C12 79 12 76 12 68 Z', kind: 'cladding' },
    ],
  },
  van: {
    label: 'מיני-ואן',
    body: 'M12 70 L12 56 C12 50 16 47 22 45 L42 34 C54 18 70 12 92 12 L214 12 C224 12 228 18 229 28 L230 72 C230 78 228 80 224 80 L14 80 C12 80 12 77 12 70 Z',
    glass: 'M46 34 C56 21 70 16 90 16 L222 16 C224 16 225 18 225 21 L225 36 L46 36 Z',
    pillars: [[100, 105], [142, 147], [186, 191]],
    wheels: [58, 190],
    r: 17,
    belt: 36,
    sill: 73,
    doors: [104, 146],
    handles: [92, 160],
    mirror: [48, 37],
    head: 'M13 51 L28 49 L27 56.5 L13 57.5 Z',
    drl: 'M15 52.5 L26 51',
    tail: 'M226 30 L229.2 30 L229.8 52 L226 52 Z',
    extra: [{ d: 'M146 40 L226 40', kind: 'line' }],
  },
  pickup: {
    label: 'טנדר',
    body: 'M10 68 L10 56 C10 51 14 49 22 48 L58 45 L74 24 C77 20 81 19 87 19 L128 19 C133 19 135 22 135 27 L135 46 L226 46 C229 46 230 48 230 51 L230 74 C230 78 228 80 225 80 L12 80 C10 80 10 76 10 68 Z',
    glass: 'M78 45 L90 24 L130 24 L130 45 Z',
    pillars: [[107, 112]],
    wheels: [60, 190],
    r: 18,
    belt: 45,
    sill: 72,
    doors: [84, 132],
    handles: [100, 124],
    mirror: [80, 45],
    head: 'M11 50.5 L27 49 L26 56 L11 57 Z',
    drl: 'M13 52 L25 51',
    tail: 'M227 49 L230 49 L230 60 L227 60 Z',
    extra: [
      { d: 'M138 51 L226 51', kind: 'line' },
      { d: 'M226 47 L226 78', kind: 'line' },
    ],
  },
  sport: {
    label: 'ספורט',
    body: 'M8 72 C8 66 14 63 26 62 L76 54 C96 40 116 34 136 34 L160 34 C182 35 200 44 214 54 L228 58 C233 60 234 66 233 72 L232 77 C232 79 230 80 228 80 L10 80 C8 80 8 78 8 72 Z',
    glass: 'M88 54 C104 43 120 38 138 38 L158 38 C176 39 190 46 202 54 Z',
    pillars: [[148, 152]],
    wheels: [60, 188],
    r: 17,
    belt: 54,
    sill: 75,
    doors: [98, 160],
    handles: [140],
    mirror: [92, 54],
    head: 'M10 66 C18 63 30 61 42 60.5 L37 65 C26 66 16 67 10 68 Z',
    drl: 'M13 66 C22 64 31 62.5 39 62',
    tail: 'M221 56 L232 60 L232.5 64 L221 61 Z',
    extra: [{ d: 'M206 52 L222 50 L224 52 L208 55 Z', kind: 'cladding' }],
  },
}

export const BODY_TYPES = Object.keys(SHAPES) as BodyType[]
export const bodyLabel = (b: BodyType) => SHAPES[b].label

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

const SMALL_MODELS = /picanto|i10|i20|spark|aygo|up!?|micra|swift|yaris|c1|108|twingo|panda|500|mii|citigo|celerio|alto|rio|morning|polo|clio|corsa|sandero|ibiza/i
const SUV_MODELS = /tucson|sportage|rav4|x-?trail|qashqai|cx-?5|cx-?3|cx-?30|kona|niro|duster|jeep|wrangler|compass|renegade|grand|land|range|tiguan|kodiaq|karoq|ateca|outlander|asx|vitara|jimny|santa|sorento|seltos|stonic|t-?roc|captur|kadjar|3008|2008|5008|c-?hr|hr-?v|cr-?v|forester|xv|x1|x3|x5|q3|q5|glc|gla|ev9|ioniq 5|model y/i
const VAN_MODELS = /carnival|sienna|odyssey|touran|sharan|caddy|berlingo|partner|kangoo|transit|vito|v-?class|staria|h-?1|multivan|alhambra/i
const PICKUP_MODELS = /hilux|ranger|d-?max|navara|l200|amarok|tundra|f-?150|frontier|bt-?50|musso/i

/** A first guess from the registry model name; the user can change it. */
export function guessBody(model: string | null | undefined): BodyType {
  if (!model) return 'family'
  if (PICKUP_MODELS.test(model)) return 'pickup'
  if (VAN_MODELS.test(model)) return 'van'
  if (SUV_MODELS.test(model)) return 'suv'
  if (SMALL_MODELS.test(model)) return 'small'
  return 'family'
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)))
  return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(f).map(c => c.toString(16).padStart(2, '0')).join('')
}

const luma = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
}

function Wheel({ cx, cy, r, id }: { cx: number; cy: number; r: number; id: string }) {
  const spokes = Array.from({ length: 5 }, (_, i) => i * 72)
  const rim = r * 0.66
  const inner = r * 0.22
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#111317" />
      <circle cx={cx} cy={cy} r={r - 1.6} fill="none" stroke="#2a2e35" strokeWidth="1" />
      <circle cx={cx} cy={cy} r={rim} fill={`url(#rim${id})`} />
      <circle cx={cx} cy={cy} r={rim - 1.4} fill="#23272e" />
      {spokes.flatMap(a =>
        [-7, 7].map(o => {
          const t = ((a + o) * Math.PI) / 180
          return (
            <line
              key={`${a}${o}`}
              x1={cx + Math.cos(t) * inner}
              y1={cy + Math.sin(t) * inner}
              x2={cx + Math.cos(t) * (rim - 1.2)}
              y2={cy + Math.sin(t) * (rim - 1.2)}
              stroke={`url(#rim${id})`}
              strokeWidth={r * 0.1}
              strokeLinecap="round"
            />
          )
        }),
      )}
      <circle cx={cx} cy={cy} r={inner} fill={`url(#rim${id})`} stroke="#5d646e" strokeWidth=".6" />
      <circle cx={cx} cy={cy} r={inner * 0.35} fill="#3a3f47" />
    </g>
  )
}

/** A side-view car in the chosen body type and paint. */
export function CarAvatar({ body, paint, className }: { body: BodyType; paint: string; className?: string }) {
  const s = SHAPES[body] ?? SHAPES.family
  const id = useId().replace(/:/g, '')
  const cy = 90 - s.r
  const light = luma(paint) > 175
  const top = shade(paint, light ? 0.5 : 0.38)
  const low = shade(paint, light ? -0.18 : -0.38)
  const edge = shade(paint, -0.5)
  const clipBody = `cb${id}`
  const clipGlass = `cg${id}`
  return (
    <svg className={`car-avatar ${className ?? ''}`} viewBox="0 0 240 96" role="img" aria-label={`רכב ${s.label}`}>
      <defs>
        <linearGradient id={`p${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset=".42" stopColor={paint} />
          <stop offset=".78" stopColor={paint} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
        <linearGradient id={`sheen${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".28" />
          <stop offset=".6" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2=".35" y2="1">
          <stop offset="0" stopColor="#8ea7c4" />
          <stop offset=".45" stopColor="#2b3a4e" />
          <stop offset="1" stopColor="#141b25" />
        </linearGradient>
        <radialGradient id={`rim${id}`} cx=".4" cy=".35" r=".8">
          <stop offset="0" stopColor="#f1f3f6" />
          <stop offset=".6" stopColor="#b9c0c9" />
          <stop offset="1" stopColor="#7d8590" />
        </radialGradient>
        <radialGradient id={`sh${id}`}>
          <stop offset="0" stopColor="#000" stopOpacity=".5" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clipBody}>
          <path d={s.body} />
        </clipPath>
        <clipPath id={clipGlass}>
          <path d={s.glass} />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="120" cy="90" rx="112" ry="4.5" fill={`url(#sh${id})`} />

      {/* body */}
      <path d={s.body} fill={`url(#p${id})`} />
      <g clipPath={`url(#${clipBody})`}>
        {/* lower body and sill in shadow */}
        <rect x="0" y={s.sill} width="240" height="20" fill="#000" opacity=".22" />
        {/* long horizontal reflection on the upper body */}
        <rect x="0" y={s.belt - 2} width="240" height="9" fill={`url(#sheen${id})`} />
        {/* shoulder crease */}
        <path d={`M0 ${s.belt + 6} L240 ${s.belt + 5}`} stroke="#fff" strokeOpacity={light ? 0.9 : 0.35} strokeWidth="1" />
        <path d={`M0 ${s.belt + 7.2} L240 ${s.belt + 6.2}`} stroke="#000" strokeOpacity=".18" strokeWidth="1" />
        {/* wheel arches */}
        {s.wheels.map(x => (
          <circle key={x} cx={x} cy={cy} r={s.r + 3.6} fill="#0d0f12" />
        ))}
        {/* door shut lines and handles */}
        {s.doors.map(x => (
          <path key={x} d={`M${x} ${s.belt + 1} C${x - 1} ${s.belt + 12} ${x - 1} ${s.sill} ${x} 80`} stroke="#000" strokeOpacity=".32" strokeWidth=".8" fill="none" />
        ))}
        {s.handles.map(x => (
          <rect key={x} x={x} y={s.belt + 9} width="9" height="2.2" rx="1.1" fill={edge} opacity=".75" />
        ))}
        {s.extra?.map(e =>
          e.kind === 'cladding' ? <path key={e.d} d={e.d} fill="#25282d" opacity=".9" /> : e.kind === 'line' ? <path key={e.d} d={e.d} stroke="#000" strokeOpacity=".3" strokeWidth=".9" fill="none" /> : null,
        )}
      </g>
      <path d={s.body} fill="none" stroke={edge} strokeOpacity={light ? 0.45 : 0.6} strokeWidth=".7" />

      {/* roof rails sit on top of the roof */}
      {s.extra?.filter(e => e.kind === 'rail').map(e => (
        <path key={e.d} d={e.d} stroke="#2b2f36" strokeWidth="2.4" strokeLinecap="round" />
      ))}

      {/* glass, pillars and a reflection */}
      <path d={s.glass} fill={`url(#g${id})`} />
      <g clipPath={`url(#${clipGlass})`}>
        {s.pillars.map(([a, b]) => (
          <rect key={a} x={a} y="0" width={b - a} height="96" fill="#0c0f14" />
        ))}
        <path d={`M${s.wheels[0] + 30} 96 L${s.wheels[0] + 60} 0 L${s.wheels[0] + 74} 0 L${s.wheels[0] + 44} 96 Z`} fill="#fff" opacity=".14" />
        <path d={`M${s.wheels[0] + 52} 96 L${s.wheels[0] + 82} 0 L${s.wheels[0] + 86} 0 L${s.wheels[0] + 56} 96 Z`} fill="#fff" opacity=".1" />
      </g>
      <path d={s.glass} fill="none" stroke="#0a0c10" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={s.glass} fill="none" stroke="#c9d1db" strokeOpacity=".5" strokeWidth=".5" strokeLinejoin="round" />

      {/* mirror */}
      <path
        d={`M${s.mirror[0]} ${s.mirror[1] + 1} l-7 -1.5 q-2 0 -2 2 l0 3 q0 2 2 2 l7 -1 Z`}
        fill={paint}
        stroke={edge}
        strokeOpacity=".6"
        strokeWidth=".6"
      />

      {/* lights */}
      <path d={s.head} fill="#1d2430" />
      <path d={s.head} fill="#eaf3ff" opacity=".55" />
      <path d={s.drl} stroke="#ffffff" strokeWidth="1.3" strokeLinecap="round" fill="none" />
      <path d={s.tail} fill="#b3121f" />
      <path d={s.tail} fill="#ff5a64" opacity=".45" transform="translate(.4 .4) scale(.995)" />

      {/* wheels */}
      {s.wheels.map(x => (
        <Wheel key={x} cx={x} cy={cy} r={s.r} id={id} />
      ))}
    </svg>
  )
}

export const carBody = (c: Pick<Car, 'body' | 'model'>): BodyType => c.body ?? guessBody(c.model)
export const carPaint = (c: Pick<Car, 'paint' | 'color'>): string => c.paint ?? paintFromRegistry(c.color)

/** The avatar of a saved car. */
export function CarBadge({ car, className }: { car: Pick<Car, 'body' | 'model' | 'paint' | 'color'>; className?: string }) {
  return <CarAvatar body={carBody(car)} paint={carPaint(car)} className={className} />
}
