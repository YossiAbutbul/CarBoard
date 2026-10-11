import { useEffect } from 'react'

/*
 * The backdrop of the login, the first-run steps and (lite) every page header: the icon's own
 * world. Brand blue with a little depth, and dials drawn the way the icon is drawn (a thick arc
 * with round ends, a needle and a hub), faint, like the instruments of a dashboard, with the
 * arc lit from zero up to the needle. On load the dashboard wakes up (the needle
 * sweeps and the lit arc fills with it), then the needles idle. Decorative only.
 */

const R = 78 // the arc's radius, in a box from -10 to 210
const FROM = 145 // where the arc starts (the icon's 145° → 35°)
const pt = (a: number, d = R) => [100 + d * Math.cos((a * Math.PI) / 180), 100 + d * Math.sin((a * Math.PI) / 180)] as const
const arcPath = (from: number, span: number, r = R) => {
  const [x1, y1] = pt(from, r)
  const [x2, y2] = pt(from + span, r)
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
}

// one dial; `needle` in degrees like the icon's (-48 points up and to the right)
function Dial({ className, needle = -48 }: { className: string; needle?: number }) {
  const span = 250 // the icon's arc, 145° round to 35°
  const lit = (((needle - FROM) % 360) + 360) % 360 // from zero up to the needle
  const litLen = (Math.PI * R * lit) / 180
  return (
    <svg className={`dial-mark ${className}`} viewBox="-10 -10 220 220">
      {/* the dial itself, faded as one piece (no brighter seam where the needle meets the hub) */}
      <g className="base">
        <path d={arcPath(FROM, span)} strokeWidth={R * 0.4} />
        <g className="needle" style={{ '--to': `${needle}deg` } as React.CSSProperties}>
          <line x1="100" y1="100" x2={100 + R * 0.55} y2="100" strokeWidth={R * 0.25} />
        </g>
        <circle cx="100" cy="100" r={R * 0.28} className="hub" />
      </g>
      {/* the reading: the arc lit from zero to the needle, filling as the needle sweeps up */}
      <path className="lit" d={arcPath(FROM, lit)} strokeWidth={R * 0.4} style={{ '--len': litLen } as React.CSSProperties} strokeDasharray={litLen} />
    </svg>
  )
}

/** A solid dial in the icon's proportions; `redTo` paints the start of the arc red (a stalled gauge). */
export function IconDial({ className, needle, redTo }: { className: string; needle: number; redTo?: number }) {
  return (
    <svg className={`icon-dial solid ${className}`} viewBox="-10 -10 220 220">
      <path className="track" d={arcPath(FROM, 250)} strokeWidth={R * 0.4} />
      {redTo && <path className="red" d={arcPath(FROM, redTo - FROM)} strokeWidth={R * 0.4} />}
      <g className="needle" style={{ '--to': `${needle}deg` } as React.CSSProperties}>
        <line x1="100" y1="100" x2={100 + R * 0.55} y2="100" strokeWidth={R * 0.25} />
      </g>
      <circle cx="100" cy="100" r={R * 0.28} className="hub" />
    </svg>
  )
}

/** The car, side on, drawn like the icon: the boot short and steep at the back, the windscreen
 *  raked and the bonnet long at the front. Mirrored so it faces left: it drives right to left. */
export function Car() {
  return (
    <g transform="matrix(-1 0 0 1 204 0)">
      <path d="M 32 62 H 22 Q 14 62 14 54 V 40 Q 14 33 22 32 L 38 31 L 50 14 Q 53 10 60 10 H 112 Q 118 10 123 14 L 148 31 L 180 36 Q 190 38 190 49 V 54 Q 190 62 182 62 H 168 M 60 62 H 140" />
      <path d="M 57 29 L 63 18 H 93 V 29 Z M 101 29 V 18 H 113 Q 117 18 120 21 L 131 29 Z" className="window" />
      <circle cx="46" cy="62" r="13" />
      <circle cx="154" cy="62" r="13" />
    </g>
  )
}

/** Under the dials: a road, and a car drawn like the icon (thick lines, round ends) that drives in and parks. */
function Road() {
  return (
    <div className="road-mark">
      <svg className="road-line" viewBox="0 0 400 10" preserveAspectRatio="none">
        <line x1="0" y1="5" x2="400" y2="5" />
      </svg>
      <svg className="road-car" viewBox="0 0 200 84">
        <Car />
      </svg>
    </div>
  )
}

/** The loading screen's dial: the icon itself, solid, its needle revving and the lit arc following it. */
export function LoadingDial() {
  const span = 250
  return (
    <svg className="splash-dial icon-dial" viewBox="-10 -10 220 220" aria-hidden="true">
      <path className="track" d={arcPath(FROM, span)} strokeWidth={R * 0.4} />
      <path className="lit" d={arcPath(FROM, span)} strokeWidth={R * 0.4} pathLength={100} />
      <g className="needle">
        <line x1="100" y1="100" x2={100 + R * 0.55} y2="100" strokeWidth={R * 0.25} />
      </g>
      <circle cx="100" cy="100" r={R * 0.28} className="hub" />
    </svg>
  )
}

// lite: the page header's one dial · bare: the blue only (error pages bring their own gauge) ·
// drive: the car keeps driving by instead of parking · stage: the login's top half, one dial and the road
export function Scene({ lite = false, bare = false, drive = false, stage = false }: { lite?: boolean; bare?: boolean; drive?: boolean; stage?: boolean }) {
  // full-screen scenes: the page behind them is the same blue, so bouncing past the edge never shows white
  useEffect(() => {
    if (lite || stage) return
    document.documentElement.classList.add('scenic-page')
    return () => document.documentElement.classList.remove('scenic-page')
  }, [lite, stage])
  return (
    <div className={`scene ${lite ? 'lite' : ''} ${drive || stage ? 'drive' : ''} ${stage ? 'stage' : ''}`} aria-hidden="true">
      {bare ? null : stage ? (
        <>
          <Dial className="d-stage" needle={-40} />
          <Road />
        </>
      ) : lite ? (
        <Dial className="d-header" needle={-55} />
      ) : (
        <>
          <Dial className="d-speed" needle={-62} />
          <Dial className="d-revs" needle={-118} />
          <Road />
        </>
      )}
    </div>
  )
}
