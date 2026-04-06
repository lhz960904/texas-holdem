const CACHE_NAME = 'allin-v1'
const STATIC_ASSETS = [
  '/sounds/card-deal.mp3',
  '/sounds/card-flip.mp3',
  '/sounds/check.mp3',
  '/sounds/chips.mp3',
  '/sounds/fold.mp3',
  '/sounds/win.mp3',
  '/sounds/turn-alert.mp3',
]

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // Skip API and WebSocket requests
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/ws')) return

  // Cache-first for hashed assets (immutable) and sounds
  if (url.pathname.match(/\/assets\/.*\.[a-f0-9]{8}\./) || url.pathname.startsWith('/sounds/')) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached || fetch(e.request).then((res) => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone))
          return res
        })
      )
    )
    return
  }

  // Network-first for HTML and other resources
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
