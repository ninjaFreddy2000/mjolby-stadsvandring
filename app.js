// Mjölby Stadsvandring — PWA prototype
// Data: mjolby_kunskapsdatabas.json (knowledge base)
import { STORIES, EXTRA_IMAGES, TIMELINES, NOTICES, HISTORIC_IMAGES } from './content.js';
import { STORYTELLERS, ACTIVE_CITY, defaultTeller } from './storytellers.js';
import { cityBlurb } from './cityintros.js';
import { STRINGS, SUMMARY_EN, TELLER_EN } from './i18n.js';
// challenges.js (39 kB) laddas inte i förväg. Stadsutmaningen syns först på
// Leder- och Profil-fliken, så den vanliga sessionen "öppna kartan och titta"
// betalar inte för den. Laddas direkt bara om man kommer in via en delad länk.
let _chCtx = null, _chPromise = null;
function challengesMod(){
  if (!_chPromise){
    _chPromise = import('./challenges.js').then(m => { m.initChallenges(_chCtx); return m; });
  }
  return _chPromise;
}
import { initAuth, mountAuthProfile, shareApp, isAdmin, isLoggedIn } from './auth.js';
import { getSupabase, isConfigured, SHARE_URL } from './config.js';
import { axiomLog } from './axiom.js';

// ── Förstaparts-analytics (integritetsvänligt: ingen cookie/PII, bara anonyma
// händelser till egen Supabase; obegränsat på free-tiern). Fire-and-forget. ──
const SID_KEY = 'sv_sid';
let _sid = null;
function sid(){
  if (_sid) return _sid;
  try { _sid = localStorage.getItem(SID_KEY) || ''; } catch(_){}
  if (!_sid){ _sid = (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Math.random()).slice(2); try { localStorage.setItem(SID_KEY, _sid); } catch(_){} }
  return _sid;
}
async function track(name, props){
  const city = (typeof activeCity!=='undefined'?activeCity:null);
  // Axiom först — oberoende av Supabase-config, no-op tills token satts (axiom.js).
  try { axiomLog({ kind:'event', name, city, path: location.pathname, session: sid(), ...(props||{}) }); } catch(_){}
  try {
    if (!isConfigured()) return;
    const supa = await getSupabase();
    if (!supa) return;
    supa.from('events').insert({ name, path: location.pathname, city, props: props||null, session: sid() }).then(()=>{}, ()=>{});
  } catch(e){}
}
// Lättvikts-felövervakning: logga JS-fel/avvisade promises till samma events-tabell
// (varje unikt fel en gång per session) så produktionskrascher syns i datan.
function setupErrorMonitoring(){
  const seen = new Set();
  const logErr = (msg, extra)=>{
    const key = String(msg).slice(0,120);
    if (seen.has(key)) return; seen.add(key);
    track('js_error', { msg: String(msg).slice(0,300), ...extra });
  };
  window.addEventListener('error', e=>{ if (e && e.message) logErr(e.message, { src:(e.filename||'').split('/').pop(), line:e.lineno }); });
  window.addEventListener('unhandledrejection', e=>{ const r=e&&e.reason; logErr(r&&r.message?r.message:String(r), { type:'promise' }); });
}
import { initTips, refreshCity as refreshTips, isActive as tipsActive, mountTipsProfile,
         openTipForm, openReviewQueue, stopBlockHtml, wireStopBlock } from './tips.js';
import { initComments, commentBlockHtml, wireCommentBlock, clearCommentCache } from './comments.js';
import { initRoutes, mountRoutes, openRoute, routeInUrl } from './routes.js';
import { initImpact, mountImpact } from './impact.js';
import { initInstall, openInstallGuide } from './install.js';
// admin.js (24 kB) laddas inte i förväg — den behövs bara av admins, och bara
// när dashboarden faktiskt öppnas. Se openAdminDashboard() nedan.
const adminAvailable = () => isConfigured() && isAdmin();
let _adminCtx = null;
async function openAdminDashboard(){
  const mod = await import('./admin.js');
  mod.initAdmin(_adminCtx);
  return mod.openAdminDashboard();
}
import { GHOSTS, SPOKKARTAN_URL } from './ghosts.js';

let lang = localStorage.getItem('mjolby_lang') || 'sv';
const t = k => (STRINGS[lang] && STRINGS[lang][k]) || STRINGS.sv[k] || k;
// Engelsk röstprofil hämtas för DEN AKTIVA berättaren (via dess cityId) — inte
// den hårdkodade ACTIVE_CITY. Annars läckte Skånska Lasses engelska roll/replik
// in på alla andra städer (som bara har "Din Stadsguide").
const tellerL = () => (lang === 'en' && TELLER && TELLER.cityId && TELLER_EN[TELLER.cityId]) ? TELLER_EN[TELLER.cityId] : null;
const leadOf = e => (lang === 'en' && SUMMARY_EN[e.id]) || e.summary || '';

// ---------- Stad (man kan välja vilken stad man vandrar i) ----------
// TEMPORÄRT: lås appen till enbart Mjölby (för att visa Mjölby kommun en ren
// Mjölby-demo). Övriga städer/orter ligger kvar i koden men döljs i väljaren och
// filtreras bort som valbara. Sätt till true för att återaktivera fler städer.
const SHOW_SOON_CITIES = true;   // STAGING (gren orter-ostergotland): Östergötland-orterna synliga för granskning. Sätt false för Mjölby-only-demo.
const MJOLBY_ONLY = !SHOW_SOON_CITIES;
const MIN_CITY_STOPS = 1;        // visa ALLA städer som har minst ett stopp i den övergripande vyn (tidigare 9 → tunna orter göms; nu alla med)
let activeCity = MJOLBY_ONLY ? 'Mjölby' : (localStorage.getItem('sv_city') || 'Mjölby');
const citySlug = s => String(s||'').toLowerCase()
  .replace(/[åä]/g,'a').replace(/ö/g,'o').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const cityOf = e => e.city || 'Mjölby';
const inCity = e => cityOf(e) === activeCity;
// Mjölby har Skånska Lasse; övriga orter får den generiska "Din Stadsguide".
const tellerFor = city => STORYTELLERS[citySlug(city)] || defaultTeller(city);

let TELLER = tellerFor(activeCity);
const TELLER_SEEN_KEY = 'mjolby_teller_seen_v1';

/* ---------- Stop-type model (the 4 pitch types) ---------- */
const TYPES = {
  story: { label: 'Berättelse', color: '#3E78A8', tag: 'Ingår i kommunens abonnemang' },
  assoc: { label: 'Förening',   color: '#5E8C53', tag: 'Gratis / bidragsfinansierat' },
  biz:   { label: 'Affär',      color: '#C77F1E', tag: 'Sponsrat erbjudande' },
  info:  { label: 'InfoPin',    color: '#9A3B52', tag: 'Praktiskt & neutralt' },
};

const CATEGORY_TYPE = {
  ort:'story', vattendrag:'story', kyrka:'story', byggnad:'story', torg:'story',
  person:'story', konst_staty:'story', runsten:'story', klosterruin:'story',
  borgruin:'story', bro:'story', handelse:'story', station:'story',
  torn:'story', stadsport:'story', historia:'story',
  museum_hembygd:'assoc', musikkar:'assoc', idrott:'assoc',
  handel:'biz', kafe_restaurang:'biz', hotell:'biz', industri_foretag:'biz', gardsbutik:'biz',
  // natur- & utflyktstyper (Östergötland-orterna) — visas som berättelse-/sevärdhetsstopp
  sevardhet:'story', naturreservat:'story', badplats:'story', utsiktsplats:'story', vandringsled:'story', slott:'story',
};

const CATEGORY_ICON = {
  ort:'📍', vattendrag:'🌊', kyrka:'⛪', byggnad:'🏛️', torg:'⛲', person:'👤',
  konst_staty:'🗿', runsten:'🪨', klosterruin:'🏚️', borgruin:'🏰', bro:'🌉',
  handelse:'📜', station:'🚉', museum_hembygd:'🏡', musikkar:'🎺', idrott:'⚽',
  torn:'🗼', stadsport:'🚪', historia:'📖',
  handel:'🛍️', kafe_restaurang:'☕', hotell:'🏨', industri_foretag:'🏭', gardsbutik:'🧺',
  sevardhet:'📷', naturreservat:'🌲', badplats:'🏖️', utsiktsplats:'🔭', vandringsled:'🥾', slott:'🏰',
};

/* ---------- Tours ---------- */
const TOURS = {
  central: {
    name: 'Centrala vandringen', sub: 'Från stationen genom kvarnbyns hjärta — ca 2 km.',
    test: e => e.tour && e.tour.in_central_walk,
    order: e => { const n = e.tour && e.tour.stop_no; return typeof n === 'number' ? n : 99; },
  },
  medieval: {
    name: 'Medeltidsringen', sub: 'Folkungaätten, kloster och runstenar runt Skänninge & Bjälbo.',
    test: e => e.tour && e.tour.in_medieval_ring,
    sequence: ['bjalbo-kyrka','hogbystenen','skanninge-orten','varfrukyrkan-skanninge',
               'sta-ingrids-kloster','ture-lang','svaneholms-borgruin'],
  },
  // Generisk "Centrumslinga" för orter utan egen kurerad tur: bara de centrala
  // stoppen (≤3 km från ortens centrum, ≥4 st), ordnade som en promenadslinga.
  // CENTRAL_BY_CITY (id-lista per stad, redan ordnad) fylls i init().
  centrum: {
    generic: true,
    test: e => { const ids = CENTRAL_BY_CITY[cityOf(e)]; return !!ids && ids.indexOf(e.id) >= 0; },
  },
  // En användarskapad rutt (routes.js) körs som en vanlig tur, så kartan,
  // den gatuföljande ledlinjen och "till nästa plats" fungerar likadant.
  // Stoppen kommer ur USER_ROUTE, som sätts av startUserRoute().
  userroute: {
    user: true,
    test: e => !!USER_ROUTE && USER_ROUTE.stops.indexOf(e.id) >= 0,
  },
};
let USER_ROUTE = null;   // { id, title, intro, mode, stops:[id] }

/* ---------- Demo sponsor offers (prototype illustration) ---------- */
const DEMO_OFFERS = {
  'mjolby-stadshotell': 'Visa appen i baren – prova whisky ur klubbhyllan till medlemspris.',
  'konditori-hornet':   'Visa din stämpel – köp kaffe, få en klassisk wienerbröd på köpet.',
  'linds-mjolby':       'Incheckning i appen ger 10% på dagens bakverk.',
  'galleria-kvarnen':   'Stämpeljakt i gallerian – samla 3 stopp, få fika hos Linds.',
  'kvarnparken':        'Visa appen vid lunch – dagens rätt till specialpris.',
};

/* ---------- Sponsor-/värde-demo (mätbar fottrafik) ---------- */
// Demosiffror som illustrerar vad en sponsor får. I skarp drift räknas
// incheckningar automatiskt; här seedar vi en baslinje + din egen incheckning.
const DEMO_METRICS = {
  'konditori-hornet':  { week: 64, total: 689, rating: 4.7 },
  'linds-mjolby':      { week: 51, total: 523, rating: 4.6 },
  'galleria-kvarnen':  { week: 47, total: 480, rating: 4.3 },
  'mjolby-stadshotell':{ week: 38, total: 412, rating: 4.5 },
  'kvarnparken':       { week: 29, total: 305, rating: 4.2 },
};
const isSponsored = id => !!DEMO_OFFERS[id];
function metricsFor(id){
  const base = DEMO_METRICS[id] || { week: 0, total: 0, rating: null };
  const mine = stamps().has(id) ? 1 : 0;
  return { week: base.week + mine, total: base.total + mine, rating: base.rating, mine };
}

/* ---------- Quiz banks ---------- */
const QUIZZES = {
  central: [
    { q:'Vad betyder ortnamnet Mjölby?', opts:['Mjölkby','Kvarn','Möjlig hamn'], answer:1 },
    { q:'Vilket år öppnade Mjölby järnvägsstation?', opts:['1873','1901','1920'], answer:0 },
    { q:'Vad hittades i stadshotellets timmerstomme vid renoveringen?', opts:['Guldmynt','En dagstidning från 1901','Ett gammalt brev'], answer:1 },
    { q:'Vad överlevde stadsbranden 1771 i Mjölby kyrka?', opts:['Altartavlan','Det medeltida tornet','Orgeln'], answer:1 },
    { q:'Vilken folkkär bondkomiker har en staty i Kvarnparken?', opts:['Skånska Lasse','Tage Danielsson','Birger jarl'], answer:0 },
  ],
  medieval: [
    { q:'Vilken berömd person föddes i Bjälbo omkring 1210?', opts:['Gustav Vasa','Birger jarl','Petrus de Dacia'], answer:1 },
    { q:'Vem tillskrivs Bjälbo mäktiga kyrktorn?', opts:['Ingrid Ylva','S:ta Ingrid','Jenny Lind'], answer:0 },
    { q:'Vad kallas Högbystenen för typ av runsten?', opts:['Greklandssten','Ormsten','Kungssten'], answer:0 },
    { q:'Vad infördes vid Skänninge möte 1248?', opts:['Tryckfrihet','Prästcelibat','Allmän rösträtt'], answer:1 },
    { q:'Vad var S:ta Ingrids kloster först i Sverige med?', opts:['Kvinnligt dominikankloster','Tryckeri','Sjukhus'], answer:0 },
  ],
};

/* ---------- State ---------- */
let DATA = [], ENTRIES = [];
let map, markerLayer, plainLayer, routeLayer, meMarker;
let ghostLayer = null;   // spökplatser (Spökkartan-korsmarknadsföring) — eget lager, stad-oberoende
const GHOSTS_KEY = 'sv_ghosts_on';
let ghostsOn = (localStorage.getItem(GHOSTS_KEY) ?? '1') === '1';   // default på
// Generisk centrumslinga: id-lista (redan promenadordnad) per stad. Fylls i init().
let CENTRAL_BY_CITY = {};
let CITY_META = {};   // { stad: {lat,lng,count} } — centrumpunkt + antal stopp per stad (fylls i init)
const CURATED_TOUR_CITIES = new Set(['Mjölby']);   // har egna kurerade turer → ingen generisk
const CENTRAL_RADIUS_KM = 3, CENTRAL_MIN_STOPS = 4;
// Stadsvandringen = stadens HÖJDPUNKTER, inte hela platslistan. Målbild: 8–12 av
// de mest intressanta centrala platserna, en slinga som går på ≤1h.
const WALK_RADIUS_KM = 1.3;   // kompakt centrum → promenaden ryms på en dryg halvtimme
const WALK_MIN = 8, WALK_MAX = 12;
const WALK_MAX_M = 3500;      // rak-linje-summa för slingan (gatuföljande blir lite längre, ~≤1h)
// Hur "intressant" en kategori är för en stadsvandring. Landmärken (slott, kyrka,
// torg, torn, museum…) väger tungt; kommers och ren natur lågt. Innehållssignaler
// (bild, lång text, årtal) höjer betyget så välkända, väldokumenterade platser vinner.
const INTEREST_WEIGHT = {
  slott:10, borgruin:10, klosterruin:10, kyrka:9, torg:9, torn:9, stadsport:9, fyr:9,
  runsten:8, museum:8, museum_hembygd:7, bro:7, byggnad:7, sevardhet:6, konst_staty:6,
  utsiktsplats:6, historia:6, handelse:6, person:5, station:5, fornminne:5, vattendrag:4,
  naturreservat:3, vandringsled:3, badplats:2,
  hotell:2, kafe_restaurang:2, handel:1, gardsbutik:1, industri_foretag:1, idrott:1,
};
// Innehålls-/kategoripoäng utan läges-term — grunden för både vandringsurvalet
// och Höjdpunkt/Bonus-nivån.
function qualityScore(e){
  let s = INTEREST_WEIGHT[e.category] ?? 4;
  const descLen = (e.description || '').length;
  if ((e.images || []).length) s += 2;
  if (descLen > 400) s += 2; else if (descLen > 200) s += 1;
  if (e.key_facts && (Array.isArray(e.key_facts) ? e.key_facts.length : Object.keys(e.key_facts).length)) s += 1;
  if (e.era) s += 1;
  return s;
}
function interestScore(e, centre){
  return qualityScore(e) + Math.max(0, 1 - distKm(e.coordinates, centre) / WALK_RADIUS_KM) * 2;   // närmare centrum → lite högre
}
// ── Höjdpunkt vs Bonus ────────────────────────────────────────────────────
// Klockrena stadsvandringsplatser (vandringsvärdig kategori + rikt innehåll)
// märks som Höjdpunkt ⭐; platser med tunnare underlag blir Bonusplatser.
// Stopp som ingår i stadens vandring räknas ALLTID som höjdpunkter — vandringen
// följer per definition de mest intressanta platserna. Tröskeln ≥11 + minsta
// textlängd ger ca 20 % höjdpunkter över hela datamängden.
let WALK_IDS = new Set();   // alla stopp som ingår i någon stads vandring (fylls i init)
function computeWalkIds(){
  WALK_IDS = new Set();
  Object.values(CENTRAL_BY_CITY).forEach(ids => ids.forEach(id => WALK_IDS.add(id)));
  // Kurerade turer (Mjölby): Centrala vandringen + Medeltidsringen
  DATA.forEach(e => { if (e.tour && (e.tour.in_central_walk || e.tour.in_medieval_ring)) WALK_IDS.add(e.id); });
}
const isTopPlace = e =>
  WALK_IDS.has(e.id) || (qualityScore(e) >= 11 && (e.description || '').length >= 180);
