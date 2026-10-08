import { useEffect, useState } from 'react'
import { onActivity } from '../lib/activity'

/**
 * A thin moving bar at the top while a request takes more than a moment. Quick ones never show it,
 * and once shown it stays a little, so it does not flash.
 */
export function ActivityBar() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let show = 0
    let hide = 0
    let since = 0
    const off = onActivity(n => {
      if (n > 0) {
        clearTimeout(hide)
        if (!show && !since)
          show = window.setTimeout(() => {
            show = 0
            since = Date.now()
            setOn(true)
          }, 250)
      } else {
        clearTimeout(show)
        show = 0
        if (since)
          hide = window.setTimeout(() => {
            since = 0
            setOn(false)
          }, Math.max(0, 400 - (Date.now() - since)))
      }
    })
    return () => {
      off()
      clearTimeout(show)
      clearTimeout(hide)
    }
  }, [])
  return <div className={`activity-bar ${on ? 'on' : ''}`} role="progressbar" aria-hidden={!on} aria-label="טוען" />
}
