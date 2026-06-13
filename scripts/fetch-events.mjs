#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// fetch-events.mjs — Hämtar evenemang från Visit Mjölby vid build-tid och
// skriver dem till events.json som appen läser. Build-tid (inte runtime) →
// ingen CORS, ingen extern runtime-dependens, ingen kostnad. Kör om för att
// uppdatera (t.ex. via cron/scheduled deploy).
//
// Källa: https://www.visitmjolby.se/evenemang (server-renderade mex-event-puff-kort)
// KÖR: node scripts/fetch-events.mjs
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = 'https://www.visitmjolby.se/evenemang';
const BASE = 'https://www.visitmjolby.se';

const decode = (s) => String(s || '')
  .replace(/<!--.*?-->/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&aring;/g, 'å').replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö')
  .replace(/&Aring;/g, 'Å').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const res = await fetch(SRC, { headers: { 'User-Agent': 'StrosaBot/1.0 (stadsvandring.io events sync)' } });
if (!res.ok) { console.error('Hämtning misslyckades:', res.status); process.exit(1); }
const html = await res.text();

// Varje kort: <p ...__date">DATUM</p><p ...__arena">ARENA</p> … <a ...__link href="URL">TITEL</a>
const re = /__information__date">(.*?)<\/p>\s*<p class="mex-event-puff__information__arena">(.*?)<\/p>[\s\S]*?mex-event-puff__link"\s+href="([^"]+)">([^<]+)<\/a>/g;
const seen = new Set();
const events = [];
let m;
while ((m = re.exec(html)) !== null) {
  const date = decode(m[1]);
  const arena = decode(m[2]);
  const url = m[3].startsWith('http') ? m[3] : BASE + m[3];
  const title = decode(m[4]);
  if (!title || seen.has(url)) continue;
  seen.add(url);
  events.push({ title, date, arena, url });
}

const out = {
  source: 'Visit Mjölby',
  sourceUrl: SRC,
  fetched: new Date().toISOString().slice(0, 10),
  events,
};
writeFileSync(join(ROOT, 'events.json'), JSON.stringify(out, null, 1));
console.log(`✓ ${events.length} evenemang → events.json`);
events.forEach(e => console.log(`  • ${e.date.padEnd(24)} | ${e.arena.padEnd(20)} | ${e.title}`));
