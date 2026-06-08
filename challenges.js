// Stadsutmaning — geocaching-tävlingar för Strosa.
// Helt klientsidan: tävlingen kodas i URL:ens hash, resultat delas som koder.
// Isolerad modul: når app.js bara via context-objektet (se initChallenges).

/* ---------- Context (sätts av app.js) ---------- */
let ctx = null;
let lastPos = null;       // [lat,lng] senast kända position
let play = null;          // { challenge, progress } pågående spel
let currentTask = null;   // stopp-objektet som visas i uppgiftsmodalen
let pendingChallenge = null, pendingResult = null;

const $ = sel => document.querySelector(sel);
const t = k => (ctx ? ctx.t(k) : k);
const isEn = () => ctx && ctx.lang === 'en';
const now = () => Date.now();

/* ---------- localStorage-nycklar ---------- */
const CH_KEY    = 'mjolby_challenges_v1';
const PROG_KEY  = 'mjolby_challenge_progress_v1';
const RUNS_KEY  = 'mjolby_challenge_runs_v1';
const DRAFT_KEY = 'mjolby_challenge_drafts_v1';
const RES_KEY   = 'mjolby_challenge_results_v1';
const CHPHOTO_KEY = 'mjolby_challenge_photos_v1';

const loadObj = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch(e){ return {}; } };
const loadArr = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch(e){ return []; } };
const saveJSON = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){ ctx && ctx.toast('Minnet är fullt'); } };

const challenges = () => loadObj(CH_KEY);
const saveChallenge = (c) => { const all = challenges(); all[c.id] = c; saveJSON(CH_KEY, all); };
const progressAll = () => loadObj(PROG_KEY);
const progressFor = (id) => progressAll()[id] || null;
const saveProgress = (id,p) => { const all = progressAll(); all[id] = p; saveJSON(PROG_KEY, all); };
const runs = () => loadArr(RUNS_KEY);
const addRun = (r) => { const all = runs(); all.push(r); saveJSON(RUNS_KEY, all); };
const resultsFor = (id) => loadObj(RES_KEY)[id] || [];
const saveResults = (id, arr) => { const all = loadObj(RES_KEY); all[id] = arr; saveJSON(RES_KEY, all); };
const chPhotos = () => loadObj(CHPHOTO_KEY);
const saveChPhoto = (key, dataUrl) => { const all = chPhotos(); all[key] = dataUrl; saveJSON(CHPHOTO_KEY, all); };

