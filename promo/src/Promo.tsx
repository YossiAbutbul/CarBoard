import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, random, staticFile, useCurrentFrame } from 'remotion'
import { loadFont } from '@remotion/google-fonts/NotoSansHebrew'
import VOICE from './voice.json'

/*
 * The CarBoard commercial. Night: light trails of passing cars, and the questions every driver forgets.
 * A flash, and the light comes on with CarBoard. One phone (real screenshots, see shoot.mjs) glides and
 * turns through reminders, fuel and documents, changing screens on the move. A clean end card with a
 * reflection. Each scene lasts as long as its voice-over line (voice.mjs).
 */

const { fontFamily } = loadFont('normal', { weights: ['300', '500', '700', '800'], subsets: ['hebrew', 'latin'] })

const FPS = 30
const W = 1920
const BLUE = '#1c69d4'
const NIGHT = '#040912'
const EASE = Easing.bezier(0.22, 1, 0.36, 1) // a long, soft ease-out
const SMOOTH = Easing.bezier(0.65, 0, 0.35, 1) // in and out

type Id = 'chaos' | 'logo' | 'home' | 'fuel' | 'docs' | 'outro'
const voice = VOICE as Partial<Record<Id, { file: string; seconds: number }>>
const DEFAULT: Record<Id, number> = { chaos: 5.2, logo: 2, home: 6, fuel: 3.8, docs: 4.4, outro: 3.6 }
const len = (id: Id) => Math.round(((voice[id]?.seconds ?? DEFAULT[id] - 0.4) + 0.4) * FPS)
const ORDER: Id[] = ['chaos', 'logo', 'home', 'fuel', 'docs', 'outro']
const START = ORDER.reduce<Record<string, number>>((m, id, i) => ({ ...m, [id]: i === 0 ? 0 : m[ORDER[i - 1]] + len(ORDER[i - 1]) }), {}) as Record<Id, number>
export const PROMO_FRAMES = START.outro + len('outro')

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const
const ramp = (f: number, a: number, b: number, from = 0, to = 1, easing = EASE) => interpolate(f, [a, b], [from, to], { ...clamp, easing })
/** A value held between keyframes and eased between them: keys are [frame, value]. */
const keys = (f: number, k: [number, number][], easing = SMOOTH) => interpolate(f, k.map(x => x[0]), k.map(x => x[1]), { ...clamp, easing })

// ── pieces ──

const R = 78
const pt = (a: number, d = R) => [100 + d * Math.cos((a * Math.PI) / 180), 100 + d * Math.sin((a * Math.PI) / 180)]
const arc = (from: number, span: number) => {
  const [x1, y1] = pt(from)
  const [x2, y2] = pt(from + span)
  return `M ${x1} ${y1} A ${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${x2} ${y2}`
}
/** The icon's dial. `draw` 0..1 draws the arc on; the needle sits at `needle` degrees. */
function Dial({ size, needle, draw = 1, color = '#fff', glow = 0 }: { size: number; needle: number; draw?: number; color?: string; glow?: number }) {
  const L = (Math.PI * R * 250) / 180
  return (
    <svg width={size} height={size} viewBox="-10 -10 220 220" fill="none" stroke={color} strokeLinecap="round" style={{ overflow: 'visible', filter: glow ? `drop-shadow(0 0 ${glow}px rgba(160,205,255,0.9))` : undefined }}>
      <path d={arc(145, 250)} strokeWidth={R * 0.4} strokeDasharray={L} strokeDashoffset={L * (1 - draw)} />
      <g transform={`rotate(${needle} 100 100)`} opacity={Math.min(1, draw * 2)}>
        <line x1="100" y1="100" x2={100 + R * 0.55} y2="100" strokeWidth={R * 0.25} />
      </g>
      <circle cx="100" cy="100" r={R * 0.28 * Math.min(1, draw * 1.5)} fill={color} stroke="none" />
    </svg>
  )
}

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.5 0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>')}")`

