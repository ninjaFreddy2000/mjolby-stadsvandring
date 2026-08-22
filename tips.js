// ── tips.js — community-tips: lämna in, granska (peer review), admin ────────
// Isolerad modul (samma mönster som challenges.js). All säkerhet ligger i RLS +
// SECURITY DEFINER-funktioner i Supabase; den här filen är bara UI + anrop.
import { getSupabase, isConfigured } from './config.js';
import { getState, getProfile, getUser, isAdmin, canReview, requireAuth,
         tierLabel, onAuthChange } from './auth.js';

let ctx = null;
let supa = null;
const publishedByStop = new Map();   // stop_ref -> [tip]
const authorsById = new Map();       // id -> { display_name, tier }
let loaded = false;

// Vilken stads tips vi arbetar med. Följer appens aktiva stad — tidigare låstes
// allt till den globala stadskonstanten ('mjolby'), så community-delen var i
// praktiken död i de andra 71 städerna: inga tips syntes, och det man skrev in
// bokfördes på Mjölby oavsett var man stod.
const city = () => (ctx && ctx.citySlug) || 'mjolby';
const t = k => (ctx && ctx.t ? ctx.t(k) : k);
const en = () => ctx && ctx.lang === 'en';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function isActive() { return isConfigured(); }
async function ensureClient() { if (!supa && isConfigured()) supa = await getSupabase(); return supa; }

export async function initTips(context) {
  ctx = context;
  if (!isConfigured()) return;
  supa = await getSupabase();
  if (!supa) return;
  await refreshCity();
  // När någon loggar in/ut kan privilegierad data ändras — håll cachen färsk.
  onAuthChange(() => { refreshCity(); });
}

export async function refreshCity() {
  if (!supa) return;
  try {
    const { data: tips } = await supa
      .from('tips')
      .select('id, kind, stop_ref, title, body, media_url, lat, lng, author_id, created_at')
      .eq('city', city()).eq('status', 'published')
      .order('created_at', { ascending: false });
    publishedByStop.clear();
    (tips || []).forEach(tp => {
      if (!tp.stop_ref) return;     // 'place'-tips visas inte på ett befintligt stopp
      if (!publishedByStop.has(tp.stop_ref)) publishedByStop.set(tp.stop_ref, []);
      publishedByStop.get(tp.stop_ref).push(tp);
    });
    const { data: authors } = await supa.from('public_authors').select('id, display_name, tier');
    authorsById.clear();
    (authors || []).forEach(a => authorsById.set(a.id, a));
    loaded = true;
    if (ctx && ctx.onTipsLoaded) ctx.onTipsLoaded();
  } catch (e) { console.warn('refreshCity', e); }
}

export function tipsForStop(stopId) { return publishedByStop.get(stopId) || []; }
const authorName = id => (authorsById.get(id) || {}).display_name || (en() ? 'A contributor' : 'En tipsare');

// ── Sektion i stopp-vyn: publicerade community-tips + "Lämna tips" ──────────
export function stopBlockHtml(stopId) {
  const list = tipsForStop(stopId);
  const items = list.map(tp => {
    const isImg = tp.media_url && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(tp.media_url);
    const corr = tp.kind === 'correction';
    return `<div class="contrib-item">
      ${isImg ? `<img class="contrib-img" src="${esc(tp.media_url)}" alt="" loading="lazy">` : ''}
      <div class="contrib-body">
        ${tp.title ? `<b>${corr ? '✎ ' : ''}${esc(tp.title)}</b>` : ''}
        ${tp.body ? `<p>${esc(tp.body)}</p>` : ''}
        <small>${en() ? 'Submitted by' : 'Inskickat av'} ${esc(authorName(tp.author_id))}</small>
      </div></div>`;
  }).join('');
  return `<div class="contrib-section">
    ${list.length ? `<div class="contrib-h">🧺 ${t('contrib_section')}</div>${items}` : ''}
    <button class="contrib-add" data-tip="${stopId}">➕ ${t('tip_add')}</button>
  </div>`;
}
export function wireStopBlock(root, stopId) {
  const b = root.querySelector('[data-tip]');
  if (b) b.onclick = () => openTipForm({ stopId, kind: 'memory' });
}

