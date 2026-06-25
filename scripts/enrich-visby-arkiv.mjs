import fs from 'node:fs';

const FILE = new URL('../data.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const byId = Object.fromEntries(data.entries.map(e => [e.id, e]));

const ARK = {
  raaFaq: 'https://www.raa.se/om-riksantikvarieambetet/fragor-och-svar/visby-ringmur/',
  raaFou: 'https://www.raa.se/app/uploads/2017/08/FoU-rapport-Visby-Ringmur-2013-140630.pdf',
  lst: 'https://www.lansstyrelsen.se/gotland/besoksmal/kulturmiljoer/visby-innerstad.html',
  bebr: 'https://www.bebyggelseregistret.raa.se/',
  runeberg: 'https://runeberg.org/nfgb/0242.html',
  gm: 'https://utforska.gotlandsmuseum.se/visby/',
  dm: 'https://digitaltmuseum.se/gotlandsmuseum',
  gmArkiv: 'https://www.gotlandsmuseum.se/besoksmal/arkiv-och-bibliotek/',
};

function addSources(id, urls) {
  const e = byId[id];
  if (!e) { console.error('MISSING:', id); return; }
  e.sources = Array.from(new Set([...(e.sources || []), ...urls]));
}
function patch(id, fn) {
  const e = byId[id];
  if (!e) { console.error('MISSING:', id); return; }
  fn(e);
}
function add(entry) {
  if (byId[entry.id]) { console.error('EXISTS:', entry.id); return; }
  entry.images = []; entry.image_source_pages = []; entry.city = 'Visby';
  data.entries.push(entry); byId[entry.id] = entry;
}

// --- Ringmuren: 2012 års ras + förvaltning + arkivrapport -------------------
patch('visby-visby-ringmur', e => {
  e.description += ' Muren lever och kräver ständig vård: i februari 2012 rasade omkring 70 kvadratmeter av det yttre skalet norr om Österport, och raset återuppbyggdes 2014 av murare och hantverkare under Riksantikvarieämbetets ledning – ett arbete som dokumenterades i FoU-rapporten "Visby ringmur – kulturarv som rasar och återuppbyggs". Region Gotland äger muren medan staten genom Riksantikvarieämbetet ansvarar för förvaltningen.';
  e.key_facts.push('Ca 70 m² av muren rasade i februari 2012 norr om Österport, återuppbyggt 2014');
  addSources('visby-visby-ringmur', [ARK.raaFaq, ARK.raaFou]);
});

// --- Världsarvet: 280 byggnadsminnen, 200+ medeltidshus, riksintresse 1987 ---
patch('visby-hansestaden-varldsarv', e => {
  e.description += ' Skyddet är omfattande: Länsstyrelsen Gotland förvaltar omkring 280 byggnadsminnen innanför muren, och staden rymmer över 200 hus med bevarat medeltida murverk. Hela stadslagret och samtliga kyrkoruiner är dessutom skyddade som fornlämning enligt kulturmiljölagen, och redan 1987 pekades innerstaden ut som riksintresse för kulturmiljövården.';
  e.key_facts.push('Ca 280 byggnadsminnen och 200+ hus med medeltida murverk');
  e.key_facts.push('Riksintresse för kulturmiljövård sedan 1987; stadslager och ruiner fornlämningsskyddade');
  addSources('visby-hansestaden-varldsarv', [ARK.lst, ARK.bebr]);
});

// --- Stora Torget: medeltida rådhus 1317, utgrävt 1925 ----------------------
patch('visby-stora-torget', e => {
  e.description += ' Vid utgrävningar 1925 påträffades grunden till stadens medeltida rådhus, omtalat redan 1317, vilket bekräftar att torget varit en administrativ och kommersiell mittpunkt sedan högmedeltiden.';
  e.key_facts.push('Medeltida rådhus (omtalat 1317) frilagt vid utgrävning 1925');
  addSources('visby-stora-torget', [ARK.runeberg, ARK.gm]);
});

// --- Slaget 1361 & Korsbetningen: koppling till Solberga kloster ------------
patch('visby-slaget-vid-visby-1361', e => {
  addSources('visby-slaget-vid-visby-1361', [ARK.gm, 'https://sv.wikipedia.org/wiki/Solberga_kloster']);
});
patch('visby-korsbetningen-massgravar', e => {
  e.description += ' Marken hörde till cisterciensklostret Solberga, vars nunnor begravde de stupade strax norr om klosterkyrkan – därav den fortsatta kopplingen mellan slagfältet och klosterruinen.';
  addSources('visby-korsbetningen-massgravar', ['https://sv.wikipedia.org/wiki/Solberga_kloster', ARK.gm]);
});

// --- Gotlands museum: P.A. Säve, Gotländskt arkiv ---------------------------
patch('visby-gotlands-museum-fornsalen', e => {
  addSources('visby-gotlands-museum-fornsalen', [ARK.runeberg, ARK.dm, ARK.gmArkiv]);
});

// --- NYTT: Sankt Görans kyrkoruin (hospitalskyrka för spetälska) ------------
add({
  id: 'visby-sankt-gorans-kyrkoruin',
  name: 'Sankt Görans kyrkoruin',
  category: 'kyrka',
  coordinates: { lat: 57.647500, lng: 18.303300 },
  era: 'Medeltid (1200-talet)',
  summary: 'Nordens näst största hospitalskyrka – byggd utanför muren för spetälskesjuka.',
  description: 'Strax utanför ringmuren, norr om staden, ligger Sankt Görans kyrkoruin – resterna av Nordens näst största hospitalskyrka. Kyrkan byggdes på 1200-talet och ersatte en äldre kyrka från 1100-talet. Den hörde till Sankt Görans hospital, en vårdinrättning för spetälska (leprasjuka) som av smittorisk medvetet förlades utanför stadsmuren. Helgedomen vigdes åt Sankt Göran (Sankt Georg), de sjukas skyddshelgon, och anläggningen drevs under klosterliknande regler där de boende kallades nunnor och munkar. Hospitalet övergavs på kunglig befallning 1542, men togs tillfälligt i bruk igen efter stadsbranden 1611. Att kyrkan ligger just utanför muren berättar konkret om medeltidens syn på smitta och utanförskap: de sjuka stängdes ute från staden men gavs ändå en mäktig kyrka och vård. Ruinen är ett gripande komplement till de praktfulla ruinerna innanför muren.',
  key_facts: [
    'Nordens näst största hospitalskyrka',
    'Byggd på 1200-talet, ersatte en kyrka från 1100-talet',
    'Tillhörde Sankt Görans hospital för spetälska',
    'Förlades utanför ringmuren av smittoskäl',
    'Övergavs på kunglig befallning 1542',
  ],
  sources: ['https://sv.wikipedia.org/wiki/Sankt_G%C3%B6rans_kyrkoruin,_Visby', ARK.gm],
});

// --- NYTT: Solberga klosterruin (cisterciensnunnekloster, 1361) -------------
add({
  id: 'visby-solberga-klosterruin',
  name: 'Solberga klosterruin',
  category: 'klosterruin',
  coordinates: { lat: 57.633340, lng: 18.298590 },
  era: 'Medeltid (grundat 1246)',
  summary: 'Cisterciensnunnornas kloster utanför Söderport – det var på dess mark slaget 1361 stod.',
  description: 'Söder om ringmuren, vid Korsbetningen, låg en gång Solberga kloster – ett cisterciensnunnekloster grundat 1246, då biskop Lars av Linköping sände nunnor av cistercienserorden till Gotland. Klosterkyrkan byggdes korsformad med Vreta kloster i Östergötland som förebild, vilket gör Vreta till Solbergas sannolika moderkloster. Klostret är oupplösligt förknippat med det blodiga slaget vid Visby 1361: det var på klostrets marker, strax norr om kyrkan, som de tusentals stupade gotländska bönderna begravdes, och här restes minneskorset Valdemarskorset. Klostret förföll under oroligheterna kring sekelskiftet 1400, och omkring 1404 flyttade de tolv nunnorna och abbedissan in till staden. Vid utgrävningar på 1900-talet frilades grunden till den korsformade klosterkyrkan tillsammans med massgravarna från 1361. För besökaren binder Solberga samman det fromma klosterlivet med slagfältets fasor på en och samma plats.',
  key_facts: [
    'Cisterciensnunnekloster grundat 1246',
    'Korsformad kyrka med Vreta kloster som förebild',
    'På klostrets mark begravdes de stupade i slaget 1361',
    'Nunnorna flyttade in till staden omkring 1404',
    'Klosterkyrkans grund och massgravar frilagda vid 1900-talsutgrävningar',
  ],
  sources: ['https://sv.wikipedia.org/wiki/Solberga_kloster', ARK.gm],
});

// --- Registrera arkivkällor i metadatan -------------------------------------
if (data.metadata) {
  data.metadata.updated = '2026-06-25';
  data.metadata.sources_visby_arkiv = [
    ARK.raaFaq, ARK.raaFou, ARK.lst, ARK.bebr, ARK.runeberg, ARK.gm, ARK.dm, ARK.gmArkiv,
  ];
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
const visby = data.entries.filter(e => e.city === 'Visby');
console.log('Visby total:', visby.length, '| total entries:', data.entries.length);
