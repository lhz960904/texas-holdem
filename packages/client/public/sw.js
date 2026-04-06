// Minimal service worker for PWA installability
// Network-first strategy — game needs live connection, no aggressive caching
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
