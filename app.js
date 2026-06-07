// Mjölby Stadsvandring — PWA prototype
// Data: mjolby_kunskapsdatabas.json (knowledge base)
import { STORIES, EXTRA_IMAGES } from './content.js';
import { STORYTELLERS, ACTIVE_CITY } from './storytellers.js';
import { STRINGS, SUMMARY_EN, TELLER_EN } from './i18n.js';

let lang = localStorage.getItem('mjolby_lang') || 'sv';
const t = k => (STRINGS[lang] && STRINGS[lang][k]) || STRINGS.sv[k] || k;
const tellerL = () => (lang === 'en' && TELLER_EN[ACTIVE_CITY]) ? TELLER_EN[ACTIVE_CITY] : null;
const leadOf = e => (lang === 'en' && SUMMARY_EN[e.id]) || e.summary || '';

const TELLER = STORYTELLERS[ACTIVE_CITY] || null;
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
  museum_hembygd:'assoc', musikkar:'assoc', idrott:'assoc',
  handel:'biz', kafe_restaurang:'biz', hotell:'biz', industri_foretag:'biz',
};

const CATEGORY_ICON = {
  ort:'📍', vattendrag:'🌊', kyrka:'⛪', byggnad:'🏛️', torg:'⛲', person:'👤',
  konst_staty:'🗿', runsten:'🪨', klosterruin:'🏚️', borgruin:'🏰', bro:'🌉',
  handelse:'📜', station:'🚉', museum_hembygd:'🏡', musikkar:'🎺', idrott:'⚽',
  handel:'🛍️', kafe_restaurang:'☕', hotell:'🏨', industri_foretag:'🏭',
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
};

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
let DATA = [], ENTRIES = [], markersById = {};
let map, markerLayer, routeLayer, meMarker;
const activeTypes = new Set(Object.keys(TYPES));
let activeTour = null; // null = all
let questMode = false;  // progressiv upplåsning av stopp i en vandring
const STAMP_KEY = 'mjolby_stamps_v1';

// Audio narration + GPS auto-guide state
let speaking = false;
let autoGuide = false, watchId = null;
const autoTriggered = new Set();
const AUTO_RADIUS = 45; // meter

const $ = sel => document.querySelector(sel);
const stamps = () => new Set(JSON.parse(localStorage.getItem(STAMP_KEY) || '[]'));
const saveStamps = set => localStorage.setItem(STAMP_KEY, JSON.stringify([...set]));
const typeOf = e => CATEGORY_TYPE[e.category] || 'story';
const hasCoords = e => e.coordinates && typeof e.coordinates.lat === 'number';
const imgUrl = e => (e.images && e.images[0] && e.images[0].url) || (EXTRA_IMAGES[e.id] && EXTRA_IMAGES[e.id].url) || null;
const imgCredit = e => (e.images && e.images[0] && e.images[0].attribution) || (EXTRA_IMAGES[e.id] && EXTRA_IMAGES[e.id].attribution) || null;
const imgFocal = e => (e.images && e.images[0] && e.images[0].focal) || (EXTRA_IMAGES[e.id] && EXTRA_IMAGES[e.id].focal) || null;
const iconOf = e => CATEGORY_ICON[e.category] || '📍';
/* ---------- Illustrerad Strosa-stadsscen (porterad från designen) ---------- */
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

const typeLabel = e => t('type_' + typeOf(e));
const tourName = key => t('tour_' + key + '_name');
const tourSub = key => t('tour_' + key + '_sub');
function stopThumb(e, badge){
  const img = imgUrl(e), icon = iconOf(e);
  return img
    ? `<span class="stop-thumb"><img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer"
         onerror="this.remove();this.parentElement.classList.add('ph');this.parentElement.insertAdjacentText('afterbegin','${icon}')">${badge||''}</span>`
    : `<span class="stop-thumb ph">${icon}${badge||''}</span>`;
}

