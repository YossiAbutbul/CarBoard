/**
 * Checks the server for a newer version now (the app also checks hourly). A new version downloads
 * in the background; when it is ready the update banner appears by itself.
 */
export async function checkForUpdate(): Promise<'new' | 'latest' | 'offline'> {
  if (!('serviceWorker' in navigator)) return 'latest'
  const reg = await navigator.serviceWorker.getRegistration()
  if (!reg) return 'latest'
  if (reg.waiting) return 'new'
  try {
    await reg.update()
  } catch {
    return 'offline'
  }
  const sw = reg.installing
  if (!sw) return reg.waiting ? 'new' : 'latest'
  // wait for the download to finish
  await new Promise<void>(done => {
    const check = () => (sw.state === 'installed' || sw.state === 'redundant' || sw.state === 'activated') && done()
    sw.addEventListener('statechange', check)
    check()
  })
  return reg.waiting ? 'new' : 'latest'
}
