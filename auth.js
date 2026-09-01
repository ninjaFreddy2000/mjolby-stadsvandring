// ── auth.js — inloggning, session & profil (Supabase) ─────────────────────
// Isolerad modul, importeras av app.js (samma mönster som challenges.js). Får ett
// context-objekt (ctx) med översättning/toast/fokus-helpers. tips.js läser samma
// session via getState()/getProfile().
import { getSupabase, isConfigured, SHARE_URL, EMAIL_DELIVERY, GOOGLE_LOGIN } from './config.js';
import { ico } from './icons.js';

// Vart användaren ska landa efter inloggning. MÅSTE vara appen, inte roten:
// index.html laddar bara webbsida.js, alltså ingen Supabase-klient. En magisk
// länk, en kontobekräftelse, en lösenordsåterställning eller en Google-retur som
// pekade på '/' lämnade token:en i URL:en helt okonsumerad — inloggningen tystnade
// utan felmeddelande. app.js kör med detectSessionInUrl och plockar upp den.
const APP_URL = () => location.origin + '/karta';

// Vilka OAuth-providers som är påslagna läses i KÖRTID från Supabase publika
// /auth/v1/settings, i stället för en hårdkodad flagga som måste kodändras och
// deployas. Slår Fredrik på Google i dashboarden dyker knappen upp av sig själv.
let _providers = null;
async function enabledProviders() {
  if (_providers) return _providers;
  try {
    const base = (await import('./config.js')).SUPABASE_URL;
    const key = (await import('./config.js')).SUPABASE_ANON_KEY;
    const r = await fetch(base.replace(/\/$/, '') + '/auth/v1/settings', { headers: { apikey: key } });
    _providers = (await r.json()).external || {};
  } catch (e) { _providers = {}; }
  return _providers;
}

let ctx = null;
let supa = null;
const state = { user: null, profile: null, ready: false, modCities: [] };
const listeners = [];

const t = k => (ctx && ctx.t ? ctx.t(k) : k);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

export function getState() { return state; }
export function getUser() { return state.user; }
export function getProfile() { return state.profile; }
export function isLoggedIn() { return !!state.user; }
export function onAuthChange(cb) { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; }
function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) {} }); }

const TIERS = {
  tipsare:    { sv: 'Tipsare',    en: 'Contributor',  emoji: '🌱' },
  granskare:  { sv: 'Granskare',  en: 'Reviewer',     emoji: '🔎' },
  ortskannare:{ sv: 'Ortskännare',en: 'Local expert', emoji: '🏅' },
};
export function tierLabel(tier) {
  const ti = TIERS[tier] || TIERS.tipsare;
  return `${ti.emoji} ${ctx && ctx.lang === 'en' ? ti.en : ti.sv}`;
}
export function tierEmoji(tier) { return (TIERS[tier] || TIERS.tipsare).emoji; }

// Säkerställer Supabase-klienten även om en snabb användare hinner klicka innan
// initAuth:s CDN-import är klar (annars dör login-knappen tyst).
async function ensureClient() { if (!supa && isConfigured()) supa = await getSupabase(); return supa; }

export async function initAuth(context) {
  ctx = context;
  if (!isConfigured()) { state.ready = true; emit(); return; }
  supa = await getSupabase();
  if (!supa) { state.ready = true; emit(); return; }

  const { data } = await supa.auth.getSession();
  state.user = data && data.session ? data.session.user : null;
  await refreshProfile();
  state.ready = true;
  emit();

  supa.auth.onAuthStateChange(async (evt, session) => {
    const next = session ? session.user : null;
    const changed = (next && next.id) !== (state.user && state.user.id);
    state.user = next;
    await refreshProfile();
    emit();
    // Användaren klickade på återställningslänken i mejlet → låt hen sätta nytt lösenord
    if (evt === 'PASSWORD_RECOVERY') { openSetNewPassword(); return; }
    if (changed && next && ctx && ctx.toast) ctx.toast('💛 ' + t('auth_signed_in'));
  });
}