function routeLenM(order){
  let m = 0;
  for (let i = 1; i < order.length; i++) m += distKm(order[i-1].coordinates, order[i].coordinates) * 1000;
  return m;
}
function distKm(a, b){
  if (!a || !b) return Infinity;
  const R = 6371, r = x => x*Math.PI/180;
  const dLat = r(b.lat-a.lat), dLng = r(b.lng-a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
// Girig närmaste-granne-ordning från en startpunkt → en rimlig promenadslinga.
function nearestNeighborOrder(items, start){
  const left = items.slice(), out = []; let cur = start;
  while (left.length){
    let bi = 0, bd = Infinity;
    left.forEach((e,i)=>{ const d = distKm(cur, e.coordinates); if (d < bd){ bd = d; bi = i; } });
    cur = left[bi].coordinates; out.push(left.splice(bi,1)[0]);
  }
  return out;
}
// ── Datalager: litet stadsindex + en chunk per stad ──────────────────────────
// Tidigare hämtades hela data.json (9,6 MB, 9 775 platser i 72 städer) vid varje
// start — för att visa EN stad. Nu laddas data/cities.json (~40 kB) plus den
// aktiva stadens chunk; andra städer hämtas först när man byter till dem.
// Den centrala vandringen per stad räknas inte längre fram i klienten utan
// kommer förberäknad ur indexet (scripts/build-data.mjs).
let CITY_INDEX = [];                 // [{name,slug,lat,lng,count,total,curated,central}]
const CITY_BY_NAME = new Map();
const CITY_LOADED = new Map();       // stad → entries[] (chunkcache)
const CITY_INFLIGHT = new Map();     // stad → Promise (avdubblar parallella hämtningar)
let PLACE_CITY = null;               // id → stadsindex; hämtas BARA vid behov (sparade platser)

function applyCityIndex(idx){
  CITY_INDEX = idx.cities || [];
  CITY_BY_NAME.clear(); CITY_META = {}; CENTRAL_BY_CITY = {};
  for (const c of CITY_INDEX){
    CITY_BY_NAME.set(c.name, c);
    CITY_META[c.name] = { lat: c.lat, lng: c.lng, count: c.count };
    if (c.central && c.central.length) CENTRAL_BY_CITY[c.name] = c.central;
  }
}

// Antal leder i en stad — utan att stadens data behöver vara laddad.
function tourCountFor(name){
  const c = CITY_BY_NAME.get(name); if (!c) return 0;
  let n = 0;
  if (c.curated && c.curated.central) n++;
  if (c.curated && c.curated.medieval) n++;
  if (c.central && c.central.length) n++;
  return n;
}

// Hämta en stads platser och foga in dem i DATA/ENTRIES. Idempotent.
function loadCity(name){
  if (CITY_LOADED.has(name)) return Promise.resolve(CITY_LOADED.get(name));
  if (CITY_INFLIGHT.has(name)) return CITY_INFLIGHT.get(name);
  const meta = CITY_BY_NAME.get(name);
  if (!meta) return Promise.resolve([]);
  const p = fetch(`data/city/${meta.slug}.json`)
    .then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
    .then(chunk => {
      const arr = (chunk.entries || []).filter(e => !/^(demo|test)[-_]/i.test(e.id || ''));
      CITY_LOADED.set(name, arr);
      DATA = DATA.concat(arr);
      ENTRIES = ENTRIES.concat(arr.filter(hasCoords));
      computeWalkIds();
      return arr;
    })
    .catch(err => { console.error('Kunde inte ladda staden', name, err); CITY_LOADED.set(name, []); return []; })
    .finally(() => CITY_INFLIGHT.delete(name));
  CITY_INFLIGHT.set(name, p);
  return p;
}

// Vilken stad hör ett plats-id till? Slår upp bland laddade städer först; först
// om det misslyckas hämtas den (större) id→stad-tabellen — i praktiken bara när
// användaren har sparade platser i en stad som inte är laddad.
async function cityForId(id){
  for (const [city, arr] of CITY_LOADED) if (arr.some(e => e.id === id)) return city;
  if (!PLACE_CITY){
    try { PLACE_CITY = await (await fetch('data/place-city.json')).json(); }
    catch (e) { PLACE_CITY = {}; }
  }
  const ix = PLACE_CITY[id];
  return (typeof ix === 'number' && CITY_INDEX[ix]) ? CITY_INDEX[ix].name : null;
}

const activeTypes = new Set(Object.keys(TYPES));
let topOnly = false;    // "⭐ Höjdpunkter"-filter: visa bara klockrena stadsvandringsplatser
let activeTour = null; // null = all
// Utforska-vyn kan visas som karta ELLER lista (samma filter gäller båda).
let exploreView = localStorage.getItem('sv_view') === 'list' ? 'list' : 'map';
let listQuery = '';     // sökfältet i listvyn (nollställs vid stadsbyte)
// Översiktsläge: kartan startar utzoomad så ALLA tillgängliga städer syns som
// prickar direkt. Blir false när man väljer/zoomar in på en stad (setActiveCity).
let cityOverview = true;
let overviewApplied = false;   // true först när fitView faktiskt ramat in översikten en gång
let questMode = false;  // progressiv upplåsning av stopp i en vandring
let activeTab = 'home'; // bottenflik-meny
let currentSheetId = null; // öppet stopp i detaljvyn (för omritning vid datauppdatering)
let sheetReturnTour = null; // vilken tur stoppet öppnades från (för "tillbaka till turen")
const STAMP_KEY = 'mjolby_stamps_v1';
const SAVED_KEY = 'mjolby_saved_v1';

// Audio narration + GPS auto-guide state
let speaking = false;
let autoGuide = false, watchId = null;
const autoTriggered = new Set();
const AUTO_RADIUS = 45; // meter
const posSubscribers = []; // callbacks som vill veta om ny GPS-position (t.ex. stadsutmaningen)
function notifyPos(ll){ posSubscribers.forEach(fn=>{ try { fn(ll); } catch(e){} }); }

const $ = sel => document.querySelector(sel);
const stamps = () => new Set(JSON.parse(localStorage.getItem(STAMP_KEY) || '[]'));
const saveStamps = set => localStorage.setItem(STAMP_KEY, JSON.stringify([...set]));
const saved = () => new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'));
const typeOf = e => CATEGORY_TYPE[e.category] || 'story';
const hasCoords = e => e.coordinates && typeof e.coordinates.lat === 'number';
// Välj hero-bild: självhostade EXTRA_IMAGES har ALLTID företräde (laddas alltid).
// Postens egna images[] (ofta Google Photos-URL:er) ignoreras om de inte är laddbara
// under vår CSP (img-src self/supabase) — annars skulle de bli trasiga bilder.
const _loadableImg = u => !!u && !/googleusercontent|place-photos|\/maps\/|google\.com/i.test(u);
const chosenImg = e => {
  const ext = EXTRA_IMAGES[e.id];
  if (ext) return ext;
  const own = e.images && e.images[0];
  return (own && _loadableImg(own.url)) ? own : null;
};
const imgUrl = e => { const i = chosenImg(e); return i ? i.url : null; };
// Självhostade foton finns i webbstorlekar (scripts/build-images.mjs): w320 för
// listminiatyrer, w800 för hero. Originalen är ~1100 px och 300–500 kB — en
// listvy med 20 platser drog flera MB. Externa URL:er lämnas orörda.
const sizedImg = (url, dir) =>
  (url && /^images\/[^/]+\.(jpe?g|png)$/i.test(url))
    ? url.replace(/^images\//, `images/${dir}/`).replace(/\.(jpe?g|png)$/i, '.webp')
    : url;
const imgCredit = e => { const i = chosenImg(e); return i ? (i.attribution || null) : null; };
const imgFocal = e => { const i = chosenImg(e); return i ? (i.focal || null) : null; };
const iconOf = e => CATEGORY_ICON[e.category] || '📍';
/* ---------- Illustrerad stadsscen (porterad från designen) ---------- */
function svgHouse(x,y,w,h,wall,roof,hip){
  const rh=h*0.52;
  const r = hip
    ? `<polygon points="${x-4},${y} ${x+w+4},${y} ${x+w-6},${y-rh} ${x+6},${y-rh}" fill="${roof}"/>`
    : `<polygon points="${x-5},${y} ${x+w+5},${y} ${x+w/2},${y-rh}" fill="${roof}"/>`;
  return `<g>${r}<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${wall}"/>`
    + `<rect x="${x-1}" y="${y}" width="${w+2}" height="2.5" fill="rgba(0,0,0,.08)"/>`
    + `<rect x="${x+w*0.16}" y="${y+h*0.2}" width="${w*0.22}" height="${h*0.28}" rx="1.5" fill="rgba(255,255,255,.85)" stroke="rgba(0,0,0,.12)" stroke-width="0.8"/>`
    + `<rect x="${x+w*0.62}" y="${y+h*0.2}" width="${w*0.22}" height="${h*0.28}" rx="1.5" fill="rgba(255,255,255,.85)" stroke="rgba(0,0,0,.12)" stroke-width="0.8"/>`
    + `<rect x="${x+w*0.4}" y="${y+h*0.5}" width="${w*0.2}" height="${h*0.5}" rx="2" fill="rgba(0,0,0,.18)"/></g>`;
}
function svgTree(x,y,r,c='var(--scene-grass-2)'){
  return `<g><rect x="${x-1.6}" y="${y}" width="3.2" height="${r*0.7}" rx="1.5" fill="#7c5a3a"/>`
    + `<circle cx="${x}" cy="${y-r*0.3}" r="${r}" fill="${c}"/>`
    + `<circle cx="${x-r*0.55}" cy="${y+r*0.1}" r="${r*0.7}" fill="${c}"/>`
    + `<circle cx="${x+r*0.55}" cy="${y+r*0.1}" r="${r*0.7}" fill="${c}"/>`
    + `<circle cx="${x-r*0.3}" cy="${y-r*0.5}" r="${r*0.45}" fill="rgba(255,255,255,.12)"/></g>`;
}
function svgPine(x,y,h){
  const w=h*0.5;
  return `<g><rect x="${x-1.4}" y="${y}" width="2.8" height="5" fill="#7c5a3a"/>`
    + `<polygon points="${x},${y-h} ${x-w/2},${y-h*0.45} ${x+w/2},${y-h*0.45}" fill="var(--scene-grass-2)"/>`
    + `<polygon points="${x},${y-h*0.62} ${x-w*0.62},${y} ${x+w*0.62},${y}" fill="var(--scene-grass)"/></g>`;
}
function svgCloud(x,y,s,speed){
  return `<g style="animation:driftCloud ${speed}s ease-in-out infinite alternate" transform="translate(${x} ${y}) scale(${s})">`
    + `<ellipse cx="0" cy="0" rx="16" ry="9" fill="rgba(255,255,255,.92)"/>`
    + `<ellipse cx="13" cy="3" rx="11" ry="7" fill="rgba(255,255,255,.92)"/>`
    + `<ellipse cx="-12" cy="3" rx="9" ry="6" fill="rgba(255,255,255,.92)"/></g>`;
}
function townScene(){
  return `<svg class="town-scene" viewBox="0 0 400 178" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <defs><linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--sky-1)"/><stop offset="100%" stop-color="var(--sky-2)"/></linearGradient></defs>
    <rect x="0" y="0" width="400" height="178" fill="url(#skyG)"/>
    <g style="animation:floaty 7s ease-in-out infinite"><circle cx="338" cy="40" r="18" fill="var(--flag-yellow)" opacity="0.9"/><circle cx="338" cy="40" r="26" fill="var(--flag-yellow)" opacity="0.18"/></g>
    ${svgCloud(78,36,1,26)}${svgCloud(250,26,0.7,20)}
    <path d="M0 96 Q70 64 150 88 T300 80 T400 92 V178 H0 Z" fill="var(--forest-soft)"/>
    <path d="M0 112 Q90 84 200 104 T400 104 V178 H0 Z" fill="var(--scene-grass)" opacity="0.55"/>
    <rect x="0" y="126" width="400" height="52" fill="var(--scene-water)"/>
    <rect x="0" y="126" width="400" height="9" fill="rgba(255,255,255,0.18)"/>
    <g style="animation:bob 5s ease-in-out infinite"><polygon points="44,150 70,150 64,160 50,160" fill="#7c5a3a"/><polygon points="57,120 57,148 40,148" fill="#FFFDF7"/><polygon points="59,122 59,148 74,148" fill="var(--flag-blue)"/></g>
    <rect x="0" y="120" width="400" height="14" fill="var(--scene-grass-2)"/>
    ${svgHouse(96,118,34,30,'var(--wall-a)','var(--roof-a)',false)}
    ${svgHouse(138,116,30,32,'var(--wall-b)','var(--roof-b)',false)}
    <g><rect x="186" y="92" width="34" height="56" fill="#FBF7EE"/><polygon points="183,92 223,92 203,72" fill="var(--roof-a)"/><rect x="198" y="46" width="10" height="48" fill="#FBF7EE"/><polygon points="197,46 209,46 203,30" fill="var(--forest)"/><rect x="201" y="34" width="4" height="9" fill="var(--honey)"/><rect x="200" y="108" width="6" height="14" rx="3" fill="rgba(0,0,0,0.18)"/></g>
    ${svgHouse(232,116,32,32,'var(--wall-c)','var(--roof-b)',true)}
    ${svgHouse(270,118,30,30,'var(--wall-a)','var(--roof-a)',false)}
    ${svgTree(80,138,13)}${svgTree(170,140,11,'var(--scene-grass)')}${svgPine(346,146,30)}
    <g><rect x="20" y="96" width="2.6" height="52" rx="1.3" fill="#9a8b6f"/><g style="animation:floaty 4s ease-in-out infinite"><rect x="22.6" y="98" width="30" height="19" fill="var(--flag-blue)"/><rect x="22.6" y="105" width="30" height="5" fill="var(--flag-yellow)"/><rect x="31" y="98" width="5" height="19" fill="var(--flag-yellow)"/></g></g>
    <path d="M0 178 L0 162 Q140 150 200 162 Q280 176 400 160 L400 178 Z" fill="var(--scene-road)"/>
    <path d="M0 162 Q140 150 200 162 Q280 176 400 160" fill="none" stroke="var(--scene-road-edge)" stroke-width="2"/>
  </svg>`;
}

function routeThumb(seed=0){
  const roofs=['var(--roof-a)','var(--lake)','var(--forest)'];
  const d=['M0 46 C40 36 70 56 132 44','M0 30 C40 44 70 26 132 40'][seed%2];
  return `<svg viewBox="0 0 132 72" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block" aria-hidden="true">
    <rect width="132" height="72" fill="var(--scene-grass)"/><rect width="132" height="72" fill="rgba(255,255,255,.08)"/>
    <path d="M0 ${42+seed*4} C40 ${36+seed*4} 70 ${50-seed*3} 132 44" stroke="var(--scene-water)" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="${100-seed*8}" cy="58" rx="20" ry="11" fill="var(--scene-water)"/>
    <path d="${d}" fill="none" stroke="var(--scene-road-edge)" stroke-width="8" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="var(--scene-road)" stroke-width="5" stroke-linecap="round"/>
    <g transform="translate(48 30) scale(.55)">${svgHouse(0,0,26,20,'#FBF7EE',roofs[seed%3],false)}</g>
    <g transform="translate(80 50) scale(.5)">${svgHouse(0,0,24,20,'var(--wall-a)',roofs[(seed+1)%3],false)}</g>
    ${svgTree(24,50,7)}${svgTree(118,60,8,'var(--honey)')}${svgPine(64,20,13)}
    <circle cx="8" cy="${seed%2?24:56}" r="4.5" fill="var(--primary)" stroke="#fff" stroke-width="1.5"/>
    <circle cx="124" cy="44" r="5" fill="var(--honey)" stroke="#fff" stroke-width="1.5"/>
  </svg>`;
}

const typeLabel = e => t('type_' + typeOf(e));
const tourName = key => (key === 'userroute' && USER_ROUTE) ? USER_ROUTE.title : t('tour_' + key + '_name');
const tourSub  = key => (key === 'userroute' && USER_ROUTE) ? (USER_ROUTE.intro || '') : t('tour_' + key + '_sub');
function stopThumb(e, badge){
  const img = imgUrl(e), icon = iconOf(e);
  if (!img) return `<span class="stop-thumb ph">${icon}${badge||''}</span>`;
  const small = sizedImg(img, 'w320');
  // Saknas webbstorleken (t.ex. innan build-images körts) → prova originalet en
  // gång, annars faller vi tillbaka på kategoriikonen.
  const onerr = small === img
    ? `this.remove();this.parentElement.classList.add('ph');this.parentElement.insertAdjacentText('afterbegin','${icon}')`
    : `if(this.dataset.full){this.remove();this.parentElement.classList.add('ph');this.parentElement.insertAdjacentText('afterbegin','${icon}')}else{this.dataset.full=1;this.src='${img}'}`;
  return `<span class="stop-thumb"><img src="${small}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"
         onerror="${onerr}">${badge||''}</span>`;
}

/* ---------- Init ---------- */
async function init() {
  setupErrorMonitoring();    // tidigt, så även tidiga fel fångas
  // Kom man in via en delad utmanings-/resultatlänk måste modulen laddas direkt —
  // den läser hashen och rensar den. Annars väntar den till Leder eller Profil.
  if (/[#&](challenge|result)=/.test(location.hash || '')){
    challengesMod().then(m => m.detectChallengeInUrl());
  }

  // Stadsindexet är litet (~40 kB) och räcker för karta-översikt, stadsväljare och
  // ledräkning. Bara den aktiva stadens platser hämtas — resten vid stadsbyte.
  applyCityIndex(await (await fetch('data/cities.json')).json());
  if (!CITY_BY_NAME.has(activeCity)) activeCity = CITY_BY_NAME.has('Mjölby') ? 'Mjölby' : (CITY_INDEX[0] && CITY_INDEX[0].name) || 'Mjölby';
  TELLER = tellerFor(activeCity);
  await loadCity(activeCity);   // fyller DATA/ENTRIES + kör computeWalkIds()

  // Evenemang per ort (build-tids-hämtade från respektive Visit-sida). Stads-nycklat
  // objekt: { "Mjölby": {source,sourceUrl,fetched,events:[…]}, "Motala": {…}, … }.
  // Bakåtkompatibelt: en gammal platt fil tolkas som Mjölby. Bryt inte appen om filen saknas.
  try {
    const ev = await (await fetch('events.json')).json();
    EVENTS_BY_CITY = (ev && Array.isArray(ev.events)) ? { 'Mjölby': ev } : (ev || {});
  } catch (e) { EVENTS_BY_CITY = {}; }

  buildMap();
  buildTours();
  buildFilters();
  renderMarkers();
  wireUi();
  setExploreView(exploreView, true);   // återställ senast valda vy (karta/lista)
  buildTabbar();
  // PWA-genvägar / djuplänk: ?tab=routes|cities|saved|profile öppnar direkt rätt flik.
  try {
    const wantTab = new URLSearchParams(location.search).get('tab');
    if (wantTab && ['cities','routes','saved','contribute','profile','home'].includes(wantTab) && wantTab!=='home') switchTab(wantTab);
  } catch(_){}
  applyI18n();
  updateStampBadge();
  setupTeller();
  setupChallenges();
  // Konton + community-tips drar in supabase-biblioteket (199 kB). Inget av det
  // behövs för att kartan ska bli användbar, så det får vänta tills webbläsaren
  // är ledig — annars konkurrerar hämtningen med kartrutor och nålar.
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 800));
  idle(() => setupAuthTips(), { timeout: 3000 });
  setupInstallPrompt();
  setupSpokBanner();
  setupConnectivity();

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(()=>{});
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', ()=>{
      // En ny version tog över → ladda om en gång så den nya designen syns direkt
      if (reloaded || !hadController) return;
      reloaded = true; location.reload();
    });
  }

  // Landningssida vid första besöket: välj/sök stad innan appen visas.
  // Djuplänkar hoppar över landningsvyn — den som klickat på en länk ska landa
  // på det de klickade på, inte på en stadsväljare.
  const sharedRoute = routeInUrl();
  const sharedPlace = placeInUrl();
  if (sharedRoute) { localStorage.setItem(LANDING_KEY,'1'); openRoute(sharedRoute); }
  else if (sharedPlace) { localStorage.setItem(LANDING_KEY,'1'); openPlaceDeepLink(sharedPlace); }
  else if (!localStorage.getItem(LANDING_KEY)) openLanding();

  track('app_open', { lang });
}