// ── Foto: optimera (app.js) + ladda upp till Storage, returnera publik URL ──
function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/:(.*?);/) || [])[1] || 'image/jpeg';
  const bin = atob(b64), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
async function uploadPhoto(fullDataUrl) {
  const u = getUser(); if (!u) return null;
  const blob = dataUrlToBlob(fullDataUrl);
  const path = `${u.id}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await supa.storage.from('tips').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) { ctx.toast(error.message); return null; }
  const { data } = supa.storage.from('tips').getPublicUrl(path);
  return data.publicUrl;
}

// ── Lämna tips ──────────────────────────────────────────────────────────────
// opts: { stopId?, kind? }. Utan stopId visas en kind-väljare och (för
// minne/rättelse) en stopp-väljare.
export async function openTipForm(opts = {}) {
  await ensureClient();
  if (!supa) { ctx.toast(t('auth_not_ready')); return; }
  const ok = await requireAuth();
  if (!ok) return;

  const overlay = document.querySelector('#contribute');
  const card = document.querySelector('#contrib-card');
  const editTip = opts.editTip || null;     // sätt → komplettera/redigera ett befintligt tips
  let kind = editTip ? editTip.kind : (opts.kind || 'memory');
  let stopId = editTip ? editTip.stop_ref : (opts.stopId || null);
  let coords = (editTip && editTip.lat != null) ? { lat: editTip.lat, lng: editTip.lng } : null;
  let photo = null;             // { full, thumb, kb } — ny/utbytt bild
  let existingMedia = editTip ? editTip.media_url : null;
  let pasteHandler = null;      // dokument-paste-lyssnare (städas vid close)
  let miniMap = null;           // Leaflet-kartväljaren för 'place' (städas vid close)
  let pickMarker = null;

  const dropMiniMap = () => { if (miniMap) { try { miniMap.remove(); } catch (e) {} miniMap = null; pickMarker = null; } };
  const close = () => {
    if (pasteHandler) { document.removeEventListener('paste', pasteHandler); pasteHandler = null; }
    dropMiniMap();
    overlay.setAttribute('aria-hidden', 'true'); if (ctx.restoreFocus) ctx.restoreFocus();
  };
  const stopName = id => { const e = (ctx.DATA || []).find(x => x.id === id); return e ? e.name : id; };

  // Steg 1: kind-väljare (bara när man kommer utan färdigt stopp)
  function renderChooser() {
    card.innerHTML = `
      <button class="fb-x" id="c-x" aria-label="${en() ? 'Close' : 'Stäng'}">&times;</button>
      <h3>${t('tip_add')}</h3>
      <p class="fb-sub">${t('tip_choose_kind')}</p>
      <div class="tip-kinds">
        <button class="tip-kind" data-k="memory"><span>📷</span><b>${t('tip_kind_memory')}</b><small>${t('tip_kind_memory_d')}</small></button>
        <button class="tip-kind" data-k="place"><span>📍</span><b>${t('tip_kind_place')}</b><small>${t('tip_kind_place_d')}</small></button>
        <button class="tip-kind" data-k="correction"><span>✎</span><b>${t('tip_kind_correction')}</b><small>${t('tip_kind_correction_d')}</small></button>
      </div>`;
    card.querySelector('#c-x').onclick = close;
    card.querySelectorAll('.tip-kind').forEach(b => b.onclick = () => {
      kind = b.dataset.k;
      if (kind === 'place') { coords = mapCenter(); renderForm(); }
      else renderStopPicker();
    });
    focusX();
  }

  function mapCenter() {
    try { const c = ctx.map.getCenter(); return { lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) }; }
    catch (e) { return null; }
  }

  // ── Kartväljare: peka ut platsen (dra nålen eller tryck på kartan) ──────────
  function setCoordTxt() {
    const tx = card.querySelector('#tip-coord-txt');
    if (tx) tx.textContent = coords ? `📍 ${coords.lat}, ${coords.lng}` : t('tip_no_coords');
  }
  function setCoords(lat, lng) { coords = { lat: +(+lat).toFixed(6), lng: +(+lng).toFixed(6) }; setCoordTxt(); }
  function initPicker() {
    const el = card.querySelector('#tip-map');
    if (!el || !window.L) return;
    const start = coords || mapCenter() || { lat: 58.327, lng: 15.13 };
    if (!coords) setCoords(start.lat, start.lng);
    miniMap = window.L.map(el, { zoomControl: true, attributionControl: false }).setView([start.lat, start.lng], 15);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(miniMap);
    pickMarker = window.L.marker([start.lat, start.lng], { draggable: true }).addTo(miniMap);
    pickMarker.on('dragend', () => { const ll = pickMarker.getLatLng(); setCoords(ll.lat, ll.lng); });
    miniMap.on('click', (e) => { pickMarker.setLatLng(e.latlng); setCoords(e.latlng.lat, e.latlng.lng); });
    setTimeout(() => { try { miniMap.invalidateSize(); } catch (e) {} }, 60);
  }

  // Steg 2 (minne/rättelse utan stopp): välj vilket stopp
  function renderStopPicker() {
    const entries = (ctx.DATA || []);
    const renderList = q => {
      const ql = (q || '').toLowerCase().trim();
      const hits = entries.filter(e => !ql || (e.name + ' ' + (e.summary || '')).toLowerCase().includes(ql)).slice(0, 40);
      return hits.map(e => `<li><button class="stop-row" data-pick="${e.id}">
        <span class="stop-meta"><b>${esc(e.name)}</b><small>${esc((ctx.CAT_LABEL && ctx.CAT_LABEL[e.category]) || '')}</small></span>
      </button></li>`).join('') || `<li class="stories-empty">${en() ? 'Nothing found.' : 'Inget hittades.'}</li>`;
    };
    card.innerHTML = `
      <button class="fb-x" id="c-x" aria-label="${en() ? 'Close' : 'Stäng'}">&times;</button>
      <h3>${kind === 'correction' ? t('tip_kind_correction') : t('tip_kind_memory')}</h3>
      <p class="fb-sub">${t('tip_pick_stop')}</p>
      <div class="stories-search"><input id="tip-stopq" type="search" placeholder="${en() ? 'Search…' : 'Sök…'}"></div>
      <ol class="stop-list tip-stoplist" id="tip-stoplist">${renderList('')}</ol>`;
    card.querySelector('#c-x').onclick = close;
    const q = card.querySelector('#tip-stopq');
    const bind = () => card.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { stopId = b.dataset.pick; renderForm(); });
    q.oninput = () => { card.querySelector('#tip-stoplist').innerHTML = renderList(q.value); bind(); };
    bind();
    focusX();
  }

  // Steg 3: formuläret
  function renderForm() {
    dropMiniMap();
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'image/*';
    const isPlace = kind === 'place';
    const heading = editTip ? t('tip_edit_resubmit')
      : isPlace ? t('tip_add_place')
      : kind === 'correction' ? `${t('tip_kind_correction')} · ${esc(stopName(stopId))}`
      : `${t('tip_kind_memory')} · ${esc(stopName(stopId))}`;
    const hasMediaPreview = existingMedia && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(existingMedia);
    // Nyttjanderätt krävs alltid; "uppgifterna stämmer"-intyget krävs för platser.
    const consentHtml = `<div class="tip-consent" id="tip-consent">
        ${isPlace ? `<label class="tip-check"><input type="checkbox" id="tip-c-acc"> <span>${t('tip_consent_accuracy')}</span></label>` : ''}
        <label class="tip-check"><input type="checkbox" id="tip-c-rights"> <span>${t('tip_consent_rights')}</span></label>
      </div>`;
    card.innerHTML = `
      <button class="fb-x" id="c-x" aria-label="${en() ? 'Close' : 'Stäng'}">&times;</button>
      <h3>${heading}</h3>
      ${editTip && editTip.info_request
        ? `<div class="tip-inforeq">📝 ${t('tip_info_requested')}<br><b>${esc(editTip.info_request)}</b></div>`
        : `<p class="fb-sub">${t('tip_form_sub')}</p>`}
      <input class="fb-email" id="tip-title" placeholder="${isPlace ? t('tip_place_name_ph') : t('tip_title_ph')}" aria-label="${t('tip_title_ph')}">
      <textarea class="fb-text" id="tip-body" rows="4" placeholder="${t('tip_body_ph')}" aria-label="${t('tip_body_ph')}"></textarea>
      ${isPlace ? `<div class="tip-mapwrap">
        <div class="tip-map" id="tip-map"></div>
        <div class="tip-coords" id="tip-coords">
          <span id="tip-coord-txt">${coords ? `📍 ${coords.lat}, ${coords.lng}` : t('tip_no_coords')}</span>
          <button class="om-link" id="tip-gps" type="button">📡 ${t('tip_use_gps')}</button>
        </div>
        <small class="fb-sub">${t('tip_map_hint')}</small></div>` : ''}
      <div class="contrib-photo-area" id="tip-photo-area">${hasMediaPreview ? `<div class="contrib-preview"><img src="${esc(existingMedia)}" alt=""></div>` : ''}</div>
      <button class="fb-cta" id="tip-photo-btn" type="button">${existingMedia ? t('contrib_changephoto') : t('contrib_addphoto')}</button>
      <small class="fb-sub" id="tip-photo-hint">${t('photo_enhance_hint')}</small>
      <input class="fb-email" id="tip-era" placeholder="${t('contrib_year')}" aria-label="${t('contrib_year')}">
      <input class="fb-email" id="tip-source" placeholder="${t('contrib_credit')}" aria-label="${t('contrib_credit')}">
      ${consentHtml}
      <button class="cta" id="tip-send" style="margin:4px 0 0">${t('contrib_send')}</button>
      <p class="auth-fine" id="tip-msg"></p>`;
    card.querySelector('#c-x').onclick = close;
    if (editTip) {
      const ti = card.querySelector('#tip-title'); if (ti) ti.value = editTip.title || '';
      const bo = card.querySelector('#tip-body'); if (bo) bo.value = editTip.body || '';
    }
    // Förbättra + förhandsvisa en vald/inklistrad bild (delas av fil-val och paste)
    const applyPhotoFile = (f) => {
      if (!f || !/^image\//.test(f.type || '')) return;
      const area = card.querySelector('#tip-photo-area');
      if (area) area.innerHTML = `<div class="contrib-optimizing">${t('optimizing')}</div>`;
      ctx.optimizeImage(f, opt => {
        photo = opt;
        const a = card.querySelector('#tip-photo-area');
        if (a) a.innerHTML = `<div class="contrib-preview"><img src="${opt.thumb}" alt=""><span class="contrib-kb">~${opt.kb} kB</span></div>`;
        const btn = card.querySelector('#tip-photo-btn'); if (btn) btn.textContent = t('contrib_changephoto');
      });
    };
    card.querySelector('#tip-photo-btn').onclick = () => fileInput.click();
    fileInput.onchange = () => applyPhotoFile(fileInput.files && fileInput.files[0]);

    // Klistra in bild (Ctrl/Cmd+V) var som helst i formuläret → samma förbättring
    if (pasteHandler) document.removeEventListener('paste', pasteHandler);
    pasteHandler = (e) => {
      const items = e.clipboardData && e.clipboardData.items; if (!items) return;
      for (const it of items){
        if (it.type && it.type.indexOf('image/') === 0){
          const f = it.getAsFile();
          if (f){ e.preventDefault(); applyPhotoFile(f); break; }
        }
      }
    };
    document.addEventListener('paste', pasteHandler);
    if (isPlace) initPicker();
    const gps = card.querySelector('#tip-gps');
    if (gps) gps.onclick = () => {
      if (!navigator.geolocation) { ctx.toast(en() ? 'Geolocation not supported' : 'Platstjänst stöds inte'); return; }
      ctx.toast(en() ? 'Locating…' : 'Letar position…');
      navigator.geolocation.getCurrentPosition(pos => {
        setCoords(pos.coords.latitude, pos.coords.longitude);
        if (miniMap && pickMarker) { miniMap.setView([coords.lat, coords.lng], 16); pickMarker.setLatLng([coords.lat, coords.lng]); }
      }, () => ctx.toast(en() ? 'Could not get position' : 'Kunde inte hämta position'), { enableHighAccuracy: true, timeout: 8000 });
    };
    card.querySelector('#tip-send').onclick = submit;
    focusX();
  }

  const msg = (text, ok) => { const m = card.querySelector('#tip-msg'); if (m) { m.textContent = text; m.className = 'auth-fine' + (ok ? ' ok' : text ? ' err' : ''); } };

  async function submit() {
    const title = (card.querySelector('#tip-title').value || '').trim();
    const body = (card.querySelector('#tip-body').value || '').trim();
    if (!title) { msg(t('tip_need_title'), false); return; }
    if (kind === 'place' && !coords) { msg(t('tip_need_coords'), false); return; }
    // Samtycke: nyttjanderätt alltid; "uppgifterna stämmer" för platser.
    const accEl = card.querySelector('#tip-c-acc');
    const rightsEl = card.querySelector('#tip-c-rights');
    if ((rightsEl && !rightsEl.checked) || (accEl && !accEl.checked)) { msg(t('tip_need_consent'), false); return; }
    const btn = card.querySelector('#tip-send'); btn.disabled = true; msg(t('tip_sending'), true);
    try {
      let media_url = existingMedia;
      if (photo) media_url = await uploadPhoto(photo.full);
      const era = (card.querySelector('#tip-era').value || '').trim();
      const source = (card.querySelector('#tip-source').value || '').trim();
      const fullBody = (era || source)
        ? [body, era && `(${era})`, source && `— ${source}`].filter(Boolean).join(' ')
        : (body || null);
      if (editTip) {
        const { error } = await supa.from('tips').update({
          title, body: fullBody, media_url,
          lat: coords ? coords.lat : null, lng: coords ? coords.lng : null,
          consent: true, status: 'pending',
        }).eq('id', editTip.id);
        if (error) throw error;
      } else {
        const { error } = await supa.from('tips').insert({
          kind, city: city(),
          stop_ref: kind === 'place' ? null : stopId,
          title, body: fullBody, media_url,
          lat: coords ? coords.lat : null, lng: coords ? coords.lng : null,
          consent: true,
          author_id: getUser().id,
        });
        if (error) throw error;
      }
      dropMiniMap();
      card.innerHTML = `<div class="fb-thanks"><div class="fb-thanks-emoji">💛</div>
        <p>${editTip ? t('tip_resubmit_thanks') : t('tip_thanks')}</p>
        <button class="cta" id="tip-done">${en() ? 'Close' : 'Stäng'}</button></div>`;
      card.querySelector('#tip-done').onclick = () => {
        close();
        if (opts.onSaved) opts.onSaved();
        if (stopId && ctx.openSheet && document.querySelector('#sheet').getAttribute('aria-hidden') === 'false') ctx.openSheet(stopId);
      };
    } catch (e) { btn.disabled = false; msg(e.message || String(e), false); }
  }

  function focusX() { setTimeout(() => { const x = card.querySelector('#c-x'); if (x) x.focus(); }, 30); }

  overlay.setAttribute('aria-hidden', 'false');
  if (ctx.markFocus) ctx.markFocus();
  if (editTip || opts.stopId || opts.kind) renderForm(); else renderChooser();
}

// Dedikerad ingång: "Lägg till plats" → hoppa direkt till plats-formuläret.
export function openAddPlace(opts = {}) { return openTipForm({ kind: 'place', onSaved: opts.onSaved }); }

// ── Granska-kö (Granskare+ / admin) ─────────────────────────────────────────
export async function openReviewQueue() {
  await ensureClient();
  if (!supa) { ctx.toast(t('auth_not_ready')); return; }
  const ok = await requireAuth();
  if (!ok) return;
  if (!canReview()) { ctx.toast(t('review_locked')); return; }

  const overlay = document.querySelector('#review');
  const card = document.querySelector('#review-card');
  const me = getUser();
  const admin = isAdmin();
  const close = () => { overlay.setAttribute('aria-hidden', 'true'); if (ctx.restoreFocus) ctx.restoreFocus(); };
  overlay.setAttribute('aria-hidden', 'false');
  if (ctx.markFocus) ctx.markFocus();

  async function load() {
    card.innerHTML = `<button class="fb-x" id="r-x" aria-label="${en() ? 'Close' : 'Stäng'}">&times;</button>
      <h3>${t('review')}</h3><p class="fb-sub">${t('review_loading')}</p>`;
    card.querySelector('#r-x').onclick = close;
    const { data: tips, error } = await supa.from('tips').select('*')
      .eq('city', city()).eq('status', 'pending').neq('author_id', me.id)
      .order('created_at', { ascending: true });
    if (error) { render([], error.message); return; }
    const ids = (tips || []).map(tp => tp.id);
    let mine = {};
    if (ids.length) {
      const { data: myReviews } = await supa.from('tip_reviews').select('tip_id, vote').eq('reviewer_id', me.id).in('tip_id', ids);
      (myReviews || []).forEach(r => mine[r.tip_id] = r.vote);
    }
    render(tips || [], null, mine);
  }

  function render(tips, err, mine = {}) {
    const stopName = id => { const e = (ctx.DATA || []).find(x => x.id === id); return e ? e.name : id; };
    const items = tips.map(tp => {
      const isImg = tp.media_url && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(tp.media_url);
      const kindLbl = tp.kind === 'place' ? t('tip_kind_place') : tp.kind === 'correction' ? t('tip_kind_correction') : t('tip_kind_memory');
      const where = tp.stop_ref ? esc(stopName(tp.stop_ref)) : (tp.lat ? `📍 ${tp.lat}, ${tp.lng}` : '');
      const myVote = mine[tp.id];
      return `<div class="review-item" data-row="${tp.id}">
        ${isImg ? `<img class="contrib-img" src="${esc(tp.media_url)}" alt="">` : ''}
        <div class="contrib-body">
          <small class="rev-kind">${kindLbl}${where ? ' · ' + where : ''} · ${en() ? 'score' : 'poäng'} ${tp.score} (${tp.review_count})</small>
          <b>${esc(tp.title)}</b>${tp.body ? `<p>${esc(tp.body)}</p>` : ''}
        </div>
        <div class="review-actions">
          <button class="rev-ok ${myVote === 'approve' ? 'cast' : ''}" data-ok="${tp.id}">👍 ${t('approve')}</button>
          <button class="rev-no ${myVote === 'reject' ? 'cast' : ''}" data-no="${tp.id}">👎 ${t('reject')}</button>
          ${admin ? `<button class="rev-admin" data-pub="${tp.id}">⚡ ${t('admin_publish')}</button>
                     <button class="rev-admin" data-info="${tp.id}">📝 ${t('admin_request_info')}</button>
                     <button class="rev-admin danger" data-rej="${tp.id}">⛔ ${t('admin_reject')}</button>` : ''}
        </div></div>`;
    }).join('');
    card.innerHTML = `<button class="fb-x" id="r-x" aria-label="${en() ? 'Close' : 'Stäng'}">&times;</button>
      <h3>${t('review')} ${admin ? '🛡️' : ''}</h3>
      <p class="fb-sub">${admin ? t('review_sub_admin') : t('review_sub')}</p>
      ${err ? `<div class="auth-fine err">${esc(err)}</div>` : ''}
      ${items || `<div class="screen-empty">${t('review_empty')}</div>`}`;
    card.querySelector('#r-x').onclick = close;
    card.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => vote(b.dataset.ok, 'approve'));
    card.querySelectorAll('[data-no]').forEach(b => b.onclick = () => vote(b.dataset.no, 'reject'));
    card.querySelectorAll('[data-pub]').forEach(b => b.onclick = () => adminDecide(b.dataset.pub, 'published'));
    card.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => adminDecide(b.dataset.rej, 'rejected'));
    card.querySelectorAll('[data-info]').forEach(b => b.onclick = () => requestInfo(b.dataset.info));
  }

  async function requestInfo(tipId) {
    const note = window.prompt(t('admin_request_info_prompt'), '');
    if (note == null || !note.trim()) return;
    const { error } = await supa.rpc('admin_request_info', { p_tip_id: tipId, p_note: note.trim() });
    if (error) { ctx.toast(error.message); return; }
    ctx.toast('📝 ' + t('admin_request_info'));
    await refreshCity();
    load();
  }

  async function vote(tipId, v) {
    const { error } = await supa.from('tip_reviews')
      .upsert({ tip_id: tipId, reviewer_id: me.id, vote: v }, { onConflict: 'tip_id,reviewer_id' });
    if (error) { ctx.toast(error.message); return; }
    ctx.toast(v === 'approve' ? '👍 ' + t('approve') : '👎 ' + t('reject'));
    await refreshCity();
    load();
  }
  async function adminDecide(tipId, status) {
    const reason = status === 'rejected' ? (window.prompt(t('admin_reason'), 'spam') || 'admin') : 'admin';
    const { error } = await supa.rpc('admin_decide_tip', { p_tip_id: tipId, p_status: status, p_reason: reason });
    if (error) { ctx.toast(error.message); return; }
    ctx.toast('🛡️ ' + (status === 'published' ? t('admin_publish') : t('admin_reject')));
    await refreshCity();
    load();
  }

  load();
}

// ── Profil-sektion: Lämna tips · Granska · Mina tips ────────────────────────
export function mountTipsProfile(el, opts = {}) {
  if (!isConfigured()) return;
  const wrap = document.createElement('div');
  wrap.className = 'tips-profile';
  el.appendChild(wrap);

  async function render() {
    const user = getUser();
    if (!user) { wrap.innerHTML = ''; return; }
    const review = canReview()
      ? `<button class="fb-cta" id="tp-review">🔎 ${t('review')}</button>`
      : `<div class="review-lock">🔒 ${t('review_unlock_hint')}</div>`;
    wrap.innerHTML = `
      <h3 class="prof-h">${t('tip_my_section')}</h3>
      <button class="cta" id="tp-addplace">📍 ${t('tip_add_place')}</button>
      <button class="fb-cta" id="tp-add">➕ ${t('tip_add')}</button>
      ${review}
      <div id="tp-mine" class="tp-mine"><div class="contrib-optimizing">${t('review_loading')}</div></div>`;
    wrap.querySelector('#tp-addplace').onclick = () => openTipForm({ kind: 'place', onSaved: loadMine });
    wrap.querySelector('#tp-add').onclick = () => openTipForm({ onSaved: loadMine });
    const rv = wrap.querySelector('#tp-review'); if (rv) rv.onclick = openReviewQueue;
    loadMine();
  }

  async function loadMine() {
    const box = wrap.querySelector('#tp-mine'); if (!box) return;
    const user = getUser(); if (!user) return;
    const { data, error } = await supa.from('tips')
      .select('id, kind, title, body, media_url, lat, lng, status, score, review_count, stop_ref, info_request, created_at')
      .eq('author_id', user.id).order('created_at', { ascending: false });
    if (error) { box.innerHTML = `<div class="auth-fine err">${esc(error.message)}</div>`; return; }
    if (!data || !data.length) { box.innerHTML = `<div class="screen-empty">${t('tip_none')}</div>`; return; }
    const stat = { pending: t('status_pending'), published: t('status_published'), rejected: t('status_rejected'), withdrawn: t('status_withdrawn'), needs_info: t('status_needs_info') };
    box.innerHTML = data.map(tp => {
      const needs = tp.status === 'needs_info';
      return `<div class="tp-row${needs ? ' tp-needs' : ''}">
        <span class="tp-meta"><b>${esc(tp.title)}</b>
          <small>${stat[tp.status] || tp.status}${tp.status === 'pending' ? ` · ${en() ? 'score' : 'poäng'} ${tp.score}` : ''}</small>
          ${needs && tp.info_request ? `<small class="tp-inforeq">📝 ${esc(tp.info_request)}</small>` : ''}
        </span>
        ${needs ? `<button class="tp-resubmit" data-edit="${tp.id}">${t('tip_edit_resubmit')}</button>`
                : `<span class="tp-status s-${tp.status}">${stat[tp.status] || tp.status}</span>`}
      </div>`;
    }).join('');
    box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const tp = data.find(x => x.id === b.dataset.edit);
      if (tp) openTipForm({ editTip: tp, onSaved: loadMine });
    });
  }

  render();
  onAuthChange(render);
}
