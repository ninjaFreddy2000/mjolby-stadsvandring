#!/usr/bin/env node
// ── build-data.mjs — dela upp data.json i ett litet index + en chunk per stad ──
//
// Problemet: data.json är ~9,6 MB (9 775 platser) och hämtades i sin helhet vid
// varje appstart — dessutom förladdad av service workern. Användaren betalade för
// 72 städers innehåll för att titta på en.
//
// Lösningen: bygg om till
//   data/cities.json        ~40 kB  — en rad per stad: centrumpunkt, antal, vilka
//                                     turer som finns, samt den FÖRBERÄKNADE
//                                     centrala vandringen (stopp-id i gångordning).
//   data/city/<slug>.json   1–580 kB — den stadens platser i sin helhet.
//
// Appen laddar cities.json + den aktiva staden. Andra städer hämtas när man byter.
// Den centrala vandringen räknades tidigare fram i klienten för ALLA städer vid
// varje start (girig närmaste-granne per stad) — nu sker det här, en gång.
//
// Kör: node scripts/build-data.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data');

// ── Måste hållas i synk med app.js ───────────────────────────────────────────
const WALK_RADIUS_KM = 1.2, WALK_MAX = 12, WALK_MIN = 6, WALK_MAX_M = 4000;
const CENTRAL_MIN_STOPS = 4;
const CURATED_TOUR_CITIES = new Set(['Mjölby']);

const citySlug = s => String(s || '').toLowerCase()
  .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const hasCoords = e => e.coordinates && typeof e.coordinates.lat === 'number';
const cityOf = e => e.city || 'Mjölby';

function distKm(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function qualityScore(e) {
  let s = 0;
  const descLen = (e.description || '').length;
  if ((e.images || []).length) s += 2;
  if (descLen > 400) s += 2; else if (descLen > 200) s += 1;
  if (e.key_facts && (Array.isArray(e.key_facts) ? e.key_facts.length : Object.keys(e.key_facts).length)) s += 1;
  if (e.era) s += 1;
  return s;
}
const interestScore = (e, centre) =>
  qualityScore(e) + Math.max(0, 1 - distKm(e.coordinates, centre) / WALK_RADIUS_KM) * 2;

function routeLenM(order) {
  let m = 0;
  for (let i = 1; i < order.length; i++) m += distKm(order[i - 1].coordinates, order[i].coordinates) * 1000;
  return m;
}
function nearestNeighborOrder(items, start) {
  const left = items.slice(), out = [];
  let cur = start;
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((e, i) => { const d = distKm(cur, e.coordinates); if (d < bd) { bd = d; bi = i; } });
    cur = left[bi].coordinates;
    out.push(left.splice(bi, 1)[0]);
  }
  return out;
}

// Den centrala vandringen för en icke-kurerad stad — samma algoritm som app.js
// körde i klienten: välj de mest intressanta platserna nära centrum med ett
// diversitetsstraff, ordna som promenadslinga, korta ner tills den ryms på ≤1 h.
function centralWalk(arr) {
  const ortE = arr.find(e => e.category === 'ort');
  const med = xs => { const s = xs.slice().sort((a, b) => a - b); return s[s.length >> 1]; };
  const centre = ortE ? ortE.coordinates
    : { lat: med(arr.map(e => e.coordinates.lat)), lng: med(arr.map(e => e.coordinates.lng)) };

  let cand = arr.filter(e => e.category !== 'ort' && distKm(e.coordinates, centre) <= WALK_RADIUS_KM);
  if (cand.length < CENTRAL_MIN_STOPS) {
    cand = arr.filter(e => e.category !== 'ort')
      .sort((a, b) => distKm(a.coordinates, centre) - distKm(b.coordinates, centre))
      .slice(0, WALK_MAX * 2);
  }
  if (cand.length < CENTRAL_MIN_STOPS) return null;

  const picked = [], catCount = {};
  while (picked.length < WALK_MAX && cand.length) {
    let bi = 0, bs = -Infinity;
    cand.forEach((e, i) => {
      const adj = interestScore(e, centre) - (catCount[e.category] || 0) * 1.5;
      if (adj > bs) { bs = adj; bi = i; }
    });
    const e = cand.splice(bi, 1)[0];
    picked.push(e);
    catCount[e.category] = (catCount[e.category] || 0) + 1;
  }
  let order = nearestNeighborOrder(picked, centre);
  while (order.length > WALK_MIN && routeLenM(order) > WALK_MAX_M) {
    let fi = 0, fd = -1;
    order.forEach((e, i) => { const d = distKm(e.coordinates, centre); if (d > fd) { fd = d; fi = i; } });
    order.splice(fi, 1);
    order = nearestNeighborOrder(order, centre);
  }
  return order.map(e => e.id);
}