// Visas när användaren kommit in via en återställningslänk (PASSWORD_RECOVERY).
export function openSetNewPassword() {
  if (!supa) return;
  const overlay = document.querySelector('#auth');
  const card = document.querySelector('#auth-card');
  const en = ctx && ctx.lang === 'en';
  const msg = (txt, ok) => { const m = card.querySelector('#np-msg'); if (m) { m.textContent = txt; m.className = 'auth-fine' + (ok ? ' ok' : txt ? ' err' : ''); } };
  function render() {
    card.innerHTML = `<button class="fb-x" id="np-x" aria-label="${en ? 'Close' : 'Stäng'}">&times;</button>
      <h3>${t('auth_new_pw_title')}</h3>
      <p class="fb-sub">${t('auth_new_pw_sub')}</p>
      <input class="fb-email" id="np-pw" type="password" autocomplete="new-password" placeholder="${t('auth_pw_ph')}" aria-label="${t('auth_pw_ph')}">
      <button class="cta" id="np-save" style="margin:6px 0 0">${t('auth_new_pw_save')}</button>
      <p class="auth-fine" id="np-msg"></p>`;
    card.querySelector('#np-x').onclick = () => { overlay.setAttribute('aria-hidden', 'true'); if (ctx && ctx.restoreFocus) ctx.restoreFocus(); };
    card.querySelector('#np-save').onclick = save;
    setTimeout(() => { const e = card.querySelector('#np-pw'); if (e) e.focus(); }, 30);
  }
  async function save() {
    const pw = (card.querySelector('#np-pw') || {}).value;
    if (!pw || pw.length < 6) { msg(t('auth_pw_short'), false); return; }
    msg(t('auth_working'), true);
    const { error } = await supa.auth.updateUser({ password: pw });
    if (error) { msg(error.message, false); return; }
    await refreshProfile(); emit();
    overlay.setAttribute('aria-hidden', 'true'); if (ctx && ctx.restoreFocus) ctx.restoreFocus();
    if (ctx && ctx.toast) ctx.toast(t('auth_pw_updated'));
  }
  overlay.setAttribute('aria-hidden', 'false');
  if (ctx && ctx.markFocus) ctx.markFocus();
  render();
}

export async function refreshProfile() {
  if (!supa || !state.user) { state.profile = null; return null; }
  const { data, error } = await supa
    .from('profiles')
    .select('id, display_name, city, tier, is_admin, reputation, published_count, trust_active_at, intent, bio, home_city')
    .eq('id', state.user.id)
    .maybeSingle();
  if (error) { console.warn('profil-fel', error); }
  state.profile = data || null;
  // Moderatorskap är en egen tabell, inte en kolumn på profilen — hämtas med.
  state.modCities = [];
  if (state.profile) {
    const { data: m } = await supa.rpc('my_moderated_cities');
    state.modCities = (m || []).map(r => r.city);
  }
  return state.profile;
}

export function moderatedCities() { return state.modCities; }
export function moderatesAnyCity() { return state.modCities.length > 0; }
export function moderatesCity(slug) { return state.modCities.includes(slug); }

export function client() { return supa; }
// Granska andras bidrag kräver TVÅ saker: nivån, och att man står för något.
// Wikipedias användarsida-norm — ska du döma andras arbete får du presentera dig.
// Admin är undantagen; hen är redan känd.
export function canReview() {
  const p = state.profile;
  if (!p) return false;
  if (p.is_admin) return true;
  // Är man stadsmoderator har man redan förtjänat förtroendet — och har per
  // definition en presentation, eftersom den krävs för att bli det.
  if (moderatesAnyCity()) return true;
  const nivå = p.tier === 'granskare' || p.tier === 'ortskannare';
  return nivå && hasBio();
}
export function hasBio() {
  const p = state.profile;
  return !!(p && p.bio && p.bio.trim().length >= 40);
}
// Varför granskningen är låst — så UI:t kan säga rätt sak i stället för "nej".
export function reviewBlocker() {
  const p = state.profile;
  if (!p) return 'login';
  if (canReview()) return null;
  const nivå = p.tier === 'granskare' || p.tier === 'ortskannare';
  return nivå ? 'bio' : 'tier';
}

