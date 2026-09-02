#!/usr/bin/env node
// ── build-images.mjs — gör webbstorlekar av de självhostade platsfotona ───────
//
// images/ är 6,9 MB råa JPEG:er på ~1100 px, flera över 400 kB. De visas som
// 88 px listminiatyrer och som hero i detaljvyn — i båda fallen laddades hela
// originalet ned. En listvy med 20 platser drog ~5 MB bilder.
//
// Skriver WebP i två bredder, originalen rörs inte:
//   images/w320/<namn>.webp   listminiatyrer
//   images/w800/<namn>.webp   hero i detaljvyn
//
// app.js pekar på varianterna via sizedImg() och faller tillbaka på originalet
// om en variant saknas (onerror), så appen fungerar även utan detta steg.
//
// Kräver cwebp (`brew install webp`) och sips (följer med macOS).
// Kör: node scripts/build-images.mjs
import { readdirSync, mkdirSync, existsSync, statSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'images');
const SIZES = [
  { dir: 'w320', width: 320, q: 72 },   // listminiatyr (88 px @3x)
  { dir: 'w800', width: 800, q: 74 },   // hero i detaljvyn (~400 CSS-px @2x)
];
// Bilder som används som CSS-bakgrund i full bredd behöver en större variant.
const WIDE = { dir: 'w1200', width: 1200, q: 72, only: ['header.jpg'] };

function have(cmd) {
  try { execFileSync('which', [cmd], { stdio: 'ignore' }); return true; } catch { return false; }
}
if (!have('cwebp')) {
  console.error('cwebp saknas. Installera med:  brew install webp');
  process.exit(1);
}

const originals = readdirSync(SRC)
  .filter(f => /\.(jpe?g|png)$/i.test(f))
  .filter(f => statSync(join(SRC, f)).isFile());

let before = 0, after = 0, n = 0;
for (const size of [...SIZES, WIDE]) {
  const out = join(SRC, size.dir);
  if (existsSync(out)) rmSync(out, { recursive: true });
  mkdirSync(out, { recursive: true });
}

for (const file of originals) {
  const src = join(SRC, file);
  before += statSync(src).size;
  const name = basename(file, extname(file));
  for (const size of [...SIZES, ...(WIDE.only.includes(file) ? [WIDE] : [])]) {
    const dest = join(SRC, size.dir, `${name}.webp`);
    // cwebp skalar själv med -resize <bredd> 0 (0 = behåll proportioner) och
    // skalar aldrig upp om originalet är smalare — därav -resize först.
    execFileSync('cwebp', [
      '-quiet', '-q', String(size.q), '-metadata', 'none',
      '-resize', String(size.width), '0', src, '-o', dest,
    ]);
    after += statSync(dest).size;
  }
  n++;
}

const mb = b => (b / 1024 / 1024).toFixed(1) + ' MB';
console.log(`✓ ${n} bilder → ${SIZES.map(s => s.dir).join(' + ')}`
  + (WIDE.only.length ? ` (+ ${WIDE.dir} för ${WIDE.only.join(', ')})` : ''));
console.log(`  original: ${mb(before)}   varianter totalt: ${mb(after)}`);