function buildMap() {
  // Starta direkt på den aktiva stadens centrum (inte alltid Mjölby) → ingen
  // "blink" via fel stad innan fitView passar in. Snitt av stadens stopp.
  const cc = (()=>{ const c=ENTRIES.filter(inCity).map(e=>e.coordinates);
    if(!c.length) return [58.327,15.13];
    return [c.reduce((s,x)=>s+x.lat,0)/c.length, c.reduce((s,x)=>s+x.lng,0)/c.length]; })();
  map = L.map('map', { zoomControl:true }).setView(cc, 12);
  // Carto Voyager-basemap (gratis, ingen nyckel, tillåten för app-bruk). OSM:s egna
  // tile-servrar (tile.openstreetmap.org) blockerar produktionsappar med 503 → använd inte dem.
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap, &copy; CARTO'
  }).addTo(map);
  // Bläddra-läget klustrar avståndsbaserat i renderView(); plain-lager för aktiv tur (alla stopp syns).
  markerLayer = L.layerGroup();
  plainLayer = L.layerGroup();
  map.addLayer(markerLayer); plainLayer.addTo(map);
  routeLayer = L.layerGroup().addTo(map);
  // Klustringen är beräknad i pixelrymd för aktuell zoom → rita om vid varje zoom/pan.
  map.on('zoomend moveend', renderView);

  // Spökplatser: eget lager över hela Sverige (oberoende av vald stad). Byggs en
  // gång och ligger kvar — renderMarkers() rör det inte. Toggle via egen knapp.
  buildGhostLayer();

  const Loc = L.Control.extend({
    options:{ position:'topleft' },
    onAdd(){
      const b = L.DomUtil.create('a','leaflet-bar leaflet-control loc-btn');
      b.href='#'; b.title='Var är jag?'; b.innerHTML='📍';
      b.setAttribute('role','button'); b.setAttribute('aria-label','Visa min position på kartan');
      b.style.cssText='width:34px;height:34px;line-height:34px;text-align:center;font-size:17px;background:#fff';
      L.DomEvent.on(b,'click',ev=>{ L.DomEvent.preventDefault(ev); locate(); });
      return b;
    }
  });
  map.addControl(new Loc());

  const Auto = L.Control.extend({
    options:{ position:'topleft' },
    onAdd(){
      const b = L.DomUtil.create('a','leaflet-bar leaflet-control autoguide-btn');
      b.href='#'; b.title='Auto-guide av'; b.innerHTML='🎧';
      b.setAttribute('role','button'); b.setAttribute('aria-label','Slå på auto-guide (ljud vid stopp)'); b.setAttribute('aria-pressed','false');
      b.style.cssText='width:34px;height:34px;line-height:34px;text-align:center;font-size:17px;background:#fff';
      L.DomEvent.on(b,'click',ev=>{ L.DomEvent.preventDefault(ev); toggleAutoGuide(); });
      return b;
    }
  });
  map.addControl(new Auto());

  const Ghost = L.Control.extend({
    options:{ position:'topleft' },
    onAdd(){
      const b = L.DomUtil.create('a','leaflet-bar leaflet-control ghost-btn');
      b.href='#'; b.title = lang==='en' ? 'Haunted places' : 'Spökplatser'; b.innerHTML='👻';
      b.setAttribute('role','button');
      b.setAttribute('aria-label', lang==='en' ? 'Toggle haunted places' : 'Visa/dölj spökplatser');
      b.setAttribute('aria-pressed', String(ghostsOn));
      b.style.cssText='width:34px;height:34px;line-height:34px;text-align:center;font-size:17px;background:#fff';
      b.classList.toggle('on', ghostsOn);
      L.DomEvent.on(b,'click',ev=>{ L.DomEvent.preventDefault(ev); toggleGhosts(b); });
      return b;
    }
  });
  map.addControl(new Ghost());

  // "Nära mig": välj närmaste stad direkt från kartan → dess platser visas. Så man
  // aldrig behöver gå in i stads-listan/söka för att komma igång.
  const Near = L.Control.extend({
    options:{ position:'topleft' },
    onAdd(){
      const b = L.DomUtil.create('a','leaflet-bar leaflet-control near-btn');
      b.href='#'; b.title = lang==='en' ? 'Nearest town' : 'Närmaste stad';
      b.innerHTML = `🧭<span class="near-lbl">${lang==='en' ? 'Near me' : 'Nära mig'}</span>`;
      b.setAttribute('role','button');
      b.setAttribute('aria-label', lang==='en' ? 'Select nearest town' : 'Välj närmaste stad');
      b.style.cssText='height:34px;line-height:34px;padding:0 10px;text-align:center;font-size:15px;font-weight:700;background:#fff;white-space:nowrap;text-decoration:none;color:#3b2a70';
      L.DomEvent.on(b,'click',ev=>{ L.DomEvent.preventDefault(ev); selectNearestCity(b); });
      return b;
    }
  });
  map.addControl(new Near());

  // "Alla städer": tillbaka till översikten som visar SAMTLIGA tillgängliga städer
  // — närsomhelst, oavsett om man valt/sökt en stad. Döljs i Mjölby-only-läget.
  if (!MJOLBY_ONLY){
    const AllCities = L.Control.extend({
      options:{ position:'topleft' },
      onAdd(){
        const b = L.DomUtil.create('a','leaflet-bar leaflet-control allcities-btn');
        b.href='#'; b.title = lang==='en' ? 'All towns' : 'Alla städer';
        b.innerHTML = `🗺️<span class="near-lbl">${lang==='en' ? 'All towns' : 'Alla städer'}</span>`;
        b.setAttribute('role','button');
        b.setAttribute('aria-label', lang==='en' ? 'Show all towns' : 'Visa alla städer');
        b.style.cssText='height:34px;line-height:34px;padding:0 10px;text-align:center;font-size:15px;font-weight:700;background:#fff;white-space:nowrap;text-decoration:none;color:#3b2a70';
        L.DomEvent.on(b,'click',ev=>{ L.DomEvent.preventDefault(ev); showAllCities(); });
        return b;
      }
    });
    map.addControl(new AllCities());
  }

  // Kartan ligger i en storleksbegränsad ram → se till att Leaflet mäter om sig.
  // Vid första laddningen körs renderMarkers/fitView innan layouten är klar (#map
  // har 0 höjd), så fitBounds hamnar i världsvy. Mät om storleken OCH passa in på
  // nytt när ramen fått sina mått — annars fastnar kartan utzoomad.
  const settleMap = ()=>{ try{ map.invalidateSize(); fitView(); }catch(e){} };
  requestAnimationFrame(settleMap);
  setTimeout(settleMap, 200);
  setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 600);
  window.addEventListener('resize', ()=> { try{ map.invalidateSize(); }catch(e){} });
}

/* ---------- Spökplatser (Spökkartan-korsmarknadsföring) ---------- */
function ghostIcon(){
  // Diskret svart prick — smälter in bland kartans platser istället för en stor
  // emoji-nål. Skiljer sig ändå (mörk, ingen kategori-färg) och känns lugn.
  return L.divIcon({
    className:'',
    html:`<div class="ghost-dot" aria-hidden="true"></div>`,
    iconSize:[14,14], iconAnchor:[7,7], popupAnchor:[0,-8],
  });
}
function buildGhostLayer(){
  if (!map) return;
  ghostLayer = L.layerGroup();
  GHOSTS.forEach(g=>{
    L.marker([g.lat, g.lng], { icon: ghostIcon(), keyboard:false, riseOnHover:true, zIndexOffset:-200 })
      .on('click', ()=> openGhostSheet(g))
      .addTo(ghostLayer);
  });
  if (ghostsOn) ghostLayer.addTo(map);
}
function toggleGhosts(btn){
  ghostsOn = !ghostsOn;
  try { localStorage.setItem(GHOSTS_KEY, ghostsOn ? '1' : '0'); } catch(_){}
  if (ghostLayer){ if (ghostsOn) ghostLayer.addTo(map); else map.removeLayer(ghostLayer); }
  if (btn){ btn.classList.toggle('on', ghostsOn); btn.setAttribute('aria-pressed', String(ghostsOn)); }
  toast(ghostsOn ? (lang==='en'?'👻 Haunted places shown':'👻 Spökplatser visas')
                 : (lang==='en'?'Haunted places hidden':'Spökplatser dolda'));
  track('ghosts_toggle', { on: ghostsOn });
}
function openGhostSheet(g){
  track('ghost_open', { name: g.name });
  currentSheetId = null;             // ghost-teaser är inget riktigt stopp
  const en = lang==='en';
  const title = en ? 'A haunted place' : 'Det spökar här';
  const body  = en
    ? `<b>${g.name}</b>${g.region?` · ${g.region}`:''} is said to be haunted. This is a taste — the real ghost stories live on <b>Spökkartan</b>, our sister map of haunted places all over Sweden.`
    : `<b>${g.name}</b>${g.region?` · ${g.region}`:''} är enligt sägnen en plats där det spökar. Det här är bara en försmak — de riktiga spökhistorierna finns på <b>Spökkartan</b>, vår systerkarta över hemsökta platser i hela Sverige.`;
  const cta = en ? 'Explore on Spökkartan' : 'Läs mer på Spökkartan';
  $('#sheet-inner').innerHTML = `
    <div class="hero hero--ghost"><div class="ghost-hero"><span class="ghost-hero__emoji">👻</span></div></div>
    <div class="sheet-pad">
      <span class="type-tag" style="background:#5b4b8a">👻 ${en?'Haunted':'Spökplats'}</span>
      <span class="city-tag">📍 ${g.region||'Sverige'}</span>
      <h2>${g.name}</h2>
      <p class="lead">${title}</p>
      <div class="story"><p>${body}</p></div>
      <a class="checkin ghost-cta" href="${SPOKKARTAN_URL}" target="_blank" rel="noopener"
         onclick="try{}catch(_){}">🔮 ${cta}</a>
      <p class="srcs"><a href="${SPOKKARTAN_URL}" target="_blank" rel="noopener">spokkartan.se</a></p>
    </div>`;
  const sb = $('#save-btn'); if (sb){ sb.classList.remove('on'); sb.style.display='none'; }
  closeOverlays('#sheet');
  $('#sheet').setAttribute('aria-hidden','false');
  focusInto('#sheet');
  if (map) map.panTo([g.lat, g.lng], { animate:true });
}

function pinIcon(entry, visited){
  // Ren punktnål — ingen ikon/emoji (matchar Spökkartans kartspråk).
  // Bonusplatser (tunnare underlag) ritas mindre och dämpade så höjdpunkterna
  // dominerar kartbilden.
  const bonus = !isTopPlace(entry);
  return L.divIcon({
    className:'',
    html:`<div class="pin ${visited?'visited':''}${bonus?' pin--bonus':''}"></div>`,
    iconSize:[20,20], iconAnchor:[10,10], popupAnchor:[0,-12],
  });
}

function visibleEntries(){
  let list = ENTRIES.filter(e => inCity(e) && activeTypes.has(typeOf(e)));
  if (topOnly) list = list.filter(isTopPlace);
  if (activeTour) list = list.filter(TOURS[activeTour].test);
  return list;
}

function renderMarkers(){
  renderView();
  drawRoute();
  updateNextStopBtn();
  fitView();
  if (exploreView === 'list') renderPlaceList();   // filter/tur/stad ändrad → spegla i listvyn
}

// Avståndsbaserad klustring: projicera alla platser i staden till pixelkoordinater
// för aktuell zoom och gruppera — platser inom CLUSTER_RADIUS_PX blir en bubbla.
// Klick på bubbla → zooma in 2 steg mot bubblans mittpunkt tills enskilda nålar
// syns. Körs om på varje zoomend/moveend (kopplas i buildMap).
//
// KLUSTRAS över hela staden (så en bubblas siffra inte ändras när man panorerar)
// men RITAS bara inom vyn + marginal. Mätt i Göteborg zoom 15: 444 nålnoder i
// DOM:en varav 56 syntes — resten byggdes om vid varje panorering i onödan.
const CLUSTER_RADIUS_PX = 60;
const VIEW_PAD = 0.35;          // extra vy-marginal så nålar finns på plats vid pan

// Girig klustring i pixelrymd, hinkad i ett rutnät med cellstorlek = radien.
// Tidigare linjärsöktes hela klusterlistan per plats (O(n·k) — 609 platser mot
// ~190 bubblor ≈ 115 000 avståndstest vid varje omritning); nu räcker 3×3 celler.
function clusterByPixel(list, zoom, radius){
  const out = [];
  if (radius <= 0) return list.map(e => ({ items: [e] }));
  const grid = new Map();
  for (const e of list){
    const pt = map.project([e.coordinates.lat, e.coordinates.lng], zoom);
    const cx = Math.floor(pt.x / radius), cy = Math.floor(pt.y / radius);
    let hit = null;
    for (let dx = -1; dx <= 1 && !hit; dx++){
      for (let dy = -1; dy <= 1 && !hit; dy++){
        const bucket = grid.get((cx + dx) + ',' + (cy + dy));
        if (!bucket) continue;
        for (const c of bucket){
          if (Math.hypot(c.x - pt.x, c.y - pt.y) < radius){ hit = c; break; }
        }
      }
    }
    if (!hit){
      hit = { x: pt.x, y: pt.y, items: [] };
      const key = cx + ',' + cy;
      const bucket = grid.get(key);
      if (bucket) bucket.push(hit); else grid.set(key, [hit]);
      out.push(hit);
    }
    hit.items.push(e);
  }
  return out;
}
function renderView(){
  if (!map) return;
  // Zoomar man in manuellt (förbi översiktens nivå) lämnar vi översiktsläget så
  // vyn inte hoppar tillbaka till hela-Sverige vid nästa omritning (filter etc.).
  // Gatas på overviewApplied: kartan skapas på zoom 12, så utan gaten skulle
  // första renderView nollställa läget innan översikten ens hunnit ritas.
  if (overviewApplied && cityOverview && map.getZoom() >= 11) cityOverview = false;
  markerLayer.clearLayers();
  plainLayer.clearLayers();
  const st = stamps();
  const list = visibleEntries();

  const single = (e, target)=>{
    const m = L.marker([e.coordinates.lat, e.coordinates.lng], { icon: pinIcon(e, st.has(e.id)) })
      .on('click', ()=> openSheet(e.id));
    target.addLayer(m);
  };

  // Under en aktiv tur: visa alla stopp individuellt (följ leden). Annars: klustra.
  if (activeTour){ list.forEach(e=> single(e, plainLayer)); return; }

  // Översiktsläge (utzoomat): ren stadsöversikt — varje stad = en tydlig stads-nål
  // (inga namn, inga stopp-kluster). Den aktiva staden markeras subtilt så man ser
  // vilken man är i.
  if (cityOverview && !MJOLBY_ONLY){
    const cm = CITY_META[activeCity];
    if (cm) markerLayer.addLayer(activeCityPin(activeCity, cm.lat, cm.lng));
    renderOtherCities();
    return;
  }

  const zoom = map.getZoom();
  const maxZoom = map.getMaxZoom();
  // Vid max-zoom kan en bubbla inte delas mer — visa då alla nålar individuellt.
  const R = zoom >= maxZoom ? 0 : CLUSTER_RADIUS_PX;
  const clusters = clusterByPixel(list, zoom, R);
  // Rita bara det som syns (plus marginal). Klustringen ovan gick över hela staden,
  // så en bubblas siffra står still när man panorerar.
  const view = map.getBounds().pad(VIEW_PAD);
  clusters.forEach(c=>{
    if (c.items.length === 1){
      const e = c.items[0];
      if (view.contains([e.coordinates.lat, e.coordinates.lng])) single(e, markerLayer);
      return;
    }
    const lat = c.items.reduce((s,p)=>s+p.coordinates.lat,0)/c.items.length;
    const lng = c.items.reduce((s,p)=>s+p.coordinates.lng,0)/c.items.length;
    if (!view.contains([lat, lng])) return;
    const n = c.items.length;
    const size = n >= 40 ? 60 : n >= 10 ? 48 : 38;
    const m = L.marker([lat,lng], {
      icon: L.divIcon({
        className:'mc-wrap',
        html:`<div class="mc-bubble" style="width:${size}px;height:${size}px">${n}</div>`,
        iconSize:[size,size], iconAnchor:[size/2,size/2],
      }),
      keyboard:false,
    }).on('click', ()=> map.flyTo([lat,lng], Math.min(zoom+2, maxZoom)));
    markerLayer.addLayer(m);
  });

  // Visa alltid de ANDRA städerna i vandringen som prickar — oavsett vald stad.
  // Så man kan se var övriga stadsvandringar finns och hoppa dit.
  renderOtherCities();
}

// Subtil stads-nål för den AKTIVA staden (den man är i) i översikten. Klick →
// zooma in i staden och visa dess platser.
function activeCityPin(name, lat, lng){
  return L.marker([lat, lng], {
    icon: L.divIcon({
      className:'mc-wrap',
      html:`<div class="city-pin city-pin--active"></div>`,
      iconSize:[26,32], iconAnchor:[13,30],
    }),
    keyboard:false, zIndexOffset:400, title:name,
  }).on('click', ()=>{ cityOverview = false; map.flyTo([lat, lng], 13, { animate:true }); });
}

// Stads-nålar för de övriga valbara städerna (ej den aktiva). VARJE stad får sin
// egen nål — de slås aldrig ihop till kluster, så man alltid ser exakt vilka
// städer som finns i stadsvandringen. Inga namn på kartan. Klick → popup → byt stad.
function renderOtherCities(){
  if (!map || MJOLBY_ONLY) return;
  const active = activeCity;
  const pts = citiesInData()
    .map(c => c.name).filter(name => name !== active)
    .map(name => { const m = CITY_META[name]; return m && { lat:m.lat, lng:m.lng, name, count:m.count }; })
    .filter(Boolean);
  if (!pts.length) return;

  // Bara de städer som är i vyn (plus marginal). Zoomad in i en stad låg annars
  // 71 nålar för andra städer kvar i DOM:en, alla utanför skärmen.
  const view = map.getBounds().pad(VIEW_PAD);
  pts.filter(p => view.contains([p.lat, p.lng])).forEach(p=>{
    const m = L.marker([p.lat, p.lng], {
      icon: L.divIcon({
        className:'mc-wrap',
        html:`<div class="city-pin"></div>`,
        iconSize:[24,30], iconAnchor:[12,28],
      }),
      keyboard:false, zIndexOffset:-100,
    });
    // Tryck på staden → liten popup med "Visa platser →" (tryck → välj → platser),
    // så man kan välja stad direkt på kartan utan att gå in i stads-listan.
    const placesTxt = p.count + ' ' + (lang==='en' ? 'places' : 'platser');
    const btnTxt = lang==='en' ? 'Show places →' : 'Visa platser →';
    m.bindPopup(
      `<div class="city-pop"><b>${p.name}</b><small>${placesTxt}</small>` +
      `<button type="button" class="city-pop-btn">${btnTxt}</button></div>`,
      { className:'city-pop-wrap', closeButton:true, autoPan:true, minWidth:150 }
    );
    m.on('popupopen', ()=>{
      const btn = document.querySelector('.leaflet-popup .city-pop-btn');
      if (btn) L.DomEvent.on(btn, 'click', ()=>{ m.closePopup(); setActiveCity(p.name); });
    });
    markerLayer.addLayer(m);
  });
}

function orderedTourEntries(tourKey){
  const t = TOURS[tourKey];
  // Användarrutt: ordningen är den som ruttmakaren valde, inte någon sortering.
  if (t.user){
    if (!USER_ROUTE) return [];
    return USER_ROUTE.stops.map(id => DATA.find(e => e.id === id)).filter(Boolean);
  }
  // Generisk centrumslinga: använd den förberäknade, redan ordnade id-listan för
  // den AKTIVA staden (annars skulle DATA.filter(test) blanda flera städer).
  if (t.generic){
    const ids = CENTRAL_BY_CITY[activeCity] || [];
    return ids.map(id => DATA.find(e => e.id === id)).filter(Boolean);
  }
  let list = DATA.filter(t.test);
  if (t.sequence){
    const idx = id => { const i = t.sequence.indexOf(id); return i<0?99:i; };
    list.sort((a,b)=> idx(a.id) - idx(b.id));
  } else {
    list.sort((a,b)=> t.order(a) - t.order(b));
  }
  return list;
}

// Gatuföljande promenadled via gratis OSRM-foot (FOSSGIS). Rak streckad linje ritas
// direkt som feedback + fallback om rutt-API:t inte svarar (offline/rate-limit).
const routeCache = new Map();   // `${activeCity}|${activeTour}` → latlngs[]
let routeReqId = 0;
function drawRouteLine(latlngs){
  L.polyline(latlngs, { color:'#fff', weight:7, opacity:.6, lineCap:'round', lineJoin:'round' }).addTo(routeLayer);
  L.polyline(latlngs, { color:'#0A2A6B', weight:4, opacity:.85, lineCap:'round', lineJoin:'round' }).addTo(routeLayer);
}
async function fetchFootRoute(pts){
  try{
    const coords = pts.map(p=>`${p[1]},${p[0]}`).join(';');   // OSRM vill ha lng,lat
    const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${coords}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const geo = data && data.routes && data.routes[0] && data.routes[0].geometry;
    if (!geo || !geo.coordinates) return null;
    return geo.coordinates.map(c=>[c[1], c[0]]);             // GeoJSON lng,lat → Leaflet lat,lng
  }catch(e){ return null; }
}
function drawRoute(){
  routeLayer.clearLayers();
  if (!activeTour) return;
  const pts = orderedTourEntries(activeTour).filter(hasCoords)
    .map(e=>[e.coordinates.lat, e.coordinates.lng]);
  if (pts.length < 2) return;
  const key = `${activeCity}|${activeTour}`;
  const cached = routeCache.get(key);
  if (cached){ drawRouteLine(cached); return; }
  // Omedelbar rak streckad linje (feedback + fallback)
  L.polyline(pts, { color:'#0A2A6B', weight:3, opacity:.4, dashArray:'2 9', lineCap:'round' }).addTo(routeLayer);
  const myReq = ++routeReqId;
  fetchFootRoute(pts).then(latlngs=>{
    if (myReq !== routeReqId || !activeTour) return;          // turen bytt/stängd under tiden
    if (!latlngs) return;                                     // behåll rak linje
    routeCache.set(key, latlngs);
    routeLayer.clearLayers();
    drawRouteLine(latlngs);
  });
}