// Sparar användarens egna fält. Betrodda kolumner (tier, reputation, is_admin)
// skyddas av en trigger i databasen — klienten kan inte röra dem oavsett.
export async function saveProfileFields(fields) {
  if (!supa || !state.user) return { error: { message: 'inte inloggad' } };
  const tillåtna = ['display_name', 'bio', 'home_city', 'intent'];
  const rad = {};
  for (const k of tillåtna) if (k in fields) rad[k] = fields[k];
  const { error } = await supa.from('profiles').update(rad).eq('id', state.user.id);
  if (!error) await refreshProfile();
  return { error };
}

// Städer där jag är moderator. Tom lista = ingen — det är normalläget.
export async function myModeratedCities() {
  if (!supa || !state.user) return [];
  if (state.modCities.length) return state.modCities;      // redan laddad med profilen
  const { data, error } = await supa.rpc('my_moderated_cities');
  if (error) return [];
  state.modCities = (data || []).map(r => r.city);
  return state.modCities;
}
export function isAdmin() { return !!(state.profile && state.profile.is_admin); }

// ── Login-overlay ──────────────────────────────────────────────────────────
// Returnerar en Promise som resolveras (true) när användaren loggat in, annars
// false när dialogen stängs. tips.js använder detta för "kräver inloggning".
export function requireAuth() {
  if (state.user) return Promise.resolve(true);
  return openLogin();
}

