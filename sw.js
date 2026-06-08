const CACHE = 'mjolby-stadsvandring-v13';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './content.js', './storytellers.js', './i18n.js', './data.json',
  './challenges.js', './vendor/qrcode.js',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './images/skanska-lasse.jpg', './images/header.jpg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});

// Is this our own app code/markup? (must always be fresh so design/code updates show)
function isShell(url){
  if (!url.startsWith(self.location.origin)) return false;
  return /\.(html|css|js|json|webmanifest)$/.test(url) || url.endsWith('/');
}

self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method !== 'GET') return;

  // App shell + navigations → NETWORK-FIRST (always get the latest; cache is offline fallback only).
  if (req.mode === 'navigate' || isShell(req.url)){
    e.respondWith(
      fetch(req).then(res=>{
        if (res && res.status===200){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req, copy)); }
        return res;
      }).catch(()=> caches.match(req).then(c=> c || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (map tiles, photos, fonts, Leaflet CDN) → cache-first + background refresh.
  e.respondWith(
    caches.match(req).then(cached=>{
      const net = fetch(req).then(res=>{
        if (res && res.status===200 && (req.url.startsWith(self.location.origin) || req.url.includes('tile.openstreetmap'))){
          const copy = res.clone(); caches.open(CACHE).then(c=>c.put(req, copy));
        }
        return res;
      }).catch(()=>cached);
      return cached || net;
    })
  );
});