/* ---------- Init ---------- */
async function init() {
  const res = await fetch('data.json');
  const json = await res.json();
  DATA = json.entries;
  ENTRIES = DATA.filter(hasCoords);

  buildMap();
  buildTours();
  buildFilters();
  renderMarkers();
  wireUi();
  applyI18n();
  updateStampBadge();
  setupTeller();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  }
}

function buildMap() {
  map = L.map('map', { zoomControl:true }).setView([58.327, 15.13], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  routeLayer = L.layerGroup().addTo(map);

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

  // Kartan ligger i en storleksbegränsad ram → se till att Leaflet mäter om sig
  setTimeout(()=> map.invalidateSize(), 200);
  window.addEventListener('resize', ()=> map.invalidateSize());
}

function pinIcon(entry, visited){
  const t = TYPES[typeOf(entry)];
  return L.divIcon({
    className:'',
    html:`<div class="pin ${visited?'visited':''}" style="background:${t.color}"><span>${CATEGORY_ICON[entry.category]||'📍'}</span></div>`,
    iconSize:[30,30], iconAnchor:[15,30], popupAnchor:[0,-28],
  });
}

function visibleEntries(){
  let list = ENTRIES.filter(e => activeTypes.has(typeOf(e)));
  if (activeTour) list = list.filter(TOURS[activeTour].test);
  return list;
}

function renderMarkers(){
  markerLayer.clearLayers();
  markersById = {};
  const st = stamps();
  visibleEntries().forEach(e=>{
    const m = L.marker([e.coordinates.lat, e.coordinates.lng], { icon: pinIcon(e, st.has(e.id)) })
      .on('click', ()=> openSheet(e.id));
    m.addTo(markerLayer);
    markersById[e.id] = m;
  });
  drawRoute();
  fitView();
}

function orderedTourEntries(tourKey){
  const t = TOURS[tourKey];
  let list = DATA.filter(t.test);
  if (t.sequence){
    const idx = id => { const i = t.sequence.indexOf(id); return i<0?99:i; };
    list.sort((a,b)=> idx(a.id) - idx(b.id));
  } else {
    list.sort((a,b)=> t.order(a) - t.order(b));
  }
  return list;
}

function drawRoute(){
  routeLayer.clearLayers();
  if (!activeTour) return;
  const pts = orderedTourEntries(activeTour).filter(hasCoords)
    .map(e=>[e.coordinates.lat, e.coordinates.lng]);
  if (pts.length>1){
    L.polyline(pts, { color:'#0A2A6B', weight:4, opacity:.55, dashArray:'2 9', lineCap:'round' }).addTo(routeLayer);
  }
}

function fitView(){
  const ms = Object.values(markersById);
  if (!ms.length) return;
  const grp = L.featureGroup(ms);
  map.fitBounds(grp.getBounds().pad(0.18), { maxZoom: activeTour==='central'?16:13 });
}

/* ---------- Tours UI ---------- */
function buildTours(){
  const wrap = $('#tours');
  const chips = [['all', t('tours_all'), ENTRIES.length+' '+t('stops')]]
    .concat(Object.entries(TOURS).map(([k,tr])=>[k, tourName(k), DATA.filter(tr.test).length+' '+t('stops')]));
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
      const clue = `${CAT_LABEL[e.category]||'Ett stopp'}${e.era?` · ${e.era}`:''}`;
      return `<li><div class="stop-row locked" aria-disabled="true">
        <span class="stop-thumb ph">🔒${badge}</span>
        <span class="stop-meta"><b>???</b><small>Lasse viskar: ${clue}</small></span>
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
  openPanel('#tour-panel');
}

/* ---------- Filters ---------- */
function buildFilters(){
  const wrap = $('#filters');
  wrap.innerHTML = Object.entries(TYPES).map(([k,ty])=>
    `<button class="fchip" data-type="${k}" aria-pressed="true">
       <span class="dot" style="background:${ty.color}"></span>${t('type_'+k)}
     </button>`).join('');
  wrap.querySelectorAll('.fchip').forEach(b=>{
    b.onclick = ()=>{
      const k = b.dataset.type;
      if (activeTypes.has(k)) activeTypes.delete(k); else activeTypes.add(k);
      b.setAttribute('aria-pressed', activeTypes.has(k));
      renderMarkers();
    };
  });
}

/* ---------- Stop detail sheet ---------- */
function openSheet(id){
  const e = DATA.find(x=>x.id===id);
  if (!e) return;
  const ty = TYPES[typeOf(e)];
  const st = stamps();
  const visited = st.has(id);
  const img = imgUrl(e), credit = imgCredit(e), icon = iconOf(e);
  const offer = DEMO_OFFERS[id];
  const story = STORIES[id] || e.description || '';
  const storyHtml = story.split(/\n\n+/).map(p=>`<p>${p}</p>`).join('');

  const facts = (e.key_facts||[]).map(f=>`<li>${f}</li>`).join('');
  const mapsHref = hasCoords(e)
    ? `https://www.google.com/maps/dir/?api=1&destination=${e.coordinates.lat},${e.coordinates.lng}` : null;
  const srcs = (e.sources||[]).slice(0,3)
    .map(s=>`<a href="${s}" target="_blank" rel="noopener">${t('source')}</a>`).join(' · ');

  const focal = imgFocal(e);
  const heroPh = `<div class="hero-ph">${townScene()}<span class="ph-emoji">${icon}</span></div>`;
  const hero = img
    ? `<div class="hero">
         ${heroPh}
         <img src="${img}" alt="${e.name}" loading="eager" referrerpolicy="no-referrer"
              ${focal?`style="object-position:${focal}"`:''} onerror="this.remove()">
         ${credit?`<span class="credit">📷 ${credit}</span>`:''}
       </div>`
    : `<div class="hero">${heroPh}</div>`;

  $('#sheet-inner').innerHTML = `
    ${hero}
    <div class="sheet-pad">
      <span class="type-tag" style="background:${ty.color}">${icon} ${typeLabel(e)}</span>
      <h2>${e.name}</h2>
      ${e.era?`<div class="era">${e.era}</div>`:''}
      ${leadOf(e)?`<p class="lead">${leadOf(e)}</p>`:''}
      ${tellerBubble(id)}
      ${('speechSynthesis' in window)?`<button class="speak-btn" id="speak-btn">🔊 ${t('speak_pre')} ${TELLER?TELLER.name:''} ${t('speak_suf')}</button>`:''}
      ${(lang==='en' && storyHtml)?`<p class="story-note">📖 ${t('story_note')}</p>`:''}
      ${storyHtml?`<div class="story">${storyHtml}</div>`:''}
      ${facts?`<ul class="facts">${facts}</ul>`:''}
      ${offer?(()=>{ const m=metricsFor(id); return `<div class="offer">
        <b>🎁 Exempelerbjudande (sponsrat)</b><p>${offer}</p>
        <div class="offer-metrics">
          <span class="om"><b>${m.week}</b><small>incheckningar denna vecka</small></span>
          <span class="om"><b>${m.total}</b><small>totalt</small></span>
          ${m.rating?`<span class="om"><b>${m.rating.toFixed(1)}</b><small>snittbetyg</small></span>`:''}
        </div>
        ${m.mine?`<p class="om-you">✓ Din incheckning räknas — så här ser sponsorn värdet växa.</p>`:''}
        <button class="om-link" data-sponsor="1">📈 Se vad sponsorn ser</button>
      </div>`; })():''}
      ${hasCoords(e)
        ? `<button class="checkin ${visited?'done':''}" id="checkin-btn">
             ${visited?t('checkin_done'):t('checkin')}
           </button>
           ${photoBlock(id)}`
        : ''}
      ${e.address?`<p class="addr">📍 ${e.address}${mapsHref?` · <a href="${mapsHref}" target="_blank" rel="noopener">${t('directions')}</a>`:''}</p>`:''}
      ${srcs?`<p class="srcs">${srcs}</p>`:''}
    </div>`;

  const btn = $('#checkin-btn');
  if (btn) btn.onclick = ()=> toggleCheckin(id);
  const sp = $('#sheet-inner [data-sponsor]');
  if (sp) sp.onclick = openSponsor;
  const spk = $('#speak-btn');
  if (spk) spk.onclick = ()=> speaking ? stopSpeaking() : speak(narrationText(e));
  const pc = $('#sheet-inner [data-photo]');
  if (pc) pc.onclick = ()=> startPhoto(pc.dataset.photo);
  const psh = $('#sheet-inner [data-share]');
  if (psh) psh.onclick = ()=> sharePhoto(psh.dataset.share);

  // Sheet och sidopaneler är ömsesidigt uteslutande (telefonbredd)
  ['#tour-panel','#stories-panel','#progress-panel','#sponsor-panel'].forEach(s=>{ const p=$(s); if(p) p.setAttribute('aria-hidden','true'); });
  $('#sheet').setAttribute('aria-hidden','false');
  focusInto('#sheet');
  if (hasCoords(e)) map.panTo([e.coordinates.lat, e.coordinates.lng], { animate:true });
}

function toggleCheckin(id){
  const set = stamps();
  if (set.has(id)){ set.delete(id); } else { set.add(id); toast('🏅 Stämpel insamlad!'); }
  saveStamps(set);
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
  const total = ENTRIES.length;
  const pct = total ? Math.round(set.size/total*100) : 0;
  const grid = ENTRIES.map(e=>{
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
    <div class="stamp-grid">${grid}</div>
    <button class="om-link" id="to-sponsor" style="margin-top:18px">📈 Öppna sponsorpanel (för kommun &amp; företag)</button>`;
  $('#to-sponsor').onclick = openSponsor;
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
  overlay.setAttribute('aria-hidden','false');
  lastFocus = document.activeElement;

  const render = ()=>{
    const q = bank[i];
    card.innerHTML = `
      <div class="quiz-progress">${lang==='en'?'Question':'Fråga'} ${i+1} / ${bank.length}</div>
      <h3>${tourName(tourKey)}</h3>
      <p class="quiz-q">${q.q}</p>
      <div class="quiz-opts">
        ${q.opts.map((o,idx)=>`<button class="quiz-opt" data-i="${idx}">${o}</button>`).join('')}
      </div>`;
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
      <div class="quiz-result">
        <div class="big">${score}/${bank.length}</div>
        <p class="quiz-q">${
          lang==='en'
            ? (score===bank.length?'Master town-walker! 🏆':score>=bank.length/2?'Well done! 👏':'Walk it again and gather more facts. 🚶')
            : (score===bank.length?'Stadsvandrarmästare! 🏆':score>=bank.length/2?'Bra jobbat! 👏':'Gå vandringen igen och samla fler fakta. 🚶')
        }</p>
        <button class="cta" id="quiz-done" style="margin:8px 0 0">${lang==='en'?'Done':'Klar'}</button>
      </div>`;
    card.querySelector('#quiz-done').onclick = ()=>{ overlay.setAttribute('aria-hidden','true'); restoreFocus(); };
  };
  render();
  focusInto('#quiz');
}

/* ---------- Fotoutmaning + delning ---------- */
const PHOTO_KEY = 'mjolby_photos_v1';
const SHARE_URL = 'https://ninjafreddy2000.github.io/mjolby-stadsvandring/';
const photos = () => { try { return JSON.parse(localStorage.getItem(PHOTO_KEY) || '{}'); } catch(e){ return {}; } };
function savePhoto(id, dataUrl){
  const p = photos(); p[id] = dataUrl;
  try { localStorage.setItem(PHOTO_KEY, JSON.stringify(p)); }
  catch(e){ toast('Kunde inte spara bilden (minne fullt)'); }
}
function photoBlock(id){
  const p = photos()[id];
  if (p) return `<div class="photo-block">
      <img class="my-photo" src="${p}" alt="${lang==='en'?'Your photo from the place':'Din bild från platsen'}">
      <button class="photo-share" data-share="${id}">${t('photo_share')}</button>
    </div>`;
  return `<button class="photo-cta" data-photo="${id}">${t('photo_cta')}</button>`;
}
function fileToThumb(file, cb){
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = ()=>{
    const max = 640; let w = img.width, h = img.height;
    const s = Math.min(1, max/Math.max(w,h)); w = Math.round(w*s); h = Math.round(h*s);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url); cb(c.toDataURL('image/jpeg', 0.72));
  };
  img.onerror = ()=>{ URL.revokeObjectURL(url); toast('Kunde inte läsa bilden'); };
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
      toast('📸 Foto sparat – stämpel klar!');
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
  const text = `Jag utforskar ${e?e.name:'Mjölby'} med Mjölby Stadsvandring! #MjölbyStadsvandring #SkånskaLasse`;
  try {
    if (p && navigator.canShare){
      const file = dataUrlToFile(p, 'mjolby.jpg');
      if (file && navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file], text, title:'Mjölby Stadsvandring' }); return;
      }
    }
    if (navigator.share){ await navigator.share({ title:'Mjölby Stadsvandring', text, url: SHARE_URL }); return; }
    await navigator.clipboard.writeText(text + ' ' + SHARE_URL);
    toast('Länk kopierad – klistra in och dela!');
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
function renderStories(filter){
  const q = (filter||'').toLowerCase().trim();
  const list = DATA.filter(e=>{
    if (!q) return true;
    return (e.name+' '+(e.summary||'')+' '+(CAT_LABEL[e.category]||'')).toLowerCase().includes(q);
  });
  const st = stamps();
  $('#stories-list').innerHTML = list.map(e=>{
    const onMap = hasCoords(e);
    return `<li><button class="stop-row" data-id="${e.id}">
      ${stopThumb(e)}
      <span class="stop-meta"><b>${e.name}</b><small>${CAT_LABEL[e.category]||''}${onMap?'':' · '+t('only_story')}</small></span>
      ${st.has(e.id)?'<span class="tick" aria-label="besökt">✓</span>':''}
    </button></li>`;
  }).join('') || `<li class="stories-empty">${lang==='en'?'Nothing found.':'Inget hittades.'}</li>`;
  $('#stories-list').querySelectorAll('.stop-row').forEach(r=>{
    r.onclick = ()=> openSheet(r.dataset.id);
  });
}
function openStories(){ renderStories($('#stories-q').value); openPanel('#stories-panel'); }