/* ---------- base64url (UTF-8-säker, klarar åäö) ---------- */
function enc(obj){
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function dec(s){
  const b = s.replace(/-/g,'+').replace(/_/g,'/');
  const bin = atob(b);
  const arr = Uint8Array.from(bin, c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(arr));
}

/* ---------- diverse helpers ---------- */
const esc = (s='') => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const genId = () => 'c_' + Math.random().toString(36).slice(2,8);
const baseUrl = () => location.origin + location.pathname;
const entryById = (id) => ctx.DATA.find(x => x.id === id);
const TASK_ICON = { visit:'📍', quiz:'❓', photo:'📸', code:'🔑' };
const TASK_DEFAULT_POINTS = { visit:10, quiz:20, photo:15, code:25 };

function taskLabel(type){
  return { visit:t('ch_task_visit'), quiz:t('ch_task_quiz'), photo:t('ch_task_photo'), code:t('ch_task_code') }[type] || type;
}
function fmtDur(ms){
  if (!ms || ms < 0) return '–';
  const s = Math.round(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
  if (h) return h + 'h ' + (m%60) + 'm';
  if (m) return m + 'm ' + (s%60) + 's';
  return s + 's';
}
function maxScore(c){ return c.stops.reduce((a,s)=>a + (s.points||0), 0); }
function windowState(c){
  if (!c.window || (!c.window.start && !c.window.end)) return { state:'none', text:'' };
  const n = now();
  const start = c.window.start ? Date.parse(c.window.start) : null;
  const end   = c.window.end ? Date.parse(c.window.end) : null;
  if (start && n < start) return { state:'upcoming', text: t('ch_window_upcoming') + ' ' + new Date(start).toLocaleString(isEn()?'en-GB':'sv-SE') };
  if (end && n > end)     return { state:'closed', text: t('ch_window_closed') };
  return { state:'open', text: t('ch_window_open') + (end ? ' · ' + new Date(end).toLocaleString(isEn()?'en-GB':'sv-SE') : '') };
}

/* =====================================================================
   INIT + URL-detektion
   ===================================================================== */
export function detectChallengeInUrl(){
  const h = location.hash || '';
  const mC = h.match(/[#&]challenge=([^&]+)/);
  const mR = h.match(/[#&]result=([^&]+)/);
  if (mC){ try { pendingChallenge = dec(decodeURIComponent(mC[1])); } catch(e){ pendingChallenge = '__bad__'; } }
  if (mR){ try { pendingResult = dec(decodeURIComponent(mR[1])); } catch(e){ pendingResult = '__bad__'; } }
  if (mC || mR){ try { history.replaceState(null, '', location.pathname + location.search); } catch(e){} }
}

export function initChallenges(context){
  ctx = context;
  // Stängknappar
  wireClose('#cb-close', '#challenge-builder');
  wireClose('#cp-close', '#challenge-play');
  wireClose('#cr-close', '#challenge-results');
  const taskOv = $('#challenge-task');
  if (taskOv) taskOv.onclick = e => { if (e.target.id === 'challenge-task') closeTask(); };

  // Positionsuppdateringar (geo-incheckning + avståndsledtrådar)
  if (ctx.onPosition) ctx.onPosition(ll => { lastPos = ll; onPositionUpdate(); });

  // Hantera ev. inkommande länk
  if (pendingChallenge === '__bad__' || pendingResult === '__bad__'){
    ctx.toast(t('ch_bad_link'));
  }
  if (pendingChallenge && pendingChallenge !== '__bad__'){
    saveChallenge(pendingChallenge);
    openJoin(pendingChallenge);
  } else if (pendingResult && pendingResult !== '__bad__'){
    ingestResult(pendingResult);
    openResults(pendingResult.challengeId);
  }
  pendingChallenge = pendingResult = null;
}

function wireClose(btnSel, panelSel){
  const b = $(btnSel); if (b) b.onclick = () => ctx.closePanel(panelSel);
}

function onPositionUpdate(){
  // Live-avstånd i spelvyn + aktivera incheckning i öppen visit-uppgift
  if (play && $('#challenge-play').getAttribute('aria-hidden') === 'false') renderPlay();
  if (currentTask && currentTask.task.type === 'visit' &&
      $('#challenge-task').getAttribute('aria-hidden') === 'false') renderTask(currentTask);
}

/* =====================================================================
   PROFIL-INTEGRATION (skapa / resultat / körhistorik)
   ===================================================================== */
export function mountChallengeProfile(container){
  if (!container) return;
  const section = document.createElement('div');
  section.className = 'ch-prof';
  section.innerHTML = `
    <h3 class="prof-h">🏁 ${t('ch_section')}</h3>
    <p class="ch-prof-sub">${t('ch_create_sub')}</p>
    <button class="ch-btn-primary" id="ch-create">🏁 ${t('ch_create')}</button>
    <button class="ch-btn-ghost" id="ch-results">🏆 ${t('ch_results')}</button>
    <div id="ch-runs"></div>`;
  container.appendChild(section);
  $('#ch-create').onclick = openBuilder;
  $('#ch-results').onclick = () => openResultsPicker();
  renderRunHistory();
}

function renderRunHistory(){
  const box = $('#ch-runs'); if (!box) return;
  const list = runs().slice().reverse();
  if (!list.length){ box.innerHTML = `<p class="ch-empty">${t('ch_no_runs')}</p>`; return; }
  box.innerHTML = `<h4 class="ch-runs-h">${t('ch_my_runs')}</h4>` + list.map(r => `
    <div class="ch-run">
      <span class="ch-run-meta"><b>${esc(r.challengeTitle)}</b>
        <small>${esc(r.player)} · ${new Date(r.finishedAt).toLocaleDateString(isEn()?'en-GB':'sv-SE')}</small></span>
      <span class="ch-run-score">${r.score}<small>/${r.maxScore}</small></span>
    </div>`).join('');
}

/* =====================================================================
   BYGGARE (arrangör)
   ===================================================================== */
let draft = null;

function blankDraft(){
  return { title:'', intro:'', org:{ name:'', kind:'skola' }, timed:false,
           window:{ start:'', end:'' }, stops:[] };
}
function openBuilder(){
  draft = loadObj(DRAFT_KEY);
  if (!draft || !draft.stops) draft = blankDraft();
  renderBuilder();
  ctx.openPanel('#challenge-builder');
}
function persistDraft(){ saveJSON(DRAFT_KEY, draft); }

function renderBuilder(){
  const kinds = [['skola', t('ch_org_school')], ['foretag', t('ch_org_company')], ['myndighet', t('ch_org_authority')]];
  $('#cb-title').textContent = t('ch_builder_title');
  $('#cb-body').innerHTML = `
    <div class="cb-pad">
      <label class="cb-l">${t('ch_field_title')}</label>
      <input class="cb-in" id="cb-f-title" value="${esc(draft.title)}" placeholder="${esc(t('ch_title_ph'))}">

      <label class="cb-l">${t('ch_field_intro')}</label>
      <textarea class="cb-in cb-ta" id="cb-f-intro" rows="2" placeholder="${esc(t('ch_intro_ph'))}">${esc(draft.intro)}</textarea>

      <label class="cb-l">${t('ch_field_org')}</label>
      <input class="cb-in" id="cb-f-org" value="${esc(draft.org.name)}" placeholder="${esc(t('ch_org_ph'))}">
      <div class="ch-seg" id="cb-org-kind">
        ${kinds.map(([k,l])=>`<button data-kind="${k}" class="${draft.org.kind===k?'on':''}">${l}</button>`).join('')}
      </div>

      <label class="cb-check"><input type="checkbox" id="cb-f-timed" ${draft.timed?'checked':''}> ${t('ch_timed')}</label>
      <div id="cb-window" class="${draft.timed?'':'cb-hidden'}">
        <label class="cb-l">${t('ch_start_time')}</label>
        <input class="cb-in" id="cb-f-start" type="datetime-local" value="${esc(draft.window.start)}">
        <label class="cb-l">${t('ch_end_time')}</label>
        <input class="cb-in" id="cb-f-end" type="datetime-local" value="${esc(draft.window.end)}">
      </div>

      <h4 class="cb-h">${t('ch_selected')} <span class="cb-count" id="cb-count">${draft.stops.length}</span></h4>
      <div id="cb-selected"></div>

      <h4 class="cb-h">${t('ch_add_stops')}</h4>
      <input class="cb-in" id="cb-search" type="search" placeholder="${esc(t('ch_search_stops'))}">
      <div id="cb-picker" class="cb-picker"></div>

      <button class="ch-btn-primary cb-generate" id="cb-generate">🔗 ${t('ch_generate')}</button>
    </div>`;

  // Bind textfält → draft (ingen omrendering vid skrift)
  $('#cb-f-title').oninput = e => { draft.title = e.target.value; persistDraft(); };
  $('#cb-f-intro').oninput = e => { draft.intro = e.target.value; persistDraft(); };
  $('#cb-f-org').oninput   = e => { draft.org.name = e.target.value; persistDraft(); };
  $('#cb-org-kind').querySelectorAll('button').forEach(b => b.onclick = () => {
    draft.org.kind = b.dataset.kind; persistDraft();
    $('#cb-org-kind').querySelectorAll('button').forEach(x => x.classList.toggle('on', x===b));
  });
  $('#cb-f-timed').onchange = e => {
    draft.timed = e.target.checked; persistDraft();
    $('#cb-window').classList.toggle('cb-hidden', !draft.timed);
  };
  const bindWin = (id,key) => { const el = $(id); if (el) el.oninput = e => { draft.window[key] = e.target.value; persistDraft(); }; };
  bindWin('#cb-f-start','start'); bindWin('#cb-f-end','end');
  $('#cb-search').oninput = e => filterPicker(e.target.value);
  $('#cb-generate').onclick = generate;

  renderSelected();
  renderPicker();
}

function renderSelected(){
  const box = $('#cb-selected');
  $('#cb-count').textContent = draft.stops.length;
  if (!draft.stops.length){ box.innerHTML = `<p class="ch-empty">${t('ch_no_selected')}</p>`; return; }
  box.innerHTML = draft.stops.map((s,i)=>{
    const e = entryById(s.id) || { name: s.id };
    const seg = ['visit','quiz','photo','code'].map(ty =>
      `<button data-type="${ty}" class="${s.task.type===ty?'on':''}">${TASK_ICON[ty]} ${taskLabel(ty)}</button>`).join('');
    let fields = '';
    if (s.task.type === 'quiz'){
      const opts = s.task.opts || ['','',''];
      fields = `
        <label class="cb-l">${t('ch_quiz_q')}</label>
        <input class="cb-in cb-task-f" data-f="q" value="${esc(s.task.q||'')}">
        <label class="cb-l">${t('ch_quiz_opts')}</label>
        ${opts.map((o,oi)=>`<div class="cb-opt-row">
            <input type="radio" name="ans-${i}" data-ans="${oi}" ${s.task.answer===oi?'checked':''} aria-label="${t('ch_quiz_answer')}">
            <input class="cb-in cb-opt-f" data-opt="${oi}" value="${esc(o)}" placeholder="${t('ch_quiz_opt')} ${oi+1}">
          </div>`).join('')}`;
    } else if (s.task.type === 'photo'){
      fields = `<label class="cb-l">${t('ch_photo_prompt')}</label>
        <input class="cb-in cb-task-f" data-f="prompt" value="${esc(s.task.prompt||'')}" placeholder="${esc(t('ch_photo_ph'))}">`;
    } else if (s.task.type === 'code'){
      fields = `<label class="cb-l">${t('ch_code_prompt')}</label>
        <input class="cb-in cb-task-f" data-f="prompt" value="${esc(s.task.prompt||'')}" placeholder="${esc(t('ch_code_ph'))}">
        <label class="cb-l">${t('ch_code_answer')}</label>
        <input class="cb-in cb-task-f" data-f="code" value="${esc(s.task.code||'')}">
        <label class="cb-check"><input type="checkbox" class="cb-case" ${s.task.caseSensitive?'checked':''}> ${t('ch_code_case')}</label>`;
    } else {
      fields = `<p class="cb-hint">${t('ch_visit_hint')}</p>`;
    }
    return `<div class="ch-task-card" data-i="${i}">
      <div class="ctc-head">
        <b>${i+1}. ${esc(e.name)}</b>
        <span class="ctc-tools">
          <button class="ctc-mv" data-mv="up" aria-label="${t('ch_up')}">▲</button>
          <button class="ctc-mv" data-mv="down" aria-label="${t('ch_down')}">▼</button>
          <button class="ctc-rm" aria-label="${t('ch_remove')}">✕</button>
        </span>
      </div>
      <div class="ch-seg ctc-seg">${seg}</div>
      ${fields}
      <label class="cb-l">${t('ch_points')}</label>
      <input class="cb-in cb-points" type="number" min="0" max="500" value="${s.points}">
    </div>`;
  }).join('');

  box.querySelectorAll('.ch-task-card').forEach(card => {
    const i = +card.dataset.i, s = draft.stops[i];
    card.querySelector('.ctc-rm').onclick = () => { draft.stops.splice(i,1); persistDraft(); renderSelected(); syncPickerState(); };
    card.querySelectorAll('.ctc-mv').forEach(btn => btn.onclick = () => {
      const dir = btn.dataset.mv === 'up' ? -1 : 1, j = i + dir;
      if (j < 0 || j >= draft.stops.length) return;
      const tmp = draft.stops[i]; draft.stops[i] = draft.stops[j]; draft.stops[j] = tmp;
      persistDraft(); renderSelected();
    });
    card.querySelectorAll('.ctc-seg button').forEach(b => b.onclick = () => {
      const ty = b.dataset.type;
      s.task = defaultTask(ty);
      s.points = TASK_DEFAULT_POINTS[ty];
      persistDraft(); renderSelected();
    });
    card.querySelectorAll('.cb-task-f').forEach(inp => inp.oninput = () => { s.task[inp.dataset.f] = inp.value; persistDraft(); });
    card.querySelectorAll('.cb-opt-f').forEach(inp => inp.oninput = () => {
      if (!s.task.opts) s.task.opts = ['','',''];
      s.task.opts[+inp.dataset.opt] = inp.value; persistDraft();
    });
    card.querySelectorAll('[data-ans]').forEach(r => r.onchange = () => { s.task.answer = +r.dataset.ans; persistDraft(); });
    const caseEl = card.querySelector('.cb-case');
    if (caseEl) caseEl.onchange = () => { s.task.caseSensitive = caseEl.checked; persistDraft(); };
    card.querySelector('.cb-points').oninput = (e) => { s.points = parseInt(e.target.value,10) || 0; persistDraft(); };
  });
}

function defaultTask(type){
  if (type === 'quiz') return { type:'quiz', q:'', opts:['','',''], answer:0 };
  if (type === 'photo') return { type:'photo', prompt:'' };
  if (type === 'code')  return { type:'code', prompt:'', code:'', caseSensitive:false };
  return { type:'visit' };
}

function renderPicker(){
  const box = $('#cb-picker');
  box.innerHTML = ctx.ENTRIES.map(e => {
    const on = draft.stops.some(s => s.id === e.id);
    return `<button class="cb-pick ${on?'on':''}" data-id="${e.id}">
      ${ctx.stopThumb(e)}
      <span class="stop-meta"><b>${esc(e.name)}</b><small>${esc(ctx.CAT_LABEL[e.category]||'')}</small></span>
      <span class="cb-pick-add">${on?'✓':'+'}</span>
    </button>`;
  }).join('');
  box.querySelectorAll('.cb-pick').forEach(b => b.onclick = () => togglePick(b.dataset.id));
}
function togglePick(id){
  const idx = draft.stops.findIndex(s => s.id === id);
  if (idx >= 0) draft.stops.splice(idx,1);
  else draft.stops.push({ id, points: TASK_DEFAULT_POINTS.visit, task: defaultTask('visit') });
  persistDraft(); renderSelected(); syncPickerState();
}
function syncPickerState(){
  $('#cb-picker').querySelectorAll('.cb-pick').forEach(b => {
    const on = draft.stops.some(s => s.id === b.dataset.id);
    b.classList.toggle('on', on);
    b.querySelector('.cb-pick-add').textContent = on ? '✓' : '+';
  });
}
function filterPicker(q){
  q = (q||'').toLowerCase().trim();
  $('#cb-picker').querySelectorAll('.cb-pick').forEach(b => {
    const e = entryById(b.dataset.id);
    const hay = (e.name + ' ' + (ctx.CAT_LABEL[e.category]||'')).toLowerCase();
    b.style.display = (!q || hay.includes(q)) ? '' : 'none';
  });
}

function validateDraft(){
  if (!draft.title.trim()) return t('ch_need_title');
  if (!draft.stops.length) return t('ch_need_stops');
  for (const s of draft.stops){
    if (s.task.type === 'quiz'){
      const opts = (s.task.opts||[]).filter(o => o.trim());
      if (!s.task.q.trim() || opts.length < 2) return t('ch_need_quiz');
    }
    if (s.task.type === 'code' && !(s.task.code||'').trim()) return t('ch_need_code');
  }
  return null;
}

function generate(){
  const err = validateDraft();
  if (err){ ctx.toast(err); return; }
  // Bygg en kompakt tävling (städa bort tomma fält)
  const challenge = {
    v:1, id: genId(), title: draft.title.trim(), intro: (draft.intro||'').trim(),
    org: { name: (draft.org.name||'').trim(), kind: draft.org.kind },
    stops: draft.stops.map(s => {
      const task = { type: s.task.type };
      if (s.task.type === 'quiz'){
        task.q = s.task.q.trim();
        task.opts = s.task.opts.map(o => o.trim()).filter(Boolean);
        task.answer = Math.min(s.task.answer||0, task.opts.length-1);
      } else if (s.task.type === 'photo'){ if (s.task.prompt) task.prompt = s.task.prompt.trim(); }
      else if (s.task.type === 'code'){
        task.code = s.task.code.trim();
        if (s.task.prompt) task.prompt = s.task.prompt.trim();
        if (s.task.caseSensitive) task.caseSensitive = true;
      }
      return { id: s.id, points: s.points||0, task };
    }),
  };
  if (draft.timed && (draft.window.start || draft.window.end))
    challenge.window = { start: draft.window.start, end: draft.window.end };

  saveChallenge(challenge);
  localStorage.removeItem(DRAFT_KEY);
  draft = blankDraft();
  showGenerated(challenge);
}

function showGenerated(challenge){
  const link = baseUrl() + '#challenge=' + enc(challenge);
  const size = link.length;
  // Storleksvarning för QR
  let meter = 'ok', meterTxt = t('ch_qr_ok');
  if (size > 2000){ meter = 'bad'; meterTxt = t('ch_qr_big'); }
  else if (size > 1200){ meter = 'warn'; meterTxt = t('ch_qr_warn'); }

  let qrSvg = '';
  try { qrSvg = (self.StrosaQR || window.StrosaQR).svg(link, { scale:5, ecc:'M', dark:'#2F2A20', light:'#FFFDF7' }); }
  catch(e){ qrSvg = `<p class="ch-empty">${t('ch_qr_fail')}</p>`; }

  $('#cb-title').textContent = challenge.title;
  $('#cb-body').innerHTML = `
    <div class="cb-pad ch-gen">
      <div class="ch-gen-emoji">🎉</div>
      <h3 class="ch-gen-h">${esc(challenge.title)}</h3>
      <p class="ch-gen-sub">${challenge.stops.length} ${t('ch_stops')} · ${maxScore(challenge)} ${t('ch_points_short')}</p>
      <div class="ch-qr" id="ch-qr">${qrSvg}</div>
      <p class="ch-size-meter ${meter}">${meterTxt}</p>
      <div class="ch-codebox"><input id="ch-link" readonly value="${esc(link)}"></div>
      <div class="ch-row2">
        <button class="ch-btn-primary" id="ch-copy">📋 ${t('ch_copy')}</button>
        <button class="ch-btn-ghost" id="ch-share">📤 ${t('ch_share')}</button>
      </div>
      <button class="ch-btn-ghost" id="ch-print">🖨️ ${t('ch_print')}</button>
      <button class="ch-btn-ghost" id="ch-newedit">✏️ ${t('ch_new')}</button>
      <p class="ch-prof-sub">${t('ch_gen_hint')}</p>
    </div>`;
  $('#ch-copy').onclick = () => copyText(link);
  $('#ch-share').onclick = () => shareLink(challenge, link);
  $('#ch-print').onclick = () => printQr(challenge, qrSvg, link);
  $('#ch-newedit').onclick = () => { draft = blankDraft(); renderBuilder(); };
}

function copyText(text){
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(()=>ctx.toast(t('ch_copied')), ()=>fallbackCopy(text));
  } else fallbackCopy(text);
}
function fallbackCopy(text){
  const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
  ta.select(); try { document.execCommand('copy'); ctx.toast(t('ch_copied')); } catch(e){}
  document.body.removeChild(ta);
}
async function shareLink(challenge, link){
  const text = (isEn()?'Join the city challenge: ':'Var med i stadsutmaningen: ') + challenge.title;
  try {
    if (navigator.share){ await navigator.share({ title:'Strosa', text, url: link }); return; }
  } catch(e){ return; }
  copyText(link);
}
function printQr(challenge, qrSvg, link){
  const w = window.open('', '_blank');
  if (!w){ ctx.toast(t('ch_copied')); return; }
  w.document.write(`<!doctype html><meta charset="utf-8"><title>${esc(challenge.title)}</title>
    <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px;color:#2F2A20}
    h1{font-size:28px}.q{width:320px;margin:18px auto}p{color:#555;word-break:break-all;font-size:12px}</style>
    <h1>🏁 ${esc(challenge.title)}</h1>
    <p>${esc(challenge.org.name||'')}</p>
    <div class="q">${qrSvg}</div>
    <p>${esc(link)}</p>`);
  w.document.close(); w.focus(); setTimeout(()=>{ try{ w.print(); }catch(e){} }, 250);
}

/* =====================================================================
   SPELLÄGE (elev)
   ===================================================================== */
function openJoin(challenge){
  saveChallenge(challenge);
  const ws = windowState(challenge);
  const existing = progressFor(challenge.id);
  const resume = existing && !existing.finishedAt;
  $('#cp-title').textContent = challenge.title;
  $('#cp-body').innerHTML = `
    <div class="cp-pad cp-join">
      <div class="cp-badge">🏁 ${esc(orgKindLabel(challenge.org.kind))}${challenge.org.name?' · '+esc(challenge.org.name):''}</div>
      <h2 class="cp-h">${esc(challenge.title)}</h2>
      ${challenge.intro?`<p class="cp-intro">${esc(challenge.intro)}</p>`:''}
      ${ws.state!=='none'?`<p class="cp-window ${ws.state}">${ws.text}</p>`:''}
      <ul class="cp-facts">
        <li><b>${challenge.stops.length}</b> ${t('ch_stops')}</li>
        <li><b>${maxScore(challenge)}</b> ${t('ch_points_short')}</li>
        <li>${challenge.stops.map(s=>TASK_ICON[s.task.type]).filter((v,i,a)=>a.indexOf(v)===i).join(' ')}</li>
      </ul>
      <label class="cb-l">${t('ch_join_name')}</label>
      <input class="cb-in" id="cp-name" value="${existing?esc(existing.player||''):''}" placeholder="${esc(t('ch_join_team_ph'))}">
      ${resume
        ? `<button class="ch-btn-primary" id="cp-continue">▶︎ ${t('ch_continue')}</button>
           <button class="ch-btn-ghost" id="cp-restart">↺ ${t('ch_restart')}</button>`
        : `<button class="ch-btn-primary" id="cp-start">🚩 ${t('ch_start')}</button>`}
    </div>`;
  const startFn = (fresh) => {
    const name = ($('#cp-name').value || '').trim();
    if (!name){ $('#cp-name').focus(); ctx.toast(t('ch_need_name')); return; }
    let prog = progressFor(challenge.id);
    if (fresh || !prog){ prog = { player:name, startedAt:now(), done:{}, finishedAt:null }; }
    else { prog.player = name; }
    saveProgress(challenge.id, prog);
    play = { challenge, progress: prog };
    renderPlay();
  };
  if (resume){
    $('#cp-continue').onclick = () => startFn(false);
    $('#cp-restart').onclick = () => startFn(true);
  } else {
    $('#cp-start').onclick = () => startFn(true);
  }
  ctx.openPanel('#challenge-play');
}
function orgKindLabel(kind){
  return { skola:t('ch_org_school'), foretag:t('ch_org_company'), myndighet:t('ch_org_authority') }[kind] || '';
}

function renderPlay(){
  if (!play) return;
  const c = play.challenge, prog = play.progress, done = prog.done || {};
  const score = c.stops.reduce((a,s)=>a + (done[s.id]?done[s.id].points:0), 0);
  const max = maxScore(c);
  const completed = c.stops.filter(s => done[s.id]).length;
  const pct = max ? Math.round(score/max*100) : 0;
  $('#cp-title').textContent = c.title;
  $('#cp-body').innerHTML = `
    <div class="cp-pad">
      <div class="ch-score-head">
        <div><span class="chs-score">${score}</span><span class="chs-max">/ ${max} ${t('ch_points_short')}</span></div>
        <div class="chs-prog">${completed}/${c.stops.length} ${t('ch_play_done')}</div>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <ol class="cp-stops">
        ${c.stops.map((s,i)=>{
          const e = entryById(s.id) || { name:s.id };
          const isDone = !!done[s.id];
          const dist = distText(e);
          return `<li><button class="stop-row cp-stop ${isDone?'is-done':''}" data-i="${i}">
            ${ctx.stopThumb(e, `<span class="stop-no" style="background:var(--lake)">${i+1}</span>`)}
            <span class="stop-meta"><b>${esc(e.name)}</b>
              <small>${TASK_ICON[s.task.type]} ${taskLabel(s.task.type)} · ${s.points} ${t('ch_points_short')}${dist?' · '+dist:''}</small></span>
            ${isDone?'<span class="tick">✓</span>':'<span class="cp-go">›</span>'}
          </button></li>`;
        }).join('')}
      </ol>
      <button class="ch-btn-primary" id="cp-finish">🏁 ${t('ch_finish')}</button>
    </div>`;
  $('#cp-body').querySelectorAll('.cp-stop').forEach(r => r.onclick = () => openTask(c.stops[+r.dataset.i]));
  $('#cp-finish').onclick = () => finish();
}
function distText(e){
  if (!lastPos || !ctx.hasCoords(e)) return '';
  const d = Math.round(ctx.map.distance(lastPos, [e.coordinates.lat, e.coordinates.lng]));
  return d < 1000 ? d + ' m' : (d/1000).toFixed(1) + ' km';
}

function openTask(stop){
  currentTask = stop;
  renderTask(stop);
  $('#challenge-task').setAttribute('aria-hidden','false');
  ctx.focusInto('#challenge-task');
}
function closeTask(){
  currentTask = null;
  $('#challenge-task').setAttribute('aria-hidden','true');
  ctx.restoreFocus();
}
function renderTask(stop){
  const card = $('#ct-card');
  const e = entryById(stop.id) || { name: stop.id };
  const done = (play.progress.done||{})[stop.id];
  const head = `<button class="ct-x" id="ct-x" aria-label="${t('ch_close')}">&times;</button>
    <div class="ct-pts">${stop.points} ${t('ch_points_short')}</div>
    <h3>${TASK_ICON[stop.task.type]} ${esc(e.name)}</h3>`;
  let body = '';
  if (done){
    body = `<div class="ct-done">✓ ${t('ch_award')}<span>+${done.points}</span></div>
      <button class="ch-btn-ghost" id="ct-ok">${t('ch_close')}</button>`;
  } else if (stop.task.type === 'visit'){
    body = renderVisitTask(e);
  } else if (stop.task.type === 'quiz'){
    body = `<p class="ct-q">${esc(stop.task.q)}</p>
      <div class="quiz-opts">${stop.task.opts.map((o,i)=>`<button class="quiz-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
  } else if (stop.task.type === 'photo'){
    body = `<p class="ct-q">${esc(stop.task.prompt || t('ch_photo_default'))}</p>
      <button class="ch-btn-primary" id="ct-photo">📸 ${t('ch_photo_take')}</button>`;
  } else if (stop.task.type === 'code'){
    body = `<p class="ct-q">${esc(stop.task.prompt || t('ch_code_default'))}</p>
      <input class="cb-in" id="ct-code" placeholder="${esc(t('ch_code_enter'))}">
      <button class="ch-btn-primary" id="ct-verify">✓ ${t('ch_verify')}</button>`;
  }
  card.innerHTML = head + body;
  $('#ct-x').onclick = closeTask;
  const ok = $('#ct-ok'); if (ok) ok.onclick = closeTask;

  if (!done){
    if (stop.task.type === 'visit') wireVisitTask(e, stop);
    if (stop.task.type === 'quiz'){
      card.querySelectorAll('.quiz-opt').forEach(b => b.onclick = () => {
        const chosen = +b.dataset.i;
        if (chosen === stop.task.answer){ award(stop); }
        else {
          b.classList.add('wrong');
          ctx.toast(t('ch_quiz_wrong'));
          setTimeout(()=>b.classList.remove('wrong'), 700);
        }
      });
    }
    if (stop.task.type === 'photo'){
      $('#ct-photo').onclick = () => takeChallengePhoto(stop);
    }
    if (stop.task.type === 'code'){
      const verify = () => {
        let val = ($('#ct-code').value||'').trim();
        let target = (stop.task.code||'').trim();
        if (!stop.task.caseSensitive){ val = val.toLowerCase(); target = target.toLowerCase(); }
        if (val && val === target) award(stop);
        else ctx.toast(t('ch_code_wrong'));
      };
      $('#ct-verify').onclick = verify;
      $('#ct-code').onkeydown = ev => { if (ev.key === 'Enter') verify(); };
    }
  }
}
function renderVisitTask(e){
  let dist = '', within = false;
  if (lastPos && ctx.hasCoords(e)){
    const d = Math.round(ctx.map.distance(lastPos, [e.coordinates.lat, e.coordinates.lng]));
    within = d <= ctx.AUTO_RADIUS;
    dist = `<p class="ct-dist ${within?'near':''}">${within ? '✓ ' + t('ch_dist_here') : d + ' m ' + t('ch_dist_away')}</p>`;
  } else {
    dist = `<p class="ct-dist">${t('ch_dist_unknown')}</p>`;
  }
  const maps = ctx.hasCoords(e)
    ? `<a class="ct-maps" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${e.coordinates.lat},${e.coordinates.lng}">🧭 ${t('ch_directions')}</a>` : '';
  return `${dist}
    <button class="ch-btn-ghost" id="ct-locate">📍 ${t('ch_find_me')}</button>
    <button class="ch-btn-primary" id="ct-checkin" ${within?'':'disabled'}>${within ? '✓ '+t('ch_checkin') : t('ch_checkin_far')}</button>
    ${maps}`;
}
function wireVisitTask(e, stop){
  const loc = $('#ct-locate'); if (loc) loc.onclick = () => ctx.locate();
  const ci = $('#ct-checkin'); if (ci) ci.onclick = () => {
    if (lastPos && ctx.hasCoords(e) && ctx.map.distance(lastPos,[e.coordinates.lat,e.coordinates.lng]) <= ctx.AUTO_RADIUS) award(stop);
    else ctx.toast(t('ch_checkin_far'));
  };
}
function takeChallengePhoto(stop){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    ctx.fileToThumb(f, dataUrl => {
      saveChPhoto(play.challenge.id + ':' + stop.id, dataUrl);
      award(stop);
    });
  };
  inp.click();
}

function award(stop){
  const prog = play.progress;
  if (!prog.done) prog.done = {};
  if (prog.done[stop.id]){ closeTask(); return; }      // idempotent
  prog.done[stop.id] = { at: now(), points: stop.points };
  saveProgress(play.challenge.id, prog);
  ctx.toast('🎉 +' + stop.points + ' ' + t('ch_points_short'));
  closeTask();
  renderPlay();
  const all = play.challenge.stops.every(s => prog.done[s.id]);
  if (all) setTimeout(()=>finish(), 400);
}

function finish(){
  const c = play.challenge, prog = play.progress, done = prog.done||{};
  const score = c.stops.reduce((a,s)=>a + (done[s.id]?done[s.id].points:0), 0);
  const completed = c.stops.filter(s => done[s.id]).length;
  if (!prog.finishedAt){ prog.finishedAt = now(); saveProgress(c.id, prog); }
  const rec = {
    challengeId: c.id, challengeTitle: c.title, player: prog.player,
    score, maxScore: maxScore(c), completed, total: c.stops.length,
    startedAt: prog.startedAt, finishedAt: prog.finishedAt,
    durationMs: prog.finishedAt - prog.startedAt,
  };
  // Undvik dubbletter om man trycker Avsluta flera gånger
  const existing = runs().some(r => r.challengeId===rec.challengeId && r.finishedAt===rec.finishedAt);
  if (!existing) addRun(rec);

  const code = 'STROSA1-' + enc(rec);
  const resultLink = baseUrl() + '#result=' + enc(rec);
  const line = isEn()
    ? (score===rec.maxScore ? 'Full marks! 🏆' : completed===c.stops.length ? 'Challenge complete! 👏' : 'Nicely done! 🚶')
    : (score===rec.maxScore ? 'Full pott! 🏆' : completed===c.stops.length ? 'Hela utmaningen klar! 👏' : 'Bra kämpat! 🚶');
  $('#cp-title').textContent = t('ch_finished_title');
  $('#cp-body').innerHTML = `
    <div class="cp-pad ch-result">
      <div class="ch-gen-emoji">🏁</div>
      <div class="ch-result-score">${score}<small>/ ${rec.maxScore}</small></div>
      <p class="ch-result-line">${line}</p>
      <div class="ch-result-stats">
        <span><b>${completed}/${c.stops.length}</b> ${t('ch_play_done')}</span>
        <span><b>${fmtDur(rec.durationMs)}</b> ${t('ch_time')}</span>
      </div>
      <p class="ch-prof-sub">${t('ch_result_hint')}</p>
      <div class="ch-codebox"><input id="ch-rescode" readonly value="${esc(code)}"></div>
      <div class="ch-row2">
        <button class="ch-btn-primary" id="ch-rescopy">📋 ${t('ch_copy')}</button>
        <button class="ch-btn-ghost" id="ch-resshare">📤 ${t('ch_share')}</button>
      </div>
      <button class="ch-btn-ghost" id="ch-resdone">${t('ch_close')}</button>
    </div>`;
  $('#ch-rescopy').onclick = () => copyText(code);
  $('#ch-resshare').onclick = async () => {
    const text = (isEn()?'My result in ':'Mitt resultat i ') + c.title + ': ' + score + '/' + rec.maxScore;
    try { if (navigator.share){ await navigator.share({ title:'Strosa', text, url: resultLink }); return; } } catch(e){ return; }
    copyText(code);
  };
  $('#ch-resdone').onclick = () => { ctx.closePanel('#challenge-play'); play = null; };
}

/* =====================================================================
   RESULTAT / TOPPLISTA (arrangör)
   ===================================================================== */
function openResultsPicker(){
  const all = challenges();
  const ids = Object.keys(all);
  $('#cr-title').textContent = t('ch_results');
  if (!ids.length){
    $('#cr-body').innerHTML = `<div class="cr-pad"><p class="ch-empty">${t('ch_no_challenges')}</p></div>`;
    ctx.openPanel('#challenge-results'); return;
  }
  $('#cr-body').innerHTML = `<div class="cr-pad">
    <p class="ch-prof-sub">${t('ch_pick_challenge')}</p>
    ${ids.map(id => {
      const c = all[id], n = resultsFor(id).length;
      return `<button class="led-card cr-pick" data-id="${id}">
        <span class="led-meta"><b>${esc(c.title)}</b>
          <small>${c.stops.length} ${t('ch_stops')} · ${maxScore(c)} ${t('ch_points_short')}</small>
          <span class="led-count">${n} ${t('ch_results_count')}</span></span>
      </button>`;
    }).join('')}
  </div>`;
  $('#cr-body').querySelectorAll('.cr-pick').forEach(b => b.onclick = () => openResults(b.dataset.id));
  ctx.openPanel('#challenge-results');
}

function openResults(challengeId){
  const c = challenges()[challengeId];
  const title = c ? c.title : challengeId;
  $('#cr-title').textContent = title;
  renderResults(challengeId);
  ctx.openPanel('#challenge-results');
}

function renderResults(challengeId){
  const c = challenges()[challengeId];
  const board = resultsFor(challengeId).slice()
    .sort((a,b)=> b.score - a.score || a.durationMs - b.durationMs);
  const rows = board.length ? board.map((r,i)=>`
    <div class="ch-leader-row">
      <span class="chl-rank ${i<3?'top':''}">${i+1}</span>
      <span class="chl-name">${esc(r.player)}<small>${r.completed}/${r.total} · ${fmtDur(r.durationMs)}</small></span>
      <span class="chl-score">${r.score}</span>
    </div>`).join('') : `<p class="ch-empty">${t('ch_no_results')}</p>`;
  $('#cr-body').innerHTML = `<div class="cr-pad">
    ${c?`<p class="ch-prof-sub">${maxScore(c)} ${t('ch_points_short')} · ${c.stops.length} ${t('ch_stops')}</p>`:''}
    <h4 class="cb-h">🏆 ${t('ch_leaderboard')} <span class="cb-count">${board.length}</span></h4>
    <div class="ch-leader">${rows}</div>
    <h4 class="cb-h">${t('ch_paste_codes')}</h4>
    <textarea class="cb-in cb-ta" id="cr-paste" rows="3" placeholder="${esc(t('ch_paste_ph'))}"></textarea>
    <button class="ch-btn-primary" id="cr-import">⬇︎ ${t('ch_import')}</button>
    <div class="ch-row2">
      <button class="ch-btn-ghost" id="cr-export">📤 ${t('ch_export')}</button>
      <button class="ch-btn-ghost" id="cr-clear">🗑️ ${t('ch_clear')}</button>
    </div>
    <button class="ch-btn-ghost" id="cr-back">‹ ${t('ch_results')}</button>
  </div>`;
  $('#cr-import').onclick = () => {
    const text = $('#cr-paste').value || '';
    const n = importCodes(text, challengeId);
    ctx.toast(n ? t('ch_imported') + ' ' + n : t('ch_no_results'));
    renderResults(challengeId);
  };
  $('#cr-export').onclick = () => exportBoard(challengeId, board);
  $('#cr-clear').onclick = () => { saveResults(challengeId, []); renderResults(challengeId); };
  $('#cr-back').onclick = () => openResultsPicker();
}

function importCodes(text, expectedId){
  const lines = text.split(/[\s\n]+/).map(s => s.trim()).filter(Boolean);
  let added = 0;
  lines.forEach(line => { if (ingestResult(decodeCode(line), expectedId)) added++; });
  return added;
}
function decodeCode(line){
  let s = line;
  const m = s.match(/[#&]result=([^&]+)/);
  if (m) s = decodeURIComponent(m[1]);
  else s = s.replace(/^STROSA1-/, '');
  try { return dec(s); } catch(e){ return null; }
}
function ingestResult(rec, expectedId){
  if (!rec || !rec.challengeId || typeof rec.score !== 'number') return false;
  if (expectedId && rec.challengeId !== expectedId) return false;
  const arr = resultsFor(rec.challengeId);
  const dup = arr.some(r => r.player===rec.player && r.score===rec.score && r.finishedAt===rec.finishedAt);
  if (dup) return false;
  arr.push(rec); saveResults(rec.challengeId, arr);
  return true;
}
function exportBoard(challengeId, board){
  const c = challenges()[challengeId];
  const head = (c?c.title:challengeId) + ' — ' + t('ch_leaderboard');
  const lines = board.map((r,i)=> (i+1) + '. ' + r.player + ' — ' + r.score + '/' + r.maxScore + ' (' + fmtDur(r.durationMs) + ')');
  copyText(head + '\n' + lines.join('\n'));
}
