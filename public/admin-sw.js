/* SOORAR Admin service worker — served at /admin-sw.js, scope /admin (Service-Worker-Allowed: /admin).
   - /api/*: network-only, never cached.
   - Navigations: network-first, fall back to cached app shell, then offline page.
   - Hashed static assets (/assets/*), icons, brand images, fonts: cache-first. */
const VERSION = 'soorar-admin-v1';
const SHELL_CACHE = VERSION + '-shell';
const ASSET_CACHE = VERSION + '-assets';
const PRECACHE = ['/admin', '/admin-offline.html', '/admin.webmanifest', '/admin-icons/icon-192.png', '/admin-icons/icon-512.png', '/brand/soorar-logo.png', '/brand/soorar-logo-white.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('soorar-admin-') && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  if (url.origin === self.location.origin) {
    return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/admin-icons/') || url.pathname.startsWith('/brand/') || url.pathname.startsWith('/src/assets/');
  }
  return url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // never touch writes
  const url = new URL(req.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/api')) return; // network-only

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && url.pathname.startsWith('/admin')) {
          const c = await caches.open(SHELL_CACHE);
          c.put('/admin', res.clone());
        }
        return res;
      } catch (e) {
        const c = await caches.open(SHELL_CACHE);
        return (await c.match('/admin')) || (await c.match('/admin-offline.html')) || Response.error();
      }
    })());
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith((async () => {
      const c = await caches.open(ASSET_CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
  }
  // everything else: default network behaviour
});