/* ---------- i18n: statiska strängar ---------- */
function applyI18n(){
  document.documentElement.lang = lang;
  const setText = (sel, val)=>{ const el=$(sel); if(el) el.textContent = val; };
  setText('#brand-sub', t('brand_sub'));
  setText('#lang-btn', t('lang_btn'));
  const sp = $('#stories-panel');
  if (sp){
    sp.querySelector('.panel-head h2').textContent = t('act_stories_full');
    sp.querySelector('.panel-sub').textContent = t('stories_sub');
  }
  const q = $('#stories-q'); if (q) q.setAttribute('placeholder', t('stories_search'));
  const pp = $('#progress-panel'); if (pp) pp.querySelector('.panel-head h2').textContent = t('act_progress');
  setText('#tour-quiz-btn', t('quiz_cta'));
}

/* ---------- Stadens berättare (storyteller) ---------- */
function setupTeller(){
  const bar = $('#tellerbar');
  if (!TELLER){ bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML =
    `<span class="tb-av">${tellerAvatar()}</span>
     <span class="tb-text">${t('teller_by')} <b>${TELLER.name}</b><small>${(tellerL()&&tellerL().role)||TELLER.role||''}</small></span>
     <span class="tb-go">${t('teller_meet')}</span>`;
  bar.onclick = ()=> openTeller();
  if (!localStorage.getItem(TELLER_SEEN_KEY)) openTeller(true);
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
  const voiceSum = (loc && loc.voiceSummary) || v.summary || '';
  const greet = greetSrc.split(/\n\n+/).map(p=>`<p>${p}</p>`).join('');
  const traits = ((loc && loc.traits) || v.traits || []).map(x=>`<li>${x}</li>`).join('');
  const phrases = en ? '' : (v.phrases||[]).map(x=>`<span class="vphrase">${x}</span>`).join('');
  const signoff = en ? '' : (v.signoff||'');
  const entry = tel.entryId && DATA.find(x=>x.id===tel.entryId);
  const voiceHeader = en ? '🎙️ How I speak' : '🎙️ Så här pratar jag';
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
    ${traits?`
      <div class="voice-card">
        <div class="vc-h">${voiceHeader}</div>
        ${voiceSum?`<p class="vc-sum">${voiceSum}</p>`:''}
        <ul class="vtraits">${traits}</ul>
        ${phrases?`<div class="vphrases">${phrases}</div>`:''}
      </div>`:''}
    ${signoff?`<p class="teller-sign">${signoff}</p>`:''}
    <button class="cta teller-go" id="teller-go" style="margin:6px 0 8px">${goLabel}</button>
    ${entry?`<button class="teller-more" id="teller-more">${en?`Read more about ${tel.name}`:`Läs mer om ${tel.name} i appen`}</button>`:''}
    <p class="teller-scale">${scaleLine}</p>`;

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
  return vs.find(v=>/sv[-_]?se/i.test(v.lang)) || vs.find(v=>(v.lang||'').toLowerCase().startsWith('sv')) || null;
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
  if (b) b.innerHTML = speaking
    ? t('speak_stop')
    : `🔊 ${t('speak_pre')} ${TELLER ? TELLER.name : ''} ${t('speak_suf')}`;
}
// Röster laddas ibland asynkront
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = ()=>{};

/* ---------- Geolocation + auto-guide ---------- */
function showMe(ll, recenter){
  if (meMarker) meMarker.remove();
  meMarker = L.marker(ll, { icon:L.divIcon({className:'',html:'<div class="me-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]}) }).addTo(map);
  if (recenter) map.setView(ll, Math.max(map.getZoom(), 15));
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
function openPanel(sel){ stopSpeaking(); $('#sheet').setAttribute('aria-hidden','true'); $(sel).setAttribute('aria-hidden','false'); focusInto(sel); }
function closePanel(sel){ $(sel).setAttribute('aria-hidden','true'); restoreFocus(); }
function closeTopDialog(){
  const order = ['#quiz','#teller','#sheet','#tour-panel','#stories-panel','#progress-panel','#sponsor-panel'];
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

function wireUi(){
  $('#sheet-close').onclick = ()=>{ stopSpeaking(); $('#sheet').setAttribute('aria-hidden','true'); };
  $('#tour-close').onclick = ()=> closePanel('#tour-panel');
  $('#progress-close').onclick = ()=> closePanel('#progress-panel');
  $('#progress-btn').onclick = openProgress;
  $('#lang-btn').onclick = ()=>{ lang = (lang==='sv'?'en':'sv'); localStorage.setItem('mjolby_lang', lang); location.reload(); };
  $('#stories-btn').onclick = openStories;
  $('#stories-close').onclick = ()=> closePanel('#stories-panel');
  $('#stories-q').oninput = e=> renderStories(e.target.value);
  $('#sponsor-close').onclick = ()=> closePanel('#sponsor-panel');
  $('#quiz').onclick = e=>{ if(e.target.id==='quiz') $('#quiz').setAttribute('aria-hidden','true'); };
  $('#teller').onclick = e=>{ if(e.target.id==='teller'){ $('#teller').setAttribute('aria-hidden','true'); restoreFocus(); } };

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

init();
