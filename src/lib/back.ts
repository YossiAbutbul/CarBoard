import { useEffect, useRef } from 'react'

/*
 * The phone's back button. Every open layer (sheet, drawer, file viewer, calendar, dialog) adds a
 * history entry; back closes the top layer instead of leaving the app. With nothing open, the first
 * back shows "press again to exit" and a second one within 2 seconds leaves.
 */

interface Layer {
  close(): void | Promise<boolean | void> // false: the layer stayed open (e.g. "keep editing")
  popped: boolean
  pushed: boolean
}

const stack: Layer[] = []
let ignore = 0 // our own history.back() calls, which must not close anything
let waiting: (() => void)[] = [] // pushes that must wait until those back() calls have landed
const afterIgnored = (fn: () => void) => (ignore === 0 ? fn() : waiting.push(fn))
let lastRootBack = 0
let onExitHint: ((show: boolean) => void) | null = null

export function setExitHint(fn: ((show: boolean) => void) | null) {
  onExitHint = fn
}

let started = false
export function startBackHandling() {
  if (started || typeof window === 'undefined') return
  started = true
  history.pushState({ carboard: 'guard' }, '')
  window.addEventListener('popstate', async () => {
    if (ignore > 0) {
      ignore--
      if (ignore === 0) {
        const run = waiting
        waiting = []
        run.forEach(fn => fn())
      }
      return
    }
    const top = stack[stack.length - 1]
    if (top) {
      top.popped = true
      const closed = await top.close()
      if (closed === false && stack.includes(top)) {
        // it stayed open: put its history entry back
        top.popped = false
        top.pushed = false
        afterIgnored(() => {
          top.pushed = true
          history.pushState({ carboard: 'layer' }, '')
        })
      }
      return
    }
    // nothing open: press twice to leave
    if (Date.now() - lastRootBack < 2000) {
      onExitHint?.(false)
      history.back() // past the guard: leaves the app
      return
    }
    lastRootBack = Date.now()
    onExitHint?.(true)
    setTimeout(() => onExitHint?.(false), 2000)
    history.pushState({ carboard: 'guard' }, '')
  })
}

/** While `active`, the back button calls `close` (the latest one) instead of leaving the page. */
export function useBackLayer(active: boolean, close: () => void | Promise<boolean | void>) {
  const ref = useRef(close)
  ref.current = close
  useEffect(() => {
    if (!active) return
    const layer: Layer = { close: () => ref.current(), popped: false, pushed: false }
    stack.push(layer)
    const push = () => {
      if (!stack.includes(layer)) return // closed before its entry was added
      layer.pushed = true
      history.pushState({ carboard: 'layer' }, '')
    }
    afterIgnored(push)
    return () => {
      stack.splice(stack.indexOf(layer), 1)
      if (layer.pushed && !layer.popped) {
        // closed by the app (✕, swipe, save): drop the entry we added
        ignore++
        history.back()
      }
    }
  }, [active])
}
