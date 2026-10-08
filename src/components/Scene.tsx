import { useEffect } from 'react'

/**
 * The animated backdrop of the login, the first-run steps and (lite) every page header: drifting glows,
 * a slowly turning speedometer, and headlight streaks passing by. Decorative only.
 */
export function Scene({ lite = false }: { lite?: boolean }) {
  const ticks = Array.from({ length: 60 }, (_, i) => i)
  // full-screen scenes: the page behind them is navy too, so scrolling or bouncing past the edge never shows white
  useEffect(() => {
    if (lite) return
    document.documentElement.classList.add('scenic-page')
    return () => document.documentElement.classList.remove('scenic-page')
  }, [lite])
  return (
    <div className={`scene ${lite ? 'lite' : ''}`} aria-hidden="true">
      <i className="glow g1" />
      <i className="glow g2" />
      <i className="glow g3" />
      {!lite && (
        <svg className="scene-dial" viewBox="0 0 400 400">
          <circle cx="200" cy="200" r="196" className="ring" />
          <circle cx="200" cy="200" r="150" className="ring thin" />
          <g className="ticks">
            {ticks.map(i => (
              <line key={i} x1="200" y1={i % 5 ? 14 : 8} x2="200" y2="30" transform={`rotate(${i * 6} 200 200)`} className={i % 5 ? '' : 'major'} />
            ))}
          </g>
          <path className="arc" d="M 340 290 A 160 160 0 1 0 60 290" />
        </svg>
      )}
      <div className="road">
        <i className="streak s1" />
        <i className="streak s2" />
        <i className="streak s3" />
        <i className="streak s4" />
      </div>
      <i className="grain" />
    </div>
  )
}
