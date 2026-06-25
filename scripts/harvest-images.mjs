// Harvests free Wikimedia Commons lead images (+ licence/author) for given entry ids.
// Output: JSON lines ready to splice into content.js EXTRA_IMAGES.
const UA = 'StadsvandringBot/1.0 (https://stadsvandring.io; image attribution harvest)';

// entry id -> candidate sv.wikipedia article titles (first that has a free image wins)
const MAP = {
  // Visby — torn, portar, mur
  'visby-visby-ringmur': ['Visby ringmur'],
  'visby-kruttornet': ['Kruttornet'],
  'visby-jungfrutornet': ['Jungfrutornet', 'Jungfrutornet, Visby'],
  'visby-dalmanstornet': ['Dalmanstornet'],
  'visby-silverhattan': ['Silverhättan'],
  'visby-norderport': ['Norderport, Visby', 'Norderport'],
  'visby-soderport': ['Söderport, Visby'],
  // Visby — kyrkor & ruiner
  'visby-sankta-maria-domkyrka': ['Visby domkyrka'],
  'visby-sankt-nicolai-kyrkoruin': ['Sankt Nicolai kyrkoruin, Visby'],
  'visby-sankta-karins-kyrkoruin': ['Sankta Katarina kyrkoruin', 'Sankt Karins kyrkoruin'],
  'visby-drottens-kyrkoruin': ['Drottens kyrkoruin, Visby'],
  'visby-sankt-lars-kyrkoruin': ['Sankt Lars kyrkoruin, Visby'],
  'visby-sankt-clemens-kyrkoruin': ['Sankt Clemens kyrkoruin, Visby'],
  'visby-helige-andes-kyrkoruin': ['Helige Andes kyrkoruin, Visby', 'Helge ands kyrkoruin'],
  'visby-sankt-hans-och-sankt-pers-kyrkoruiner': ['Sankt Hans kyrkoruin', 'Sankt Hans och Sankt Pers kyrkoruiner'],
  'visby-sankt-olofs-kyrkoruin': ['Sankt Olofs kyrkoruin, Visby'],
  'visby-sankt-gorans-kyrkoruin': ['Sankt Görans kyrkoruin, Visby'],
  'visby-solberga-klosterruin': ['Solberga kloster'],
  // Visby — platser, byggnader, museum
  'visby-dbw-s-botaniska-tradgard': ['DBW:s botaniska trädgård'],
  'visby-burmeisterska-huset': ['Burmeisterska huset'],
  'visby-gotlands-museum-fornsalen': ['Gotlands museum'],
  'visby-almedalen': ['Almedalen'],
  'visby-stora-torget': ['Stora torget, Visby', 'Stora Torget, Visby'],
  'visby-gamla-apoteket': ['Gamla apoteket, Visby'],
  'visby-strandgatan-packhusen': ['Strandgatan, Visby'],
  'visby-visby-hamn': ['Visby hamn'],
  'visby-packhusplan': ['Packhusplan, Visby'],
  'visby-donners-plats': ['Donners plats'],
  'visby-karleksporten': ['Kärleksporten, Visby'],
  // Visby — historia/teman
  'visby-slaget-vid-visby-1361': ['Slaget vid Visby'],
  'visby-medeltidsveckan': ['Medeltidsveckan'],
  'visby-hansestaden-varldsarv': ['Visby'],
  'visby-spillingsskatten': ['Spillingsskatten'],
  // Visby — personer
  'visby-christopher-polhem': ['Christopher Polhem'],
  'visby-valdemar-atterdag': ['Valdemar Atterdag'],
  'visby-pehr-arvid-save': ['Pehr Arvid Säve'],
  'visby-bengt-thordeman': ['Bengt Thordeman'],
  // Boxholm
  'boxholm-kyrka': ['Boxholms kyrka'],
  'boxholm-bruk': ['Boxholms bruksmuseum', 'Boxholms bruk'],
  'boxholm-boxholms-sateri': ['Boxholms säteri'],
  'boxholm-liljeholmens-sateri': ['Liljeholmen, Boxholm'],
  'boxholm-folkets-hus': ['Folkets hus, Boxholm'],
  'boxholm-ekeby-kyrka': ['Ekeby kyrka, Östergötland', 'Ekeby kyrka'],
  'boxholm-asbo-kyrka': ['Åsbo kyrka'],
  'boxholm-blaviks-kyrka': ['Blåviks kyrka'],
  'boxholm-sommen': ['Sommen'],
  'boxholm-stralsnas-jarnvagsstation': ['Strålsnäs'],
};

async function j(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
const stripHtml = s => (s || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

async function leadImageFile(title) {
  const u = `https://sv.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=name&format=json&redirects=1&titles=${encodeURIComponent(title)}`;
  const d = await j(u);
  const page = Object.values(d.query.pages)[0];
  return page && page.pageimage ? page.pageimage : null; // File name w/o "File:"
}

async function commonsInfo(file) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1280&format=json&titles=${encodeURIComponent('File:' + file)}`;
  const d = await j(u);
  const page = Object.values(d.query.pages)[0];
  if (!page || page.missing !== undefined || !page.imageinfo) return null;
  const ii = page.imageinfo[0];
  const m = ii.extmetadata || {};
  const license = stripHtml(m.LicenseShortName && m.LicenseShortName.value) || '';
  const artist = stripHtml(m.Artist && m.Artist.value) || 'okänd';
  const restrictions = stripHtml(m.Restrictions && m.Restrictions.value);
  // skip non-free
  const lic = license.toLowerCase();
  const free = !lic || lic.includes('cc') || lic.includes('public domain') || lic.includes('pd') || lic.includes('cc0');
  if (!free || restrictions) return null;
  return { url: ii.thumburl || ii.url, license, artist };
}

const out = {};
const fails = [];
for (const [id, titles] of Object.entries(MAP)) {
  let done = false;
  for (const t of titles) {
    try {
      const file = await leadImageFile(t);
      if (!file) continue;
      if (!/commons/i.test(file) && false) {}
      const info = await commonsInfo(file);
      if (!info) continue;
      const lic = info.license || 'Wikimedia Commons';
      const artist = info.artist.length > 90 ? info.artist.slice(0, 87) + '…' : info.artist;
      out[id] = {
        url: info.url,
        attribution: `Foto: ${artist}, ${lic}, Wikimedia Commons`,
        focal: 'center center',
      };
      done = true;
      break;
    } catch (e) { /* try next */ }
  }
  if (!done) fails.push(id);
}

console.log('=== RESOLVED', Object.keys(out).length, '===');
console.log(JSON.stringify(out, null, 2));
console.log('=== FAILED', fails.length, '===');
console.log(fails.join('\n'));
