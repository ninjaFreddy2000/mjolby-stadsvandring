// ── billing.js — betalning, tillgång & paywall (Stripe via edge functions) ────
// Isolerad modul (samma mönster som auth.js/tips.js). Läser användarens EGNA
// entitlements/city_purchases (RLS skyddar dem) och avgör tillgång; köp och
// uppsägning går via edge functions som redirectar till Stripes hostade sidor.
//
//   Två nivåer:
//     • Stadsjakten (prenumeration 49 kr/mån) → låser upp alla städer
//     • En stad (engångsköp 19 kr) → låser upp den staden för alltid
//
// Gaten är en KONVERTERINGS-mekanism, inte DRM — samma filosofi som leads-gaten.
import { getSupabase, isConfigured, FUNCTIONS_BASE, PRICES, BILLING_ENABLED } from './config.js';
import { requireAuth, getUser, onAuthChange } from './auth.js';

let ctx = null;
let supa = null;
const state = { stadsjakt: false, cities: new Set(), ready: false };
const listeners = [];

const t = k => (ctx && ctx.t ? ctx.t(k) : k);
const en = () => ctx && ctx.lang === 'en';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const toast = m => { if (ctx && ctx.toast) ctx.toast(m); };

export function onBillingChange(cb) { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; }
function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) {} }); }

export function isStadsjakt() { return !!state.stadsjakt; }
export function unlockedCities() { return [...state.cities]; }
export function billingReady() { return state.ready; }

// Kärnfrågan appen ställer: får den här användaren gå den här stadens vandring?
export function hasAccess(city) {
  if (!BILLING_ENABLED) return true;          // paywall av tills Stripe är live
  if (state.stadsjakt) return true;
  return state.cities.has(String(city || '').toLowerCase());
}

export async function initBilling(context) {
  ctx = context;
  if (!isConfigured()) { state.ready = true; emit(); return; }
  supa = await getSupabase();
  await refreshEntitlements();
  state.ready = true;
  emit();
  // Vid in-/utloggning: läs om tillgången.
  onAuthChange(() => { refreshEntitlements().then(emit); });
}

export async function refreshEntitlements() {
  state.stadsjakt = false;
  state.cities = new Set();
  if (!supa || !getUser()) return;
  try {
    const [{ data: ent }, { data: purchases }] = await Promise.all([
      supa.from('entitlements').select('status,current_period_end').maybeSingle(),
      supa.from('city_purchases').select('city'),
    ]);
    if (ent && ['active', 'trialing'].includes(ent.status) &&
        (!ent.current_period_end || new Date(ent.current_period_end) > new Date())) {
      state.stadsjakt = true;
    }
    (purchases || []).forEach(p => state.cities.add(String(p.city).toLowerCase()));
  } catch (e) { /* offline / ej konfigurerad → ingen tillgång, tyst */ }
}

async function accessToken() {
  if (!supa) supa = await getSupabase();
  if (!supa) return null;
  const { data } = await supa.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

async function callFn(name, payload) {
  const token = await accessToken();
  if (!token) throw new Error(en() ? 'Sign in first' : 'Logga in först');
  const res = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload || {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(body.error || res.statusText); e.code = body.error; throw e; }
  return body;
}

// Startar Stripe Checkout och lämnar sidan. plan: 'stadsjakt' | 'city'.
export async function startCheckout(plan, city) {
  const ok = await requireAuth();
  if (!ok) return;
  toast(en() ? 'Opening checkout…' : 'Öppnar kassan…');
  try {
    const { url } = await callFn('create-checkout', { plan, city: city || null, lang: en() ? 'en' : 'sv' });
    if (url) location.assign(url);
  } catch (e) {
    if (e.code === 'already_owned') { await refreshEntitlements(); emit(); toast(en() ? 'You already own this walk.' : 'Du äger redan den här vandringen.'); return; }
    toast((en() ? 'Checkout failed: ' : 'Kassan misslyckades: ') + (e.message || ''));
  }
}

// Öppnar Stripes kundportal (säg upp / ändra / kvitton).
export async function openPortal() {
  toast(en() ? 'Opening your subscription…' : 'Öppnar ditt abonnemang…');
  try {
    const { url } = await callFn('customer-portal', { lang: en() ? 'en' : 'sv' });
    if (url) location.assign(url);
  } catch (e) {
    if (e.code === 'no_customer') { toast(en() ? 'No active subscription.' : 'Inget aktivt abonnemang.'); return; }
    toast((en() ? 'Could not open portal: ' : 'Kunde inte öppna portalen: ') + (e.message || ''));
  }
}

// Efter återkomst från Stripe (?checkout=success): webhooken kan släpa efter en
// sekund, så vi läser om tillgången några gånger och städar URL:en.
export async function handleCheckoutReturn() {
  const p = new URLSearchParams(location.search);
  const status = p.get('checkout');
  if (!status) return;
  const clean = () => { p.delete('checkout'); p.delete('plan'); p.delete('city');
    const qs = p.toString(); history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); };
  if (status === 'cancel') { clean(); toast(en() ? 'Checkout cancelled.' : 'Köpet avbröts.'); return; }
  if (status === 'success') {
    for (let i = 0; i < 5; i++) {
      await refreshEntitlements();
      if (state.stadsjakt || state.cities.size) break;
      await new Promise(r => setTimeout(r, 1200));
    }
    emit();
    clean();
    toast(state.stadsjakt
      ? (en() ? '🎉 Stadsjakten unlocked!' : '🎉 Stadsjakten upplåst!')
      : (en() ? '🎉 Walk unlocked — enjoy!' : '🎉 Vandringen upplåst — ha så kul!'));
  }
}

