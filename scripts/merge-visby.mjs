import fs from 'node:fs';

const DATA = new URL('../data.json', import.meta.url);
const VISBY = new URL('./visby-data.json', import.meta.url);

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const incoming = JSON.parse(fs.readFileSync(VISBY, 'utf8'));
const byId = Object.fromEntries(data.entries.map(e => [e.id, e]));

let replaced = 0, added = 0;
for (const e of incoming) {
  // Normalise to the project schema (preserve images/source pages on existing rows).
  const norm = {
    id: e.id,
    name: e.name,
    category: e.category,
    city: 'Visby',
    coordinates: e.coordinates,
    era: e.era,
    summary: e.summary,
    description: e.description,
    key_facts: e.key_facts || [],
    sources: e.sources || [],
  };
  const existing = byId[e.id];
  if (existing) {
    norm.images = existing.images || [];
    norm.image_source_pages = existing.image_source_pages || [];
    // merge sources uniquely
    norm.sources = Array.from(new Set([...(existing.sources || []), ...norm.sources]));
    Object.assign(existing, norm);
    replaced++;
  } else {
    norm.images = [];
    norm.image_source_pages = [];
    data.entries.push(norm);
    byId[e.id] = norm;
    added++;
  }
}

// Register new categories in metadata so the taxonomy stays complete.
if (data.metadata && Array.isArray(data.metadata.categories)) {
  for (const c of ['torn', 'stadsport', 'historia']) {
    if (!data.metadata.categories.includes(c)) data.metadata.categories.push(c);
  }
  data.metadata.updated = '2026-06-25';
}

fs.writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n');
const visby = data.entries.filter(e => e.city === 'Visby');
console.log(`Visby: replaced ${replaced}, added ${added} → ${visby.length} total`);
console.log('Total entries:', data.entries.length);
// sanity: categories present
const cats = {};
visby.forEach(e => cats[e.category] = (cats[e.category] || 0) + 1);
console.log('Visby categories:', JSON.stringify(cats));
