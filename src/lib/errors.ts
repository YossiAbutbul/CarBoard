/*
 * What the user sees when something fails: a short, friendly line, never the technical message.
 * The app's own messages are in Hebrew and are shown as they are; anything else (Firebase, the
 * network, a bug) is kept here, and "copy details" puts it on the clipboard for the developer.
 */

const log: string[] = []
const HEBREW = /[֐-׿]/

const text = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}\n${(e.stack ?? '').split('\n').slice(1, 6).join('\n')}` : String(e))

/** Keep an error for "copy details" (the last 5). */
export function recordError(e: unknown) {
  log.push(`[${new Date().toISOString()}] ${text(e)}`)
  if (log.length > 5) log.shift()
  console.error(e)
}

/** A line to show the user for this error. Empty for things the user did on purpose (closing the sign-in window). */
export function userMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const code = (e as { code?: string })?.code ?? ''
  if (/popup-closed|cancelled-popup|user-cancelled/.test(code + msg)) return ''
  if (HEBREW.test(msg)) return msg // the app's own words
  recordError(e)
  if (!navigator.onLine || /offline|network|unavailable/i.test(code + msg)) return 'אין חיבור לאינטרנט. נסו שוב כשהחיבור יחזור.'
  return 'משהו השתבש. נסו שוב בעוד רגע.'
}

/** Everything a developer needs, as plain text. */
export function errorDetails(extra?: unknown) {
  if (extra !== undefined) recordError(extra)
  return [
    `CarBoard v${__APP_VERSION__} (${__APP_BUILD__})`,
    `${location.href}`,
    `${navigator.userAgent}`,
    `online: ${navigator.onLine} · standalone: ${matchMedia('(display-mode: standalone)').matches}`,
    '',
    ...log,
  ].join('\n')
}

export async function copyText(s: string) {
  try {
    await navigator.clipboard.writeText(s)
    return true
  } catch {
    // older browsers, or no permission: the classic way
    const ta = document.createElement('textarea')
    ta.value = s
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}
