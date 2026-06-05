// Mjölby Stadsvandring — PWA prototype
// Data: mjolby_kunskapsdatabas.json (knowledge base)
import { STORIES, EXTRA_IMAGES } from './content.js';
import { STORYTELLERS, ACTIVE_CITY } from './storytellers.js';

const TELLER = STORYTELLERS[ACTIVE_CITY] || null;
const TELLER_SEEN_KEY = 'mjolby_teller_seen_v1';

/* ---------- Stop-type model (the 4 pitch types) ---------- */
const TYPES = {
  story: { label: 'Berättelse', color: '#1657C9', tag: 'Ingår i kommunens abonnemang' },
  assoc: { label: 'Förening',   color: '#2E8C63', tag: 'Gratis / bidragsfinansierat' },
  biz:   { label: 'Affär',      color: '#E0A100', tag: 'Sponsrat erbjudande' },
  info:  { label: 'InfoPin',    color: '#6B4BC4', tag: 'Praktiskt & neutralt' },
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
const STAMP_KEY = 'mjolby_stamps_v1';

const $ = sel => document.querySelector(sel);
const stamps = () => new Set(JSON.parse(localStorage.getItem(STAMP_KEY) || '[]'));
const saveStamps = set => localStorage.setItem(STAMP_KEY, JSON.stringify([...set]));
const typeOf = e => CATEGORY_TYPE[e.category] || 'story';
const hasCoords = e => e.coordinates && typeof e.coordinates.lat === 'number';
const imgUrl = e => (e.images && e.images[0] && e.images[0].url) || (EXTRA_IMAGES[e.id] && EXTRA_IMAGES[e.id].url) || null;
const imgCredit = e => (e.images && e.images[0] && e.images[0].attribution) || (EXTRA_IMAGES[e.id] && EXTRA_IMAGES[e.id].attribution) || null;
const iconOf = e => CATEGORY_ICON[e.category] || '📍';

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
      b.style.cssText='width:34px;height:34px;line-height:34px;text-align:center;font-size:17px;background:#fff';
      L.DomEvent.on(b,'click',ev=>{ L.DomEvent.preventDefault(ev); locate(); });
      return b;
    }
  });
  map.addControl(new Loc());
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
  const chips = [['all','Alla platser', ENTRIES.length+' stopp']]
    .concat(Object.entries(TOURS).map(([k,t])=>[k, t.name, DATA.filter(t.test).length+' stopp']));
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
  const t = TOURS[key];
  $('#tour-title').textContent = t.name;
  $('#tour-sub').textContent = t.sub;
  const st = stamps();
  const list = orderedTourEntries(key);
  $('#tour-stops').innerHTML = list.map((e,i)=>{
    const ty = TYPES[typeOf(e)];
    const done = st.has(e.id);
    const img = imgUrl(e), icon = iconOf(e);
    const thumb = img
      ? `<span class="stop-thumb">
           <img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer"
                onerror="this.remove();this.parentElement.classList.add('ph');this.parentElement.insertAdjacentText('afterbegin','${icon}')">
           <span class="stop-no" style="background:${ty.color}">${i+1}</span></span>`
      : `<span class="stop-thumb ph">${icon}<span class="stop-no" style="background:${ty.color}">${i+1}</span></span>`;
    return `<li class="stop-row" data-id="${e.id}">
      ${thumb}
      <span class="stop-meta"><b>${e.name}</b><small>${ty.label} · ${e.era||''}</small></span>
      ${done?'<span class="tick">✓</span>':''}
    </li>`;
  }).join('');
  $('#tour-stops').querySelectorAll('.stop-row').forEach(r=>{
    r.onclick = ()=> openSheet(r.dataset.id);
  });
  $('#tour-quiz-btn').onclick = ()=> startQuiz(key);
  openPanel('#tour-panel');
}