export function openLogin() {
  return new Promise(resolve => { (async () => {
    await ensureClient();
    if (!supa) {
      if (ctx && ctx.toast) ctx.toast(t('auth_not_ready'));
      return resolve(false);
    }
    const overlay = document.querySelector('#auth');
    const card = document.querySelector('#auth-card');
    let mode = 'signup';   // 'magic' | 'password' | 'signup' — instant (autoconfirm) default så ingen fastnar på ett uteblivet mejl
    // Fliken ritas inte utan EMAIL_DELIVERY, men läget kan sättas via data-mode.
    if (!EMAIL_DELIVERY && mode === 'magic') mode = 'password';
    let done = false;
    const close = (ok) => {
      if (done) return; done = true;
      overlay.setAttribute('aria-hidden', 'true');
      if (ctx && ctx.restoreFocus) ctx.restoreFocus();
      resolve(!!ok);
    };

    function render() {
      const en = ctx && ctx.lang === 'en';
      const tabs = `
        <div class="fb-types auth-tabs">
          ${EMAIL_DELIVERY ? `<button class="fb-chip ${mode === 'magic' ? 'on' : ''}" data-mode="magic">${t('auth_tab_magic')}</button>` : ''}
          <button class="fb-chip ${mode === 'password' ? 'on' : ''}" data-mode="password">${t('auth_tab_password')}</button>
          <button class="fb-chip ${mode === 'signup' ? 'on' : ''}" data-mode="signup">${t('auth_tab_signup')}</button>
        </div>`;
      const emailField = `<input class="fb-email" id="auth-email" type="email" autocomplete="email" placeholder="${t('auth_email_ph')}" aria-label="${t('auth_email_ph')}">`;
      const pwField = `<input class="fb-email" id="auth-pw" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" placeholder="${t('auth_pw_ph')}" aria-label="${t('auth_pw_ph')}">`;
      let body, submitLabel;
      if (mode === 'magic') { body = emailField; submitLabel = t('auth_send_magic'); }
      else if (mode === 'password') { body = emailField + pwField; submitLabel = t('auth_login'); }
      else { body = emailField + pwField; submitLabel = t('auth_create'); }

      card.innerHTML = `
        <button class="fb-x" id="auth-x" aria-label="${en ? 'Close' : 'Stäng'}">&times;</button>
        <h3>${t('auth_title')}</h3>
        <p class="fb-sub">${t('auth_sub')}</p>
        <div id="auth-oauth"></div>
        ${tabs}
        ${body}
        <button class="cta" id="auth-submit" style="margin:6px 0 0">${submitLabel}</button>
        ${mode === 'password' && EMAIL_DELIVERY ? `<button class="auth-link" id="auth-forgot" type="button">${t('auth_forgot')}</button>` : ''}
        <p class="auth-fine" id="auth-msg"></p>`;
      card.querySelector('#auth-x').onclick = () => close(false);
      // Google-knappen ritas in när vi vet att providern är påslagen. Att visa
      // den annars ger bara "provider is not enabled" i ansiktet på användaren.
      enabledProviders().then(p => {
        const slot = card.querySelector('#auth-oauth');
        // GOOGLE_LOGIN är av så länge Supabase har fel client secret — annars
        // ritas en knapp som alltid kastar tillbaka användaren utloggad.
        if (!slot || !p.google || !GOOGLE_LOGIN) return;
        slot.innerHTML = `<button class="auth-google" id="auth-google" type="button">
            <span class="g-mark">G</span> ${t('auth_google')}
          </button>
          <div class="auth-or"><span>${t('auth_or')}</span></div>`;
        slot.querySelector('#auth-google').onclick = googleLogin;
      });
      card.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; render(); });
      card.querySelector('#auth-submit').onclick = submit;
      const fp = card.querySelector('#auth-forgot'); if (fp) fp.onclick = forgot;
      setTimeout(() => { const x = card.querySelector('#auth-x'); if (x) x.focus(); }, 30);
    }

    const msg = (text, ok) => {
      const m = card.querySelector('#auth-msg');
      if (m) { m.textContent = text; m.className = 'auth-fine' + (ok ? ' ok' : text ? ' err' : ''); }
    };

    async function googleLogin() {
      msg(t('auth_redirecting'), true);
      const { error } = await supa.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: APP_URL() },
      });
      if (error) msg(error.message, false);
    }

    async function submit() {
      const email = (card.querySelector('#auth-email') || {}).value;
      const pw = (card.querySelector('#auth-pw') || {}).value;
      if (!email || !email.includes('@')) { msg(t('auth_bad_email'), false); return; }
      const btn = card.querySelector('#auth-submit');
      btn.disabled = true; msg(t('auth_working'), true);
      try {
        if (mode === 'magic') {
          const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: APP_URL() } });
          if (error) throw error;
          card.innerHTML = `<div class="fb-thanks"><div class="fb-thanks-emoji">📨</div>
            <p>${t('auth_magic_sent')}</p>
            <button class="cta" id="auth-done">${ctx && ctx.lang === 'en' ? 'Close' : 'Stäng'}</button></div>`;
          card.querySelector('#auth-done').onclick = () => close(false);
          return;
        }
        if (mode === 'signup') {
          const { data, error } = await supa.auth.signUp({ email, password: pw, options: { emailRedirectTo: APP_URL() } });
          if (error) throw error;
          if (data.session) { close(true); return; }     // confirmations off → signed in
          card.innerHTML = `<div class="fb-thanks"><div class="fb-thanks-emoji">📨</div>
            <p>${t('auth_confirm_sent')}</p>
            <button class="cta" id="auth-done">${ctx && ctx.lang === 'en' ? 'Close' : 'Stäng'}</button></div>`;
          card.querySelector('#auth-done').onclick = () => close(false);
          return;
        }
        const { error } = await supa.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        close(true);
      } catch (e) {
        btn.disabled = false;
        msg(e.message || String(e), false);
      }
    }

    async function forgot() {
      const email = (card.querySelector('#auth-email') || {}).value;
      if (!email || !email.includes('@')) { msg(t('auth_bad_email'), false); return; }
      msg(t('auth_working'), true);
      const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: APP_URL() });
      if (error) { msg(error.message, false); return; }
      card.innerHTML = `<div class="fb-thanks"><div class="fb-thanks-emoji">📨</div>
        <p>${t('auth_reset_sent')}</p>
        <button class="cta" id="auth-done">${ctx && ctx.lang === 'en' ? 'Close' : 'Stäng'}</button></div>`;
      card.querySelector('#auth-done').onclick = () => close(false);
    }

    overlay.setAttribute('aria-hidden', 'false');
    if (ctx && ctx.markFocus) ctx.markFocus();
    render();
  })(); });
}

export async function signOut() {
  if (!supa) return;
  await supa.auth.signOut();
  state.user = null; state.profile = null; state.modCities = []; emit();
  if (ctx && ctx.toast) ctx.toast(t('auth_signed_out'));
}

async function updateDisplayName(name) {
  if (!supa || !state.user) return;
  const clean = (name || '').trim().slice(0, 40);
  if (!clean) return;
  const { error } = await supa.from('profiles').update({ display_name: clean }).eq('id', state.user.id);
  if (error) { if (ctx && ctx.toast) ctx.toast(error.message); return; }
  await refreshProfile();
}