/** The blue, with a slow light drifting across it; fades up after the night. */
function Stage() {
  const f = useCurrentFrame()
  const lx = 30 + Math.sin(f / 120) * 18
  const ly = 22 + Math.cos(f / 150) * 10
  const on = ramp(f, START.logo - 4, START.logo + 10, 0, 1, SMOOTH)
  return (
    <AbsoluteFill style={{ opacity: on, background: `radial-gradient(60% 70% at ${lx}% ${ly}%, #2f7fe8 0%, rgba(47,127,232,0) 65%), radial-gradient(80% 90% at 85% 110%, #0d3a86 0%, rgba(13,58,134,0) 60%), linear-gradient(180deg, #1a5fc4 0%, #123f8f 100%)` }}>
      <AbsoluteFill style={{ background: 'radial-gradient(120% 90% at 50% 50%, rgba(0,0,0,0) 55%, rgba(2,8,22,0.55) 100%)' }} />
    </AbsoluteFill>
  )
}

/**
 * Light trails, like a long exposure of a road at night: white headlights and warm tail lights streaking
 * right to left. Bright in the dark opening, faint behind the rest.
 */
function Trails() {
  const f = useCurrentFrame()
  const night = 1 - ramp(f, START.logo - 6, START.logo + 14, 0, 1, SMOOTH)
  const strength = 0.16 + 0.5 * night
  return (
    <AbsoluteFill style={{ opacity: strength, filter: 'blur(1.2px)' }}>
      {Array.from({ length: 26 }, (_, i) => {
        const warm = i % 4 === 0
        const lengthPx = 260 + random(`l${i}`) * 620
        const speed = (warm ? 26 : 38) + random(`v${i}`) * 34
        const y = 120 + random(`y${i}`) * 840
        const span = W + lengthPx * 2
        const x = W - ((f * speed + random(`o${i}`) * span) % span) + lengthPx * 0.2
        const h = 1.5 + random(`h${i}`) * 2.5
        const c = warm ? '255,170,90' : '205,228,255'
        return (
          <i key={i} style={{ position: 'absolute', left: x, top: y + Math.sin((f + i * 30) / 50) * 4, width: lengthPx, height: h, borderRadius: h, background: `linear-gradient(90deg, rgba(${c},0.95), rgba(${c},0))`, boxShadow: `0 0 ${h * 4}px rgba(${c},0.5)` }} />
        )
      })}
    </AbsoluteFill>
  )
}

/** A line of type that arrives softly: up, out of a blur. */
function Type({ children, at, size, weight = 700, color = '#fff', out, style }: { children: React.ReactNode; at: number; size: number; weight?: number; color?: string; out?: number; style?: React.CSSProperties }) {
  const f = useCurrentFrame()
  const a = ramp(f, at, at + 22)
  const o = out == null ? 1 : 1 - ramp(f, out, out + 14, 0, 1, SMOOTH)
  return (
    <div style={{ fontFamily, fontSize: size, fontWeight: weight, letterSpacing: '-0.025em', lineHeight: 1.08, color, direction: 'rtl', opacity: a * o, transform: `translateY(${(1 - a) * 34 - (1 - o) * 20}px)`, filter: `blur(${(1 - a) * 14 + (1 - o) * 10}px)`, ...style }}>
      {children}
    </div>
  )
}

const Eyebrow = ({ children, at }: { children: React.ReactNode; at: number }) => (
  <Type at={at} size={28} weight={500} color="rgba(207,226,255,0.85)">
    {children}
  </Type>
)

/**
 * The one phone of the ad, on the whole timeline: rises in with the reminders, glides to the other side
 * for fuel and back for documents (changing screen on the way), and lifts away into the end card.
 */
