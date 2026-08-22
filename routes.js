// ── routes.js — egna rutter: skapa, dela, gå, utmana ─────────────────────────
// Isolerad modul (samma mönster som tips.js/comments.js). Säkerheten ligger i
// RLS + triggers (supabase/migrations/20260822120000_routes.sql).
//
// Skilt från challenges.js, som är ett arrangörsverktyg: en skola bygger en
// geocaching-tävling med poäng och uppgifter, kodad i URL:ens hash. En rutt är
// enklare — ett namn, en följd av platser, hur man tar sig runt — och ligger i
// databasen, så att andras rutter går att UPPTÄCKA i staden och inte bara tas
// emot av den som fick länken.
import { getSupabase, isConfigured } from './config.js';
import { getUser, requireAuth } from './auth.js';

let ctx = null;
let supa = null;
let draft = null;                  // rutten som byggs just nu
const authorNames = new Map();

const $ = sel => document.querySelector(sel);
const t = k => (ctx && ctx.t ? ctx.t(k) : k);
const en = () => ctx && ctx.lang === 'en';
const city = () => (ctx && ctx.citySlug) || 'mjolby';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function routesActive() { return isConfigured(); }
async function ensureClient() { if (!supa && isConfigured()) supa = await getSupabase(); return supa; }
export function initRoutes(context) { ctx = context; }

let tableMissing = false;   // migrationen inte körd → visa inget alls

// ── Färdsätt ────────────────────────────────────────────────────────────────
// Tempot används bara för tidsuppskattningen. Gånghastighet i stadsmiljö med
// stopp är lägre än ren gångtakt — 4 km/h är realistiskt, inte 5.
const MODES = {
  walk: { icon: '🚶', kmh: 4.0,  key: 'route_mode_walk' },
  run:  { icon: '🏃', kmh: 9.0,  key: 'route_mode_run' },
  bike: { icon: '🚲', kmh: 15.0, key: 'route_mode_bike' },
};
const modeIcon = m => (MODES[m] || MODES.walk).icon;
const modeLabel = m => t((MODES[m] || MODES.walk).key);

function distKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371, r = x => x * Math.PI / 180;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
// Fågelvägen mellan stoppen × 1.25. Riktig gatuföljande sträcka hämtas först när
// rutten ritas på kartan (app.js gör det); här räcker en ärlig uppskattning.
function routeStats(stopIds, mode) {
  const pts = stopIds.map(id => (ctx.DATA || []).find(e => e.id === id))
    .filter(e => e && e.coordinates).map(e => e.coordinates);
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += distKm(pts[i - 1], pts[i]);
  km *= 1.25;
  const min = Math.round(km / (MODES[mode] || MODES.walk).kmh * 60);
  return { km, min };
}
const fmtKm = km => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
const fmtMin = min => min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${min % 60} min`;
const fmtTime = secs => {
  const m = Math.floor(secs / 60), s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const nameOf = id => authorNames.get(id) || (en() ? 'A walker' : 'En stadsvandrare');
async function loadAuthors(ids) {
  const missing = [...new Set(ids)].filter(id => id && !authorNames.has(id));
  if (!missing.length || !supa) return;
  const { data } = await supa.from('public_authors').select('id, display_name').in('id', missing);
  (data || []).forEach(a => authorNames.set(a.id, a.display_name));
}

// ── Hämtning ────────────────────────────────────────────────────────────────
async function fetchRoutes({ mine = false } = {}) {
  await ensureClient();
  if (!supa) return [];
  let q = supa.from('routes')
    .select('id, author_id, city, title, intro, mode, stops, is_public, starts_at, walk_count, created_at')
    .order('created_at', { ascending: false }).limit(100);
  if (mine) {
    const u = getUser(); if (!u) return [];
    q = q.eq('author_id', u.id);
  } else {
    q = q.eq('city', city()).eq('is_public', true);
  }
  const { data, error } = await q;
  if (error) {
    if (/does not exist|schema cache|PGRST205/i.test(error.message || '')) tableMissing = true;
    else console.warn('rutter', error);
    return [];
  }
  await loadAuthors((data || []).map(r => r.author_id));
  return data || [];
}

async function fetchRoute(id) {
  await ensureClient();
  if (!supa) return null;
  const { data, error } = await supa.from('routes')
    .select('id, author_id, city, title, intro, mode, stops, is_public, starts_at, walk_count, created_at')
    .eq('id', id).maybeSingle();
  if (error || !data) return null;
  await loadAuthors([data.author_id]);
  return data;
}

// ── Listvy (Leder-fliken) ───────────────────────────────────────────────────
function routeCardHtml(r, opts = {}) {
  const { km, min } = routeStats(r.stops, r.mode);
  const when = r.starts_at ? new Date(r.starts_at) : null;
  const whenTxt = when ? when.toLocaleString(en() ? 'en-GB' : 'sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  return `<button class="led-card route-card" data-route="${esc(r.id)}">
    <span class="route-mode" aria-hidden="true">${modeIcon(r.mode)}</span>
    <span class="led-meta">
      <b>${esc(r.title)}</b>
      <small>${r.stops.length} ${t('stops')} · ${fmtKm(km)} · ${fmtMin(min)}${opts.mine ? (r.is_public ? '' : ` · ${t('route_private')}`) : ` · ${esc(nameOf(r.author_id))}`}</small>
      <span class="led-count">${whenTxt ? `🗓️ ${whenTxt}` : (r.walk_count ? `${r.walk_count} ${t('route_walked_by')}` : t('route_nobody_yet'))}</span>
    </span>
  </button>`;
}

// Renderas in i Leder-vyn under de kurerade lederna.
export async function mountRoutes(container) {
  if (!routesActive() || !container) return;
  const wrap = document.createElement('div');
  wrap.className = 'routes-section';
  container.appendChild(wrap);

  wrap.innerHTML = `<div class="contrib-optimizing">${t('route_loading')}</div>`;
  const [mine, theirs] = await Promise.all([
    getUser() ? fetchRoutes({ mine: true }) : Promise.resolve([]),
    fetchRoutes({}),
  ]);
  if (tableMissing) { wrap.remove(); return; }

  const theirsNotMine = theirs.filter(r => !mine.some(m => m.id === r.id));
  wrap.innerHTML = `
    <h3 class="prof-h">${t('route_yours')}</h3>
    <button class="cta route-new" id="route-new">➕ ${t('route_create')}</button>
    ${mine.length ? mine.map(r => routeCardHtml(r, { mine: true })).join('')
                  : `<p class="cmt-empty">${t('route_none_yours')}</p>`}
    <h3 class="prof-h">${t('route_in_city')} ${esc(ctx.cityName || '')}</h3>
    ${theirsNotMine.length ? theirsNotMine.map(r => routeCardHtml(r)).join('')
                           : `<p class="cmt-empty">${t('route_none_city')}</p>`}`;
  wrap.querySelector('#route-new').onclick = () => openBuilder();
  wrap.querySelectorAll('[data-route]').forEach(b => b.onclick = () => openRoute(b.dataset.route));
}

// ── Byggaren ────────────────────────────────────────────────────────────────
function blankDraft() {
  return { id: null, title: '', intro: '', mode: 'walk', stops: [], is_public: true, starts_at: '' };
}

export async function openBuilder(existing) {
  if (!(await requireAuth())) return;
  await ensureClient();
  draft = existing
    ? { id: existing.id, title: existing.title, intro: existing.intro || '', mode: existing.mode,
        stops: [...existing.stops], is_public: existing.is_public,
        starts_at: existing.starts_at ? new Date(existing.starts_at).toISOString().slice(0, 16) : '' }
    : blankDraft();
  renderBuilder();
  ctx.openPanel('#route-builder');
}

function renderBuilder() {
  $('#rb-title').textContent = draft.id ? t('route_edit_title') : t('route_new_title');
  $('#rb-body').innerHTML = `
    <div class="cb-pad">
      <label class="cb-l" for="rb-f-title">${t('route_field_title')}</label>
      <input class="cb-in" id="rb-f-title" value="${esc(draft.title)}" placeholder="${esc(t('route_title_ph'))}" maxlength="120">

      <label class="cb-l" for="rb-f-intro">${t('route_field_intro')}</label>
      <textarea class="cb-in cb-ta" id="rb-f-intro" rows="2" maxlength="600" placeholder="${esc(t('route_intro_ph'))}">${esc(draft.intro)}</textarea>

      <label class="cb-l">${t('route_field_mode')}</label>
      <div class="ch-seg" id="rb-mode" role="group" aria-label="${esc(t('route_field_mode'))}">
        ${Object.keys(MODES).map(m => `<button data-mode="${m}" class="${draft.mode === m ? 'on' : ''}">${MODES[m].icon} ${modeLabel(m)}</button>`).join('')}
      </div>

      <label class="cb-l" for="rb-f-when">${t('route_field_when')}</label>
      <input class="cb-in" id="rb-f-when" type="datetime-local" value="${esc(draft.starts_at)}">
      <p class="cb-hint">${t('route_when_hint')}</p>

      <label class="cb-check"><input type="checkbox" id="rb-f-public" ${draft.is_public ? 'checked' : ''}> ${t('route_public')}</label>

      <h4 class="cb-h">${t('route_selected')} <span class="cb-count" id="rb-count">${draft.stops.length}</span></h4>
      <div id="rb-selected"></div>
      <div class="route-stats" id="rb-stats"></div>

      <h4 class="cb-h">${t('route_add_stops')}</h4>
      <input class="cb-in" id="rb-search" type="search" placeholder="${esc(t('route_search_stops'))}" aria-label="${esc(t('route_search_stops'))}">
      <div id="rb-picker" class="cb-picker"></div>

      <button class="ch-btn-primary cb-generate" id="rb-save">${draft.id ? t('route_save') : t('route_create_btn')}</button>
      ${draft.id ? `<button class="fb-cta route-delete" id="rb-delete">${t('route_delete')}</button>` : ''}
    </div>`;

  $('#rb-f-title').oninput = e => { draft.title = e.target.value; };
  $('#rb-f-intro').oninput = e => { draft.intro = e.target.value; };
  $('#rb-f-when').oninput  = e => { draft.starts_at = e.target.value; };
  $('#rb-f-public').onchange = e => { draft.is_public = e.target.checked; };
  $('#rb-mode').querySelectorAll('button').forEach(b => b.onclick = () => {
    draft.mode = b.dataset.mode;
    $('#rb-mode').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    renderStats();
  });
  $('#rb-search').oninput = e => renderPicker(e.target.value);
  $('#rb-save').onclick = save;
  const del = $('#rb-delete'); if (del) del.onclick = remove;

  renderSelected();
  renderPicker('');
}

function renderStats() {
  const el = $('#rb-stats'); if (!el) return;
  if (draft.stops.length < 2) { el.innerHTML = ''; return; }
  const { km, min } = routeStats(draft.stops, draft.mode);
  el.innerHTML = `<span>${modeIcon(draft.mode)} ${fmtKm(km)}</span><span>⏱️ ${t('route_about')} ${fmtMin(min)}</span>`;
}

function renderSelected() {
  const box = $('#rb-selected'); if (!box) return;
  $('#rb-count').textContent = draft.stops.length;
  if (!draft.stops.length) { box.innerHTML = `<p class="cmt-empty">${t('route_pick_hint')}</p>`; renderStats(); return; }
  box.innerHTML = `<ol class="route-stoplist">${draft.stops.map((id, i) => {
    const e = (ctx.DATA || []).find(x => x.id === id);
    return `<li>
      <span class="rs-no">${i + 1}</span>
      <span class="rs-name">${esc(e ? e.name : id)}</span>
      <span class="rs-acts">
        <button class="rs-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="${esc(t('route_move_up'))}">↑</button>
        <button class="rs-btn" data-down="${i}" ${i === draft.stops.length - 1 ? 'disabled' : ''} aria-label="${esc(t('route_move_down'))}">↓</button>
        <button class="rs-btn rs-x" data-rm="${i}" aria-label="${esc(t('route_remove'))}">×</button>
      </span></li>`;
  }).join('')}</ol>`;
  const swap = (i, j) => { const a = draft.stops; [a[i], a[j]] = [a[j], a[i]]; renderSelected(); };
  box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => swap(+b.dataset.up, +b.dataset.up - 1));
  box.querySelectorAll('[data-down]').forEach(b => b.onclick = () => swap(+b.dataset.down, +b.dataset.down + 1));
  box.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { draft.stops.splice(+b.dataset.rm, 1); renderSelected(); renderPicker($('#rb-search').value); });
  renderStats();
}

function renderPicker(q) {
  const box = $('#rb-picker'); if (!box) return;
  const ql = (q || '').toLowerCase().trim();
  // Bara platser i den aktiva staden som har en kartnål — en rutt går mellan
  // punkter, så poster utan koordinater hör inte hemma här.
  const hits = (ctx.DATA || [])
    .filter(e => e.coordinates && typeof e.coordinates.lat === 'number')
    .filter(e => (e.city || '') === (ctx.cityName || ''))
    .filter(e => !draft.stops.includes(e.id))
    .filter(e => !ql || (e.name + ' ' + (e.summary || '')).toLowerCase().includes(ql))
    .slice(0, 40);
  box.innerHTML = hits.length
    ? hits.map(e => `<button class="stop-row" data-pick="${esc(e.id)}">
        <span class="stop-meta"><b>${esc(e.name)}</b><small>${esc((ctx.CAT_LABEL && ctx.CAT_LABEL[e.category]) || '')}</small></span>
        <span class="rs-add">+</span></button>`).join('')
    : `<p class="cmt-empty">${en() ? 'Nothing found.' : 'Inget hittades.'}</p>`;
  box.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    if (draft.stops.length >= 40) { ctx.toast(t('route_max_stops')); return; }
    draft.stops.push(b.dataset.pick);
    renderSelected();
    renderPicker($('#rb-search').value);
  });
}

async function save() {
  if (!draft.title.trim()) { ctx.toast(t('route_need_title')); return; }
  if (draft.stops.length < 2) { ctx.toast(t('route_need_stops')); return; }
  const btn = $('#rb-save'); btn.disabled = true;
  const row = {
    city: city(), title: draft.title.trim(), intro: draft.intro.trim() || null,
    mode: draft.mode, stops: draft.stops, is_public: draft.is_public,
    starts_at: draft.starts_at ? new Date(draft.starts_at).toISOString() : null,
  };
  const res = draft.id
    ? await supa.from('routes').update(row).eq('id', draft.id).select().maybeSingle()
    : await supa.from('routes').insert(row).select().maybeSingle();
  btn.disabled = false;
  if (res.error) {
    const msg = /too many routes/.test(res.error.message) ? t('route_rate')
              : /cooldown|suspended/.test(res.error.message) ? t('route_cooldown')
              : res.error.message;
    ctx.toast(msg); return;
  }
  ctx.closePanel('#route-builder');
  ctx.toast('🧭 ' + t('route_saved'));
  if (ctx.onRoutesChanged) ctx.onRoutesChanged();
  if (res.data) openRoute(res.data.id);
}

async function remove() {
  if (!confirm(t('route_delete_confirm'))) return;
  const { error } = await supa.from('routes').delete().eq('id', draft.id);
  if (error) { ctx.toast(error.message); return; }
  ctx.closePanel('#route-builder');
  ctx.toast(t('route_deleted'));
  if (ctx.onRoutesChanged) ctx.onRoutesChanged();
}

// ── Ruttvyn ─────────────────────────────────────────────────────────────────
export async function openRoute(id) {
  await ensureClient();
  const r = await fetchRoute(id);
  if (!r) { ctx.toast(t('route_gone')); return; }
  // Rutten kan ligga i en annan stad än den man tittar på (delad länk).
  if (ctx.ensureCity && r.city) await ctx.ensureCity(r.city);

  const me = getUser();
  const mine = me && r.author_id === me.id;
  const { km, min } = routeStats(r.stops, r.mode);
  const when = r.starts_at ? new Date(r.starts_at) : null;

  const { data: walks } = await supa.from('route_walks')
    .select('walker_id, seconds, finished_at').eq('route_id', r.id)
    .order('seconds', { ascending: true, nullsFirst: false }).limit(20);
  await loadAuthors((walks || []).map(w => w.walker_id));

  $('#rv-title').textContent = r.title;
  $('#rv-body').innerHTML = `
    <div class="cb-pad">
      <div class="route-hero">
        <span class="route-hero-mode">${modeIcon(r.mode)}</span>
        <div>
          <b>${fmtKm(km)} · ${t('route_about')} ${fmtMin(min)}</b>
          <small>${r.stops.length} ${t('stops')} · ${t('route_by')} ${esc(nameOf(r.author_id))}</small>
        </div>
      </div>
      ${r.intro ? `<p class="route-intro">${esc(r.intro)}</p>` : ''}
      ${when ? `<div class="route-when">🗓️ ${esc(when.toLocaleString(en() ? 'en-GB' : 'sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}</div>` : ''}

      <button class="ch-btn-primary" id="rv-start">${modeIcon(r.mode)} ${t('route_start')}</button>
      <div class="route-actions">
        <button class="fb-cta" id="rv-share">📤 ${t('route_share')}</button>
        ${me ? `<button class="fb-cta" id="rv-done">✓ ${t('route_log_walk')}</button>` : ''}
        ${mine ? `<button class="fb-cta" id="rv-edit">✎ ${t('route_edit')}</button>` : ''}
      </div>

      <h4 class="cb-h">${t('route_stops_head')}</h4>
      <ol class="route-stoplist route-stoplist--view">${r.stops.map((sid, i) => {
        const e = (ctx.DATA || []).find(x => x.id === sid);
        return `<li><span class="rs-no">${i + 1}</span>
          <span class="rs-name">${esc(e ? e.name : sid)}</span></li>`;
      }).join('')}</ol>

      <h4 class="cb-h">${t('route_board')}</h4>
      ${(walks && walks.length) ? `<ol class="route-board">${walks.map((w, i) => `<li>
          <span class="rb-pos">${w.seconds ? i + 1 : '–'}</span>
          <span class="rb-name">${esc(nameOf(w.walker_id))}</span>
          <span class="rb-time">${w.seconds ? fmtTime(w.seconds) : t('route_no_time')}</span>
        </li>`).join('')}</ol>`
        : `<p class="cmt-empty">${t('route_board_empty')}</p>`}
    </div>`;

  $('#rv-start').onclick = () => { ctx.closePanel('#route-view'); ctx.startUserRoute(r); };
  $('#rv-share').onclick = () => shareRoute(r);
  const done = $('#rv-done'); if (done) done.onclick = () => logWalk(r);
  const ed = $('#rv-edit'); if (ed) ed.onclick = () => { ctx.closePanel('#route-view'); openBuilder(r); };
  ctx.openPanel('#route-view');
}

function routeLink(r) {
  return location.origin + location.pathname + '?rutt=' + encodeURIComponent(r.id);
}

async function shareRoute(r) {
  const url = routeLink(r);
  const when = r.starts_at ? new Date(r.starts_at) : null;
  const whenTxt = when ? ' ' + when.toLocaleString(en() ? 'en-GB' : 'sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const { km } = routeStats(r.stops, r.mode);
  const text = en()
    ? `${r.title} — ${modeIcon(r.mode)} ${fmtKm(km)} past ${r.stops.length} places.${whenTxt ? ' We are going' + whenTxt + '.' : ''} Come along!`
    : `${r.title} — ${modeIcon(r.mode)} ${fmtKm(km)} förbi ${r.stops.length} platser.${whenTxt ? ' Vi går den' + whenTxt + '.' : ''} Häng med!`;
  try {
    if (navigator.share) { await navigator.share({ title: r.title, text, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text + '\n' + url); ctx.toast(t('route_link_copied')); }
  catch (e) { prompt(t('route_share'), url); }
}

// "Jag gick den" — med eller utan tid. Tiden är frivillig: en söndagspromenad
// ska inte behöva vara en tävling för att räknas.
async function logWalk(r) {
  if (!(await requireAuth())) return;
  const ans = prompt(t('route_time_prompt'), '');
  if (ans === null) return;                       // avbröt
  let seconds = null;
  const m = String(ans).trim().match(/^(\d+)(?::(\d{1,2}))?$/);
  if (m) seconds = (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  const { error } = await supa.from('route_walks')
    .insert({ route_id: r.id, walker_id: getUser().id, seconds, stops_done: r.stops.length });
  if (error) { ctx.toast(error.message); return; }
  ctx.toast('🎉 ' + t('route_walk_logged'));
  openRoute(r.id);
}

// Delad länk: ?rutt=<id> öppnar rutten direkt, även utan konto.
export function routeInUrl() {
  try {
    const id = new URLSearchParams(location.search).get('rutt');
    if (!id) return null;
    history.replaceState(null, '', location.pathname);
    return id;
  } catch (e) { return null; }
}