// ── Profil-sektionen (monteras överst i Profil-fliken) ──────────────────────
// onMounted() ger app.js/tips.js en krok att fylla på "Mina tips" m.m.
export function mountAuthProfile(el, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'auth-profile';
  el.prepend(wrap);

  function render() {
    if (!isConfigured()) {
      wrap.innerHTML = `<div class="auth-card-cta soon"><b>${t('auth_account')}</b>
        <p class="fb-sub">${t('auth_soon')}</p></div>`;
      return;
    }
    if (!state.user) {
      wrap.innerHTML = `<div class="auth-card-cta">
        <div class="acc-emoji">👋</div>
        <b>${t('auth_join_title')}</b>
        <p class="fb-sub">${t('auth_join_sub')}</p>
        <button class="cta" id="ap-login">${t('auth_login_share')}</button>
        <button class="om-link" id="ap-share2">${ico('share',17)} ${t('share_app')}</button>
      </div>`;
      wrap.querySelector('#ap-login').onclick = async () => { const ok = await openLogin(); if (ok && opts.onChange) opts.onChange(); };
      const sh = wrap.querySelector('#ap-share2'); if (sh) sh.onclick = shareApp;
      return;
    }
    const p = state.profile || {};
    const name = p.display_name || (state.user.email || '').split('@')[0];
    wrap.innerHTML = `
      <div class="acc-head">
        <div class="acc-av">${tierEmoji(p.tier)}</div>
        <div class="acc-id">
          <b id="ap-name">${esc(name)}</b>
          <small>${esc(state.user.email || '')}</small>
          <span class="tier-badge">${tierLabel(p.tier)}</span>
        </div>
      </div>
      <div class="prog-stat acc-stats">
        <div class="prog-box"><b>${p.reputation ?? 0}</b><small>${t('auth_points')}</small></div>
        <div class="prog-box"><b>${p.published_count ?? 0}</b><small>${t('auth_published')}</small></div>
        <div class="prog-box"><b>${tierEmoji(p.tier)}</b><small>${t('auth_level')}</small></div>
      </div>
      ${nextTierHint(p)}
      <div class="acc-actions">
        <button class="om-link" id="ap-rename">${ico('pencil',16)} ${t('auth_rename')}</button>
        <button class="om-link" id="ap-share">${ico('share',17)} ${t('share_app')}</button>
        <button class="om-link" id="ap-logout">↩︎ ${t('auth_logout')}</button>
      </div>`;
    wrap.querySelector('#ap-logout').onclick = async () => { await signOut(); if (opts.onChange) opts.onChange(); };
    wrap.querySelector('#ap-share').onclick = shareApp;
    wrap.querySelector('#ap-rename').onclick = async () => {
      const cur = (state.profile && state.profile.display_name) || '';
      const nn = window.prompt(t('auth_rename_ph'), cur);
      if (nn != null) { await updateDisplayName(nn); render(); if (opts.onChange) opts.onChange(); }
    };
  }

  function nextTierHint(p) {
    if (p.is_admin) return `<p class="tier-hint">🛡️ ${t('auth_admin_note')}</p>`;
    if (p.tier === 'tipsare') {
      const left = Math.max(0, 3 - (p.published_count || 0));
      return `<p class="tier-hint">${t('auth_to_granskare').replace('{n}', left)}</p>`;
    }
    if (p.tier === 'granskare') {
      const left = Math.max(0, 200 - (p.reputation || 0));
      return `<p class="tier-hint">${t('auth_to_ortskannare').replace('{n}', left)}</p>`;
    }
    return `<p class="tier-hint">⭐ ${t('auth_top_tier')}</p>`;
  }

  render();
  const off = onAuthChange(render);
  return off;
}

export function shareApp() {
  const text = ctx && ctx.lang === 'en'
    ? 'Explore the town with Stadsvandring.io — city walks in Mjölby!'
    : 'Utforska staden med Stadsvandring.io — stadsvandringar i Mjölby!';
  try {
    if (navigator.share) { navigator.share({ title: 'Stadsvandring.io', text, url: SHARE_URL }).catch(() => {}); return; }
    navigator.clipboard.writeText(text + ' ' + SHARE_URL);
    if (ctx && ctx.toast) ctx.toast(t('share_copied'));
  } catch (e) {}
}
