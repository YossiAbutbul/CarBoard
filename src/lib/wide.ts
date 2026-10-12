import { useEffect, useState } from 'react'

/** A PC-sized window: the app shows its desk layout (icon strip, cars pane, page) instead of the phone's. */
export const WIDE = '(min-width: 1024px)'

export const isWide = () => typeof matchMedia === 'function' && matchMedia(WIDE).matches

export function useWide() {
  const [wide, setWide] = useState(isWide)
  useEffect(() => {
    const mq = matchMedia(WIDE)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}
