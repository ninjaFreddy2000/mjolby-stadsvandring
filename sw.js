const CACHE = 'mjolby-stadsvandring-v101';
// Separat runtime-cache för kartrutor/foton/fonter. Hålls UTANFÖR den versionerade
// shell-cachen så den (a) inte raderas vid varje koduppdatering och (b) kan trimmas
// till ett tak — annars växer den obegränsat på användarens enhet ("clogging up").
// v1 → v2: v1 innehöll Carto-rutor med "API key required"-vattenstämpel.
// Cachen bevaras med flit mellan kodsläpp, så ett URL-byte i koden räckte
// inte — de gamla rutorna serverades cache-first ändå. Namnbytet slänger dem.
const RUNTIME = 'mjolby-runtime-v2';
const RUNTIME_MAX = 250;   // max antal cachade rutor/foton; äldsta vräks (FIFO)

// Appen bor på /karta (karta.html). Roten ('/') är webbplatsens startsida (statisk,
// behöver inte cachas för offline). Vi förladdar app-skalet via ./karta.html.
const SHELL = [
  './karta', './karta.html', './styles.css', './app.js', './content.js', './storytellers.js', './cityintros.js', './i18n.js',
  // Stadsindexet (~40 kB) förladdas; stadschunkarna (data/city/*.json) hamnar i
  // cachen först när de faktiskt hämtas. Tidigare låg hela data.json (9,6 MB) här
  // och laddades ned vid varje SW-installation.
  './data/cities.json',
  './events.json', './config.js', './auth.js', './basemap.js', './tips.js', './ghosts.js', './axiom.js', './install.js', './comments.js', './routes.js', './icons.js', './impact.js',
  // challenges.js och admin.js laddas dynamiskt först när de behövs — de ligger
  // därför inte i shell-cachen utan hamnar i den när de faktiskt hämtas.
  // vendor/supabase.js (199 kB) och vendor/qrcode.js hämtas på begäran och
  // ligger därför inte i shell-cachen.
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  // Typsnitten är självhostade → de går att cacha. Tidigare låg de på
  // fonts.gstatic.com och appen var fontlös offline.
  './vendor/fonts/fonts.css', './vendor/fonts/fredoka-normal-latin.woff2', './vendor/fonts/mulish-normal-latin.woff2',
  './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/marker-icon-2x.png',
  './vendor/leaflet/images/marker-shadow.png', './vendor/leaflet/images/layers.png', './vendor/leaflet/images/layers-2x.png',
  './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './images/w320/skanska-lasse.webp', './images/w1200/header.webp',
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=>{
  // Behåll aktuell shell-cache + runtime-cachen; radera allt annat (gamla versioner).
  e.waitUntil(caches.keys().then(keys=>
    Promise.all(keys.filter(k=>k!==CACHE && k!==RUNTIME).map(k=>caches.delete(k)))
  ).then(()=>self.clients.claim()));
});

// Trimma en cache till maxantal poster. caches.keys() ger posterna i
// insättningsordning, så slice(0, n) är de äldsta → vräk dem (FIFO).
async function trimCache(name, max){
  const c = await caches.open(name);
  const keys = await c.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map(k=>c.delete(k)));
}

// Is this our own app code/markup? (must always be fresh so design/code updates show)
function isShell(url){
  if (!url.startsWith(self.location.origin)) return false;
  return /\.(html|css|js|json|webmanifest)$/.test(url) || url.endsWith('/');
}

self.addEventListener('fetch', e=>{
  const req = e.request;
  if (req.method !== 'GET') return;

  // Only manage our OWN (same-origin) assets. Third-party requests — map tiles,
  // Supabase media, fonts — must go straight to the network. Proxying cross-origin
  // no-cors requests through the SW broke tile loading: they came back failed/503
  // even though the exact same tile loads fine natively. Don't touch them.
  let sameOrigin = false;
  try { sameOrigin = new URL(req.url).origin === self.location.origin; } catch (e2) {}
  if (!sameOrigin) return;

  // App shell + navigations → NETWORK-FIRST (always get the latest; cache is offline fallback only).
  if (req.mode === 'navigate' || isShell(req.url)){
    e.respondWith(
      // Truly network-first: bypass the HTTP cache so app code/data updates show
      // immediately. The cached copy below remains the offline fallback.
      fetch(req, { cache: 'no-store' }).then(res=>{
        if (res && res.status===200){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req, copy)); }
        return res;
      }).catch(()=> caches.match(req).then(c=> c || caches.match('./karta.html')))
    );
    return;
  }

  // Everything else (map tiles, photos, fonts, Leaflet CDN) → cache-first + background
  // refresh, into the SIZE-CAPPED runtime cache so it can never grow without bound.
  e.respondWith(
    caches.match(req).then(cached=>{
      const net = fetch(req).then(res=>{
        if (res && res.status===200 && (req.url.startsWith(self.location.origin) || req.url.includes('server.arcgisonline.com'))){
          const copy = res.clone();
          caches.open(RUNTIME).then(c=>c.put(req, copy).then(()=>trimCache(RUNTIME, RUNTIME_MAX)));
        }
        return res;
      }).catch(()=>cached);
      return cached || net;
    })
  );
});