/* ── Paywall-overlay ─────────────────────────────────────────────────────────
   Egen isolerad overlay (rör inte auth-overlayen). Injicerar scoped stilar en
   gång. Returnerar en Promise som resolvar true om användaren just fick tillgång
   (t.ex. redan ägde), annars false — appen kan då släppa in / stanna kvar. */
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return; stylesInjected = true;
  const css = `
  #paywall{position:fixed;inset:0;z-index:9000;display:none;align-items:flex-end;justify-content:center;background:rgba(12,18,36,.55);backdrop-filter:blur(3px)}
  #paywall[aria-hidden="false"]{display:flex}
  #paywall .pw-card{background:var(--card,#fff);color:var(--ink,#1b2a4a);width:100%;max-width:460px;border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));box-shadow:0 -8px 40px rgba(0,0,0,.28);animation:pwUp .28s cubic-bezier(.2,.8,.2,1)}
  @media(min-width:520px){#paywall{align-items:center}#paywall .pw-card{border-radius:22px}}
  @keyframes pwUp{from{transform:translateY(24px);opacity:.6}to{transform:none;opacity:1}}
  #paywall .pw-x{float:right;border:0;background:transparent;font-size:26px;line-height:1;color:var(--muted,#5a6680);cursor:pointer}
  #paywall h3{margin:.1em 0 .1em;font-size:1.28rem}
  #paywall .pw-sub{color:var(--muted,#5a6680);margin:.2em 0 1em;font-size:.96rem}
  #paywall .pw-opt{border:1.5px solid var(--line,#e6dcc6);border-radius:16px;padding:14px 16px;margin:0 0 12px;display:flex;flex-direction:column;gap:10px}
  #paywall .pw-opt.feat{border-color:var(--accent,#0A2A6B)}
  #paywall .pw-opt .pw-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  #paywall .pw-opt b{font-size:1.05rem}
  #paywall .pw-price{font-weight:800;font-size:1.15rem;white-space:nowrap}
  #paywall .pw-opt small{color:var(--muted,#5a6680);display:block;line-height:1.45}
  #paywall .pw-tag{display:inline-block;background:var(--accent,#0A2A6B);color:#fff;font-size:.72rem;font-weight:700;border-radius:999px;padding:2px 9px;margin-left:6px;vertical-align:middle}
  #paywall .cta{width:100%}
  #paywall .pw-fine{text-align:center;color:var(--muted,#5a6680);font-size:.8rem;margin:.6em 0 0}
  #paywall .pw-fine a{color:inherit}`;
  const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
}

function ensureOverlay() {
  let o = document.querySelector('#paywall');
  if (o) return o;
  o = document.createElement('div');
  o.id = 'paywall'; o.setAttribute('aria-hidden', 'true'); o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
  o.innerHTML = '<div class="pw-card" id="pw-card"></div>';
  document.body.appendChild(o);
  o.addEventListener('click', e => { if (e.target === o) o.setAttribute('aria-hidden', 'true'); });
  return o;
}

const CTA_LABEL = (plan) => plan === 'stadsjakt'
  ? (en() ? 'Get Stadsjakten' : 'Skaffa Stadsjakten')
  : (en() ? 'Unlock this walk' : 'Lås upp vandringen');

