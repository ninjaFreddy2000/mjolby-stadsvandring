#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// build-seo.mjs — Genererar den crawl-bara SEO/AEO-ytan från data.json.
//
// VARFÖR: Appen är en SPA — allt innehåll renderas client-side via app.js, så
// view-source är tomt. Google och (i princip alla) LLM-svarsmotorer kör inte
// JS pålitligt → innehållet är osynligt. Den här generatorn producerar RIKTIGA
// statiska, server-levererade HTML-sidor (en per plats) + en platsindex +
// sitemap.xml + robots.txt + llms.txt. Textförst = bäst för LLM-extraktion.
//
// KÖR: node scripts/build-seo.mjs   (ingen build-kedja krävs; idempotent)
// Skriver till repo-roten. Kör om varje gång data.json ändras.
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SUMMARY_EN } from '../i18n.js';
import { EXTRA_IMAGES } from '../content.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://stadsvandring.io';          // kanonisk produktionsdomän
const SITE_NAME = 'Stadsvandring';
const BRAND = 'Stadsvandring.io';
const TODAY = new Date().toISOString().slice(0, 10);

const data = JSON.parse(readFileSync(join(ROOT, 'data.json'), 'utf8'));
// Exkludera demo-/testdata från den indexerbara ytan (tunt/irrelevant innehåll
// skadar SEO). Allt övrigt är riktiga, innehållsrika poster.
const isDemo = (e) => /^(demo|test)[-_]?/i.test(e.id || '') || /\b(demo|test)\b/i.test(e.id || '');
const entries = (data.entries || []).filter((e) => !isDemo(e));

// Evenemang per ort (stads-nycklat events.json) — renderas på ortssidan för
// färskt, crawlbart lokalt innehåll (SEO/LLM). Saknas filen körs allt vidare.
let EVENTS_BY_CITY = {};
try { EVENTS_BY_CITY = JSON.parse(readFileSync(join(ROOT, 'events.json'), 'utf8')) || {}; } catch { EVENTS_BY_CITY = {}; }

// ── helpers ───────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const attr = (s) => esc(s);
// Bild-url kan vara self-hostad (relativ) eller en absolut Wikimedia-URL.
const imgSrc = (u) => /^https?:\/\//.test(u) ? u : '/' + u;            // för <img src>
const imgAbs = (u) => /^https?:\/\//.test(u) ? u : `${BASE}/${u}`;     // för og:image/schema
const jsonld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const trunc = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };
const slug = (s) => String(s).toLowerCase()
  .replaceAll('å', 'a').replaceAll('ä', 'a').replaceAll('ö', 'o')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const CITIES = [...new Set(entries.map(e => e.city).filter(Boolean))];

// Evenemangssektion för en ortspost (kategori 'ort') — crawlbar lista.
function eventsSectionHtml(e) {
  if (!e || e.category !== 'ort') return '';
  const ce = EVENTS_BY_CITY[e.city];
  const evs = (ce && ce.events) || [];
  if (!evs.length) return '';
  const items = evs.map(ev =>
    `<li><b>${esc(ev.date || '')}</b>${ev.date ? ' — ' : ''}` +
    `<a href="${attr(ev.url || '#')}" rel="nofollow noopener" target="_blank">${esc(ev.title)}</a>` +
    `${ev.arena ? ` <span class="muted">· ${esc(ev.arena)}</span>` : ''}</li>`).join('');
  const intro = `Det händer alltid något i ${esc(e.city)} — här är ett urval ur kalendern${ce.source ? ` (källa: ${esc(ce.source)})` : ''}.`;
  return `<div class="card"><h2>Evenemang i ${esc(e.city)}</h2><p>${intro}</p>` +
    `<ul class="facts">${items}</ul>` +
    `${ce.sourceUrl ? `<p><a class="cta ghost" href="${attr(ce.sourceUrl)}" rel="nofollow noopener" target="_blank">Fler evenemang ↗</a></p>` : ''}</div>`;
}

// Haversine-avstånd (km) för "närliggande platser" → internt länkgraf.
function distKm(a, b) {
  if (!a?.lat || !b?.lat) return Infinity;
  const R = 6371, toR = (d) => d * Math.PI / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// Förbered de 3 närmaste (inom 60 km) för varje plats med koordinater.
function nearestFor(entry) {
  if (!entry.coordinates?.lat) return [];
  return entries
    .filter(o => o.id !== entry.id && o.coordinates?.lat)
    .map(o => ({ o, d: distKm(entry.coordinates, o.coordinates) }))
    .filter(x => x.d < 60)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.o);
}

// Kategori → mänsklig etikett (för synligt innehåll + nyckelord)
const CAT_LABEL = {
  ort: 'Ort', vattendrag: 'Vattendrag', kyrka: 'Kyrka', byggnad: 'Byggnad',
  torg: 'Torg', museum_hembygd: 'Museum & hembygd', handel: 'Handel',
  kafe_restaurang: 'Kafé & restaurang', hotell: 'Hotell',
  industri_foretag: 'Industri & företag', person: 'Person',
  konst_staty: 'Konst & staty', runsten: 'Runsten', klosterruin: 'Klosterruin',
  borgruin: 'Borgruin', bro: 'Bro', musikkar: 'Musikkår', handelse: 'Händelse',
  idrott: 'Idrott', station: 'Station',
};

// Kategori → engelsk etikett (för den engelska hub-sidan /en)
const CAT_LABEL_EN = {
  ort: 'Locality', vattendrag: 'Waterway', kyrka: 'Church', byggnad: 'Building',
  torg: 'Square', museum_hembygd: 'Museum & heritage', handel: 'Trade & commerce',
  kafe_restaurang: 'Café & restaurant', hotell: 'Hotel',
  industri_foretag: 'Industry & business', person: 'Person',
  konst_staty: 'Art & statue', runsten: 'Rune stone', klosterruin: 'Monastery ruin',
  borgruin: 'Castle ruin', bro: 'Bridge', musikkar: 'Marching band', handelse: 'Event',
  idrott: 'Sport', station: 'Station',
};

