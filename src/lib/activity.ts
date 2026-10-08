/*
 * How many requests are on their way right now. Every call to the store goes through `tracked`, so
 * a thin bar at the top (ActivityBar) can show that the app is working and not stuck.
 */

let pending = 0
const subs = new Set<(n: number) => void>()

export function track<T>(p: Promise<T>): Promise<T> {
  pending++
  subs.forEach(f => f(pending))
  return p.finally(() => {
    pending--
    subs.forEach(f => f(pending))
  })
}

export function onActivity(f: (n: number) => void) {
  subs.add(f)
  return () => void subs.delete(f)
}

/** The same object, with each method that returns a promise counted while it runs. */
export function tracked<T extends object>(o: T): T {
  return new Proxy(o, {
    get(target, key, recv) {
      const v = Reflect.get(target, key, recv)
      if (typeof v !== 'function') return v
      return (...args: unknown[]) => {
        const r = v.apply(target, args)
        return r instanceof Promise ? track(r) : r
      }
    },
  })
}
