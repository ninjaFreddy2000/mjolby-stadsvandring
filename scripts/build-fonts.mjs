#!/usr/bin/env node
// ── build-fonts.mjs — självhosta typsnitten ──────────────────────────────────
//
// Sidorna länkade till fonts.googleapis.com med en render-BLOCKERANDE
// <link rel="stylesheet">. Det kostar en extra DNS + TLS + hämtning innan något
// ritas, och sedan ytterligare en rundtur till fonts.gstatic.com för själva
// filerna. På mobil är det typiskt några hundra millisekunder före first paint —
// mer än hela styles.css (19 kB gzip) kostar.
//
// Värre för en PWA: gstatic ligger utanför service workerns cache, så appen är
// FONTLÖS offline trots att den i övrigt fungerar.
//
// Här hämtas variabelvarianterna (ett enda filpar täcker alla vikter) för latin
// och latin-ext, och en lokal fonts.css skrivs. Båda typsnitten är OFL-licensade,
// så självhosting är tillåten. Licenstexterna följer med.
//
// Kör: node scripts/build-fonts.mjs
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'vendor', 'fonts');

// Modern UA → Google svarar med woff2 och variabla axlar.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CSS_URL = 'https://fonts.googleapis.com/css2'
  + '?family=Fredoka:wght@400..700'
  + '&family=Mulish:ital,wght@0,400..800;1,400..800'
  + '&display=swap';

// Bara de teckenuppsättningar vi faktiskt behöver. Svenska ryms i 'latin'
// (å, ä, ö ligger i U+0000-00FF); 'latin-ext' tar hand om namn från övriga
// Europa som förekommer i platsdatan. Grekiska, kyrilliska och hebreiska
// skippas — de skulle fyrdubbla nedladdningen utan att användas.
const KEEP = new Set(['latin', 'latin-ext']);

async function get(url, asBuffer = false) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return asBuffer ? Buffer.from(await res.arrayBuffer()) : res.text();
}

const css = await get(CSS_URL);

// Blocken är kommenterade med sitt subset: /* latin */ @font-face { … }
const blocks = [...css.matchAll(/\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]+\})/g)]
  .map(m => ({ subset: m[1], body: m[2] }))
  .filter(b => KEEP.has(b.subset));

if (!blocks.length) throw new Error('Inga @font-face-block hittades — ändrade Google formatet?');

if (existsSync(OUT)) rmSync(OUT, { recursive: true });
mkdirSync(OUT, { recursive: true });

let out = `/* Självhostade typsnitt — genererad av scripts/build-fonts.mjs, redigera inte.
   Fredoka och Mulish, båda SIL Open Font License 1.1 (se LICENSE.txt här bredvid).
   Variabla varianter: ett filpar täcker alla vikter vi använder. */\n`;
let total = 0;

for (const b of blocks) {
  const family = (b.body.match(/font-family:\s*'([^']+)'/) || [])[1];
  const style = (b.body.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
  const url = (b.body.match(/url\((https:[^)]+)\)/) || [])[1];
  if (!family || !url) continue;

  const name = `${family.toLowerCase()}-${style}-${b.subset}.woff2`;
  const buf = await get(url, true);
  writeFileSync(join(OUT, name), buf);
  total += buf.length;

  out += '\n' + b.body.replace(/url\(https:[^)]+\)/, `url('${name}')`) + '\n';
  console.log(`  ${name.padEnd(34)} ${(buf.length / 1024).toFixed(0)} kB`);
}

writeFileSync(join(OUT, 'fonts.css'), out);

// OFL-texten följer med filerna, som licensen kräver.
const license = await get('https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/OFL.txt')
  .catch(() => 'SIL Open Font License 1.1 — se https://openfontlicense.org\nFredoka: https://fonts.google.com/specimen/Fredoka\nMulish: https://fonts.google.com/specimen/Mulish\n');
writeFileSync(join(OUT, 'LICENSE.txt'), license);

console.log(`✓ ${blocks.length} typsnittsfiler, ${(total / 1024).toFixed(0)} kB totalt → vendor/fonts/`);
console.log('  Kom ihåg: peka <link> mot vendor/fonts/fonts.css och ta bort preconnect till Google.');