// Engelska sammanfattningar för de få poster som saknas i SUMMARY_EN (i18n.js).
// Trogna översättningar av den svenska summaryn — håller /en helt engelsk.
const EN_EXTRA = {
  'og-norra-vi-kyrka': 'The first Christian church in the village of Vi was probably a modest timber farm chapel, raised sometime in the 12th or 13th century.',
  'og-korpberget': 'A hilltop just outside the village with a beautiful view over Norra Vi.',
  'og-skuru': 'A farmstead whose main house was built around 1880, the barn in 1937 and the old timbered storehouse sometime in the 1800s.',
  'og-norra-vi-vandringsled': 'A marked hiking trail laid out by the Norra Vi heritage society, starting at Norra Vi church and heading west.',
  'og-ostgotaleden': 'The Östgötaleden long-distance trail can be walked year-round; from May it is fully maintained and at its best.',
  'og-mullsjo': 'Mullsjö — a small community with room for the things that matter.',
  'og-store-mosse-nationalpark': 'A short way from Värnamo lies Store Mosse National Park, a vast open wetland landscape of calm and stillness.',
  'kommunsammanslagningen-1971': 'In 1971 the towns of Mjölby and Skänninge and three rural municipalities were merged into today’s Mjölby Municipality.',
  'mjolby-mejeri': 'Mjölby’s old dairy on Kanikegatan, in operation from around 1900 to 1961 and later rebuilt as a community hall.',
};
const enSummary = (e) => SUMMARY_EN[e.id] || EN_EXTRA[e.id] || '';

// Kategori → Schema.org-typ (Place-subtyper får geo; Person/CreativeWork inte)
function schemaTypeFor(cat) {
  if (cat === 'person') return { type: 'Person', place: false };
  if (cat === 'handelse') return { type: 'CreativeWork', place: false };
  if (cat === 'kyrka') return { type: 'Church', place: true };
  if (cat === 'klosterruin' || cat === 'borgruin') return { type: 'LandmarksOrHistoricalBuildings', place: true };
  if (cat === 'museum_hembygd') return { type: 'Museum', place: true };
  if (cat === 'hotell') return { type: 'Hotel', place: true };
  if (cat === 'kafe_restaurang') return { type: 'Restaurant', place: true };
  if (cat === 'station') return { type: 'TrainStation', place: true };
  return { type: 'TouristAttraction', place: true };
}

