// Push reminders, loaded into the app's service worker (vite.config.ts → workbox.importScripts).

self.addEventListener('push', event => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'CarBoard', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'CarBoard', {
      body: data.body || '',
      tag: data.tag, // a newer notice for the same reminder replaces the older one
      icon: '/icon-192.png',
      badge: '/favicon-32.png',
      dir: 'rtl',
      lang: 'he',
      data: { url: data.url || '/' },
    }),
  )
})

// Tapping a notice opens the app, or brings it forward if it is already open.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus()
      return self.clients.openWindow(url)
    }),
  )
})