// city: staden som gaten gäller (för "Lås upp <stad> 19 kr"). cityName: visningsnamn.
export function openPaywall(city, cityName) {
  injectStyles();
  const o = ensureOverlay();
  const card = o.querySelector('#pw-card');
  const priceCity = en() ? PRICES.city.label_en : PRICES.city.label_sv;
  const priceSub = en() ? PRICES.stadsjakt.label_en : PRICES.stadsjakt.label_sv;
  const name = cityName || (city ? city[0].toUpperCase() + city.slice(1) : (en() ? 'this town' : 'staden'));

  const soon = !BILLING_ENABLED;
  card.innerHTML = `
    <button class="pw-x" id="pw-x" aria-label="${en() ? 'Close' : 'Stäng'}">&times;</button>
    <h3>🚶 ${en() ? 'Unlock the guided walk' : 'Lås upp den guidade vandringen'}</h3>
    <p class="pw-sub">${en()
      ? `Turn-by-turn route, stories, audio and quiz through ${esc(name)}. Support keeps the walks free of ads.`
      : `Vägbeskrivning, berättelser, ljud och quiz genom ${esc(name)}. Ditt stöd håller vandringarna reklamfria.`}</p>

    <div class="pw-opt feat">
      <div class="pw-row">
        <b>Stadsjakten <span class="pw-tag">${en() ? 'ALL TOWNS' : 'ALLA STÄDER'}</span></b>
        <span class="pw-price">${priceSub}</span>
      </div>
      <small>${en() ? 'Every walk in every town, new towns as they launch. Cancel anytime.' : 'Alla vandringar i alla städer, nya städer när de kommer. Säg upp när du vill.'}</small>
      <button class="cta" id="pw-sub" ${soon ? 'disabled' : ''}>${soon ? (en() ? 'Coming soon' : 'Kommer snart') : CTA_LABEL('stadsjakt')}</button>
    </div>

    <div class="pw-opt">
      <div class="pw-row">
        <b>${en() ? `${esc(name)} — one walk` : `${esc(name)} — en vandring`}</b>
        <span class="pw-price">${priceCity}</span>
      </div>
      <small>${en() ? 'Unlock this town once, keep it forever.' : 'Lås upp den här staden en gång, behåll den för alltid.'}</small>
      <button class="cta" id="pw-city" style="background:transparent;color:var(--accent,#0A2A6B);border:1.5px solid var(--accent,#0A2A6B)" ${soon || !city ? 'disabled' : ''}>${soon ? (en() ? 'Coming soon' : 'Kommer snart') : CTA_LABEL('city')}</button>
    </div>

    <p class="pw-fine">${en() ? 'Secure payment via Stripe · ' : 'Säker betalning via Stripe · '}<a href="/integritet">${en() ? 'Privacy' : 'Integritet'}</a></p>`;

  card.querySelector('#pw-x').onclick = () => o.setAttribute('aria-hidden', 'true');
  const sub = card.querySelector('#pw-sub'); if (sub && !soon) sub.onclick = () => startCheckout('stadsjakt');
  const cty = card.querySelector('#pw-city'); if (cty && !soon && city) cty.onclick = () => startCheckout('city', city);
  o.setAttribute('aria-hidden', 'false');
}

// Gate-helper för appen: släpp igenom om tillgång finns, annars öppna paywall.
// Returnerar true om användaren får fortsätta.
export function requireAccess(city, cityName) {
  if (hasAccess(city)) return true;
  openPaywall(city, cityName);
  return false;
}

/* ── Konto-sektion (monteras i Profil-fliken, under auth-profilen) ────────────
   Visar nivå, upplåsta städer och knappar för köp/uppsägning. */
export function mountBillingProfile(el, opts = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'billing-profile';
  el.appendChild(wrap);

  function render() {
    if (!isConfigured() || !getUser()) { wrap.innerHTML = ''; return; }
    const cities = unlockedCities();
    let levelHtml;
    if (state.stadsjakt) {
      levelHtml = `<span class="tier-badge">🗝️ Stadsjakten</span>`;
    } else if (cities.length) {
      levelHtml = `<span class="tier-badge">🎫 ${cities.length} ${en() ? (cities.length === 1 ? 'town' : 'towns') : (cities.length === 1 ? 'stad' : 'städer')}</span>`;
    } else {
      levelHtml = `<span class="tier-badge">${en() ? 'Free' : 'Gratis'}</span>`;
    }
    const citiesLabel = cities.length
      ? `<p class="fb-sub" style="margin:.4em 0 0">${en() ? 'Unlocked: ' : 'Upplåst: '}${cities.map(c => esc(c[0].toUpperCase() + c.slice(1))).join(', ')}</p>`
      : '';

    let actions = '';
    if (state.stadsjakt) {
      actions = `<button class="om-link" id="bp-portal">💳 ${en() ? 'Manage / cancel subscription' : 'Hantera / säg upp abonnemang'}</button>`;
    } else {
      actions = `<button class="cta" id="bp-buy">🗝️ ${en() ? 'Get Stadsjakten — ' : 'Skaffa Stadsjakten — '}${en() ? PRICES.stadsjakt.label_en : PRICES.stadsjakt.label_sv}</button>`;
      if (cities.length) actions += `<button class="om-link" id="bp-portal">🧾 ${en() ? 'Receipts' : 'Kvitton'}</button>`;
    }

    wrap.innerHTML = `
      <div class="acc-sub-card">
        <div class="acc-sub-head">
          <b>${en() ? 'Your access' : 'Din tillgång'}</b>
          ${levelHtml}
        </div>
        ${citiesLabel}
        <div class="acc-actions" style="margin-top:10px">${actions}</div>
        <p class="fb-sub" style="margin:.7em 0 0;font-size:.8rem"><a href="/integritet" style="color:inherit">${en() ? 'Privacy policy' : 'Integritetspolicy'}</a></p>
      </div>`;

    const buy = wrap.querySelector('#bp-buy'); if (buy) buy.onclick = () => startCheckout('stadsjakt');
    const portal = wrap.querySelector('#bp-portal'); if (portal) portal.onclick = () => openPortal();
  }

  render();
  const off1 = onBillingChange(render);
  const off2 = onAuthChange(render);
  return () => { off1(); off2(); };
}