// "Till nästa plats": hämta position → nästa ostämplade stopp → gångväg dit + avstånd/tid.
let navLayer = null;
function routeDistance(latlngs){ let d=0; for (let i=1;i<latlngs.length;i++) d+=map.distance(latlngs[i-1],latlngs[i]); return d; }
function updateNextStopBtn(){
  const b=$('#next-stop-btn'); if (!b) return;
  b.hidden = !activeTour || exploreView === 'list';   // navigering hör till kartvyn
  if (!activeTour && navLayer) navLayer.clearLayers();
  const lbl=$('#next-stop-label'); if (lbl) lbl.textContent=t('nav_next');
}
function navigateToNext(){
  if (!activeTour) return;
  if (!navigator.geolocation){ toast(t('nav_geo_fail')); return; }
  toast(t('nav_locating'));
  navigator.geolocation.getCurrentPosition(pos=>{
    const me=[pos.coords.latitude,pos.coords.longitude];
    showMe(me, false);
    const st=stamps();
    const list=orderedTourEntries(activeTour).filter(hasCoords);
    const next=list.find(e=>!st.has(e.id));
    if (!next){ toast(t('nav_nostop')); return; }
    const dest=[next.coordinates.lat,next.coordinates.lng];
    if (map.distance(me, dest) < 40){          // du står redan vid stoppet
      if (navLayer) navLayer.clearLayers();
      map.setView(dest, Math.max(map.getZoom(),16), {animate:true});
      toast(`✓ ${t('nav_here')} ${next.name} 🎉`);
      speak(`${t('nav_here')} ${next.name}.`);
      openSheet(next.id);
      return;
    }
    fetchFootRoute([me,dest]).then(latlngs=>{
      if (!navLayer) navLayer=L.layerGroup().addTo(map);
      navLayer.clearLayers();
      const line=(latlngs&&latlngs.length>1)?latlngs:[me,dest];
      L.polyline(line, { color:'#fff', weight:8, opacity:.7, lineCap:'round', lineJoin:'round' }).addTo(navLayer);
      L.polyline(line, { color:'#E2A21A', weight:5, opacity:.95, lineCap:'round', lineJoin:'round', dashArray:latlngs?null:'4 9' }).addTo(navLayer);
      const dist=Math.round(routeDistance(line));
      const mins=Math.max(1,Math.round(dist/80));   // ~80 m/min gångtakt
      const distTxt=dist>=1000?(dist/1000).toFixed(1)+' km':dist+' m';
      try{ map.fitBounds(L.latLngBounds(line).pad(0.25), { maxZoom:17, animate:true }); }catch(e){}
      toast(`${t('nav_to')} ${next.name} · ${distTxt} · ~${mins} ${t('nav_min')}`);
      speak(lang==='en' ? `Next stop: ${next.name}. About ${distTxt} away, ${mins} minutes on foot.`
                        : `Nästa stopp: ${next.name}. Ungefär ${distTxt} bort, ${mins} minuters promenad.`);
    });
  }, ()=> toast(t('nav_geo_fail')), { enableHighAccuracy:true, timeout:10000 });
}

function fitView(){
  if (!map) return;
  try { map.invalidateSize(); } catch(e){}
  // Om kartramen ännu inte fått sina mått (0×0 vid första laddningen) skulle
  // fitBounds räkna fram världsvy OCH lämna ett felplacerat spök-kluster. Hoppa
  // då över — settleMap()/buildMap kör fitView igen så snart storleken är känd.
  const sz = (map.getSize && map.getSize()) || { x:0, y:0 };
  if (!sz.x || !sz.y) return;
  // Översiktsläge: rama in ALLA tillgängliga städer så man alltid ser vilka som
  // finns. Zooma/klicka in på en stad → cityOverview blir false och vi ramar in
  // just den staden i stället.
  if (cityOverview && !activeTour && !MJOLBY_ONLY){
    const lls = citiesInData().map(c => CITY_META[c.name]).filter(Boolean).map(m => [m.lat, m.lng]);
    if (lls.length > 1){
      map.fitBounds(L.latLngBounds(lls).pad(0.12), { maxZoom: 10 });
      overviewApplied = true;
      return;
    }
  }
  // Obs: räkna på platserna (inte markörerna) — i bläddra-läget är de flesta
  // platser dolda inne i klusterbubblor och saknar egen markör.
  const ms = visibleEntries().map(e => L.marker([e.coordinates.lat, e.coordinates.lng]));
  if (!ms.length) return;
  // Utan aktiv tur: rama in stadskärnan i stället för hela kommunen. Efter
  // K-samsök-importen ligger många platser långt ut på landsbygden → hela stadens
  // bounds zoomar ut allt till ETT jätte-kluster. Vi hittar ett robust centrum
  // (median av nålarna, tål utliggare) och ramar in bara det som ligger inom
  // CENTRAL_RADIUS_KM. De perifera platserna finns kvar på kartan (panorera/zooma
  // ut) men startvyn blir kärnan där enskilda nålar syns. Beräknas direkt här så
  // det funkar även för kurerade städer (Mjölby) som saknar CENTRAL_BY_CITY.
  let fitMarkers = ms;
  if (!activeTour && ms.length > 6){
    const lls = ms.map(m => m.getLatLng());
    const med = arr => { const s = [...arr].sort((a,b)=>a-b); return s[s.length>>1]; };
    const c = { lat: med(lls.map(p=>p.lat)), lng: med(lls.map(p=>p.lng)) };
    const near = ms.filter(m => { const p = m.getLatLng(); return distKm({ lat:p.lat, lng:p.lng }, c) <= CENTRAL_RADIUS_KM; });
    if (near.length >= 3) fitMarkers = near;
  }
  const grp = L.featureGroup(fitMarkers);
  map.fitBounds(grp.getBounds().pad(0.18), { maxZoom: activeTour==='central'?16:15 });
}

/* ---------- Tours UI ---------- */
function buildTours(){
  const wrap = $('#tours');
  const cityCount = ENTRIES.filter(inCity).length;
  // Bara turer som har stopp i den valda staden
  const cityTours = Object.entries(TOURS)
    .filter(([k,tr])=> k !== 'userroute' || activeTour === 'userroute')   // rutten visas bara medan man går den
    .filter(([k,tr])=> DATA.filter(tr.test).some(inCity));
  const chips = [['all', `${t('tours_all')} · ${activeCity}`, nStops(cityCount)]]
    .concat(cityTours.map(([k,tr])=>[k, tourName(k), nStops(DATA.filter(tr.test).filter(inCity).length)]));
  wrap.innerHTML = chips.map(([k,name,sub])=>
    `<button class="tour-chip ${k==='all'?'active':''}" data-tour="${k}">${name}<small>${sub}</small></button>`
  ).join('');
  wrap.querySelectorAll('.tour-chip').forEach(b=>{
    b.onclick = ()=>{
      wrap.querySelectorAll('.tour-chip').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const k = b.dataset.tour;
      activeTour = k==='all' ? null : k;
      renderMarkers();
      if (activeTour) openTourPanel(activeTour); else closePanel('#tour-panel');
    };
  });
}

function openTourPanel(key){
  $('#tour-title').textContent = tourName(key);
  $('#tour-sub').textContent = tourSub(key);
  const st = stamps();
  const list = orderedTourEntries(key);
  // Quest-progress: första stoppet i ordningen som inte är incheckat
  let progressIndex = list.findIndex(e=>!st.has(e.id));
  if (progressIndex < 0) progressIndex = list.length;

  const qt = $('#quest-toggle');
  qt.setAttribute('aria-pressed', String(questMode));
  qt.classList.toggle('on', questMode);
  qt.textContent = '🗺️ ' + (questMode ? t('quest_on') : t('quest_off'));
  qt.onclick = ()=>{ questMode = !questMode; openTourPanel(key); };

  $('#tour-stops').innerHTML = list.map((e,i)=>{
    const ty = TYPES[typeOf(e)];
    const done = st.has(e.id);
    const locked = questMode && i > progressIndex;
    const current = questMode && i === progressIndex;
    const badge = `<span class="stop-no" style="background:${ty.color}">${i+1}</span>`;
    if (locked){
      const clue = `${catLabel(e)||(lang==='en'?'A stop':'Ett stopp')}${e.era?` · ${e.era}`:''}`;
      // Ledtråden viskas av STADENS berättare (Lasse enbart i Mjölby).
      const whisper = TELLER ? TELLER.name : (lang==='en'?'Your guide':'Din guide');
      return `<li><div class="stop-row locked" aria-disabled="true">
        <span class="stop-thumb ph">🔒${badge}</span>
        <span class="stop-meta"><b>???</b><small>${whisper} ${lang==='en'?'whispers':'viskar'}: ${clue}</small></span>
      </div></li>`;
    }
    return `<li><button class="stop-row ${current?'current':''}" data-id="${e.id}">
      ${stopThumb(e, badge)}
      <span class="stop-meta"><b>${current?(lang==='en'?'Next: ':'Nästa: '):''}${e.name}</b><small>${typeLabel(e)} · ${e.era||''}</small></span>
      ${done?'<span class="tick" aria-label="besökt">✓</span>':''}
    </button></li>`;
  }).join('');
  $('#tour-stops').querySelectorAll('.stop-row[data-id]').forEach(r=>{
    r.onclick = ()=> openSheet(r.dataset.id);
  });
  $('#tour-quiz-btn').onclick = ()=> startQuiz(key);
  $('#tour-start-label').textContent = t('start_walk');
  $('#tour-start').onclick = ()=>{
    activeTour = key;                 // säkerställ att turen är aktiv
    track('tour_start', { tour: key });
    closePanel('#tour-panel');        // ta mig till vandringen (kartan med leden)
    renderMarkers();                  // visa turens stopp + gatuföljande led
    navigateToNext();                 // vägbeskrivning till första (ostämplade) stoppet
  };
  openPanel('#tour-panel');
}

/* ---------- Filters ---------- */
function buildFilters(){
  const wrap = $('#filters');
  // Först: Höjdpunkter-filtret (klockrena platser vs bonus), sedan typ-filtren.
  wrap.innerHTML = `<button class="fchip fchip--top" data-top="1" aria-pressed="${topOnly}">⭐ ${t('filter_top')}</button>`
    + Object.entries(TYPES).map(([k,ty])=>
    `<button class="fchip" data-type="${k}" aria-pressed="true">
       <span class="dot" style="background:${ty.color}"></span>${t('type_'+k)}
     </button>`).join('');
  const topBtn = wrap.querySelector('[data-top]');
  topBtn.onclick = ()=>{
    topOnly = !topOnly;
    topBtn.setAttribute('aria-pressed', topOnly);
    renderMarkers();
  };
  wrap.querySelectorAll('.fchip[data-type]').forEach(b=>{
    b.onclick = ()=>{
      const k = b.dataset.type;
      if (activeTypes.has(k)) activeTypes.delete(k); else activeTypes.add(k);
      b.setAttribute('aria-pressed', activeTypes.has(k));
      renderMarkers();
    };
  });
}

/* ---------- Stad: byt aktiv stad ---------- */
function updateCityHeader(){
  // Headern bär varumärkeslöftet, inte den aktiva staden — vilken stad man är i
  // syns på "Alla platser"-chippet, i Leder-vyn och i berättaren.
  const el = $('#brand-sub');
  if (el) el.textContent = t('tagline');
}
function citiesInData(){
  // Städer som faktiskt har stopp, med antal — ur stadsindexet, så listan är
  // komplett utan att någon stads platser behöver vara laddade.
  let arr = CITY_INDEX.map(c=>({ name: c.name, count: c.count }));
  if (MJOLBY_ONLY) arr = arr.filter(c=> c.name === 'Mjölby');   // temporär Mjölby-only-demo
  // En ort blir valbar först när den har minst MIN_CITY_STOPS stopp att besöka
  // (Mjölby alltid med). Tunna seed-orter göms tills de byggts ut.
  else arr = arr.filter(c=> c.name === 'Mjölby' || c.count >= MIN_CITY_STOPS);
  return arr;
}
// Byter aktiv stad. Tillståndet byts DIREKT (synkront) så anropare som gör något
// omedelbart efteråt ser rätt stad; bara hämtningen av stadens platser och den
// efterföljande omritningen är asynkron. Returnerar ett löfte som är klart när
// kartan är omritad.
function setActiveCity(city){
  if (!city || city === activeCity) return Promise.resolve();
  activeCity = city;
  localStorage.setItem('sv_city', city);
  cityOverview = false;        // vald stad → zooma in på den (ut ur översiktsläget)
  activeTour = null;
  activeTypes.clear(); Object.keys(TYPES).forEach(k=>activeTypes.add(k));
  TELLER = tellerFor(city);
  autoTriggered.clear();
  listQuery = '';                                     // ny stad → nollställ listsökningen
  const plq = $('#pl-q'); if (plq) plq.value = '';
  updateCityHeader();
  return loadCity(city).then(()=>{
    refreshTips();             // tipsen tillhör staden — hämta om för den nya
    clearCommentCache();       // kommentarer är stadsskopade (city + stop_ref)
    buildTours();
    buildFilters();
    setupTeller(false);        // byt berättare utan att tvinga upp introt
    renderMarkers();           // fitView centrerar om kartan till stadens stopp
    toast((lang==='en'?'Now exploring ':'Nu utforskar du ') + city + ' 🗺️');
    track('city_change', { city });
  });
}

