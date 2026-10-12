import { useEffect, useRef } from 'react'

/**
 * Phones: the keyboard opens over the page without making it shorter (iOS, and Android in some
 * browsers), so anything pinned to the bottom ends up under it. This keeps `--kb` on the element at
 * the height the keyboard covers (0 when closed), for its padding to lift the content above it, and
 * brings a field into view when it is tapped.
 */
// `on`: attach again whenever the element appears (a dialog that is not always there)
export function useKeyboardInset<T extends HTMLElement>(on = true) {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    const vv = window.visualViewport
    if (!el || !on) return
    const fit = () => {
      const kb = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0
      el.style.setProperty('--kb', `${Math.round(kb)}px`)
    }
    // a field just tapped: once the keyboard is up, scroll it to the middle of what is still visible
    const onFocus = (e: FocusEvent) => {
      const t = e.target as HTMLElement
      if (!t.matches('input, textarea, select, [contenteditable]')) return
      setTimeout(() => {
        fit()
        t.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 320)
    }
    fit()
    vv?.addEventListener('resize', fit)
    vv?.addEventListener('scroll', fit)
    el.addEventListener('focusin', onFocus)
    return () => {
      vv?.removeEventListener('resize', fit)
      vv?.removeEventListener('scroll', fit)
      el.removeEventListener('focusin', onFocus)
    }
  }, [on])
  return ref
}
