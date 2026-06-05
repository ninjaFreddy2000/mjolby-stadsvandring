const CACHE = 'mjolby-stadsvandring-v4';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './content.js', './storytellers.js', './data.json',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './images/skanska-lasse.jpg',
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

self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method !== 'GET') return;
  // Cache-first for app shell; network-first-ish (stale-while-revalidate) otherwise
  e.respondWith(
    caches.match(req).then(cached=>{
      const net = fetch(req).then(res=>{
        if (res && res.status===200 && (req.url.startsWith(self.location.origin) || req.url.includes('tile.openstreetmap'))){
          const copy = res.clone();
          caches.open(CACHE).then(c=>c.put(req, copy));
        }
        return res;
      }).catch(()=>cached);
      return cached || net;
    })
  );
});