function Phone() {
  const g = useCurrentFrame()
  const H = START.home
  const F = START.fuel
  const D = START.docs
  const O = START.outro
  if (g < H - 2 || g > O + 24) return null
  const LEFT = 300
  const RIGHT = 1200
  const x = keys(g, [[F - 4, LEFT], [F + 24, RIGHT], [D - 4, RIGHT], [D + 24, LEFT]])
  const rise = ramp(g, H, H + 36)
  const rotY = keys(g, [[H, -46], [H + 36, -26], [F - 4, -12], [F + 24, 18], [D - 4, 24], [D + 24, -20], [O, -10]], EASE)
  const rotX = keys(g, [[H, 14], [H + 36, 6], [O, 3]])
  const lift = ramp(g, O - 2, O + 22, 0, 1, SMOOTH)
  const shot = (from: number) => ramp(g, from, from + 14, 0, 1, SMOOTH)
  const shots: [string, number][] = [
    ['phone-home.png', 1],
    ['phone-fuel.png', shot(F + 6)],
    ['phone-docs.png', shot(D + 6)],
  ]
  const PW = 420
  const PH = 908
  return (
    <div style={{ position: 'absolute', left: x, top: 86 + (1 - rise) * 260 - lift * 120, opacity: rise * (1 - lift), filter: `blur(${lift * 12}px)`, transform: `scale(${1 + lift * 0.2})`, perspective: 2600 }}>
      <div style={{ position: 'relative', width: PW, height: PH, transformStyle: 'preserve-3d', transform: `rotateY(${rotY}deg) rotateX(${rotX}deg)` }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: 66, background: 'linear-gradient(145deg, #2a3445, #0a0f18 40%, #1b2331)', padding: 14, boxShadow: '0 80px 120px -40px rgba(0,5,20,0.75), inset 0 0 0 2px rgba(255,255,255,0.08)' }}>
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 54, overflow: 'hidden', background: '#fff' }}>
            {/* each new screen slides in over the one before, like changing pages */}
            {shots.map(([s, o], i) => (
              <Img key={s} src={staticFile(`shots/${s}`)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', transform: i === 0 ? undefined : `translateX(${(1 - o) * 104}%)`, boxShadow: i === 0 ? undefined : '0 0 40px rgba(0,0,0,0.25)' }} />
            ))}
            {/* the glass catching the light as it turns */}
            <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(${115 + rotY * 2.2}deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.24) 46%, rgba(255,255,255,0) 60%)`, mixBlendMode: 'screen' }} />
          </div>
        </div>
      </div>
      <div style={{ position: 'absolute', left: '10%', right: '10%', bottom: -60, height: 50, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(0,6,22,0.55), rgba(0,6,22,0))', filter: 'blur(6px)' }} />
    </div>
  )
}

/** A glass label with a dot, its thin line drawing out from the phone. */
function Label({ children, x, y, at, dot, line = 90 }: { children: React.ReactNode; x: number; y: number; at: number; dot: string; line?: number }) {
  const f = useCurrentFrame()
  const a = ramp(f, at, at + 20)
  const l = ramp(f, at + 6, at + 26)
  return (
    <div style={{ position: 'absolute', left: x, top: y, display: 'flex', alignItems: 'center', opacity: a, transform: `translateX(${(1 - a) * 30}px)` }}>
      <i style={{ width: 8, height: 8, borderRadius: 4, background: '#fff', boxShadow: '0 0 12px #fff', opacity: l }} />
      <div style={{ width: line * l, height: 2, background: 'linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,0.15))' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 26px', borderRadius: 18, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22), 0 20px 40px -20px rgba(0,5,20,0.6)', fontFamily, fontSize: 30, fontWeight: 500, color: '#fff', direction: 'rtl', whiteSpace: 'nowrap' }}>
        <i style={{ width: 12, height: 12, borderRadius: 6, background: dot, boxShadow: `0 0 14px ${dot}` }} />
        {children}
      </div>
    </div>
  )
}

const Voice = ({ id }: { id: Id }) => (voice[id] ? <Audio src={staticFile(voice[id]!.file)} /> : null)
const fadeOut = (f: number, n: number) => 1 - ramp(f, n - 10, n, 0, 1, SMOOTH)

// ── scenes ──

/** Night. A dashboard dial idles in the dark; the questions come one after another with the voice. */
function Chaos() {
  const f = useCurrentFrame()
  const n = len('chaos')
  const q = [
    { t: 'מתי הטסט?', at: Math.round(n * 0.04) },
    { t: 'מתי הביטוח?', at: Math.round(n * 0.27) },
    { t: 'מתי עשינו טיפול?!', at: Math.round(n * 0.52) },
  ]
  const push = interpolate(f, [0, n], [1, 1.08])
  const needle = 150 + Math.sin(f / 7) * 4 + Math.sin(f / 2.3) * 1.5 // an idling engine
  return (
    <AbsoluteFill>
      <Voice id="chaos" />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 0.07 * ramp(f, 0, 30) * fadeOut(f, n) }}>
        <Dial size={900} needle={needle} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${push})` }}>
        {q.map((x, i) => (
          <div key={i} style={{ position: 'absolute' }}>
            <Type
              at={x.at}
              out={q[i + 1]?.at ? q[i + 1].at - 6 : n - 12}
              size={i === 2 ? 132 : 112}
              weight={i === 2 ? 800 : 300}
              color={i === 2 ? '#fff' : 'rgba(255,255,255,0.9)'}
              style={{ textShadow: '0 0 40px rgba(120,170,255,0.35)' }}
            >
              {x.t}
            </Type>
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** A flash, and the light comes on: the icon draws itself with a glow, the name wipes in. */
function Logo() {
  const f = useCurrentFrame()
  const n = len('logo')
  const draw = ramp(f, 2, 28, 0, 1, SMOOTH)
  const needle = ramp(f, 6, 36, 145, 312)
  const wipe = ramp(f, 12, 36, 0, 100, SMOOTH)
  const flash = interpolate(f, [0, 3, 18], [0, 0.85, 0], clamp)
  const glow = interpolate(f, [6, 30, n], [0, 26, 10], clamp)
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Voice id="logo" />
      <AbsoluteFill style={{ opacity: fadeOut(f, n), alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 44, direction: 'ltr', transform: `scale(${interpolate(f, [0, n], [0.96, 1.04])})` }}>
          <Dial size={190} needle={needle} draw={draw} glow={glow} />
          {/* the glow is outside the wipe, so the wipe's edge never shows */}
          <div style={{ filter: `drop-shadow(0 0 ${glow}px rgba(160,205,255,0.6))` }}>
            <div style={{ fontFamily, fontSize: 170, fontWeight: 800, letterSpacing: '-0.045em', color: '#fff', clipPath: `inset(-20% ${100 - wipe}% -20% 0)` }}>
              Car<span style={{ color: '#cfe2ff' }}>Board</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,${flash}), rgba(190,220,255,${flash * 0.5}) 50%, rgba(255,255,255,0) 100%)` }} />
    </AbsoluteFill>
  )
}

function Home() {
  const f = useCurrentFrame()
  const n = len('home')
  return (
    <AbsoluteFill style={{ opacity: fadeOut(f, n) }}>
      <Voice id="home" />
      <Label x={690} y={300} at={32} dot="#4ade80">טסט · תקין עוד 8 חודשים</Label>
      <Label x={690} y={420} at={46} dot="#fbbf24">ביטוח · נגמר בעוד 19 ימים</Label>
      <Label x={690} y={540} at={60} dot="#fbbf24">שמן · עוד 800 ק״מ</Label>
      <div style={{ position: 'absolute', right: 140, top: 360, width: 620, display: 'grid', gap: 20 }}>
        <Eyebrow at={10}>תזכורות</Eyebrow>
        <Type at={18} size={86} weight={800}>
          נזכיר לכם,
        </Type>
        <Type at={28} size={86} weight={300}>
          לפני שמשהו מגיע.
        </Type>
      </div>
    </AbsoluteFill>
  )
}

function Fuel() {
  const f = useCurrentFrame()
  const n = len('fuel')
  return (
    <AbsoluteFill style={{ opacity: fadeOut(f, n) }}>
      <Voice id="fuel" />
      <div style={{ position: 'absolute', left: 150, top: 370, width: 680, display: 'grid', gap: 20 }}>
        <Eyebrow at={14}>דלק</Eyebrow>
        <Type at={20} size={86} weight={800}>
          כמה עולה הדלק?
        </Type>
        <Type at={30} size={86} weight={300}>
          עכשיו אתם יודעים.
        </Type>
      </div>
      <div style={{ position: 'absolute', left: 150, top: 770, display: 'flex', gap: 18 }}>
        {[
          ['₪4,032', 'חצי שנה'],
          ['₪7.36', 'לליטר'],
        ].map(([v, k], i) => {
          const a = ramp(f, 38 + i * 8, 60 + i * 8)
          return (
            <div key={k} style={{ opacity: a, transform: `translateY(${(1 - a) * 24}px)`, padding: '18px 28px', borderRadius: 20, background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(18px)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)', fontFamily, color: '#fff', direction: 'rtl' }}>
              <div style={{ fontSize: 44, fontWeight: 700, direction: 'ltr', textAlign: 'right' }}>{v}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: 'rgba(207,226,255,0.85)' }}>{k}</div>
            </div>
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

function Docs() {
  const f = useCurrentFrame()
  const n = len('docs')
  // the papers rise out of the phone, layered in depth
  const cards = [
    { t: 'רישיון רכב', s: 'בתוקף עד 28.05.2027', c: '#4ade80', x: 760, y: 250, d: 24 },
    { t: 'ביטוח חובה ומקיף', s: 'הראל · עד 31.10.2026', c: '#fbbf24', x: 800, y: 420, d: 34 },
    { t: 'רישיון נהיגה', s: 'בתוקף', c: '#93c5fd', x: 740, y: 590, d: 44 },
  ]
  return (
    <AbsoluteFill style={{ opacity: fadeOut(f, n) }}>
      <Voice id="docs" />
      {cards.map((c, i) => {
        const a = ramp(f, c.d, c.d + 26)
        const float = Math.sin((f + i * 20) / 30) * 6
        return (
          <div key={i} style={{ position: 'absolute', left: c.x - (1 - a) * 220, top: c.y + float, opacity: a, transform: `perspective(1600px) rotateY(${-16 + (1 - a) * -30}deg)`, width: 360, padding: '22px 26px', borderRadius: 22, background: '#fff', boxShadow: '0 40px 60px -30px rgba(0,5,20,0.7)', fontFamily, direction: 'rtl' }}>
            <div style={{ width: 54, height: 6, borderRadius: 3, background: c.c }} />
            <div style={{ marginTop: 14, fontSize: 30, fontWeight: 700, color: '#0f1720' }}>{c.t}</div>
            <div style={{ marginTop: 6, fontSize: 21, fontWeight: 500, color: '#6b7889' }}>{c.s}</div>
          </div>
        )
      })}
      <div style={{ position: 'absolute', right: 140, top: 380, width: 560, display: 'grid', gap: 20 }}>
        <Eyebrow at={14}>מסמכים</Eyebrow>
        <Type at={20} size={86} weight={800}>
          רישיון, ביטוח, קבלות.
        </Type>
        <Type at={32} size={86} weight={300}>
          תמיד בכיס.
        </Type>
      </div>
    </AbsoluteFill>
  )
}

function Outro() {
  const f = useCurrentFrame()
  const sweep = ramp(f, 18, 62, -40, 140, SMOOTH)
  const logo = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 40, direction: 'ltr' }}>
      <div style={{ width: 150, height: 150, borderRadius: 36, background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 30px 60px -30px rgba(0,5,20,0.6)' }}>
        <Dial size={116} needle={-48} color={BLUE} />
      </div>
      <div style={{ position: 'relative', overflow: 'hidden', fontFamily, fontSize: 150, fontWeight: 800, letterSpacing: '-0.045em', color: '#fff', lineHeight: 1.1 }}>
        Car<span style={{ color: '#cfe2ff' }}>Board</span>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${sweep}%`, width: '22%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.45), rgba(255,255,255,0))', transform: 'skewX(-18deg)', mixBlendMode: 'overlay' }} />
      </div>
    </div>
  )
  const a = ramp(f, 4, 30)
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Voice id="outro" />
      <div style={{ marginTop: -60, opacity: a, transform: `translateY(${(1 - a) * 40}px) scale(${interpolate(a, [0, 1], [0.94, 1])})` }}>
        {logo}
        {/* its reflection on a glossy floor */}
        <div style={{ transform: 'scaleY(-1)', opacity: 0.1, marginTop: 4, maskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0) 40%)', WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0) 40%)', filter: 'blur(3px)' }}>{logo}</div>
      </div>
      <div style={{ position: 'absolute', top: 690, width: '100%', display: 'grid', justifyItems: 'center', gap: 24 }}>
        <Type at={16} size={52} weight={300}>
          כל הרכב. במקום אחד.
        </Type>
        <Type at={26} size={32} weight={500} color="rgba(207,226,255,0.9)" style={{ direction: 'ltr', letterSpacing: '0.04em' }}>
          carboard-teal.vercel.app
        </Type>
      </div>
    </AbsoluteFill>
  )
}

const SCENES: Record<Id, () => React.JSX.Element> = { chaos: Chaos, logo: Logo, home: Home, fuel: Fuel, docs: Docs, outro: Outro }

export function Promo() {
  return (
    <AbsoluteFill style={{ fontFamily, background: NIGHT }}>
      <Stage />
      <Trails />
      <Phone />
      {ORDER.map(id => {
        const Scene = SCENES[id]
        return (
          <Sequence key={id} from={START[id]} durationInFrames={len(id)}>
            <Scene />
          </Sequence>
        )
      })}
      <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.06, mixBlendMode: 'overlay', pointerEvents: 'none' }} />
    </AbsoluteFill>
  )
}
