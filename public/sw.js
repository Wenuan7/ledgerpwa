const CACHE_NAME = 'ledgerpwa-v3'
const BASE_PATH = self.location.pathname.replace(/sw\.js$/, '')
const APP_SHELL = [BASE_PATH, `${BASE_PATH}index.html`, `${BASE_PATH}manifest.webmanifest`, `${BASE_PATH}favicon.svg`]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const requestUrl = new URL(event.request.url)
  if (requestUrl.origin !== self.location.origin) return

  const isDocument = event.request.mode === 'navigate'

  event.respondWith(
    (async () => {
      if (isDocument) {
        try {
          const fresh = await fetch(event.request)
          if (fresh && fresh.status === 200 && fresh.type === 'basic') {
            const clone = fresh.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return fresh
        } catch {
          const cachedDoc = await caches.match(event.request)
          if (cachedDoc) return cachedDoc
          const appShell = await caches.match(BASE_PATH)
          if (appShell) return appShell
          throw new Error('offline and no cached document')
        }
      }

      const cachedResponse = await caches.match(event.request)
      if (cachedResponse) return cachedResponse

      const networkResponse = await fetch(event.request)
      if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
        const responseClone = networkResponse.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone))
      }
      return networkResponse
    })(),
  )
})