/* ---------- Notis + tidslinje (per plats) ---------- */
// Slås samman med ev. framtida contributor-data (e.notice / e.timeline) så
// kurerat innehåll + inskickat innehåll samexisterar.
// Riktiga evenemang från Visit Mjölby (hämtas vid build-tid → events.json).
// EVENTS fylls i init(). Visas på ortens post (kategori 'ort') med VARJE evenemangs
// egen arena/plats utskriven — ingen felaktig attribution till en specifik plats.
let EVENTS_BY_CITY = {};
function cityEventsMeta(e){ return (e && EVENTS_BY_CITY[e.city]) || null; }
function eventsFor(e){
  // Ortens post (kategori 'ort') visar hela kommunens program — per ort.
  if (e && e.category === 'ort'){ const ce = EVENTS_BY_CITY[e.city]; if (ce && ce.events && ce.events.length) return ce.events; }
  return [];
}
function noticeHtml(id, e){
  const n = NOTICES[id] || (e && e.notice);
  const live = eventsFor(e);
  if (!n && !live.length) return '';
  const items = [
    ...((n && n.events) || []).map(ev=>`<li>${ev.when?`<b>${ev.when}</b>`:''}${ev.when&&ev.what?' — ':''}${ev.what||''}</li>`),
    ...live.map(ev=>`<li><b>${ev.date||''}</b>${ev.date?' — ':''}<a href="${ev.url}" target="_blank" rel="noopener">${ev.title}</a>${ev.arena?` <span class="ev-arena">· ${ev.arena}</span>`:''}</li>`),
  ].join('');
  const icon = (n&&n.icon) || '🎉';
  const title = (n&&n.title) || (live.length ? (lang==='en'?`Events in ${e.name}`:`Evenemang i ${e.name}`) : (lang==='en'?'Events':'Evenemang'));
  const text = (n&&n.text) || '';
  const ce = cityEventsMeta(e);
  const srcUrl = (n&&n.url) || (ce&&ce.sourceUrl) || 'https://www.visitmjolby.se/evenemang';
  const srcName = (n&&n.source) || (ce&&ce.source) || 'Visit Mjölby';
  return `<div class="notice">
    <div class="notice-h">${icon} ${title}</div>
    ${text?`<p>${text}</p>`:''}
    ${items?`<ul class="notice-evs">${items}</ul>`:''}
    <a class="notice-src" href="${srcUrl}" target="_blank" rel="noopener">${srcName} ↗</a>
  </div>`;
}
function timelineHtml(id, e){
  const tl = [...(TIMELINES[id]||[]), ...((e&&e.timeline)||[])];
  if (!tl.length) return '';
  const rows = tl.map(it=>`<li class="tl-item">
    <span class="tl-year">${it.year||''}</span>
    <div class="tl-card">
      ${it.image?`<img class="tl-img" src="${it.image}" alt="${it.title||''}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}
      ${it.title?`<b>${it.title}</b>`:''}
      ${it.text?`<p>${it.text}</p>`:''}
      ${it.credit?`<span class="tl-credit">${it.image?'📷 ':''}${it.credit}</span>`:''}
    </div>
  </li>`).join('');
  return `<div class="timeline"><div class="tl-h">🕰️ ${lang==='en'?'Timeline':'Tidslinje'}</div><ol class="tl-list">${rows}</ol></div>`;
}

// ?plats=<id> — öppnar en plats direkt. Ortssidorna på webbplatsen länkar hit
// för de platser som inte har en egen statisk sida, så varje plats är nåbar
// från en länk även utan att man vet vilken stad den ligger i.
function placeInUrl(){
  try {
    const id = new URLSearchParams(location.search).get('plats');
    if (!id) return null;
    history.replaceState(null, '', location.pathname);
    return id;
  } catch (e) { return null; }
}
async function openPlaceDeepLink(id){
  if (!DATA.some(e => e.id === id)){
    const c = await cityForId(id);
    if (c && c !== activeCity) await setActiveCity(c);
    else if (c) await loadCity(c);
  }
  const e = DATA.find(x => x.id === id);
  if (!e) { toast(lang==='en' ? 'That place could not be found.' : 'Platsen gick inte att hitta.'); return; }
  if (cityOf(e) !== activeCity) await setActiveCity(cityOf(e));
  openSheet(id);
}

/* ---------- Stop detail sheet ---------- */
function openSheet(id){
  const e = DATA.find(x=>x.id===id);
  if (!e) return;
  currentSheetId = id;
  sheetReturnTour = activeTour;           // kom vi från en tur? (för "tillbaka till turen")
  track('stop_open', { id });
  spokOnPlaceOpen();                      // engagemang → ev. nudga Spökkartan-bannern

  const ty = TYPES[typeOf(e)];
  const st = stamps();
  const visited = st.has(id);
  const img = imgUrl(e), credit = imgCredit(e), icon = iconOf(e);
  const story = STORIES[id] || e.description || '';
  const storyHtml = story.split(/\n\n+/).map(p=>`<p>${p}</p>`).join('');

  const facts = (e.key_facts||[]).map(f=>`<li>${f}</li>`).join('');
  const srcs = (e.sources||[]).slice(0,3)
    .map(s=>`<a href="${s}" target="_blank" rel="noopener">${t('source')}</a>`).join(' · ');

  const focal = imgFocal(e);
  const heroPh = `<div class="hero-ph">${townScene()}<span class="ph-emoji">${icon}</span></div>`;
  // "Förr" — historiska arkivbilder (kan vara flera). Ger en Nu/Förr-växlare på hero.
  const histo = (HISTORIC_IMAGES[id] || []).filter(h => h && h.url);
  const hasHist = histo.length > 0;
  const thenLabel = lang==='en' ? 'Then' : 'Förr';
  const nowLabel = lang==='en' ? 'Now' : 'Nu';
  const thenGallery = hasHist ? `<div class="hero-then" data-hero-then hidden>
        ${histo.map(h=>`<figure class="then-fig">
          <img src="${h.url}" alt="${(h.caption||e.name)} — ${thenLabel}" loading="lazy" referrerpolicy="no-referrer"
               ${h.focal?`style="object-position:${h.focal}"`:''} onerror="this.closest('.then-fig').remove()">
          <figcaption>${h.year?`<b>${h.year}</b>`:''}${h.caption?` ${h.caption}`:''}${h.credit?`<span class="then-credit">📷 ${h.credit}</span>`:''}</figcaption>
        </figure>`).join('')}
      </div>` : '';
  const nowThenToggle = hasHist ? `<div class="nowthen" role="group" aria-label="${lang==='en'?'Now or then':'Nu eller förr'}">
        <button type="button" class="nowthen__btn on" data-mode="now">${nowLabel}</button>
        <button type="button" class="nowthen__btn" data-mode="then">📷 ${thenLabel}</button>
      </div>` : '';
  const hero = (img || hasHist)
    ? `<div class="hero">
         ${heroPh}
         ${img?`<img class="hero-now" data-hero-now src="${sizedImg(img,'w800')}" alt="${e.name}" loading="eager" decoding="async" referrerpolicy="no-referrer"
              ${focal?`style="object-position:${focal}"`:''} onerror="if(!this.dataset.full&&'${sizedImg(img,'w800')}'!=='${img}'){this.dataset.full=1;this.src='${img}';return}var c=this.parentElement.querySelector('[data-now-credit]');if(c)c.remove();this.remove()">`:''}
         ${thenGallery}
         ${credit?`<span class="credit" data-now-credit>📷 ${credit}</span>`:''}
         ${nowThenToggle}
       </div>`
    : `<div class="hero">${heroPh}</div>`;

  $('#sheet-inner').innerHTML = `
    ${hero}
    <div class="sheet-pad">
      ${sheetReturnTour?`<button class="sheet-back" id="sheet-back">← ${tourName(sheetReturnTour)}</button>`:''}
      <span class="type-tag" style="background:${ty.color}">${icon} ${typeLabel(e)}</span>
      <span class="tier-tag ${isTopPlace(e)?'top':'bonus'}">${isTopPlace(e)?`⭐ ${t('tier_top')}`:t('tier_bonus')}</span>
      <span class="city-tag">📍 ${cityOf(e)}</span>
      <h2>${e.name}</h2>
      ${e.era?`<div class="era">${e.era}</div>`:''}
      ${leadOf(e)?`<p class="lead">${leadOf(e)}</p>`:''}
      ${noticeHtml(id, e)}
      ${tellerBubble(id)}
      ${('speechSynthesis' in window)?`<button class="speak-btn" id="speak-btn">🔊 ${t('speak_listen')}</button>`:''}
      ${(lang==='en' && storyHtml)?`<p class="story-note">📖 ${t('story_note')}</p>`:''}
      ${storyHtml?`<div class="story">${storyHtml}</div>`:''}
      ${facts?`<ul class="facts">${facts}</ul>`:''}
      ${timelineHtml(id, e)}
      ${tipsActive() ? stopBlockHtml(id) : ''}
      ${commentBlockHtml(id)}
      ${hasCoords(e)
        ? `<button class="checkin ${visited?'done':''}" id="checkin-btn">
             ${visited?t('checkin_done'):t('checkin')}
           </button>
           ${photoBlock(id)}`
        : ''}
      ${e.address?`<p class="addr">📍 ${e.address}</p>`:''}
      ${hasCoords(e)?`<button class="addr-map" id="show-on-map">🗺️ ${lang==='en'?'Show on map':'Visa på kartan'}</button>`:''}
      ${srcs?`<p class="srcs">${srcs}</p>`:''}
      ${e.spokkartan_url?`<p class="spok-link"><a href="${e.spokkartan_url}" target="_blank" rel="noopener">👻 ${lang==='en'?'Read this place’s ghost story on Spökkartan':'Läs platsens spökhistoria på Spökkartan'} →</a></p>`:''}
    </div>`;

  const btn = $('#checkin-btn');
  if (btn) btn.onclick = ()=> toggleCheckin(id);
  const back = $('#sheet-back');
  if (back) back.onclick = ()=>{ stopSpeaking(); $('#sheet').setAttribute('aria-hidden','true'); if (sheetReturnTour) openTourPanel(sheetReturnTour); };
  const som = $('#show-on-map');
  if (som) som.onclick = ()=>{ stopSpeaking(); $('#sheet').setAttribute('aria-hidden','true'); if (map && e.coordinates) map.setView([e.coordinates.lat, e.coordinates.lng], 17, { animate:true }); };
  const spk = $('#speak-btn');
  if (spk) spk.onclick = ()=> speaking ? stopSpeaking() : speak(narrationText(e));
  const sb = $('#save-btn');
  if (sb){ sb.style.display=''; const on=saved().has(id); sb.classList.toggle('on',on); sb.setAttribute('aria-label', on?t('saved'):t('save')); sb.onclick=()=> toggleSave(id); }
  const pc = $('#sheet-inner [data-photo]');
  if (pc) pc.onclick = ()=> startPhoto(pc.dataset.photo);
  const psh = $('#sheet-inner [data-share]');
  if (psh) psh.onclick = ()=> sharePhoto(psh.dataset.share);
  // Nu/Förr-växlare: byt mellan nutida foto och historiska arkivbilder.
  const nt = $('#sheet-inner .nowthen');
  if (nt){
    const nowImg    = $('#sheet-inner [data-hero-now]');
    const thenEl    = $('#sheet-inner [data-hero-then]');
    const nowCredit = $('#sheet-inner [data-now-credit]');
    nt.querySelectorAll('[data-mode]').forEach(b=> b.onclick = ()=>{
      const then = b.dataset.mode === 'then';
      nt.querySelectorAll('[data-mode]').forEach(x=> x.classList.toggle('on', x===b));
      if (thenEl)    thenEl.hidden = !then;
      if (nowImg)    nowImg.style.visibility = then ? 'hidden' : '';
      if (nowCredit) nowCredit.style.display = then ? 'none' : '';
      track('hero_mode', { id, mode: then ? 'then' : 'now' });
    });
  }
  if (tipsActive()) {
    wireStopBlock($('#sheet-inner'), id);
    wireCommentBlock($('#sheet-inner'), id);   // hämtar platsens kommentarer
  } else {
  }

  // En vy åt gången: stäng alla andra fönster innan stoppet visas (sömlöst, inga staplade fönster)
  closeOverlays('#sheet');
  $('#sheet').setAttribute('aria-hidden','false');
  focusInto('#sheet');
  if (hasCoords(e)) map.panTo([e.coordinates.lat, e.coordinates.lng], { animate:true });
}

function toggleCheckin(id){
  const set = stamps();
  if (set.has(id)){ set.delete(id); } else { set.add(id); toast('🏅 Stämpel insamlad!'); track('checkin', { id }); }
  saveStamps(set);
  setTimeout(checkNewBadges, 1100);   // ev. nytt märke (toastas efter stämpel-toasten)
  updateStampBadge();
  renderMarkers();
  openSheet(id); // refresh button + pin state (sheet stays focused over panels)
}

/* ---------- Progress / stamps ---------- */
function updateStampBadge(){
  $('#stamp-count').textContent = stamps().size;
}

function openProgress(){
  const set = stamps();
  // Stämpelrutnätet visar den AKTIVA staden. (Tidigare ritades en ruta per plats
  // i hela datamängden — 9 775 noder i DOM:en, och procenten blev meningslös.)
  const cityEntries = ENTRIES.filter(inCity);
  const total = cityEntries.length;
  const pct = total ? Math.round(cityEntries.filter(e=>set.has(e.id)).length/total*100) : 0;
  const grid = cityEntries.map(e=>{
    const on = set.has(e.id);
    return `<div class="stamp ${on?'on':''}" title="${e.name}">${on?(CATEGORY_ICON[e.category]||'🏅'):'·'}</div>`;
  }).join('');
  $('#progress-body').innerHTML = `
    <div class="prog-stat">
      <div class="prog-box"><b>${set.size}</b><small>${t('prog_stamps')}</small></div>
      <div class="prog-box"><b>${pct}%</b><small>${t('prog_city')}</small></div>
      <div class="prog-box"><b>${total}</b><small>${t('prog_total')}</small></div>
    </div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <div class="stamp-grid">${grid}</div>`;
  openPanel('#progress-panel');
}

/* ---------- Sponsorpanel (mätbart värde) ---------- */
function openSponsor(){
  const ids = Object.keys(DEMO_OFFERS).filter(id=>DATA.find(x=>x.id===id));
  const rows = ids.map(id=>({ e:DATA.find(x=>x.id===id), m:metricsFor(id), offer:DEMO_OFFERS[id] }))
                  .sort((a,b)=> b.m.week - a.m.week);
  const maxWeek = Math.max(1, ...rows.map(r=>r.m.week));
  const totalWeek = rows.reduce((s,r)=>s+r.m.week,0);
  const totalAll = rows.reduce((s,r)=>s+r.m.total,0);

  $('#sponsor-body').innerHTML = `
    <div class="prog-stat">
      <div class="prog-box"><b>${rows.length}</b><small>affärsstopp</small></div>
      <div class="prog-box"><b>${totalWeek}</b><small>incheckn./vecka</small></div>
      <div class="prog-box"><b>${totalAll.toLocaleString('sv-SE')}</b><small>totalt</small></div>
    </div>
    <div class="sponsor-rows">
      ${rows.map(r=>{
        const ty = TYPES[typeOf(r.e)];
        return `<div class="sp-row" data-id="${r.e.id}" role="button" tabindex="0">
          <div class="sp-top">
            <b>${iconOf(r.e)} ${r.e.name}</b>
            <span class="sp-week">${r.m.week}<small>/v</small></span>
          </div>
          <div class="sp-bar"><i style="width:${Math.round(r.m.week/maxWeek*100)}%;background:${ty.color}"></i></div>
          <div class="sp-meta">${r.m.total.toLocaleString('sv-SE')} totalt${r.m.rating?` · ★ ${r.m.rating.toFixed(1)}`:''}</div>
          <div class="sp-offer">🎁 ${r.offer}</div>
        </div>`;
      }).join('')}
    </div>
    <p class="sp-foot">Demosiffror för pitch. I skarp drift räknas varje incheckning automatiskt — sponsorn ser sin fottrafik i realtid, kommunen ser hela stadens.</p>`;
  $('#sponsor-body').querySelectorAll('.sp-row').forEach(r=>{
    r.onclick = ()=> openSheet(r.dataset.id);
  });
  openPanel('#sponsor-panel');
}

/* ---------- Quiz ---------- */
function startQuiz(tourKey){
  const bank = QUIZZES[tourKey] || [];
  if (!bank.length){ toast('Quiz saknas för denna vandring'); return; }
  let i = 0, score = 0;
  const overlay = $('#quiz'), card = $('#quiz-card');
  const closeQuiz = ()=>{ overlay.setAttribute('aria-hidden','true'); restoreFocus(); };
  const closeBtn = `<button class="quiz-x" id="quiz-x" aria-label="${lang==='en'?'Close':'Stäng'}">&times;</button>`;
  closeOverlays('#quiz');
  overlay.setAttribute('aria-hidden','false');
  lastFocus = document.activeElement;

  const render = ()=>{
    const q = bank[i];
    card.innerHTML = `
      ${closeBtn}
      <div class="quiz-progress">${lang==='en'?'Question':'Fråga'} ${i+1} / ${bank.length}</div>
      <h3>${tourName(tourKey)}</h3>
      <p class="quiz-q">${q.q}</p>
      <div class="quiz-opts">
        ${q.opts.map((o,idx)=>`<button class="quiz-opt" data-i="${idx}">${o}</button>`).join('')}
      </div>`;
    card.querySelector('#quiz-x').onclick = closeQuiz;
    card.querySelectorAll('.quiz-opt').forEach(b=>{
      b.onclick = ()=>{
        const chosen = +b.dataset.i;
        card.querySelectorAll('.quiz-opt').forEach(x=>x.style.pointerEvents='none');
        card.querySelectorAll('.quiz-opt')[q.answer].classList.add('correct');
        if (chosen===q.answer) score++; else b.classList.add('wrong');
        setTimeout(()=>{ i++; i<bank.length ? render() : result(); }, 850);
      };
    });
  };
  const result = ()=>{
    card.innerHTML = `
      ${closeBtn}
      <div class="quiz-result">
        <div class="big">${score}/${bank.length}</div>
        <p class="quiz-q">${
          lang==='en'
            ? (score===bank.length?'Master town-walker! 🏆':score>=bank.length/2?'Well done! 👏':'Walk it again and gather more facts. 🚶')
            : (score===bank.length?'Stadsvandrarmästare! 🏆':score>=bank.length/2?'Bra jobbat! 👏':'Gå vandringen igen och samla fler fakta. 🚶')
        }</p>
        <button class="cta" id="quiz-done" style="margin:8px 0 0">${lang==='en'?'Done':'Klar'}</button>
      </div>`;
    card.querySelector('#quiz-x').onclick = closeQuiz;
    card.querySelector('#quiz-done').onclick = closeQuiz;
  };
  render();
  focusInto('#quiz');
}

/* ---------- Fotoutmaning + delning ---------- */
const PHOTO_KEY = 'mjolby_photos_v1';
// SHARE_URL importeras från config.js (kanonisk domän) — tidigare fanns en stale
// GitHub Pages-URL hårdkodad här som gjorde att delade foton länkade till en död sida.
const photos = () => { try { return JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}'); } catch(e){ return {}; } };
function savePhoto(id, dataUrl){
  const p = photos(); p[id] = dataUrl;
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify(p)); }
  catch(e){ toast(t('photo_save_fail')); }
}
function photoBlock(id){
  const p = photos()[id];
  if (p) return `<div class="photo-block">
      <img class="my-photo" src="${p}" alt="${lang==='en'?'Your photo from the place':'Din bild från platsen'}">
      <button class="photo-share" data-share="${id}">${t('photo_share')}</button>
    </div>`;
  return `<button class="photo-cta" data-photo="${id}">${t('photo_cta')}</button>`;
}

/* ---------- Automatisk bildförbättring (canvas, klientsida) ----------
   Körs på ALLA uppladdade/inklistrade foton. Adaptiv:
   • Färgfoto  → varm "sommardags"-grade: auto-nivåer, varm vitbalans, lyster/mättnad,
                 mjuk S-kurva-kontrast, lätt skärpa → klara, glada färger.
   • Gammalt svartvitt → auto-nivåer + starkare kontrast + skärpa → tydligare/klarare.
   Best-effort: vid fel lämnas bilden orörd. Canvas är same-origin (blob) → ej tainted. */
function _clamp8(v){ return v<0?0:v>255?255:v; }
function _sharpen(d, w, h, amount){
  if (amount<=0 || w<3 || h<3) return;
  const src = new Uint8ClampedArray(d);            // kopia för grannläsning
  const a = amount, center = 1 + 4*a, row = w*4;
  for (let y=1; y<h-1; y++){
    for (let x=1; x<w-1; x++){
      const i = (y*w + x)*4;
      for (let c=0;c<3;c++){
        const k = i+c;
        d[k] = _clamp8(center*src[k] - a*(src[k-4] + src[k+4] + src[k-row] + src[k+row]));
      }
    }
  }
}
function enhancePhoto(canvas){
  try{
    const ctx = canvas.getContext('2d', { willReadFrequently:true });
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    const imgData = ctx.getImageData(0,0,w,h);
    const d = imgData.data, N = d.length;

    // 1. Mät luminans-histogram + genomsnittlig mättnad (gråskala?)
    const hist = new Uint32Array(256);
    let satSum = 0, satN = 0;
    const sStep = 4 * Math.max(1, ((N/4)/40000)|0);  // sampla ~40k px
    for (let i=0;i<N;i+=4){
      const r=d[i], g=d[i+1], b=d[i+2];
      hist[(r*0.299 + g*0.587 + b*0.114)|0]++;
      if ((i % sStep) === 0){ const mx=Math.max(r,g,b), mn=Math.min(r,g,b); satSum += mx?(mx-mn)/mx:0; satN++; }
    }
    const isBW = (satSum/Math.max(1,satN)) < 0.07;

    // 2. Auto-nivåer: klipp ~0,4 % i varje ände av luminans → sträck till fullt omfång
    const total = N/4, clip = total*0.004;
    let lo=0, hi=255, acc=0;
    for (let v=0; v<256; v++){ acc+=hist[v]; if (acc>clip){ lo=v; break; } }
    acc=0;
    for (let v=255; v>=0; v--){ acc+=hist[v]; if (acc>clip){ hi=v; break; } }
    if (hi-lo < 16){ lo=0; hi=255; }                 // redan brett omfång → rör inte
    const span = hi-lo;

    // 3. Tonkurva-LUT (lika för alla kanaler → ingen färgskift här): auto-nivåer →
    //    S-kurva-kontrast → lätt ljuslyft.
    const contrast = isBW ? 0.24 : 0.15;
    const lift     = isBW ? 0.0  : 0.012;
    const lut = new Uint8ClampedArray(256);
    for (let v=0; v<256; v++){
      let x = Math.min(1, Math.max(0, (v-lo)/span));   // auto-nivåer
      const s = x*x*(3-2*x);                           // smoothstep
      x = x + (s-x)*contrast;                          // mjuk S-kurva
      x = x + lift*(1-x);                              // lätt ljuslyft
      lut[v] = Math.round(Math.min(1, Math.max(0, x))*255);
    }
    for (let i=0;i<N;i+=4){ d[i]=lut[d[i]]; d[i+1]=lut[d[i+1]]; d[i+2]=lut[d[i+2]]; }

    // 4. Lyster/mättnad + VARM vitbalans som sista färgsteg (färgfoto).
    //    Värmen läggs EFTER mättnaden så den inte kan ätas upp/förstärkas bort.
    if (!isBW){
      const sat = 1.24, warmR = 1.05, warmB = 0.95;
      for (let i=0;i<N;i+=4){
        const r=d[i], g=d[i+1], b=d[i+2];
        const y = r*0.299 + g*0.587 + b*0.114;
        const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
        const cur = mx?(mx-mn)/mx:0;                   // lyster: boosta mindre där färgen redan är mättad
        const k = 1 + (sat-1)*(1 - cur*0.6);
        d[i]   = _clamp8((y+(r-y)*k)*warmR);
        d[i+1] = _clamp8( y+(g-y)*k );
        d[i+2] = _clamp8((y+(b-y)*k)*warmB);
      }
    }

    // 5. Skärpa (unsharp) — mer för gamla svartvita, lätt för färg
    _sharpen(d, w, h, isBW ? 0.5 : 0.32);

    ctx.putImageData(imgData, 0, 0);
  }catch(e){ /* förbättring är best-effort */ }
}

function fileToThumb(file, cb){
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = ()=>{
    const max = 640; let w = img.width, h = img.height;
    const s = Math.min(1, max/Math.max(w,h)); w = Math.round(w*s); h = Math.round(h*s);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently:true });
    cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, w, h);
    enhancePhoto(c);                       // automatisk varm/klar förbättring
    URL.revokeObjectURL(url); cb(c.toDataURL('image/jpeg', 0.82));
  };
  img.onerror = ()=>{ URL.revokeObjectURL(url); toast(t('photo_read_fail')); };
  img.src = url;
}
function startPhoto(id){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
  inp.onchange = ()=>{
    const f = inp.files && inp.files[0]; if (!f) return;
    fileToThumb(f, dataUrl=>{
      savePhoto(id, dataUrl);
      const set = stamps();
      if (!set.has(id)){ set.add(id); saveStamps(set); updateStampBadge(); renderMarkers(); }
      toast(t('photo_saved'));
      openSheet(id);
    });
  };
  inp.click();
}
function dataUrlToFile(dataUrl, name){
  try {
    const [meta, b64] = dataUrl.split(',');
    const mime = (meta.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name, { type: mime });
  } catch(e){ return null; }
}
async function sharePhoto(id){
  const e = DATA.find(x=>x.id===id), p = photos()[id];
  const place = e ? e.name : 'Mjölby';
  const text = lang==='en'
    ? `I'm exploring ${place} with Stadsvandring.io! #Stadsvandring #Mjölby`
    : `Jag utforskar ${place} med Stadsvandring.io! #Stadsvandring #Mjölby`;
  try {
    if (p && navigator.canShare){
      const file = dataUrlToFile(p, 'strosa.jpg');
      if (file && navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file], text, title:'Stadsvandring.io' }); return;
      }
    }
    if (navigator.share){ await navigator.share({ title:'Stadsvandring.io', text, url: SHARE_URL }); return; }
    await navigator.clipboard.writeText(text + ' ' + SHARE_URL);
    toast(t('share_copied'));
  } catch(err){ /* användaren avbröt delningen */ }
}

/* ---------- Personer & berättelser (alla poster) ---------- */
const CAT_LABEL = {
  ort:'Ort', vattendrag:'Vattendrag', kyrka:'Kyrka', byggnad:'Byggnad', torg:'Torg',
  person:'Person', konst_staty:'Konst', runsten:'Runsten', klosterruin:'Klosterruin',
  borgruin:'Borgruin', bro:'Bro', handelse:'Händelse', station:'Station',
  museum_hembygd:'Museum', musikkar:'Musikkår', idrott:'Idrott',
  handel:'Handel', kafe_restaurang:'Café/Restaurang', hotell:'Hotell', industri_foretag:'Företag',
};
// Engelska kategori-etiketter (UI-nivå). Det djupa innehållet förblir svenskt (Spår B),
// men korta etiketter översätts så engelskt läge inte blandar språk.
const CAT_LABEL_EN = {
  ort:'Locality', vattendrag:'Waterway', kyrka:'Church', byggnad:'Building', torg:'Square',
  person:'Person', konst_staty:'Art', runsten:'Rune stone', klosterruin:'Monastery ruin',
  borgruin:'Castle ruin', bro:'Bridge', handelse:'Event', station:'Station',
  museum_hembygd:'Museum', musikkar:'Music corps', idrott:'Sports',
  handel:'Retail', kafe_restaurang:'Café/Restaurant', hotell:'Hotel', industri_foretag:'Company',
};
const catLabel = e => (lang==='en' ? CAT_LABEL_EN : CAT_LABEL)[e.category] || '';
// Antal stopp med korrekt singular/plural (svenska "stopp" är invariant; engelska "stop/stops").
const nStops = (n) => `${n} ${(lang==='en' && n===1) ? 'stop' : t('stops')}`;
function renderStories(filter){
  const q = (filter||'').toLowerCase().trim();
  const list = DATA.filter(e=>{
    if (!inCity(e)) return false;                 // bara den valda stadens berättelser
    if (!q) return true;
    return (e.name+' '+(e.summary||'')+' '+(CAT_LABEL[e.category]||'')).toLowerCase().includes(q);
  })
  // Höjdpunkterna först, bonusplatserna efter (stabil ordning inom varje grupp).
  .sort((a,b)=> (isTopPlace(b)?1:0) - (isTopPlace(a)?1:0));
  const st = stamps();
  $('#stories-list').innerHTML = list.map(e=>{
    const onMap = hasCoords(e);
    const tier = isTopPlace(e) ? '⭐ ' : '';
    return `<li><button class="stop-row" data-id="${e.id}">
      ${stopThumb(e)}
      <span class="stop-meta"><b>${tier}${e.name}</b><small>${catLabel(e)}${isTopPlace(e)?'':' · '+t('tier_bonus')}${onMap?'':' · '+t('only_story')}</small></span>
      ${st.has(e.id)?'<span class="tick" aria-label="besökt">✓</span>':''}
    </button></li>`;
  }).join('') || `<li class="stories-empty">${lang==='en'?'Nothing found.':'Inget hittades.'}</li>`;
  $('#stories-list').querySelectorAll('.stop-row').forEach(r=>{
    r.onclick = ()=> openSheet(r.dataset.id);
  });
}
function openStories(){ renderStories($('#stories-q').value); openPanel('#stories-panel'); }