/* ---------- Filters ---------- */
function buildFilters(){
  const wrap = $('#filters');
  wrap.innerHTML = Object.entries(TYPES).map(([k,t])=>
    `<button class="fchip" data-type="${k}" aria-pressed="true">
       <span class="dot" style="background:${t.color}"></span>${t.label}
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
    .map(s=>`<a href="${s}" target="_blank" rel="noopener">källa</a>`).join(' · ');

  const heroPh = `<div class="hero-ph"><span>${icon}</span></div>`;
  const hero = img
    ? `<div class="hero">
         <img src="${img}" alt="${e.name}" loading="eager" referrerpolicy="no-referrer"
              onerror="this.closest('.hero').outerHTML='<div class=&quot;hero&quot;>${heroPh}</div>'">
         ${credit?`<span class="credit">📷 ${credit}</span>`:''}
       </div>`
    : `<div class="hero">${heroPh}</div>`;

  $('#sheet-inner').innerHTML = `
    ${hero}
    <div class="sheet-pad">
      <span class="type-tag" style="background:${ty.color}">${icon} ${ty.label}</span>
      <h2>${e.name}</h2>
      ${e.era?`<div class="era">${e.era}</div>`:''}
      ${e.summary?`<p class="lead">${e.summary}</p>`:''}
      ${tellerBubble(id)}
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
             ${visited?'✓ Incheckad – stämpel sparad':'Checka in & samla stämpel'}
           </button>`
        : ''}
      ${e.address?`<p class="addr">📍 ${e.address}${mapsHref?` · <a href="${mapsHref}" target="_blank" rel="noopener">vägbeskrivning</a>`:''}</p>`:''}
      ${srcs?`<p class="srcs">${srcs}</p>`:''}
    </div>`;

  const btn = $('#checkin-btn');
  if (btn) btn.onclick = ()=> toggleCheckin(id);
  const sp = $('#sheet-inner [data-sponsor]');
  if (sp) sp.onclick = openSponsor;

  $('#sheet').setAttribute('aria-hidden','false');
  if (hasCoords(e)) map.panTo([e.coordinates.lat, e.coordinates.lng], { animate:true });
}

function toggleCheckin(id){
  const set = stamps();
  if (set.has(id)){ set.delete(id); } else { set.add(id); toast('🏅 Stämpel insamlad!'); }
  saveStamps(set);
  updateStampBadge();
  renderMarkers();
  openSheet(id); // refresh button + pin state
  if (activeTour) openTourPanel(activeTour); // refresh ticks silently
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
      <div class="prog-box"><b>${set.size}</b><small>stämplar</small></div>
      <div class="prog-box"><b>${pct}%</b><small>av staden</small></div>
      <div class="prog-box"><b>${total}</b><small>stopp totalt</small></div>
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
        return `<div class="sp-row" data-id="${r.e.id}">
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

  const render = ()=>{
    const q = bank[i];
    card.innerHTML = `
      <div class="quiz-progress">Fråga ${i+1} / ${bank.length}</div>
      <h3>${TOURS[tourKey].name}</h3>
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
        <p class="quiz-q">${score===bank.length?'Stadsvandrarmästare! 🏆':score>=bank.length/2?'Bra jobbat! 👏':'Gå vandringen igen och samla fler fakta. 🚶'}</p>
        <button class="cta" id="quiz-done" style="margin:8px 0 0">Klar</button>
      </div>`;
    card.querySelector('#quiz-done').onclick = ()=> overlay.setAttribute('aria-hidden','true');
  };
  render();
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
    const ty = TYPES[typeOf(e)], img = imgUrl(e), icon = iconOf(e);
    const onMap = hasCoords(e);
    const thumb = img
      ? `<span class="stop-thumb"><img src="${img}" alt="" loading="lazy" referrerpolicy="no-referrer"
            onerror="this.remove();this.parentElement.classList.add('ph');this.parentElement.insertAdjacentText('afterbegin','${icon}')"></span>`
      : `<span class="stop-thumb ph">${icon}</span>`;
    return `<li class="stop-row" data-id="${e.id}">
      ${thumb}
      <span class="stop-meta"><b>${e.name}</b><small>${CAT_LABEL[e.category]||''}${onMap?'':' · endast berättelse'}</small></span>
      ${st.has(e.id)?'<span class="tick">✓</span>':''}
    </li>`;
  }).join('') || `<li class="stories-empty">Inget hittades.</li>`;
  $('#stories-list').querySelectorAll('.stop-row').forEach(r=>{
    r.onclick = ()=> openSheet(r.dataset.id);
  });
}
function openStories(){ renderStories($('#stories-q').value); openPanel('#stories-panel'); }

/* ---------- Stadens berättare (storyteller) ---------- */
function setupTeller(){
  const bar = $('#tellerbar');
  if (!TELLER){ bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML =
    `<span class="tb-av">${tellerAvatar()}</span>
     <span class="tb-text">Berättad av <b>${TELLER.name}</b><small>${TELLER.role||''}</small></span>
     <span class="tb-go">Möt mig ›</span>`;
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
  const say = tellerRemark(id);
  if (!say) return '';
  return `<div class="teller-say">
    <span class="ts-av">${tellerAvatar()}</span>
    <div class="ts-body"><b>${TELLER.name}</b><p>${say}</p></div>
  </div>`;
}

function openTeller(firstTime){
  const t = TELLER; if (!t) return;
  const v = t.voice || {};
  const greet = (t.greeting||'').split(/\n\n+/).map(p=>`<p>${p}</p>`).join('');
  const traits = (v.traits||[]).map(x=>`<li>${x}</li>`).join('');
  const phrases = (v.phrases||[]).map(x=>`<span class="vphrase">${x}</span>`).join('');
  const entry = t.entryId && DATA.find(x=>x.id===t.entryId);

  $('#teller-card').innerHTML = `
    <button class="teller-x" id="teller-x" aria-label="Stäng">&times;</button>
    <div class="teller-hd">
      <span class="teller-bigav">${t.portrait?`<img class="av-img" src="${t.portrait}" alt="${t.name}">`:(t.avatar||'💬')}</span>
      <div>
        <h3>${t.name}</h3>
        <small>${[t.realName, t.years].filter(Boolean).join(' · ')}</small>
        <div class="teller-role">${t.role||''}</div>
      </div>
    </div>
    ${v.tagline?`<p class="teller-tagline">”${v.tagline}”</p>`:''}
    <div class="teller-greet">${greet}</div>
    ${(traits||phrases)?`
      <div class="voice-card">
        <div class="vc-h">🎙️ Så här pratar jag</div>
        ${v.summary?`<p class="vc-sum">${v.summary}</p>`:''}
        ${traits?`<ul class="vtraits">${traits}</ul>`:''}
        ${phrases?`<div class="vphrases">${phrases}</div>`:''}
      </div>`:''}
    ${v.signoff?`<p class="teller-sign">${v.signoff}</p>`:''}
    <button class="cta teller-go" id="teller-go" style="margin:6px 0 8px">${firstTime?'Följ med mig →':'Tillbaka till kartan'}</button>
    ${entry?`<button class="teller-more" id="teller-more">Läs mer om ${t.name} i appen</button>`:''}
    <p class="teller-scale">Varje stad kan ha sin egen berättare. I ${t.city} är det ja.</p>`;

  $('#teller').setAttribute('aria-hidden','false');
  localStorage.setItem(TELLER_SEEN_KEY, '1');
  const close = ()=> $('#teller').setAttribute('aria-hidden','true');
  $('#teller-x').onclick = close;
  $('#teller-go').onclick = close;
  const more = $('#teller-more');
  if (more) more.onclick = ()=>{ close(); openSheet(t.entryId); };
}

/* ---------- Geolocation ---------- */
function locate(){
  if (!navigator.geolocation){ toast('Platstjänst stöds inte'); return; }
  toast('Letar efter din position…');
  navigator.geolocation.getCurrentPosition(
    pos=>{
      const ll=[pos.coords.latitude, pos.coords.longitude];
      if (meMarker) meMarker.remove();
      meMarker = L.marker(ll, { icon:L.divIcon({className:'',html:'<div class="me-dot"></div>',iconSize:[18,18],iconAnchor:[9,9]}) }).addTo(map);
      map.setView(ll, 15);
    },
    ()=> toast('Kunde inte hämta position'),
    { enableHighAccuracy:true, timeout:8000 }
  );
}

/* ---------- Panels / helpers ---------- */
function openPanel(sel){ $(sel).setAttribute('aria-hidden','false'); }
function closePanel(sel){ $(sel).setAttribute('aria-hidden','true'); }
let toastT;
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),2200);
}

function wireUi(){
  $('#sheet-close').onclick = ()=> $('#sheet').setAttribute('aria-hidden','true');
  $('#tour-close').onclick = ()=> closePanel('#tour-panel');
  $('#progress-close').onclick = ()=> closePanel('#progress-panel');
  $('#progress-btn').onclick = openProgress;
  $('#stories-btn').onclick = openStories;
  $('#stories-close').onclick = ()=> closePanel('#stories-panel');
  $('#stories-q').oninput = e=> renderStories(e.target.value);
  $('#sponsor-close').onclick = ()=> closePanel('#sponsor-panel');
  $('#quiz').onclick = e=>{ if(e.target.id==='quiz') $('#quiz').setAttribute('aria-hidden','true'); };
  $('#teller').onclick = e=>{ if(e.target.id==='teller') $('#teller').setAttribute('aria-hidden','true'); };
}

init();