// ── Bygg ─────────────────────────────────────────────────────────────────────
const src = JSON.parse(readFileSync(join(ROOT, 'data.json'), 'utf8'));
const all = src.entries.filter(e => !/^(demo|test)[-_]/i.test(e.id || ''));

const byCity = new Map();
for (const e of all) {
  const c = cityOf(e);
  if (!byCity.has(c)) byCity.set(c, []);
  byCity.get(c).push(e);
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(join(OUT, 'city'), { recursive: true });

const cities = [];
let biggest = 0, biggestName = '';
for (const [name, arr] of [...byCity.entries()].sort((a, b) => a[0].localeCompare(b[0], 'sv'))) {
  const slug = citySlug(name);
  const withCoords = arr.filter(hasCoords);

  // Centrumpunkt: ortens egen post om den finns, annars snitt av stoppen.
  const ortE = withCoords.find(e => e.category === 'ort');
  const lat = ortE ? ortE.coordinates.lat : withCoords.reduce((s, e) => s + e.coordinates.lat, 0) / (withCoords.length || 1);
  const lng = ortE ? ortE.coordinates.lng : withCoords.reduce((s, e) => s + e.coordinates.lng, 0) / (withCoords.length || 1);

  // Kurerade turer (Mjölby: central + medeltidsringen) markeras i posternas tour-fält.
  const curated = { central: 0, medieval: 0 };
  for (const e of arr) {
    if (!e.tour) continue;
    if (e.tour.in_central_walk) curated.central++;
    if (e.tour.in_medieval_ring) curated.medieval++;
  }
  const central = (!CURATED_TOUR_CITIES.has(name) && withCoords.length) ? centralWalk(withCoords) : null;

  const body = JSON.stringify({ city: name, slug, entries: arr });
  writeFileSync(join(OUT, 'city', `${slug}.json`), body);
  if (body.length > biggest) { biggest = body.length; biggestName = name; }

  cities.push({
    name, slug,
    lat: +lat.toFixed(5), lng: +lng.toFixed(5),
    count: withCoords.length,      // antal med kartnål (det CITY_META räknade)
    total: arr.length,             // inkl. platser utan koordinater (berättelser)
    curated,                       // {central, medieval} — antal stopp i kurerad tur
    central,                       // förberäknad central vandring (stopp-id) eller null
  });
}

const index = {
  generated: new Date().toISOString().slice(0, 10),
  source: 'data.json',
  places: all.length,
  cities,
};
writeFileSync(join(OUT, 'cities.json'), JSON.stringify(index));

// Uppslagstabell plats-id → stadsindex (index i cities[]). Laddas ALDRIG vid start —
// bara när appen har ett sparat plats-id vars stad den inte känner till (sparade
// platser från en stad som inte är laddad). ~270 kB, hämtas i praktiken sällan.
const cityIx = new Map(cities.map((c, i) => [c.name, i]));
const placeCity = {};
for (const e of all) placeCity[e.id] = cityIx.get(cityOf(e));
writeFileSync(join(OUT, 'place-city.json'), JSON.stringify(placeCity));

const kb = n => Math.round(n / 1024) + ' kB';
console.log(`✓ ${all.length} platser i ${cities.length} städer`);
console.log(`  data/cities.json      ${kb(JSON.stringify(index).length)}`);
console.log(`  data/city/*.json      störst: ${biggestName} ${kb(biggest)}`);
console.log(`  data/place-city.json  ${kb(JSON.stringify(placeCity).length)} (hämtas bara vid behov)`);
console.log(`  (data.json var ${kb(readFileSync(join(ROOT, 'data.json')).length)} — laddades i sin helhet vid varje start)`);