/* ---------- Utforska: Karta ⇄ Lista ---------- */
// Samma filter (typ-chips, ⭐ Höjdpunkter, vald vandring) styr BÅDA vyerna, så
// det aldrig blir olika resultat beroende på vy. Listan visar höjdpunkterna
// först som rika kort (mest kända överst), bonusplatserna som kompakta rader.
function setExploreView(v, first){
  exploreView = v === 'list' ? 'list' : 'map';
  localStorage.setItem('sv_view', exploreView);
  const mapEl = $('#map'), listEl = $('#place-list');
  if (mapEl) mapEl.style.display = exploreView === 'map' ? '' : 'none';
  if (listEl) listEl.hidden = exploreView !== 'list';
  updateViewToggle();
  updateNextStopBtn();
  if (exploreView === 'list') renderPlaceList();
  else if (!first) setTimeout(()=>{ try{ map.invalidateSize(); fitView(); }catch(e){} }, 60);
  if (!first) track('view_toggle', { view: exploreView });
}
function updateViewToggle(){
  const b = $('#view-toggle'); if (!b) return;
  b.innerHTML = exploreView === 'map' ? `📋 ${t('view_list')}` : `🗺️ ${t('view_map')}`;
}
// Basen för listvyn: stadens platser genom samma filter som kartan + fritextsök.
// (DATA, inte ENTRIES — platser utan koordinater hör också hemma i listan.)
function placeListEntries(){
  let list = DATA.filter(e => inCity(e) && activeTypes.has(typeOf(e)));
  if (topOnly) list = list.filter(isTopPlace);
  if (activeTour) list = list.filter(TOURS[activeTour].test);
  const q = listQuery.toLowerCase().trim();
  if (q) list = list.filter(e => (e.name+' '+(e.summary||'')+' '+(catLabel(e)||'')).toLowerCase().includes(q));
  return list;
}
// Sökfält + räknare byggs EN gång (annars tappar inputen fokus vid varje tangent);
// själva listinnehållet ritas om separat i renderPlaceListBody().
function ensurePlaceListHead(){
  const wrap = $('#place-list'); if (!wrap || wrap.querySelector('.pl-head')) return;
  wrap.innerHTML = `
    <div class="pl-head">
      <div class="pl-search"><span class="pl-mag" aria-hidden="true">🔍</span>
        <input id="pl-q" type="search" inputmode="search" autocomplete="off" placeholder="${t('list_search')}" aria-label="${t('list_search')}"></div>
      <p class="pl-count" id="pl-count"></p>
    </div>
    <div id="pl-body"></div>`;
  const qi = wrap.querySelector('#pl-q');
  qi.oninput = ()=>{ listQuery = qi.value; renderPlaceListBody(); };
}
function renderPlaceList(){ ensurePlaceListHead(); renderPlaceListBody(); }
function renderPlaceListBody(){
  const body = $('#pl-body'); if (!body) return;
  const st = stamps();
  const list = placeListEntries();
  const tops = list.filter(isTopPlace).sort((a,b)=> qualityScore(b) - qualityScore(a));
  const rest = list.filter(e => !isTopPlace(e)).sort((a,b)=> qualityScore(b) - qualityScore(a));
  const cnt = $('#pl-count');
  if (cnt) cnt.textContent = `${list.length} ${t('stops')} · ${activeCity}`;

  // Höjdpunkter: rika kort — bild, namn, kategori/era och en kort ingress.
  const card = e => {
    const img = imgUrl(e), icon = iconOf(e), lead = leadOf(e);
    const thumb = img
      ? `<span class="pl-thumb"><img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer"
           onerror="this.remove();this.parentElement.classList.add('ph');this.parentElement.insertAdjacentText('afterbegin','${icon}')"></span>`
      : `<span class="pl-thumb ph">${icon}</span>`;
    return `<li><button class="pl-card" data-id="${e.id}">
      ${thumb}
      <span class="pl-body">
        <b>${e.name}${st.has(e.id)?' <span class="pl-tick" aria-label="besökt">✓</span>':''}</b>
        <small>${catLabel(e)}${e.era?` · ${e.era}`:''}</small>
        ${lead?`<p>${lead}</p>`:''}
      </span>
    </button></li>`;
  };
  // Bonusplatser: kompakta rader (samma mönster som berättelselistan).
  const row = e => `<li><button class="stop-row" data-id="${e.id}">
      ${stopThumb(e)}
      <span class="stop-meta"><b>${e.name}</b><small>${catLabel(e)}${e.era?` · ${e.era}`:''}</small></span>
      ${st.has(e.id)?'<span class="tick" aria-label="besökt">✓</span>':''}
    </button></li>`;

  body.innerHTML =
    (tops.length ? `<h3 class="pl-h">⭐ ${t('list_top')} <small>${tops.length}</small></h3><ul class="pl-cards">${tops.map(card).join('')}</ul>` : '') +
    (rest.length ? `<h3 class="pl-h">${t('list_more')} <small>${rest.length}</small></h3><ul class="pl-rows">${rest.map(row).join('')}</ul>` : '') +
    (!list.length ? `<div class="screen-empty">🔍<br>${lang==='en'?'Nothing matches your search or filters.':'Inget matchar din sökning eller dina filter.'}</div>` : '');
  body.querySelectorAll('[data-id]').forEach(r=> r.onclick = ()=> openSheet(r.dataset.id));
}

/* ---------- i18n: statiska strängar ---------- */
function applyI18n(){
  document.documentElement.lang = lang;
  const setText = (sel, val)=>{ const el=$(sel); if(el) el.textContent = val; };
  updateCityHeader();
  const ls = $('#lang-switch');
  if (ls) ls.querySelectorAll('.flag-btn').forEach(b=> b.classList.toggle('on', b.dataset.lang===lang));
  const sp = $('#stories-panel');
  if (sp){
    sp.querySelector('.panel-head h2').textContent = t('act_stories_full');
    sp.querySelector('.panel-sub').textContent = t('stories_sub');
  }
  const q = $('#stories-q'); if (q) q.setAttribute('placeholder', t('stories_search'));
  const pp = $('#progress-panel'); if (pp) pp.querySelector('.panel-head h2').textContent = t('act_progress');
  setText('#tour-quiz-btn', t('quiz_cta'));
  setText('.skip-link', t('skip_link'));
  const mp = $('#map'); if (mp) mp.setAttribute('aria-label', t('map_label'));
}