// ── shared layout ───────────────────────────────────────────────────────────
function page({ title, description, canonical, head = '', body, lang = 'sv', alts = '', footerHtml = null, image = `${BASE}/images/og.jpg`, robots = 'index,follow,max-image-preview:large,max-snippet:-1', bodyAttrs = '' }) {
  const ogLocale = lang === 'en' ? 'en' : 'sv_SE';
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0A2A6B">
<title>${esc(title)}</title>
<meta name="description" content="${attr(description)}">
<link rel="canonical" href="${attr(canonical)}">
${alts}<meta name="robots" content="${attr(robots)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${attr(SITE_NAME)}">
<meta property="og:locale" content="${ogLocale}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(description)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(description)}">
<meta name="twitter:image" content="${attr(image)}">
<link rel="apple-touch-icon" href="/icons/icon-192.png">
<link rel="manifest" href="/manifest.webmanifest">
${head}
<style>
:root{--ink:#1b2a4a;--muted:#5a6680;--bg:#F3EAD8;--card:#fff;--accent:#0A2A6B;--line:#e6dcc6}
*{box-sizing:border-box}
body{margin:0;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Mulish,Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg)}
.wrap{max-width:760px;margin:0 auto;padding:24px 20px 64px}
a{color:var(--accent)}
header.site{display:flex;align-items:center;gap:10px;padding:8px 0 20px;border-bottom:1px solid var(--line);margin-bottom:24px}
header.site .mark{width:34px;height:34px;border-radius:9px;background:var(--accent);color:#fff;display:grid;place-items:center;font-weight:700;flex:0 0 auto}
header.site b{font-size:18px}
nav.crumbs{font-size:13px;color:var(--muted);margin:0 0 14px}
nav.crumbs a{color:var(--muted);text-decoration:none}
h1{font-size:30px;line-height:1.15;margin:6px 0 8px}
.badges{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 18px}
.badge{font-size:12px;font-weight:600;background:#fff;border:1px solid var(--line);color:var(--muted);padding:4px 10px;border-radius:999px}
.lead{font-size:18px;color:var(--ink);font-weight:500;margin:0 0 18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:0 0 18px}
h2{font-size:18px;margin:0 0 10px}
ul.facts{margin:0;padding-left:18px}
ul.facts li{margin:6px 0}
.sources li{margin:6px 0;word-break:break-word}
.cta{display:inline-block;background:var(--accent);color:#fff;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:12px;margin:6px 8px 6px 0}
.cta.ghost{background:#fff;color:var(--accent);border:1px solid var(--accent)}
footer.site{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.grid{display:grid;gap:12px}
@media(min-width:560px){.grid.two{grid-template-columns:1fr 1fr}}
.tile{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:inherit}
.tile b{display:block;color:var(--ink);margin-bottom:3px}
.tile span{font-size:13px;color:var(--muted)}
.city-h{font-size:15px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:26px 0 10px}
figure.hero{margin:0 0 18px}
figure.hero img{display:block;width:100%;height:auto;max-height:420px;object-fit:cover;border-radius:14px;border:1px solid var(--line)}
figure.hero figcaption{font-size:12px;color:var(--muted);margin:6px 2px 0}
</style>
</head>
<body${bodyAttrs ? ' ' + bodyAttrs : ''}>
<div class="wrap">
<header class="site">
  <a class="mark" href="/" aria-label="${attr(BRAND)} — hem">S</a>
  <div><b>${esc(BRAND)}</b></div>
</header>
${body}
<footer class="site">
${footerHtml || `  <p><strong>${esc(BRAND)}</strong> — guidade stadsvandringar i ${esc(CITIES.join(', '))}. Upptäck sevärdheter, historia och berättelser en plats i taget.</p>
  <p><a href="/karta">Öppna kartan &amp; appen</a> · <a href="/platser">Alla platser</a> · <a href="/om">Om &amp; vanliga frågor</a></p>`}
</footer>
</div>
</body>
</html>`;
}

// ── per-plats-sidor ─────────────────────────────────────────────────────────
let pageCount = 0;
const placeDir = join(ROOT, 'p');
if (existsSync(placeDir)) rmSync(placeDir, { recursive: true, force: true });
mkdirSync(placeDir, { recursive: true });

const urls = [
  { loc: `${BASE}/`, priority: '1.0', changefreq: 'weekly' },
  // OBS: /karta (appen) är medvetet noindex → ingår INTE i sitemap.
  { loc: `${BASE}/platser`, priority: '0.8', changefreq: 'weekly' },
  // Fristående marknadsföringssidor ("skyltfönstret") — handskrivna, ingår i sitemap.
  { loc: `${BASE}/bidra`, priority: '0.7', changefreq: 'monthly' },
  { loc: `${BASE}/partners`, priority: '0.7', changefreq: 'monthly' },
  { loc: `${BASE}/orter`, priority: '0.7', changefreq: 'monthly' },
  // Bloggen (handskriven) — index + inlägg.
  { loc: `${BASE}/blogg`, priority: '0.7', changefreq: 'weekly' },
  { loc: `${BASE}/blogg/elva-orter-pa-kartan`, priority: '0.6', changefreq: 'monthly' },
  { loc: `${BASE}/blogg/sa-gor-du-en-stadsvandring`, priority: '0.6', changefreq: 'monthly' },
];

for (const e of entries) {
  const s = slug(e.id || e.name);
  const catLabel = CAT_LABEL[e.category] || e.category || '';
  const desc = trunc(e.summary || e.description, 158);
  const canonical = `${BASE}/p/${s}`;
  const { type, place } = schemaTypeFor(e.category);

  // JSON-LD: huvudentitet
  const ld = { '@context': 'https://schema.org', '@type': type, name: e.name, url: canonical };
  if (e.summary || e.description) ld.description = trunc(e.description || e.summary, 500);
  if (place && e.coordinates?.lat) {
    ld.geo = { '@type': 'GeoCoordinates', latitude: e.coordinates.lat, longitude: e.coordinates.lng };
    ld.address = { '@type': 'PostalAddress', addressLocality: e.city, addressRegion: 'Östergötland', addressCountry: 'SE' };
  }
  if (e.city) ld.containedInPlace = { '@type': 'City', name: e.city };
  const sames = (e.sources || []).filter(u => /^https?:\/\//.test(u));
  if (sames.length) ld.sameAs = sames;
  // Riktigt foto (Wikimedia, self-hostat) → og:image + schema.org image på sidan.
  const ex = EXTRA_IMAGES[e.id];
  // url kan vara antingen self-hostad (relativ) eller en absolut Wikimedia-URL.
  const isAbs = ex && /^https?:\/\//.test(ex.url);
  const photoUrl = ex ? (isAbs ? ex.url : `${BASE}/${ex.url}`) : undefined;  // absolut för og:image/schema
  const photoSrc = ex ? (isAbs ? ex.url : `/${ex.url}`) : undefined;          // för <img src>
  if (photoUrl) ld.image = photoUrl;

  // JSON-LD: breadcrumb
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hem', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Platser', item: `${BASE}/platser` },
      { '@type': 'ListItem', position: 3, name: e.name, item: canonical },
    ],
  };

  const facts = (e.key_facts || []).map(f => `<li>${esc(f)}</li>`).join('');
  const nearby = nearestFor(e);
  const nearbyHtml = nearby.length ? `<div class="card"><h2>Närliggande platser</h2><div class="grid two">${
    nearby.map(o => `<a class="tile" href="/p/${slug(o.id || o.name)}"><b>${esc(o.name)}</b><span>${esc(CAT_LABEL[o.category] || o.category || '')}${o.city && o.city !== e.city ? ' · ' + esc(o.city) : ''}</span></a>`).join('')
  }</div></div>` : '';
  const sourcesHtml = (e.sources || []).filter(u => /^https?:\/\//.test(u))
    .map(u => `<li><a href="${attr(u)}" rel="nofollow noopener" target="_blank">${esc(u.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></li>`).join('');

  const body = `
<nav class="crumbs"><a href="/">Hem</a> › <a href="/platser">Platser</a> › ${esc(e.name)}</nav>
<article>
  <div class="badges">
    ${catLabel ? `<span class="badge">${esc(catLabel)}</span>` : ''}
    ${e.city ? `<span class="badge">📍 ${esc(e.city)}</span>` : ''}
    ${e.era ? `<span class="badge">${esc(e.era)}</span>` : ''}
  </div>
  <h1>${esc(e.name)}</h1>
  ${photoUrl ? `<figure class="hero"><img src="${attr(photoSrc)}" alt="${attr(e.name)}" width="1280" loading="eager" referrerpolicy="no-referrer"${ex.focal ? ` style="object-position:${attr(ex.focal)}"` : ''}>${ex.attribution ? `<figcaption>📷 ${esc(ex.attribution)}</figcaption>` : ''}</figure>` : ''}
  ${e.summary ? `<p class="lead">${esc(e.summary)}</p>` : ''}
  ${e.description ? `<div class="card"><p>${esc(e.description)}</p></div>` : ''}
  ${facts ? `<div class="card"><h2>Snabbfakta</h2><ul class="facts">${facts}</ul></div>` : ''}
  ${eventsSectionHtml(e)}
  <p>
    <a class="cta" href="/karta">Visa på kartan</a>
    <a class="cta ghost" href="/platser">Alla platser i ${esc(e.city || SITE_NAME)}</a>
  </p>
  ${nearbyHtml}
  ${sourcesHtml ? `<div class="card"><h2>Källor</h2><ul class="sources">${sourcesHtml}</ul></div>` : ''}
</article>`;

  const html = page({
    title: `${e.name} – ${e.city || 'Stadsvandring'} | ${BRAND}`,
    description: desc,
    canonical,
    image: photoUrl,
    head: jsonld(ld) + '\n' + jsonld(crumbs),
    body,
  });
  writeFileSync(join(placeDir, `${s}.html`), html);
  urls.push({ loc: canonical, priority: '0.7', changefreq: 'monthly', image: photoUrl, imageTitle: e.name });
  pageCount++;
}

// ── platsindex (/platser) ────────────────────────────────────────────────────
const byCity = {};
for (const e of entries) (byCity[e.city || 'Övrigt'] ||= []).push(e);
const indexBody = `
<nav class="crumbs"><a href="/">Hem</a> › Platser</nav>
<h1>Alla platser</h1>
<p class="lead">${entries.length} sevärdheter, byggnader, personer och berättelser i ${esc(CITIES.join(', '))} — kartlagda för stadsvandring.</p>
<h2 class="city-h">Vandringsturer</h2>
<div class="grid two">
  <a class="tile" href="/tur/central"><b>🚶 Centrala vandringen</b><span>Mjölby · från stationen genom kvarnbyns hjärta, ca 2 km</span></a>
  <a class="tile" href="/tur/medeltidsringen"><b>🚶 Medeltidsringen</b><span>Skänninge &amp; Bjälbo · Folkungaätten, kloster och runstenar</span></a>
</div>
${Object.entries(byCity).map(([city, list]) => `
<h2 class="city-h">${esc(city)} · ${list.length} platser</h2>
<div class="grid two">
${list.map(e => `<a class="tile" href="/p/${slug(e.id || e.name)}"><b>${esc(e.name)}</b><span>${esc(CAT_LABEL[e.category] || e.category || '')}${e.era ? ' · ' + esc(e.era) : ''}</span></a>`).join('\n')}
</div>`).join('\n')}
<p style="margin-top:30px"><a class="cta" href="/karta">Öppna kartan &amp; appen</a></p>`;

const indexLd = {
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  name: 'Alla platser – Stadsvandring', url: `${BASE}/platser`,
  about: CITIES.map(c => ({ '@type': 'City', name: c })),
  mainEntity: {
    '@type': 'ItemList', numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem', position: i + 1, name: e.name, url: `${BASE}/p/${slug(e.id || e.name)}`,
    })),
  },
};
writeFileSync(join(ROOT, 'platser.html'), page({
  title: `Alla platser i ${CITIES.join(', ')} | ${BRAND} Stadsvandring`,
  description: trunc(`Utforska ${entries.length} sevärdheter, byggnader och historiska platser i ${CITIES.join(', ')}. Guidade stadsvandringar med karta, berättelser och quiz.`, 158),
  canonical: `${BASE}/platser`,
  head: jsonld(indexLd),
  body: indexBody,
}));

// ── /om (About + FAQ, FAQPage-schema) ────────────────────────────────────────
const byId = (id) => entries.find(e => (e.id || '') === id);
const mjo = byId('mjolby-orten'), ska = byId('skanninge-mote-1248');
const faqs = [
  { q: 'Vad är Stadsvandring.io?', a: `Stadsvandring.io är en gratis webbapp (PWA) för guidade stadsvandringar i ${CITIES[0]} med omnejd. Du utforskar sevärdheter, byggnader, historia och berättelser via en interaktiv karta, samlar digitala stämplar när du besöker platser och testar dina kunskaper med quiz.` },
  { q: 'Vilka orter kan jag utforska?', a: `Du kan vandra i ${CITIES.join(', ')} samt kringliggande platser i Östergötland. Totalt finns ${entries.length} kartlagda sevärdheter, byggnader, personer och historiska händelser.` },
  { q: 'Behöver jag installera en app?', a: 'Nej. Stadsvandring.io körs direkt i webbläsaren på mobil och dator. Du kan också installera den som app via "Lägg till på hemskärmen" (PWA) för snabb åtkomst och offline-stöd.' },
  { q: 'Vad kan jag göra i appen?', a: 'Du kan följa tematiska vandringsturer steg för steg, utforska platser på en karta, läsa om historia och personer, samla stämplar vid besök och testa dina kunskaper i quiz.' },
  { q: 'Finns Stadsvandring.io på engelska?', a: 'Ja. Du kan när som helst växla mellan svenska och engelska direkt i appen.' },
  mjo ? { q: 'Vad är Mjölby känt för?', a: mjo.summary + (mjo.era ? ` (${mjo.era}.)` : '') } : null,
  ska ? { q: 'Vad var Skänninge möte?', a: ska.summary } : null,
].filter(Boolean);

const faqLd = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faqs.map(f => ({
    '@type': 'Question', name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};
const omBody = `
<nav class="crumbs"><a href="/">Hem</a> › Om</nav>
<h1>Om Stadsvandring.io</h1>
<p class="lead">Stadsvandring.io är en gratis webbapp för guidade stadsvandringar i ${esc(CITIES.join(', '))}. Upptäck ${entries.length} sevärdheter, byggnader, personer och historiska händelser — en plats i taget, med karta, berättelser, stämplar och quiz.</p>
<div class="card">
  <p>Stadsvandring.io gör lokalhistorien levande och promenadvänlig. Varje plats har en kort sammanfattning, en fördjupande beskrivning, snabbfakta och källor — så att både besökare, skolklasser och nyfikna invånare kan lära känna sin stad på djupet. Innehållet bygger på källor som Wikipedia, ${esc(CITIES[0].toLowerCase())}.se och lokalhistoriskt material.</p>
</div>
<h2 class="city-h">Vanliga frågor</h2>
${faqs.map(f => `<div class="card"><h2>${esc(f.q)}</h2><p>${esc(f.a)}</p></div>`).join('\n')}
<p style="margin-top:24px"><a class="cta" href="/karta">Öppna kartan &amp; appen</a> <a class="cta ghost" href="/platser">Alla platser</a></p>`;
writeFileSync(join(ROOT, 'om.html'), page({
  title: `Om Stadsvandring.io – Guidade stadsvandringar i ${CITIES[0]} | Vanliga frågor`,
  description: trunc(`Vad är Stadsvandring.io? En gratis webbapp för guidade stadsvandringar i ${CITIES.join(', ')} med karta, berättelser, stämplar och quiz. Svar på vanliga frågor.`, 158),
  canonical: `${BASE}/om`,
  head: jsonld(faqLd),
  body: omBody,
}));
urls.push({ loc: `${BASE}/om`, priority: '0.6', changefreq: 'monthly' });

// ── /en (engelsk hub-sida — innehållsrik, byggd på SUMMARY_EN) ────────────────
// VARFÖR EN HUB istället för per-plats EN-sidor: vi har trogna engelska
// sammanfattningar men inte fullständiga engelska beskrivningar. Per-plats
// EN-sidor med bara en summary blir "thin content" som SKADAR ranking. En enda
// innehållsrik hub som samlar alla engelska sammanfattningar fångar engelska
// sök ("Mjölby walking tour", "things to do in Mjölby") med RIKTIGT innehåll,
// utan tunna sidor och utan att maskinöversätta hela beskrivningar.
const enAlts = `<link rel="alternate" hreflang="en" href="${BASE}/en">
<link rel="alternate" hreflang="sv" href="${BASE}/">
<link rel="alternate" hreflang="x-default" href="${BASE}/">
`;
const enByCity = {};
for (const e of entries) (enByCity[e.city || 'Other'] ||= []).push(e);
// Mjölby först, sen efter antal platser
const enCityOrder = Object.entries(enByCity).sort((a, b) =>
  (a[0] === 'Mjölby' ? -1 : b[0] === 'Mjölby' ? 1 : b[1].length - a[1].length));
const enToursMeta = [
  { slug: 'central', name: 'The Central Walk',
    blurb: 'From the railway station through the heart of the old mill town — about 2 km. The station that turned a milling village into a railway junction, Stora Torget, the medieval church and the open-air heritage farm.' },
  { slug: 'medeltidsringen', name: 'The Medieval Ring',
    blurb: 'In the footsteps of the Folkunga dynasty around Skänninge & Bjälbo — churches, monastery ruins and rune stones from the 13th-century power centre of Östergötland.' },
];
const enBody = `
<nav class="crumbs"><a href="/">Hem (svenska)</a> › English</nav>
<div class="badges">
  <span class="badge">🇬🇧 English</span>
  <span class="badge">📍 ${esc(CITIES.join(', '))}</span>
  <span class="badge">${entries.length} places</span>
</div>
<h1>Self-guided city walks in Mjölby, Sweden</h1>
<p class="lead">Stadsvandring.io is a free web app (PWA) for self-guided walking tours in ${esc(CITIES.join(', '))} and the surrounding Östergötland countryside. Explore ${entries.length} sights, buildings, people and historic events one place at a time — with an interactive map, walking routes, collectible stamps and quizzes.</p>
<div class="card">
  <p>No installation needed: Stadsvandring.io runs straight in your browser on phone and desktop, and you can switch between <strong>English and Swedish</strong> at any time inside the app. Below is an English overview of every place. The full place articles are written in Swedish — open the app and tap the flag to read them in English.</p>
  <p style="margin:14px 0 0"><a class="cta" href="/karta">Open the map &amp; app</a> <a class="cta ghost" href="/platser">All places (Swedish)</a></p>
</div>
<h2 class="city-h">Walking tours</h2>
<div class="grid">
${enToursMeta.map(t => `  <a class="tile" href="/tur/${t.slug}"><b>🚶 ${esc(t.name)}</b><span>${esc(t.blurb)}</span></a>`).join('\n')}
</div>
${enCityOrder.map(([city, list]) => `
<h2 class="city-h">${esc(city)} · ${list.length} places</h2>
<div class="grid">
${list.map(e => {
  const s = enSummary(e);
  const cat = CAT_LABEL_EN[e.category] || e.category || '';
  return `  <div class="tile"><b>${esc(e.name)}</b><span>${esc(cat)}${s ? ' · ' + esc(s) : ''}</span></div>`;
}).join('\n')}
</div>`).join('\n')}
<p style="margin-top:30px"><a class="cta" href="/karta">Open the map &amp; app</a></p>`;

const enLd = {
  '@context': 'https://schema.org', '@type': 'CollectionPage',
  name: 'Self-guided city walks in Mjölby, Sweden — Stadsvandring.io', url: `${BASE}/en`,
  inLanguage: 'en', about: CITIES.map(c => ({ '@type': 'City', name: c })),
  mainEntity: {
    '@type': 'ItemList', numberOfItems: entries.length,
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem', position: i + 1, name: e.name,
      description: enSummary(e) || undefined,
    })),
  },
};
const enFooter = `  <p><strong>${esc(BRAND)}</strong> — self-guided walking tours in ${esc(CITIES.join(', '))}, Sweden. Discover sights, history and stories one place at a time.</p>
  <p><a href="/karta">Open the map &amp; app</a> · <a href="/">Svenska</a></p>`;
writeFileSync(join(ROOT, 'en.html'), page({
  title: `Mjölby walking tours — self-guided city walks in Sweden | ${BRAND}`,
  description: trunc(`Free self-guided walking tours in ${CITIES.join(', ')}, Sweden. ${entries.length} sights, buildings and historic places with a map, routes, stamps and quizzes. In English and Swedish.`, 158),
  canonical: `${BASE}/en`,
  lang: 'en', alts: enAlts, footerHtml: enFooter,
  head: jsonld(enLd),
  body: enBody,
}));
urls.push({ loc: `${BASE}/en`, priority: '0.7', changefreq: 'monthly' });

// ── Vandringsturer (/tur/<slug>, TouristTrip-schema) ─────────────────────────
// Speglar TOURS i app.js: 'central' via flagga+stop_no, 'medeltidsringen' via sekvens.
const TOURS = [
  {
    slug: 'central', name: 'Centrala vandringen',
    sub: 'Från stationen genom kvarnbyns hjärta — ca 2 km.', area: 'Mjölby',
    intro: 'En lättgången slinga genom Mjölbys historiska kärna — från järnvägsstationen som förvandlade kvarnbyn till järnvägsknut, via Stora Torget och kyrkan till hembygdsgården på Norrgårdsholmen. Cirka 2 km i lugn takt.',
    stops: entries.filter(e => e.tour && e.tour.in_central_walk)
      .sort((a, b) => (a.tour.stop_no || 99) - (b.tour.stop_no || 99)),
  },
  {
    slug: 'medeltidsringen', name: 'Medeltidsringen',
    sub: 'Folkungaätten, kloster och runstenar runt Skänninge & Bjälbo.', area: 'Skänninge & Bjälbo',
    intro: 'En vandring i Folkungaättens fotspår genom medeltidens Skänninge och Bjälbo — kyrkor, klosterruiner och runstenar som berättar om 1200-talets maktcentrum i Östergötland.',
    stops: ['bjalbo-kyrka', 'hogbystenen', 'skanninge-orten', 'varfrukyrkan-skanninge',
      'sta-ingrids-kloster', 'ture-lang', 'svaneholms-borgruin'].map(byId).filter(Boolean),
  },
];

const turDir = join(ROOT, 'tur');
if (existsSync(turDir)) rmSync(turDir, { recursive: true, force: true });
mkdirSync(turDir, { recursive: true });

for (const t of TOURS) {
  const canonical = `${BASE}/tur/${t.slug}`;
  const tripLd = {
    '@context': 'https://schema.org', '@type': 'TouristTrip',
    name: t.name, description: t.intro, url: canonical, touristType: 'sightseeing',
    itinerary: {
      '@type': 'ItemList', numberOfItems: t.stops.length,
      itemListElement: t.stops.map((e, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'TouristAttraction', name: e.name, url: `${BASE}/p/${slug(e.id || e.name)}` },
      })),
    },
  };
  const crumbs = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hem', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Vandringsturer', item: `${BASE}/platser` },
      { '@type': 'ListItem', position: 3, name: t.name, item: canonical },
    ],
  };
  const stopsHtml = t.stops.map((e, i) => `<a class="tile" href="/p/${slug(e.id || e.name)}"><b>${i + 1}. ${esc(e.name)}</b><span>${esc(CAT_LABEL[e.category] || e.category || '')}${e.summary ? ' · ' + esc(trunc(e.summary, 70)) : ''}</span></a>`).join('\n');
  const body = `
<nav class="crumbs"><a href="/">Hem</a> › <a href="/platser">Vandringsturer</a> › ${esc(t.name)}</nav>
<div class="badges"><span class="badge">🚶 Vandringstur</span><span class="badge">📍 ${esc(t.area)}</span><span class="badge">${t.stops.length} stopp</span></div>
<h1>${esc(t.name)}</h1>
<p class="lead">${esc(t.sub)}</p>
<div class="card"><p>${esc(t.intro)}</p></div>
<h2 class="city-h">Stopp längs vägen</h2>
<div class="grid">${stopsHtml}</div>
<p style="margin-top:24px"><a class="cta" href="/karta">Starta vandringen i appen</a> <a class="cta ghost" href="/platser">Alla platser</a></p>`;
  writeFileSync(join(turDir, `${t.slug}.html`), page({
    title: `${t.name} – guidad stadsvandring i ${t.area} | ${BRAND}`,
    description: trunc(`${t.sub} ${t.stops.length} stopp med karta, berättelser och quiz i ${BRAND}.`, 158),
    canonical, head: jsonld(tripLd) + '\n' + jsonld(crumbs), body,
  }));
  urls.push({ loc: canonical, priority: '0.8', changefreq: 'monthly' });
}

// ── Leadmagnet M1: PDF-stadsvandring per ort (/stadsvandring/<ort>) ───────────
// Per kvalificerad ort (≥6 poster) genereras TVÅ sidor:
//   • teaser  /stadsvandring/<ort>        — PUBLIK, indexerbar (SEO/AEO-ytan):
//       ingress, Leaflet-karta, 3 stopp, FAQ, TouristTrip+FAQPage-JSON-LD,
//       och signup-gaten som fångar e-post (leads) + skickar magic-länk.
//   • guide   /stadsvandring/<ort>/guide  — NOINDEX, gatad: hela vandringen +
//       "Spara som PDF" (window.print). Låses upp av inloggad session.
// Klientlogiken ligger i /leadmagnet.js (CSP script-src 'self' → ingen inline-JS).
const lmDir = join(ROOT, 'stadsvandring');
if (existsSync(lmDir)) rmSync(lmDir, { recursive: true, force: true });
mkdirSync(lmDir, { recursive: true });

const imgFor = (e) => EXTRA_IMAGES[e.id] || null;
const centroidOf = (list) => {
  const pts = list.map(e => e.coordinates).filter(c => c?.lat && c?.lng);
  if (!pts.length) return null;
  return { lat: pts.reduce((s, c) => s + c.lat, 0) / pts.length,
           lng: pts.reduce((s, c) => s + c.lng, 0) / pts.length };
};

const LM_ASSETS = `<link rel="stylesheet" href="/vendor/leaflet/leaflet.css">
<script defer src="/vendor/supabase.js"></script>
<script defer src="/vendor/leaflet/leaflet.js"></script>
<script type="module" src="/leadmagnet.js"></script>`;

let lmCount = 0;
for (const city of CITIES) {
  const cityEntries = entries.filter(e => e.city === city);
  if (cityEntries.length < 6) continue;            // för tunt för en meningsfull vandring

  const citySlug = slug(city);
  const ortEntry = cityEntries.find(e => e.category === 'ort') || null;
  const stops = cityEntries.filter(e => e !== ortEntry && e.coordinates?.lat && e.coordinates?.lng);
  if (stops.length < 3) continue;
  const teaserStops = stops.slice(0, 3);
  const centroid = ortEntry?.coordinates?.lat ? ortEntry.coordinates : centroidOf(stops);
  const canonical = `${BASE}/stadsvandring/${citySlug}`;
  const guidePath = `/stadsvandring/${citySlug}/guide`;
  const ingress = ortEntry?.summary
    || `Upptäck ${city} till fots: ${stops.length} sevärdheter med karta, historia och berättelser — en gratis självguidad stadsvandring.`;
  const ld = imgFor(ortEntry || teaserStops[0] || {});
  const ogImg = ld ? imgAbs(ld.url) : `${BASE}/images/og.jpg`;

  // FAQ — fristående, citerbara svar (AEO-bränsle + FAQPage-JSON-LD).
  const faqs = [];
  if (ortEntry?.summary) faqs.push({ q: `Vad är ${city} känt för?`, a: ortEntry.summary });
  faqs.push({ q: `Är stadsvandringen i ${city} gratis?`,
    a: `Ja. Karta, alla ${stops.length} stopp och hela guiden är gratis på ${BRAND}. Du anger bara din e-post för att låsa upp den nedladdningsbara PDF-vandringen.` });
  faqs.push({ q: `Hur många sevärdheter ingår i stadsvandringen i ${city}?`,
    a: `Vandringen samlar ${stops.length} sevärdheter i ${city} — kyrkor, torg, byggnader och platser med en historia, alla nåbara till fots.` });
  for (const s of stops.slice(0, 4)) if (s.summary) faqs.push({ q: `Vad är ${s.name}?`, a: s.summary });

  // ── JSON-LD ──
  const tripLd = {
    '@context': 'https://schema.org', '@type': 'TouristTrip',
    name: `Stadsvandring i ${city}`, description: ingress, url: canonical, touristType: 'Sightseeing',
    itinerary: {
      '@type': 'ItemList', numberOfItems: stops.length,
      itemListElement: stops.map((s, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: {
          '@type': 'TouristAttraction', name: s.name,
          ...(s.summary ? { description: trunc(s.summary, 160) } : {}),
          url: `${BASE}/p/${slug(s.id || s.name)}`,
          ...(s.coordinates?.lat ? { geo: { '@type': 'GeoCoordinates', latitude: s.coordinates.lat, longitude: s.coordinates.lng } } : {}),
        },
      })),
    },
  };
  const faqLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Hem', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Stadsvandringar', item: `${BASE}/platser` },
      { '@type': 'ListItem', position: 3, name: `Stadsvandring i ${city}`, item: canonical },
    ],
  };

  // ── CSP-säkert data-block till leadmagnet.js (karta + gate-metadata) ──
  const lmData = {
    citySlug, sourceSlug: `stadsvandring/${citySlug}`,
    centroid: centroid ? { lat: centroid.lat, lng: centroid.lng } : null,
    stops: teaserStops.map(s => ({ name: s.name, lat: s.coordinates.lat, lng: s.coordinates.lng })),
  };
  const dataBlock = `<script type="application/json" id="lm-data">${JSON.stringify(lmData).replace(/</g, '\\u003c')}</script>`;

  // ── teaser-body ──
  const stopCard = (s, i) => {
    const im = imgFor(s);
    return `<a class="tile" href="/p/${slug(s.id || s.name)}">` +
      (im ? `<img src="${attr(imgSrc(im.url))}" referrerpolicy="no-referrer" alt="${attr(s.name)}" loading="lazy" style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:8px">` : '') +
      `<b>${i + 1}. ${esc(s.name)}</b><span>${esc(CAT_LABEL[s.category] || s.category || '')}${s.summary ? ' · ' + esc(trunc(s.summary, 80)) : ''}</span></a>`;
  };
  const faqHtml = faqs.map(f => `<details class="faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('\n');

  const teaserBody = `
<nav class="crumbs"><a href="/">Hem</a> › <a href="/platser">Stadsvandringar</a> › ${esc(city)}</nav>
<div class="badges"><span class="badge">🚶 Stadsvandring</span><span class="badge">📍 ${esc(city)}</span><span class="badge">${stops.length} stopp</span><span class="badge">Gratis</span></div>
<h1>Stadsvandring i ${esc(city)} — gratis karta &amp; guide</h1>
<p class="lead">${esc(ingress)}</p>
<div id="lm-map" class="lm-map" role="img" aria-label="Karta över stadsvandringen i ${attr(city)}"></div>
<h2 class="city-h">Tre stopp att börja med</h2>
<div class="grid two">
${teaserStops.map(stopCard).join('\n')}
</div>

<section class="gate card" id="lm-gate">
  <h2>Ladda ner hela vandringen gratis</h2>
  <p>Ange din e-post så låser vi upp PDF-kartan, alla ${stops.length} stopp och hela guiden — direkt i mejlen.</p>
  <form id="lm-gate-form" data-guide-url="${attr(guidePath)}" novalidate>
    <input type="email" name="email" inputmode="email" autocomplete="email" required placeholder="din@epost.se" aria-label="E-postadress">
    <label class="consent"><input type="checkbox" name="consent"> Skicka mig fler gratis stadsvandringar och tips (valfritt)</label>
    <button type="submit" class="cta">Lås upp hela vandringen →</button>
    <p id="lm-gate-status" class="lm-status" role="status" aria-live="polite"></p>
  </form>
  <p id="lm-gate-unlocked" class="lm-status ok" hidden>Du är redan inloggad. <a href="${attr(guidePath)}">Öppna hela vandringen →</a></p>
</section>

<h2 class="city-h">Vanliga frågor</h2>
${faqHtml}

<p style="margin-top:24px"><a class="cta ghost" href="/platser">Alla platser</a> <a class="cta ghost" href="/karta">Öppna kartan &amp; appen</a></p>`;

  const lmHead = `<style>
.lm-map{height:300px;border-radius:14px;border:1px solid var(--line);margin:0 0 22px;background:#eee}
.faq{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0 16px;margin:0 0 10px}
.faq summary{cursor:pointer;font-weight:600;padding:14px 0}
.faq p{margin:0 0 14px;color:var(--muted)}
.gate input[type=email]{width:100%;padding:12px 14px;border:1px solid var(--line);border-radius:10px;font:inherit;margin:4px 0 10px}
.gate .consent{display:flex;gap:8px;align-items:flex-start;font-size:14px;color:var(--muted);margin:0 0 14px}
.gate .cta{border:0;cursor:pointer;width:100%;font-size:16px}
.lm-status{font-size:14px;margin:10px 0 0;min-height:1em}
.lm-status.ok{color:#1a7f37}
.lm-status.err{color:#b3261e}
</style>
${LM_ASSETS}
${jsonld(tripLd)}
${jsonld(faqLd)}
${jsonld(crumbLd)}`;

  writeFileSync(join(lmDir, `${citySlug}.html`), page({
    title: `Stadsvandring i ${city} — gratis karta, guide & PDF | ${BRAND}`,
    description: trunc(`${ingress} Karta, ${stops.length} stopp och nedladdningsbar PDF-guide — gratis.`, 158),
    canonical, image: ogImg, head: dataBlock + '\n' + lmHead, body: teaserBody,
    bodyAttrs: 'data-lm-page="teaser"',
  }));
  urls.push({ loc: canonical, priority: '0.85', changefreq: 'monthly', image: ogImg, imageTitle: `Stadsvandring i ${city}` });

  // ── gatad guide (noindex) ──
  const fullStop = (s, i) => {
    const im = imgFor(s);
    const facts = Array.isArray(s.key_facts) && s.key_facts.length
      ? `<ul class="facts">${s.key_facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
    return `<article class="card stop">
<h3>${i + 1}. ${esc(s.name)}</h3>
<div class="badges"><span class="badge">${esc(CAT_LABEL[s.category] || s.category || '')}</span>${s.era ? `<span class="badge">${esc(s.era)}</span>` : ''}</div>
${im ? `<img src="${attr(imgSrc(im.url))}" referrerpolicy="no-referrer" alt="${attr(s.name)}" loading="lazy" style="width:100%;max-height:280px;object-fit:cover;border-radius:10px;margin:4px 0 12px">` : ''}
<p>${esc(s.description || s.summary || '')}</p>
${facts}</article>`;
  };
  const guideBody = `
<nav class="crumbs no-print"><a href="/">Hem</a> › <a href="/stadsvandring/${citySlug}">Stadsvandring i ${esc(city)}</a> › Hela guiden</nav>

<section id="lm-locked" class="card lock no-print">
  <h1>Hela stadsvandringen i ${esc(city)}</h1>
  <p>Den fullständiga guiden låses upp när du angett din e-post. Det tar tio sekunder och är gratis.</p>
  <p><a class="cta" href="/stadsvandring/${citySlug}#lm-gate">Lås upp via e-post →</a></p>
</section>

<div id="lm-guide-full" hidden>
  <div class="badges no-print"><span class="badge">🚶 Hela vandringen</span><span class="badge">📍 ${esc(city)}</span><span class="badge">${stops.length} stopp</span></div>
  <h1>Stadsvandring i ${esc(city)} — hela guiden</h1>
  <p class="lead">${esc(ingress)}</p>
  <p class="no-print"><button id="lm-print" class="cta">💾 Spara som PDF / skriv ut</button></p>
  ${stops.map(fullStop).join('\n')}
  <footer class="guide-foot"><p>Källa: ${esc(BRAND)} — ${esc(city)}. Innehåll från Wikipedia/Wikidata m.fl. under fria licenser.</p></footer>
</div>`;

  const guideHead = `<style>
.stop h3{font-size:20px;margin:0 0 6px}
.lock{text-align:center}
@media print{
  .no-print{display:none !important}
  body{background:#fff}
  .wrap{max-width:100%;padding:0}
  header.site,footer.site{display:none}
  .card{border:0;box-shadow:none;padding:0;margin:0 0 18px;break-inside:avoid}
  .badge{border:1px solid #ccc}
}
</style>
<script defer src="/vendor/supabase.js"></script>
<script type="module" src="/leadmagnet.js"></script>`;

  // Teaser = stadsvandring/<ort>.html → /stadsvandring/<ort> (cleanUrls).
  // Guide  = stadsvandring/<ort>/guide.html → /stadsvandring/<ort>/guide.
  // <ort>.html och katalogen <ort>/ samexisterar utan kollision (ingen
  // <ort>/index.html finns), så båda rena URL:erna löser rätt fil direkt.
  mkdirSync(join(lmDir, citySlug), { recursive: true });
  writeFileSync(join(lmDir, citySlug, 'guide.html'), page({
    title: `Hela stadsvandringen i ${city} (PDF) | ${BRAND}`,
    description: `Hela den självguidade stadsvandringen i ${city} — alla ${stops.length} stopp att spara som PDF.`,
    canonical: `${BASE}${guidePath}`, robots: 'noindex,nofollow', head: guideHead, body: guideBody,
    bodyAttrs: 'data-lm-page="guide"',
  }));
  lmCount++;
}

// ── sitemap.xml ──────────────────────────────────────────────────────────────
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${TODAY}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority>${
    u.image ? `<image:image><image:loc>${u.image}</image:loc><image:title>${esc(u.imageTitle || '')}</image:title></image:image>` : ''
  }</url>`).join('\n')}
</urlset>
`;
writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);

// ── robots.txt (välkomna AI-crawlers explicit) ───────────────────────────────
const robots = `# robots.txt — ${SITE_NAME}
# Alla sökmotorer välkomna. AI-svarsmotorer (AEO) uttryckligen tillåtna —
# målet är att bli läst OCH citerad av LLM:er.
User-agent: *
Allow: /

# AI-/LLM-crawlers (tillåt indexering & citering)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-Web
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /
User-agent: CCBot
Allow: /
User-agent: Bingbot
Allow: /

Sitemap: ${BASE}/sitemap.xml
`;
writeFileSync(join(ROOT, 'robots.txt'), robots);

// ── llms.txt (AEO: maskinläsbar karta för LLM:er) ────────────────────────────
const llms = `# ${BRAND}

> Guidade stadsvandringar i ${CITIES.join(', ')} (Östergötland, Sverige). En webbapp (PWA) med karta, vandringsturer, stämplar, quiz och en kunskapsdatabas över ${entries.length} sevärdheter, byggnader, personer och historiska händelser. Innehållet är på svenska.

## Om
- Varumärke: ${BRAND}
- Plats: ${CITIES.join(', ')} (Östergötland, Sverige)
- Webbplats: ${BASE}
- Innehåll: ${entries.length} kartlagda platser med beskrivning, epok, snabbfakta och källor.

## Vandringsturer
${TOURS.map(t => `- [${t.name}](${BASE}/tur/${t.slug}): ${t.sub} ${t.stops.length} stopp.`).join('\n')}

## Platser
${entries.map(e => `- [${e.name}${e.city ? ' (' + e.city + ')' : ''}](${BASE}/p/${slug(e.id || e.name)}): ${trunc(e.summary || e.description, 140)}`).join('\n')}

## Index
- [Om & vanliga frågor](${BASE}/om): Vad Stadsvandring.io är, vilka orter som täcks och svar på vanliga frågor.
- [Alla platser](${BASE}/platser): Komplett lista över sevärdheter och platser.
- [English overview](${BASE}/en): English-language overview of all ${entries.length} places and the walking tours.
- [Sitemap](${BASE}/sitemap.xml)
`;
writeFileSync(join(ROOT, 'llms.txt'), llms);

console.log(`✓ ${pageCount} platssidor (/p/*.html)`);
console.log(`✓ platser.html`);
console.log(`✓ en.html (engelsk hub, hreflang ↔ /)`);
console.log(`✓ leadmagnet M1 (${lmCount} orter: teaser + gatad guide)`);
console.log(`✓ sitemap.xml (${urls.length} url:er)`);
console.log(`✓ robots.txt`);
console.log(`✓ llms.txt`);
console.log(`Domän: ${BASE} · Städer: ${CITIES.join(', ')}`);
