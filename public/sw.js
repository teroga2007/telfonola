// Sin caché de credenciales, QR ni respuestas de Spotify. La sesión requiere red.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