/* ---------- Stadens berättare (storyteller) ---------- */
function setupTeller(auto = true){
  const bar = $('#tellerbar');
  // OBS: .tellerbar har display:flex i CSS, vilket överkör [hidden] — toggla därför
  // även style.display så orter utan egen berättare (t.ex. Östergötland-orterna) inte
  // ärver föregående stads berättarbar.
  if (!TELLER){ bar.hidden = true; bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.hidden = false; bar.style.display = '';
  bar.innerHTML =
    `<span class="tb-av">${tellerAvatar()}</span>
     <span class="tb-text">${t('teller_by')} <b>${TELLER.name}</b><small>${(tellerL()&&tellerL().role)||TELLER.role||''}</small></span>
     <span class="tb-go">${t('teller_meet')}</span>`;
  bar.onclick = ()=> openTeller();
  if (auto && !localStorage.getItem(TELLER_SEEN_KEY)) openTeller(true);
}

function tellerAvatar(){
  return TELLER.portrait
    ? `<img class="av-img" src="${TELLER.portrait}" alt="${TELLER.name}" loading="lazy">`
    : (TELLER.avatar||'💬');
}

function tellerRemark(id){
  if (!TELLER) return null;
  if (TELLER.remarks && TELLER.remarks[id]) return TELLER.remarks[id];
  const fb = TELLER.fallbacks || [];
  if (!fb.length) return null;
  const e = DATA.find(x=>x.id===id);
  const name = e ? e.name : 'platsen';
  return fb[id.length % fb.length].replace('{name}', name);
}

function tellerBubble(id){
  if (lang === 'en') return '';   // dialektreplikerna finns bara på svenska
  const say = tellerRemark(id);
  if (!say) return '';
  return `<div class="teller-say">
    <span class="ts-av">${tellerAvatar()}</span>
    <div class="ts-body"><b>${TELLER.name}</b><p>${say}</p></div>
  </div>`;
}

function openTeller(firstTime){
  const tel = TELLER; if (!tel) return;
  const en = lang === 'en', loc = tellerL(), v = tel.voice || {};
  const role = (loc && loc.role) || tel.role || '';
  const tagline = (loc && loc.tagline) || v.tagline || '';
  const greetSrc = (loc && loc.greeting) || tel.greeting || '';
  const greet = greetSrc.split(/\n\n+/).map(p=>`<p>${p}</p>`).join('');
  const signoff = en ? '' : (v.signoff||'');
  const entry = tel.entryId && DATA.find(x=>x.id===tel.entryId);
  const goLabel = firstTime ? (en?'Come along →':'Följ med mig →') : (en?'Back to the map':'Tillbaka till kartan');
  const scaleLine = en ? `Every town can have its own storyteller. In ${tel.city}, that's me.`
                       : `Varje stad kan ha sin egen berättare. I ${tel.city} är det ja.`;

  $('#teller-card').innerHTML = `
    <div class="teller-scene">${townScene()}</div>
    <button class="teller-x" id="teller-x" aria-label="${en?'Close':'Stäng'}">&times;</button>
    <div class="teller-hd">
      <span class="teller-bigav">${tel.portrait?`<img class="av-img" src="${tel.portrait}" alt="${tel.name}">`:(tel.avatar||'💬')}</span>
      <div>
        <h3>${tel.name}</h3>
        <small>${[tel.realName, tel.years].filter(Boolean).join(' · ')}</small>
        <div class="teller-role">${role}</div>
      </div>
    </div>
    ${tagline?`<p class="teller-tagline">”${tagline}”</p>`:''}
    <div class="teller-greet">${greet}</div>
    ${signoff?`<p class="teller-sign">${signoff}</p>`:''}
    <button class="cta teller-go" id="teller-go" style="margin:6px 0 8px">${goLabel}</button>
    ${entry?`<button class="teller-more" id="teller-more">${en?`Read more about ${tel.name}`:`Läs mer om ${tel.name} i appen`}</button>`:''}
    <p class="teller-scale">${scaleLine}</p>`;

  closeOverlays('#teller');
  $('#teller').setAttribute('aria-hidden','false');
  focusInto('#teller');
  localStorage.setItem(TELLER_SEEN_KEY, '1');
  const close = ()=>{ $('#teller').setAttribute('aria-hidden','true'); restoreFocus(); };
  $('#teller-x').onclick = close;
  $('#teller-go').onclick = close;
  const more = $('#teller-more');
  if (more) more.onclick = ()=>{ close(); openSheet(tel.entryId); };
}

/* ---------- Ljuduppläsning (Web Speech API) ---------- */
function pickSvVoice(){
  if (!('speechSynthesis' in window)) return null;
  const vs = speechSynthesis.getVoices() || [];
  const sv = vs.filter(v=>/^sv/i.test(v.lang||''));
  // Manlig röst föredras BARA när berättaren är Skånska Lasse (Mjölby) — övriga
  // städer har neutral guide och tar enhetens förstahandsval.
  if (TELLER && TELLER.id === 'skanska-lasse')
    return sv.find(v=>/oskar|male|man\b|mikael|erik|gustav/i.test(v.name||'')) || sv[0] || null;
  return sv[0] || null;
}
function narrationText(e){
  if (lang === 'en') return SUMMARY_EN[e.id] || e.summary || e.name;
  const parts = [];
  const r = tellerRemark(e.id); if (r) parts.push(r);
  if (e.summary) parts.push(e.summary);
  const story = STORIES[e.id] || e.description; if (story) parts.push(story.replace(/\n\n+/g,' '));
  return parts.join('  ');
}
function speak(text){
  if (!('speechSynthesis' in window)){ toast('Uppläsning stöds inte i denna webbläsare'); return false; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickSvVoice(); if (v) u.voice = v;
  u.lang = 'sv-SE'; u.rate = 0.98; u.pitch = 1.0;
  u.onend = ()=>{ speaking = false; updateSpeakButtons(); };
  u.onerror = ()=>{ speaking = false; updateSpeakButtons(); };
  speaking = true; speechSynthesis.speak(u); updateSpeakButtons();
  return true;
}
function stopSpeaking(){
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  speaking = false; updateSpeakButtons();
}
function updateSpeakButtons(){
  const b = $('#speak-btn');
  if (b) b.innerHTML = speaking ? t('speak_stop') : `🔊 ${t('speak_listen')}`;
}
// Röster laddas ibland asynkront
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = ()=>{};

/* ---------- Bottenflik-meny + vyer ---------- */
const TABS = [
  ['cities',  'tab_cities',  'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z'],
  ['home',    'tab_home',    'M4 11l8-7 8 7M6 10v9h12v-9'],
  ['routes',  'tab_routes',  'M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Zm0 0v14m6-12v14'],
  ['saved',   'tab_saved',   'M7 4h10v16l-5-3.5L7 20V4Z'],
  // Bidra är appens själva poäng nu — den får inte ligga begravd i profilen.
  ['contribute','tab_contribute','M12 5v14M5 12h14'],
  ['profile', 'tab_profile', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 21c0-3.3 3.1-6 7-6s7 2.7 7 6'],
];
// Fler städer (Mjölby aktiv; övriga på väg). Skalbart: lägg till en post per stad.
const CITIES = [
  { id:'mjolby',    name:'Mjölby',    blurb:'Kvarnbyn vid Svartån — kyrka, järnväg & Skånska Lasse.', status:'active', leder:2, seed:0 },
  { id:'skanninge', name:'Skänninge', blurb:'En av Sveriges äldsta städer — kloster & medeltid.',      status:'soon', seed:1 },
  { id:'vadstena',  name:'Vadstena',  blurb:'Klosterstaden vid Vättern — slott & Heliga Birgitta.',     status:'soon', seed:2 },
  { id:'linkoping', name:'Linköping', blurb:'Domkyrkostaden & Gamla Linköping.',                        status:'soon', seed:0 },
  { id:'motala',    name:'Motala',    blurb:'Göta kanal och sjön Vättern.',                              status:'soon', seed:1 },
  { id:'tranas',    name:'Tranås',    blurb:'Sjön Sommen och småländsk charm.',                          status:'soon', seed:2 },
];
const FEEDBACK_KEY = 'mjolby_feedback_v1';
function buildTabbar(){
  $('#tabbar').innerHTML = TABS.map(([id,key,d])=>
    `<button data-tab="${id}" aria-label="${t(key)}">
       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>
       <span>${t(key)}</span>
     </button>`).join('');
  $('#tabbar').querySelectorAll('button').forEach(b=> b.onclick=()=> switchTab(b.dataset.tab));
  updateTabbar();
  wireBrandHome();
}
// Logotypen/varumärket → startsidan (Städer-vyn där man väljer ort).
function wireBrandHome(){
  const brand = document.querySelector('.topbar .brand');
  if (!brand || brand.dataset.wired) return;
  brand.dataset.wired = '1';
  brand.style.cursor = 'pointer';
  brand.setAttribute('role', 'button');
  brand.setAttribute('tabindex', '0');
  brand.setAttribute('aria-label', lang==='en' ? 'Home — choose a town' : 'Till startsidan — välj stad');
  const go = ()=> switchTab('cities');
  brand.addEventListener('click', go);
  brand.addEventListener('keydown', e=>{ if (e.key==='Enter' || e.key===' '){ e.preventDefault(); go(); } });
}
function updateTabbar(){
  $('#tabbar').querySelectorAll('button').forEach(b=>{
    const on = b.dataset.tab===activeTab;
    b.classList.toggle('on', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
}
function switchTab(id){
  activeTab = id;
  updateTabbar();
  stopSpeaking();
  ['#tour-panel','#stories-panel','#progress-panel','#sponsor-panel','#sheet','#challenge-builder','#challenge-play','#challenge-results','#challenge-task'].forEach(s=>{ const p=$(s); if(p) p.setAttribute('aria-hidden','true'); });
  if (id==='home'){
    $('#explore').hidden=false; $('#screen').hidden=true;
    setTimeout(()=>{ try{ map.invalidateSize(); }catch(e){} }, 60);
  } else {
    $('#explore').hidden=true; $('#screen').hidden=false;
    if (id==='cities') renderCities();
    else if (id==='routes') renderLeder();
    else if (id==='saved') renderSaved();
    else if (id==='contribute') renderContribute();
    else if (id==='profile') renderProfil();
    $('#screen').scrollTop=0;
  }
  updateSpokBanner();   // Spökkartan-bannern visas bara i hemvyn
}
function renderLeder(){
  const st=stamps();
  // Bara leder som har stopp i den valda staden
  const keys = Object.keys(TOURS).filter(key=> key !== 'userroute')
    .filter(key=> DATA.filter(TOURS[key].test).some(inCity));
  const cards = keys.map((key,i)=>{
    const list=orderedTourEntries(key).filter(inCity);
    const done=list.filter(e=>st.has(e.id)).length;
    return `<button class="led-card" data-led="${key}">
      <span class="led-thumb">${routeThumb(i)}</span>
      <span class="led-meta"><b>${tourName(key)}</b><small>${tourSub(key)}</small>
        <span class="led-count">${nStops(list.length)} · ${done} ✓</span></span>
    </button>`;
  }).join('');
  $('#screen').innerHTML = `<div class="screen-head"><h2>${t('screen_routes')}</h2><p>${t('routes_sub')} · ${activeCity}</p></div>`
    + (cards || `<div class="screen-empty">🚶<br>${(lang==='en'?'No guided routes in ':'Inga färdiga leder i ')+activeCity+(lang==='en'?' yet — explore freely on the map!':' än — utforska fritt på kartan!')}</div>`);
  $('#screen').querySelectorAll('.led-card').forEach(c=> c.onclick=()=> startLed(c.dataset.led));
  // Egna och andras rutter — under de kurerade lederna.
  mountRoutes($('#screen'));
  // Upptäckbar ingång till Stadsutmaningen. Laddas asynkront — fäst på det
  // #screen som gällde när vyn ritades, så en snabb flikväxling inte hamnar fel.
  const screenEl = $('#screen');
  challengesMod().then(m => { if ($('#screen') === screenEl && activeTab === 'routes') m.mountChallengeCTA(screenEl); });
}
// Kör en användarskapad rutt (routes.js) som en tur: sätt USER_ROUTE, byt till
// kartan och rita den gatuföljande leden. Samma väg som de kurerade lederna, så
// "till nästa plats", incheckningar och quest-läge fungerar oförändrat.
function startUserRoute(route){
  USER_ROUTE = { id: route.id, title: route.title, intro: route.intro || '', mode: route.mode, stops: route.stops };
  activeTour = 'userroute';
  switchTab('home');
  buildTours();
  renderMarkers();
  navigateToNext();
  toast((lang==='en' ? 'Route started: ' : 'Rutten är igång: ') + route.title);
  track('route_start', { id: route.id, mode: route.mode });
}

function startLed(key){
  activeTour=key;
  $('#tours').querySelectorAll('.tour-chip').forEach(x=>x.classList.toggle('active', x.dataset.tour===key));
  switchTab('home');
  renderMarkers();
  openTourPanel(key);
}
function renderCities(){
  const have = citiesInData();                       // [{name,count}] — städer med riktiga stopp
  const haveNames = new Set(have.map(c=>c.name));
  const meta = {}; CITIES.forEach(c=> meta[c.name]={ blurb:c.blurb, seed:c.seed });
  // Stadsspecifik blurb (cityintros.js) i första hand — sedan CITIES-listan, sist generisk.
  const blurbFor = n => cityBlurb(n) || (meta[n]&&meta[n].blurb) || (lang==='en'?`Walks and stories in ${n}.`:`Vandringar och berättelser i ${n}.`);
  const seedFor  = (n,i) => (meta[n]&&typeof meta[n].seed==='number') ? meta[n].seed : (i%3);

  // Valbara städer (har stopp). Den aktiva markeras tydligt.
  const activeCards = have.map((c,i)=>{
    const sel = c.name===activeCity;
    const tours = tourCountFor(c.name);
    const sub = `${nStops(c.count)}${tours?` · ${tours} ${t('city_leder')}`:''}`;
    return `<button class="led-card city-card ${sel?'selected':''}" data-pick="${c.name}" aria-pressed="${sel}">
      <span class="led-thumb">${routeThumb(seedFor(c.name,i))}</span>
      <span class="led-meta"><b>${c.name}${sel?` · ${t('city_current')}`:''}</b><small>${blurbFor(c.name)}</small>
        <span class="city-badge on">${sub}</span></span>
    </button>`;
  }).join('');

  // "Kommer snart"-städer (utan stopp ännu) — dolda när SHOW_SOON_CITIES=false
  const soon = SHOW_SOON_CITIES ? CITIES.filter(c=> c.status!=='active' && !haveNames.has(c.name)).map(c=>
    `<button class="led-card city-card soon" data-soon="1">
      <span class="led-thumb">${routeThumb(c.seed)}<span class="city-lock">🔒</span></span>
      <span class="led-meta"><b>${c.name}</b><small>${c.blurb}</small>
        <span class="city-badge">${t('city_soon')}</span></span>
    </button>`).join('') : '';

  $('#screen').innerHTML = `<div class="screen-head"><h2>${t('screen_cities')}</h2><p>${t('cities_pick')}</p></div>
    <button class="fb-cta" id="cities-locate" style="margin:0 0 14px">📍 ${t('land_locate')}</button>
    ${activeCards}
    ${soon?`<h3 class="prof-h">${t('city_more_soon')}</h3>${soon}`:''}
    <button class="fb-cta" id="fb-cities">💬 ${t('feedback')}</button>`;
  $('#screen').querySelector('#cities-locate').onclick = openLanding;
  $('#screen').querySelectorAll('[data-pick]').forEach(c=> c.onclick=()=>{ switchTab('home'); setActiveCity(c.dataset.pick); });
  $('#screen').querySelectorAll('[data-soon]').forEach(c=> c.onclick=()=> toast(t('city_soon') + ' 🌱'));
  $('#fb-cities').onclick = openFeedback;
}

/* ---------- Landningssida: välj/sök stad (entry) ---------- */
const LANDING_KEY = 'sv_landing_done';
let landNear = null;   // namn på närmaste stad (sätts av geolocation)

function havKm(a,b){
  if(!a||!b) return Infinity;
  const R=6371, r=d=>d*Math.PI/180;
  const dLa=r(b.lat-a.lat), dLo=r(b.lng-a.lng);
  const s=Math.sin(dLa/2)**2+Math.cos(r(a.lat))*Math.cos(r(b.lat))*Math.sin(dLo/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function cityCentroid(name){
  const c = CITY_BY_NAME.get(name);
  return c ? { lat: c.lat, lng: c.lng } : null;
}
function renderLandingList(filter){
  const q=(filter||'').toLowerCase().trim();
  const have=citiesInData();
  const metaOf=n=>CITIES.find(c=>c.name===n);
  const tourCount=n=>tourCountFor(n);
  let list=have.filter(c=>!q || c.name.toLowerCase().includes(q));
  if(landNear) list=[...list].sort((a,b)=>(b.name===landNear)-(a.name===landNear));
  const cards=list.map((c,i)=>{
    const m=metaOf(c.name), tn=tourCount(c.name), near=c.name===landNear;
    const sub=cityBlurb(c.name)||(m&&m.blurb)||`${nStops(c.count)}`;
    const badge=near ? `📍 ${t('land_geo_near').replace(':','').trim()}`
                     : `${nStops(c.count)}${tn?` · ${tn} ${t('city_leder')}`:''}`;
    return `<button class="land-city ${near?'near':''}" data-city="${c.name}">
      <span class="lc-thumb">${routeThumb((m&&typeof m.seed==='number')?m.seed:i%3)}</span>
      <span class="lc-body"><b>${c.name}</b><small>${sub}</small></span>
      <span class="lc-badge">${badge}</span></button>`;
  }).join('');
  const haveNames=new Set(have.map(c=>c.name));
  const soon=((SHOW_SOON_CITIES && !q) ? CITIES.filter(c=>c.status!=='active' && !haveNames.has(c.name)) : []).map(c=>
    `<button class="land-city soon" data-soon="1">
      <span class="lc-thumb">${routeThumb(c.seed)}<span class="lc-lock">🔒</span></span>
      <span class="lc-body"><b>${c.name}</b><small>${c.blurb}</small></span>
      <span class="lc-badge">${t('city_soon')}</span></button>`).join('');
  $('#land-list').innerHTML = (cards || `<div class="land-none">${t('land_none')}</div>`)
    + (soon?`<div class="land-soon-h">${t('land_soon')}</div>${soon}`:'');
  $('#land-list').querySelectorAll('[data-city]').forEach(b=> b.onclick=()=>chooseCity(b.dataset.city));
  $('#land-list').querySelectorAll('[data-soon]').forEach(b=> b.onclick=()=> toast(t('city_soon')+' 🌱'));
}
function openLanding(){
  $('#landing-card').innerHTML = `
    <div class="land-brand"><span class="mark">S</span> Stadsvandring.io</div>
    <div class="land-hero"><h1>${t('land_title')}</h1><p>${t('land_sub')}</p></div>
    <div class="land-search"><span class="land-mag">🔍</span>
      <input id="land-q" type="search" inputmode="search" autocomplete="off" placeholder="${t('land_search')}"></div>
    <button class="land-locate" id="land-locate">📍 ${t('land_locate')}</button>
    <div class="land-list" id="land-list"></div>`;
  const qi=$('#land-q'); qi.oninput=()=>renderLandingList(qi.value);
  // Mobil: när tangentbordet öppnas, scrolla upp sökfältet så det (och listan)
  // syns ovanför tangentbordet i stället för att gömmas bakom det.
  qi.addEventListener('focus', ()=>{ setTimeout(()=>{ try{ qi.scrollIntoView({ block:'start', behavior:'smooth' }); }catch(_){} }, 300); });
  $('#land-locate').onclick=locateMe;
  renderLandingList('');
  $('#landing').setAttribute('aria-hidden','false');
  if (typeof updateSpokBanner==='function') updateSpokBanner();
}
function chooseCity(name){
  // Stäng landningsvyn först — stadens platser kan behöva hämtas, och man ska
  // inte stirra på listan medan det sker.
  localStorage.setItem(LANDING_KEY,'1');
  landNear=null;
  $('#landing').setAttribute('aria-hidden','true');
  switchTab('home');
  // Byter + centrerar. Är det samma stad är setActiveCity en no-op → renderMarkers
  // säkerställer centreringen ändå.
  setActiveCity(name).then(()=>{ try{ renderMarkers(); }catch(e){} });
}
function locateMe(){
  const btn=$('#land-locate'); if(!btn) return;
  if(!navigator.geolocation){ toast(t('land_geo_fail')); return; }
  const orig=btn.innerHTML; btn.disabled=true; btn.innerHTML=`⏳ ${t('land_locating')}`;
  navigator.geolocation.getCurrentPosition(pos=>{
    const me={lat:pos.coords.latitude,lng:pos.coords.longitude};
    let best=null,bestD=Infinity;
    citiesInData().forEach(c=>{ const d=havKm(me,cityCentroid(c.name)); if(d<bestD){bestD=d;best=c.name;} });
    landNear=best; btn.disabled=false; btn.innerHTML=orig;
    renderLandingList($('#land-q')?$('#land-q').value:'');
    if(best) toast(`📍 ${t('land_geo_near')} ${best}`);
  }, ()=>{ btn.disabled=false; btn.innerHTML=orig; toast(t('land_geo_fail')); },
     {enableHighAccuracy:false,timeout:8000,maximumAge:600000});
}
// "Nära mig" från kartan: hitta närmaste valbara stad och visa dess platser direkt.
function selectNearestCity(btnEl){
  if (!navigator.geolocation){ toast(lang==='en'?'Location not supported':'Platstjänst stöds inte'); return; }
  const orig = btnEl ? btnEl.innerHTML : '';
  if (btnEl) btnEl.innerHTML = '⏳';
  navigator.geolocation.getCurrentPosition(pos=>{
    const me = { lat:pos.coords.latitude, lng:pos.coords.longitude };
    let best=null, bestD=Infinity;
    citiesInData().forEach(c=>{ const cc=cityCentroid(c.name); const d=havKm(me,cc); if(d<bestD){ bestD=d; best=c.name; } });
    if (btnEl) btnEl.innerHTML = orig;
    if (!best) return;
    cityOverview = false;
    if (best === activeCity) renderMarkers(); else setActiveCity(best);
    toast(`📍 ${lang==='en'?'Nearest town: ':'Närmaste stad: '}${best} · ${Math.round(bestD)} km`);
    track('near_me_city', { city: best });
  }, ()=>{ if (btnEl) btnEl.innerHTML = orig; toast(lang==='en'?'Could not get your location':'Kunde inte hämta din position'); },
     { enableHighAccuracy:false, timeout:8000, maximumAge:600000 });
}

// "Alla städer": återgå till översikten som ramar in SAMTLIGA tillgängliga städer,
// oavsett vald stad. Lämnar ev. aktiv tur och zoomar ut till hela-Sverige-vyn.
function showAllCities(){
  if (MJOLBY_ONLY) return;
  activeTour = null;
  cityOverview = true;
  overviewApplied = false;     // så gaten i renderView inte direkt nollställer läget
  renderMarkers();             // ritar om + fitView ramar in alla städer (cityOverview)
  toast(lang==='en' ? '🗺️ All towns' : '🗺️ Alla städer');
  track('show_all_cities', {});
}

/* ---------- Tyck till (feedback) ---------- */
function openFeedback(){
  const card = $('#fb-card');
  let type = 'idea';
  card.innerHTML = `
    <button class="fb-x" id="fb-x" aria-label="Stäng">&times;</button>
    <h3>${t('fb_title')}</h3>
    <p class="fb-sub">${t('fb_sub')}</p>
    <div class="fb-types" id="fb-types">
      <button class="fb-chip on" data-type="idea">${t('fb_idea')}</button>
      <button class="fb-chip" data-type="bug">${t('fb_bug')}</button>
      <button class="fb-chip" data-type="love">${t('fb_love')}</button>
    </div>
    <textarea class="fb-text" id="fb-text" rows="4" placeholder="${t('fb_ph')}" aria-label="${t('fb_title')}"></textarea>
    <input class="fb-email" id="fb-email" type="email" placeholder="${t('fb_email')}" aria-label="${t('fb_email')}">
    <button class="cta fb-send" id="fb-send" style="margin:4px 0 0">${t('fb_send')}</button>`;
  $('#feedback').setAttribute('aria-hidden','false');
  lastFocus = document.activeElement;
  setTimeout(()=>{ const x=$('#fb-x'); if(x) x.focus(); }, 30);
  const close = ()=>{ $('#feedback').setAttribute('aria-hidden','true'); restoreFocus(); };
  $('#fb-x').onclick = close;
  $('#fb-types').querySelectorAll('.fb-chip').forEach(b=> b.onclick=()=>{
    type = b.dataset.type;
    $('#fb-types').querySelectorAll('.fb-chip').forEach(x=> x.classList.toggle('on', x===b));
  });
  $('#fb-send').onclick = ()=>{
    const msg = $('#fb-text').value.trim();
    if (!msg){ $('#fb-text').focus(); return; }
    const email = $('#fb-email').value.trim();
    try {
      const all = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '[]');
      all.push({ type, msg, email, lang });
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all));
    } catch(e){}
    // Skicka även till Supabase så det syns i admin-inkorgen (inte bara lokalt).
    try {
      if (isConfigured()) getSupabase().then(supa=>{ if (supa) supa.from('feedback').insert({
        kind: type, message: msg, email: email || null, lang,
        city: (typeof activeCity!=='undefined'?activeCity:null), session: sid(),
      }).then(()=>{},()=>{}); });
    } catch(_){}
    card.innerHTML = `<div class="fb-thanks">
      <div class="fb-thanks-emoji">💛</div>
      <p>${t('fb_thanks')}</p>
      <button class="cta" id="fb-done">${lang==='en'?'Close':'Stäng'}</button></div>`;
    $('#fb-done').onclick = close;
  };
}

/* ---------- Bildoptimering för inskickade foton ---------- */
// Det lokala bidrags- och granskningsflödet (localStorage) är borttaget. Det var
// en demo från innan backenden fanns, och nåddes bara när Supabase saknade
// konfiguration — men då lovade det något det inte kunde hålla: "bidrag" och
// "granskning" som aldrig lämnade webbläsaren. Riktiga bidrag och peer review
// ligger i tips.js mot Supabase.

// Optimerar och "förskönar" en bild i webbläsaren: nedskalning + lätt förbättring
// (kontrast/mättnad/ljus) + JPEG-komprimering mot en storleksgräns → snyggare,
// tydligare och liten i filstorlek så sidan inte blir seg.
function optimizeImage(file, cb){
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = ()=>{
    let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
    const s=Math.min(1, 1280/Math.max(w,h)); w=Math.max(1,Math.round(w*s)); h=Math.max(1,Math.round(h*s));
    // Rita fullbilden och förbättra EN gång (varm/klar grade resp. svartvit-klarhet)
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const x=c.getContext('2d', { willReadFrequently:true });
    x.imageSmoothingEnabled=true; x.imageSmoothingQuality='high';
    x.drawImage(img, 0, 0, w, h);
    enhancePhoto(c);
    let q=0.85, full=c.toDataURL('image/jpeg', q);
    while (full.length>360000 && q>0.45){ q=Math.round((q-0.1)*100)/100; full=c.toDataURL('image/jpeg', q); }
    // Tumnagel från den FÖRBÄTTRADE fullbilden (matchar exakt det användaren ser)
    const ts=Math.min(1, 560/Math.max(w,h));
    const tw=Math.max(1,Math.round(w*ts)), th=Math.max(1,Math.round(h*ts));
    const tc=document.createElement('canvas'); tc.width=tw; tc.height=th;
    const tx=tc.getContext('2d'); tx.imageSmoothingEnabled=true; tx.imageSmoothingQuality='high';
    tx.drawImage(c, 0, 0, tw, th);
    const thumb=tc.toDataURL('image/jpeg', 0.74);
    URL.revokeObjectURL(url);
    cb({ full, thumb, w, h, kb: Math.round(full.length*0.73/1024) });
  };
  img.onerror = ()=>{ URL.revokeObjectURL(url); toast(lang==='en'?'Could not read the image':'Kunde inte läsa bilden'); };
  img.src = url;
}

async function renderSaved(){
  const sv=saved(), st=stamps();
  // Sparade platser kan ligga i städer som inte är laddade — hämta dem först.
  const missing = [...sv].filter(id => !DATA.some(e => e.id === id));
  if (missing.length){
    const cities = new Set((await Promise.all(missing.map(cityForId))).filter(Boolean));
    await Promise.all([...cities].map(loadCity));
  }
  const list = DATA.filter(e=> sv.has(e.id));
  const rows = list.map(e=>`<li><button class="stop-row" data-id="${e.id}">${stopThumb(e)}
      <span class="stop-meta"><b>${e.name}</b><small>📍 ${cityOf(e)} · ${catLabel(e)}</small></span>
      ${st.has(e.id)?'<span class="tick" aria-label="besökt">✓</span>':''}</button></li>`).join('');
  $('#screen').innerHTML = `<div class="screen-head"><h2>${t('screen_saved')}</h2></div>`
    + (rows ? `<ol class="screen-list">${rows}</ol>` : `<div class="screen-empty">💛<br>${t('saved_empty')}</div>`);
  $('#screen').querySelectorAll('.stop-row[data-id]').forEach(r=> r.onclick=()=> openSheet(r.dataset.id));
}

/* ---------- Utmärkelser / badges (gamification, klientsida) ---------- */
const BADGES = [
  { id:'first',    icon:'👣', count:'stamps', target:1,  sv:['Första steget','Din första incheckning'],        en:['First step','Your first check-in'] },
  { id:'five',     icon:'🧭', count:'stamps', target:5,  sv:['Upptäckare','5 platser besökta'],                  en:['Explorer','5 places visited'] },
  { id:'ten',      icon:'🏅', count:'stamps', target:10, sv:['Stadsvandrare','10 platser besökta'],              en:['Town walker','10 places visited'] },
  { id:'central',  icon:'🚂', tour:'central',            sv:['Centrala vandringen','Alla stopp på leden'],       en:['The Central Walk','All stops on the route'] },
  { id:'medieval', icon:'🏰', tour:'medieval',           sv:['Medeltidsringen','Alla stopp på leden'],           en:['The Medieval Ring','All stops on the route'] },
  { id:'cityall',  icon:'🌟', city:true,                 sv:['Ortskännare','Alla platser i staden besökta'],     en:['Local legend','Every place in town visited'] },
  { id:'saver',    icon:'💛', count:'saved', target:5,   sv:['Samlare','5 sparade platser'],                     en:['Collector','5 saved places'] },
];
const BADGES_KEY = 'sv_badges_v1';
const badgeName = b => (lang==='en'?b.en:b.sv)[0];
const badgeDesc = b => (lang==='en'?b.en:b.sv)[1];
function computeBadges(){
  const st=stamps(), sv=saved();
  const cityEnt = ENTRIES.filter(inCity);
  return BADGES.map(b=>{
    let cur=0, target=1;
    if (b.count==='stamps'){ cur=st.size; target=b.target; }
    else if (b.count==='saved'){ cur=sv.size; target=b.target; }
    else if (b.tour){ const list=orderedTourEntries(b.tour).filter(hasCoords); cur=list.filter(e=>st.has(e.id)).length; target=Math.max(1,list.length); }
    else if (b.city){ cur=cityEnt.filter(e=>st.has(e.id)).length; target=Math.max(1,cityEnt.length); }
    return { ...b, cur, target, earned: cur>=target };
  });
}
function checkNewBadges(){
  const earnedNow = computeBadges().filter(b=>b.earned).map(b=>b.id);
  let stored=[]; try { stored=JSON.parse(localStorage.getItem(BADGES_KEY)||'[]'); } catch(_){}
  const fresh = earnedNow.filter(id=>!stored.includes(id));
  try { localStorage.setItem(BADGES_KEY, JSON.stringify(earnedNow)); } catch(_){}
  if (fresh.length){
    const b = BADGES.find(x=>x.id===fresh[0]);
    if (b) toast(`🏅 ${lang==='en'?'New badge':'Nytt märke'}: ${badgeName(b)}!`);
  }
}

// Bidra-vyn: samla allt som gör appen till folkets egen — lägg till en plats,
// lämna ett tips, granska andras. Låg tidigare som en sektion längst ned i
// profilen, dit ingen scrollade.
function renderContribute(){
  const on = tipsActive();
  $('#screen').innerHTML = `<div class="screen-head"><h2>${t('screen_contribute')}</h2><p>${t('contribute_lead')} · ${activeCity}</p></div>`;
  if (!on){
    $('#screen').insertAdjacentHTML('beforeend', `<div class="screen-empty">🌱<br>${t('auth_soon')}</div>`);
    return;
  }
  if (!isLoggedIn()){
    // Utan konto går det inte att bidra — men visa VAD man får göra, inte bara
    // en inloggningsvägg.
    $('#screen').insertAdjacentHTML('beforeend', `
      <div class="contrib-why">
        <div class="cw-row"><span>📍</span><div><b>${t('cw_place')}</b><small>${t('cw_place_d')}</small></div></div>
        <div class="cw-row"><span>📷</span><div><b>${t('cw_tip')}</b><small>${t('cw_tip_d')}</small></div></div>
        <div class="cw-row"><span>🔎</span><div><b>${t('cw_review')}</b><small>${t('cw_review_d')}</small></div></div>
      </div>`);
    // mountAuthProfile prepend:ar i sin container — ge den en egen så kortet
    // hamnar under rubriken i stället för överst på skärmen.
    const slot = document.createElement('div');
    $('#screen').appendChild(slot);
    mountAuthProfile(slot, { onChange: renderContribute });
    return;
  }
  mountTipsProfile($('#screen'), { onChange: renderContribute });
}

function renderProfil(){
  const on = tipsActive();
  const set=stamps(), sv=saved();
  // Statistiken gäller den valda staden
  const cityEnt = ENTRIES.filter(inCity);
  const total = cityEnt.length;
  const visitedHere = cityEnt.filter(e=>set.has(e.id)).length;
  const pct= total? Math.round(visitedHere/total*100):0;
  const grid = cityEnt.map(e=>{const got=set.has(e.id);return `<div class="stamp ${got?'on':''}" title="${e.name}">${got?(CATEGORY_ICON[e.category]||'🏅'):'·'}</div>`;}).join('');
  const ach = computeBadges();
  const achEarned = ach.filter(b=>b.earned).length;
  const achGrid = ach.map(b=>`<div class="ach ${b.earned?'on':''}" title="${badgeDesc(b)}">
      <span class="ach-ic">${b.icon}</span><b>${badgeName(b)}</b>
      <small>${b.earned ? '✓' : `${Math.min(b.cur,b.target)}/${b.target}`}</small>
    </div>`).join('');
  $('#screen').innerHTML = `<div class="screen-head"><h2>${t('screen_profile')}</h2><p>📍 ${activeCity}</p></div>
    <div class="prog-stat">
      <div class="prog-box"><b>${visitedHere}</b><small>${t('prof_visited')}</small></div>
      <div class="prog-box"><b>${pct}%</b><small>${t('prog_city')}</small></div>
      <div class="prog-box"><b>${sv.size}</b><small>${t('prof_saved')}</small></div>
    </div>
    <div class="bar"><i style="width:${pct}%"></i></div>
    <h3 class="prof-h">${t('prof_achievements')} · ${achEarned}/${ach.length}</h3>
    <div class="ach-grid">${achGrid}</div>
    <h3 class="prof-h">${t('prof_badges')}</h3>
    <div class="stamp-grid">${grid}</div>
    <button class="fb-cta" id="fb-prof">💬 ${t('feedback')}</button>
    <button class="fb-cta" id="install-prof">📲 ${t('install_app')}</button>
    ${adminAvailable() ? `<button class="fb-cta" id="admin-prof">🛡️ ${t('admin_dashboard')}</button>` : ''}
    <h3 class="prof-h">Stadsvandring.io</h3>
    <button class="fb-cta" id="prof-cities">🗺️ ${lang==='en'?'Choose a town':'Välj stad'}</button>
    <a class="fb-cta" href="/blogg">📰 ${lang==='en'?'Read the blog':'Läs bloggen'}</a>
    <a class="fb-cta" href="/">ℹ️ ${lang==='en'?'About us':'Om oss'}</a>
    <div class="prof-social">
      <span class="prof-social__label">${lang==='en'?'Follow us':'Följ oss'}</span>
      <button class="soc-btn-app" data-soc="1" aria-label="Facebook — ${lang==='en'?'coming soon':'kommer snart'}"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7h2.3l.4-2.8h-2.7V9.4c0-.8.3-1.4 1.5-1.4h1.3V5.1c-.6-.1-1.4-.2-2.3-.2-2.3 0-3.8 1.4-3.8 3.9v2.2H7.7V14h2.2v7h3.6Z"/></svg></button>
      <button class="soc-btn-app" data-soc="1" aria-label="Instagram — ${lang==='en'?'coming soon':'kommer snart'}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg></button>
      <small class="prof-social__soon">${lang==='en'?'Coming soon':'Kommer snart'} 🌱</small>
    </div>
    <a class="hp-cross" href="https://hauntedplaces.io" target="_blank" rel="noopener">
      <span class="hp-cross__ic" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 40 40" fill="none"><path d="M8 32V20a12 12 0 0 1 24 0v12c0 2.2-2.4 1.7-3.7.4-1.3 1.4-2.7 1.4-4 0-1.3 1.4-2.7 1.4-4 0-1.3 1.4-2.7 1.4-4 .1C12.3 33.7 8 34.2 8 32Z" fill="#fff"/><circle cx="15.5" cy="19" r="2" fill="#3b2f6e"/><circle cx="24.5" cy="19" r="2" fill="#3b2f6e"/></svg></span>
      <span class="hp-cross__txt"><b>${lang==='en'?'Want a scarier walk?':'Vill du ha en läskigare vandring?'}</b><small>${lang==='en'?'Ghost walks from Hauntedplaces →':'Spökvandringar från Hauntedplaces →'}</small></span>
    </a>`;
  const pc=$('#prof-cities'); if (pc) pc.onclick = ()=> switchTab('cities');
  $('#screen').querySelectorAll('[data-soc]').forEach(b=> b.onclick=()=> toast(lang==='en'?'Coming soon on social media! 🌱':'Snart på sociala medier! 🌱'));
  $('#fb-prof').onclick = openFeedback;
  const ib=$('#install-prof'); if (ib) ib.onclick = openInstallGuide;
  const ab=$('#admin-prof'); if (ab) ab.onclick = openAdminDashboard;
  const profScreen = $('#screen');
  challengesMod().then(m => { if ($('#screen') === profScreen && activeTab === 'profile') m.mountChallengeProfile(profScreen); });
  if (on){
    // Vad man BIDRAGIT med, inte bara vad man besökt. Ligger före kontokortet i
    // DOM:en men hamnar under det, eftersom mountAuthProfile prepend:ar.
    mountImpact($('#screen'), { onContribute: () => switchTab('contribute') });
    mountAuthProfile($('#screen'), { onChange: renderProfil });   // prepend → kontokort överst
  }
}

/* Admin-analytics flyttad till admin.js (openAdminDashboard) — konsoliderad där
   tillsammans med användar- och förslagsöversikten. */
function toggleSave(id){
  const set=saved();
  if (set.has(id)) set.delete(id); else { set.add(id); toast('💛 '+t('saved')); }
  localStorage.setItem(SAVED_KEY, JSON.stringify([...set]));
  setTimeout(checkNewBadges, 1100);
  const sb=$('#save-btn');
  if (sb){ const on=saved().has(id); sb.classList.toggle('on',on); sb.setAttribute('aria-label', on?t('saved'):t('save')); }
  if (activeTab==='saved') renderSaved();
}

/* ---------- Geolocation + auto-guide ---------- */
function showMe(ll, recenter){
  if (meMarker) meMarker.remove();
  meMarker = L.marker(ll, { icon:L.divIcon({className:'',html:'<div class="me-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]}) }).addTo(map);
  if (recenter) map.setView(ll, Math.max(map.getZoom(), 15));
  notifyPos(ll);
}
function locate(){
  if (!navigator.geolocation){ toast('Platstjänst stöds inte'); return; }
  toast('Letar efter din position…');
  navigator.geolocation.getCurrentPosition(
    pos=> showMe([pos.coords.latitude, pos.coords.longitude], true),
    ()=> toast('Kunde inte hämta position'),
    { enableHighAccuracy:true, timeout:8000 }
  );
}
function handleGeo(ll){
  // Närmaste synliga stopp inom radie som inte redan triggats
  let best=null, bestD=Infinity;
  visibleEntries().forEach(e=>{
    const d = map.distance(ll, [e.coordinates.lat, e.coordinates.lng]);
    if (d < bestD){ bestD = d; best = e; }
  });
  if (best && bestD <= AUTO_RADIUS && !autoTriggered.has(best.id)){
    autoTriggered.add(best.id);
    openSheet(best.id);
    toast('📍 Du är vid ' + best.name);
    speak(narrationText(best));
  }
}
function toggleAutoGuide(){
  autoGuide = !autoGuide;
  if (autoGuide){
    if (!navigator.geolocation){ toast('Platstjänst stöds inte'); autoGuide=false; updateAutoBtn(); return; }
    toast('🎧 Auto-guide på — gå nära ett stopp så berättar ' + (TELLER?TELLER.name:'guiden'));
    watchId = navigator.geolocation.watchPosition(
      pos=>{ const ll=[pos.coords.latitude,pos.coords.longitude]; showMe(ll); handleGeo(ll); },
      ()=> toast('Kunde inte följa din position'),
      { enableHighAccuracy:true, maximumAge:5000, timeout:12000 }
    );
  } else {
    if (watchId!=null) navigator.geolocation.clearWatch(watchId);
    watchId = null; stopSpeaking(); toast('Auto-guide av');
  }
  updateAutoBtn();
}
function updateAutoBtn(){
  const b = document.querySelector('.autoguide-btn');
  if (!b) return;
  b.classList.toggle('on', autoGuide);
  b.title = autoGuide ? 'Auto-guide på' : 'Auto-guide av';
  b.setAttribute('aria-pressed', String(autoGuide));
  b.setAttribute('aria-label', autoGuide ? 'Stäng av auto-guide' : 'Slå på auto-guide (ljud vid stopp)');
}
// Testkrok: simulera GPS-position utan riktig sensor (skadar inget i produktion)
window.__feedPos = (lat,lng)=>{ const ll=[lat,lng]; showMe(ll,true); handleGeo(ll); };

/* ---------- Panels / helpers ---------- */
let lastFocus = null;
function focusInto(sel){
  lastFocus = document.activeElement;
  const dlg = $(sel); if (!dlg) return;
  const target = dlg.querySelector('.panel-close, .sheet-close, .teller-x, .quiz-opt, [autofocus]') || dlg;
  // vänta in transition/innehåll
  setTimeout(()=>{ try { target.focus({preventScroll:true}); } catch(e){} }, 30);
}
function restoreFocus(){ if (lastFocus && lastFocus.focus){ try { lastFocus.focus({preventScroll:true}); } catch(e){} } lastFocus = null; }
function markFocus(){ lastFocus = document.activeElement; }
// Alla "fönster" (paneler/sheet/modaler). En vy åt gången → sömlöst, inga staplade fönster.
const OVERLAYS = ['#sheet','#tour-panel','#stories-panel','#progress-panel','#sponsor-panel','#quiz','#teller','#feedback','#contribute','#review','#auth','#challenge-builder','#challenge-play','#challenge-results','#challenge-task'];
function closeOverlays(except){
  OVERLAYS.forEach(sel=>{ if (sel===except) return; const el=$(sel);
    if (el && el.getAttribute('aria-hidden')==='false'){ if (sel==='#sheet') stopSpeaking(); el.setAttribute('aria-hidden','true'); } });
}
function openPanel(sel){ stopSpeaking(); closeOverlays(sel); $(sel).setAttribute('aria-hidden','false'); focusInto(sel); }
function closePanel(sel){ $(sel).setAttribute('aria-hidden','true'); restoreFocus(); }
function closeTopDialog(){
  const order = ['#auth','#review','#contribute','#challenge-task','#feedback','#quiz','#teller','#sheet','#challenge-builder','#challenge-play','#challenge-results','#tour-panel','#stories-panel','#progress-panel','#sponsor-panel'];
  for (const sel of order){
    const el = $(sel);
    if (el && el.getAttribute('aria-hidden') === 'false'){
      if (sel === '#sheet') stopSpeaking();
      el.setAttribute('aria-hidden','true');
      restoreFocus();
      return true;
    }
  }
  return false;
}
let toastT;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200);
}

/* ---------- PWA-installprompt ---------- */
let deferredInstallPrompt = null;
/* Offline-indikator: diskret banner när nätet tappas (cachat innehåll visas ändå
   tack vare service workern), kort "online igen"-toast när det kommer tillbaka.
   Viktigt för en vandringsapp där signalen kan svaja i fält. */
function setupConnectivity(){
  let bar = null;
  const show = ()=>{
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'offline-bar';
    bar.setAttribute('role','status');
    bar.setAttribute('aria-live','polite');
    bar.textContent = t('offline_msg');
    document.body.appendChild(bar);
  };
  const hide = (announce)=>{
    if (bar){ bar.remove(); bar = null; if (announce) toast(t('online_msg')); }
  };
  window.addEventListener('offline', show);
  window.addEventListener('online', ()=>hide(true));
  if (!navigator.onLine) show();
}

const PWA_DISMISS_KEY = 'sv_pwa_dismissed';
function setupInstallPrompt(){
  const banner = $('#install-banner');
  if (!banner) return;
  $('#ib-title').textContent = t('pwa_title');
  $('#ib-sub').textContent = t('pwa_text');
  $('#ib-install').textContent = t('pwa_install');
  window.addEventListener('beforeinstallprompt', (e)=>{
    e.preventDefault();
    deferredInstallPrompt = e;
    try { if (localStorage.getItem(PWA_DISMISS_KEY)) return; } catch(_){}            // användaren har avböjt
    if (matchMedia('(display-mode: standalone)').matches) return;                    // redan installerad
    banner.hidden = false;
  });
  $('#ib-install').onclick = async ()=>{
    banner.hidden = true;
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice.catch(()=>{});
    deferredInstallPrompt = null;
  };
  $('#ib-x').onclick = ()=>{ banner.hidden = true; try { localStorage.setItem(PWA_DISMISS_KEY,'1'); } catch(_){} };
  window.addEventListener('appinstalled', ()=>{ banner.hidden = true; });
}

/* ---------- Spökkartan-promo-banner (korsmarknadsföring) ---------- */
// Diskret ÅTERKOMMANDE nudge — dyker upp i hemvyn lite då och då vid naturliga
// stunder (efter lite utforskande / när man öppnat ett par platser), inte som en
// engångsruta. Ingen permanent bortstängning: stänger man snoozas den några dygn,
// klickar man vidare snoozas den längre. Som mest en gång per session.
const SPOK_SNOOZE_KEY     = 'sv_spok_banner_snooze';    // ms-timestamp: dold tills dess
const SPOK_SNOOZE_DISMISS = 4  * 24 * 3600 * 1000;      // stäng (×) → 4 dygns paus
const SPOK_SNOOZE_CLICK   = 30 * 24 * 3600 * 1000;      // klick vidare → 30 dygn
const SPOK_INTRO_MS       = 25000;                      // fallback: dyk upp efter en stund i hemvyn
const SPOK_OPENS_TRIGGER  = 2;                          // eller så fort man öppnat så här många platser
let spokBannerReady = false;
let spokShownThisSession = false;
let spokPlaceOpens = 0;
function spokSnoozed(){
  try { return Date.now() < (+localStorage.getItem(SPOK_SNOOZE_KEY) || 0); } catch(_){ return false; }
}
function snoozeSpok(ms){ try { localStorage.setItem(SPOK_SNOOZE_KEY, String(Date.now() + ms)); } catch(_){} }
function setupSpokBanner(){
  const b = $('#spok-banner');
  if (!b) return;
  const en = lang==='en';
  $('#spok-banner-title').textContent = en ? 'Fond of a good ghost story?' : 'Tycker du även om en bra spökhistoria?';
  $('#spok-banner-sub').textContent   = en ? 'Spökkartan maps haunted places all over Sweden.'
                                           : 'På Spökkartan hittar du hemsökta platser i hela Sverige.';
  $('#spok-banner-cta').textContent   = en ? 'Explore' : 'Utforska';
  $('#spok-banner-cta').onclick = ()=>{ track('spok_banner_click', {}); snoozeSpok(SPOK_SNOOZE_CLICK); };
  $('#spok-banner-x').onclick = ()=>{
    b.hidden = true; spokShownThisSession = true; snoozeSpok(SPOK_SNOOZE_DISMISS);
    track('spok_banner_dismiss', {});
  };
  // Fallback-intro: dyk upp efter en stund om användaren inte hunnit öppna platser.
  setTimeout(nudgeSpokBanner, SPOK_INTRO_MS);
}
// Anropas vid en "bra stund" (t.ex. efter ett par öppnade platser) för att nudga.
function nudgeSpokBanner(){ spokBannerReady = true; updateSpokBanner(); }
// Räknar engagemang; efter några öppnade platser är det ett bra läge att tipsa.
function spokOnPlaceOpen(){ if (++spokPlaceOpens === SPOK_OPENS_TRIGGER) nudgeSpokBanner(); }
function updateSpokBanner(){
  const b = $('#spok-banner');
  if (!b) return;
  const installShown = $('#install-banner') && $('#install-banner').hidden === false;
  const landingOpen  = $('#landing') && $('#landing').getAttribute('aria-hidden')==='false';
  const canShow = spokBannerReady && !spokSnoozed() && activeTab==='home' && !installShown && !landingOpen;
  if (!canShow){ b.hidden = true; return; }
  if (!b.hidden) return;                       // redan synlig — lämna orörd
  if (spokShownThisSession) return;            // redan visad denna session → vänta till nästa
  b.hidden = false;
  spokShownThisSession = true;
}

function wireUi(){
  $('#sheet-close').onclick = ()=>{ stopSpeaking(); $('#sheet').setAttribute('aria-hidden','true'); };
  $('#tour-close').onclick = ()=> closePanel('#tour-panel');
  const rbC=$('#rb-close'); if (rbC) rbC.onclick = ()=> closePanel('#route-builder');
  const rvC=$('#rv-close'); if (rvC) rvC.onclick = ()=> closePanel('#route-view');
  $('#progress-close').onclick = ()=> closePanel('#progress-panel');
  $('#progress-btn').onclick = ()=> switchTab('profile');
  $('#lang-switch')?.querySelectorAll('.flag-btn').forEach(b=>{
    b.onclick = ()=>{ const nl=b.dataset.lang; if (nl===lang) return; lang=nl; localStorage.setItem('mjolby_lang', lang); location.reload(); };
  });
  $('#next-stop-btn').onclick = navigateToNext;
  $('#view-toggle').onclick = ()=> setExploreView(exploreView === 'map' ? 'list' : 'map');
  $('#stories-btn').onclick = openStories;
  $('#stories-close').onclick = ()=> closePanel('#stories-panel');
  $('#stories-q').oninput = e=> renderStories(e.target.value);
  $('#sponsor-close').onclick = ()=> closePanel('#sponsor-panel');
  $('#quiz').onclick = e=>{ if(e.target.id==='quiz') $('#quiz').setAttribute('aria-hidden','true'); };
  $('#teller').onclick = e=>{ if(e.target.id==='teller'){ $('#teller').setAttribute('aria-hidden','true'); restoreFocus(); } };
  $('#feedback').onclick = e=>{ if(e.target.id==='feedback'){ $('#feedback').setAttribute('aria-hidden','true'); restoreFocus(); } };
  $('#contribute').onclick = e=>{ if(e.target.id==='contribute'){ $('#contribute').setAttribute('aria-hidden','true'); restoreFocus(); } };
  $('#review').onclick = e=>{ if(e.target.id==='review'){ $('#review').setAttribute('aria-hidden','true'); restoreFocus(); } };
  $('#auth').onclick = e=>{ if(e.target.id==='auth'){ $('#auth').setAttribute('aria-hidden','true'); restoreFocus(); } };

  // Tangentbord: Esc stänger översta dialogen; Enter/Space aktiverar list-rader
  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape'){ if (closeTopDialog()) e.preventDefault(); return; }
    if (e.key === 'Enter' || e.key === ' '){
      const el = document.activeElement;
      if (el && el.matches && el.matches('.sp-row[data-id]')){
        e.preventDefault(); el.click();
      }
    }
  });
}

/* ---------- Stadsutmaning (challenges.js) ---------- */
function setupChallenges(){
  // Kontexten byggs direkt men modulen laddas först när den behövs (challengesMod).
  _chCtx = {
    get DATA(){ return DATA; }, get ENTRIES(){ return ENTRIES; },
    get map(){ return map; }, get lang(){ return lang; },
    hasCoords, stopThumb, CAT_LABEL, AUTO_RADIUS,
    openPanel, closePanel, focusInto, restoreFocus, toast,
    locate, fileToThumb, t,
    onPosition: cb => posSubscribers.push(cb),
  };
}

/* ---------- Konton + community-tips (auth.js + tips.js) ---------- */
function setupAuthTips(){
  const c = {
    get DATA(){ return DATA; }, get ENTRIES(){ return ENTRIES; },
    get map(){ return map; }, get lang(){ return lang; },
    get citySlug(){ return citySlug(activeCity); },   // community-flödet följer vald stad
    get cityName(){ return activeCity; },
    openPanel, closePanel, startUserRoute,
    // En delad rutt kan ligga i en annan stad än den man tittar på.
    ensureCity: async (slug) => {
      const c = CITY_INDEX.find(x => x.slug === slug);
      if (!c) return;
      if (c.name !== activeCity) await setActiveCity(c.name); else await loadCity(c.name);
    },
    onRoutesChanged(){ if (activeTab === 'routes') renderLeder(); },
    CAT_LABEL, t, toast, hasCoords,
    openSheet, optimizeImage,
    markFocus, restoreFocus,
    // Rita om öppen stopp-vy/profil när färska community-tips laddats
    onTipsLoaded(){
      const sh=$('#sheet');
      if (sh && sh.getAttribute('aria-hidden')==='false' && currentSheetId) openSheet(currentSheetId);
      if (activeTab==='profile') renderProfil();
    },
  };
  _adminCtx = c; initInstall(c); initComments(c); initRoutes(c); initImpact(c);
  initAuth(c).then(()=> initTips(c));
}

init();
