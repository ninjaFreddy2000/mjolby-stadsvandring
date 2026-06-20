// ─────────────────────────────────────────────────────────────────────────
// leadmagnet.js — klientlogik för M1 (PDF-stadsvandring per ort).
//
// VARFÖR EXTERN MODUL: CSP:n är `script-src 'self'` (vercel.json) → ingen
// inline-JS tillåts. All interaktivitet på de genererade landningssidorna
// (/stadsvandring/<ort>) och den gatade guiden (/stadsvandring/<ort>/guide)
// måste därför ligga i den här filen, som serveras från egen origin.
//
// Data skickas från den statiska sidan via ett CSP-säkert
// <script type="application/json" id="lm-data">…</script>-block (icke-exekverbar
// data, tillåten av script-src 'self') och läses här med getElementById.
//
// Två sidtyper, valda via data-lm-page på <body>:
//   "teaser" → Leaflet-karta + signup-gate (lead-insert + magic-länk)
//   "guide"  → låst tills inloggad session finns; annars länk tillbaka till gaten
// ─────────────────────────────────────────────────────────────────────────
import { getSupabase, isConfigured } from './config.js';

const $ = (sel, root = document) => root.querySelector(sel);

// Läs det inbäddade data-blocket (centroid + stopp för kartan, ort-metadata).
function readData() {
  const el = document.getElementById('lm-data');
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch { return null; }
}

// ── Leaflet-teaserkarta ──────────────────────────────────────────────────
// Liten, icke-interaktiv översikt centrerad på orten med markörer för de
// publika teaser-stoppen. Leaflet (UMD) laddas före denna modul via en
// vanlig <script defer> i samma dokumentordning, så window.L finns här.
function initMap(data) {
  const node = document.getElementById('lm-map');
  if (!node || !window.L || !data?.centroid) return;
  const { lat, lng } = data.centroid;
  const map = L.map(node, { scrollWheelZoom: false, attributionControl: true })
    .setView([lat, lng], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap, &copy; CARTO', maxZoom: 19,
  }).addTo(map);

  const pts = (data.stops || []).filter(s => s.lat && s.lng);
  const group = [];
  for (const s of pts) {
    const m = L.marker([s.lat, s.lng]).addTo(map);
    if (s.name) m.bindPopup(`<b>${s.name}</b>`);
    group.push([s.lat, s.lng]);
  }

  // Leaflet beräknar storleken vid init. Om containern ännu saknar bredd (t.ex.
  // layout inte klar) blir kartan tom — invalidateSize() + om-fit när bredd finns
  // löser det robust. Vi kör direkt, vid load, och via ResizeObserver tills bredd>0.
  const fit = () => {
    map.invalidateSize();
    if (group.length > 1) map.fitBounds(group, { padding: [30, 30], maxZoom: 15 });
    else map.setView([lat, lng], 14);
  };
  fit();
  window.addEventListener('load', fit);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => { if (node.clientWidth > 0) { fit(); ro.disconnect(); } });
    ro.observe(node);
  }
}

// ── Signup-gate (teaser) ─────────────────────────────────────────────────
function initGate(data) {
  const form = document.getElementById('lm-gate-form');
  if (!form) return;
  const statusEl = document.getElementById('lm-gate-status');
  const btn = $('button[type="submit"]', form);
  const guideUrl = form.getAttribute('data-guide-url') || '/';

  const setStatus = (msg, kind = '') => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'lm-status' + (kind ? ' ' + kind : '');
  };

  // Redan inloggad? Då behövs ingen gate — skicka direkt till guiden.
  (async () => {
    if (!isConfigured()) return;
    const sb = await getSupabase();
    const { data: s } = await sb?.auth?.getSession?.() || { data: {} };
    if (s?.session) {
      form.hidden = true;
      const go = document.getElementById('lm-gate-unlocked');
      if (go) { go.hidden = false; go.querySelector('a')?.setAttribute('href', guideUrl); }
    }
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (form.email?.value || '').trim();
    const consent = !!form.consent?.checked;
    if (!email) { setStatus('Ange din e-postadress.', 'err'); return; }

    if (!isConfigured()) {
      setStatus('Inloggning är inte konfigurerad ännu — fyll i Supabase-nycklarna i config.js.', 'err');
      return;
    }
    if (btn) btn.disabled = true;
    setStatus('Skickar…');
    const sb = await getSupabase();
    if (!sb) { setStatus('Kunde inte nå servern. Försök igen.', 'err'); if (btn) btn.disabled = false; return; }

    // 1) Registrera leaden direkt (fångas även om magic-länken aldrig klickas).
    const { error: leadErr } = await sb.from('leads').insert({
      email,
      magnet_type: 'pdf',
      city_slug: data?.citySlug || null,
      source_slug: data?.sourceSlug || null,
      consent_marketing: consent,
    });
    if (leadErr) console.warn('lead insert:', leadErr.message);

    // 2) Skicka magic-länk som skapar/loggar in kontot och landar på guiden.
    const redirect = new URL(guideUrl, location.origin);
    redirect.searchParams.set('unlocked', '1');
    const { error } = await sb.auth.signInWithOtp({
      email, options: { emailRedirectTo: redirect.toString() },
    });
    if (error) {
      setStatus('Något gick fel: ' + error.message, 'err');
      if (btn) btn.disabled = false;
    } else {
      setStatus('Klart! Kolla din mejl — klicka på länken så öppnas hela vandringen.', 'ok');
    }
  });
}

// ── Gatad guide ──────────────────────────────────────────────────────────
function initGuide() {
  const locked = document.getElementById('lm-locked');
  const full = document.getElementById('lm-guide-full');
  const printBtn = document.getElementById('lm-print');

  printBtn?.addEventListener('click', () => window.print());

  const reveal = () => {
    if (full) full.hidden = false;
    if (locked) locked.hidden = true;
  };
  const lock = () => {
    if (full) full.hidden = true;
    if (locked) locked.hidden = false;
  };

  // Ingen backend konfigurerad → visa innehållet ändå (lokal demo).
  if (!isConfigured()) { reveal(); return; }

  (async () => {
    const sb = await getSupabase();
    if (!sb) { reveal(); return; }
    // detectSessionInUrl (config.js) växlar in token från magic-länken automatiskt.
    const { data } = await sb.auth.getSession();
    if (data?.session) reveal(); else lock();
    // Reagera om sessionen kommer in strax efter (token-utbyte).
    sb.auth.onAuthStateChange((_e, session) => { if (session) reveal(); });
  })();
}

// ── Faktabank-gate (M3) ───────────────────────────────────────────────────
// Innehållet är publikt (det är AEO-poängen) — gaten fångar bara e-post för
// nyhetsbrevet ("nästa orts faktabank") och belönar med en PDF (window.print).
// Ingen karta, ingen guide-redirect.
function initFaktaGate(data) {
  const form = document.getElementById('lm-fakta-form');
  if (!form) return;
  const statusEl = document.getElementById('lm-fakta-status');
  const reward = document.getElementById('lm-fakta-reward');
  document.getElementById('lm-fakta-print')?.addEventListener('click', () => window.print());

  const setStatus = (msg, kind = '') => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'lm-status' + (kind ? ' ' + kind : '');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (form.email?.value || '').trim();
    const consent = !!form.consent?.checked;
    if (!email) { setStatus('Ange din e-postadress.', 'err'); return; }
    if (!isConfigured()) { setStatus('Inloggning är inte konfigurerad ännu.', 'err'); return; }

    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    setStatus('Skickar…');
    const sb = await getSupabase();
    if (!sb) { setStatus('Kunde inte nå servern. Försök igen.', 'err'); if (btn) btn.disabled = false; return; }

    const { error } = await sb.from('leads').insert({
      email, magnet_type: 'faktabank',
      city_slug: data?.citySlug || null, source_slug: data?.sourceSlug || null,
      consent_marketing: consent,
    });
    if (error) { setStatus('Något gick fel: ' + error.message, 'err'); if (btn) btn.disabled = false; return; }

    setStatus('Tack! Du står på listan. Här är hela faktabanken att spara:', 'ok');
    form.hidden = true;
    if (reward) reward.hidden = false;
  });
}

// ── Kommun-gate (M5 B2B-whitepaper) ───────────────────────────────────────
// Annan köpare än M1/M3 → fångar namn, kommun och roll i leads.meta. Belönar
// med hela whitepapern (reveal + window.print). magnet_type 'whitepaper'.
function initKommunGate(data) {
  const form = document.getElementById('lm-kommun-form');
  if (!form) return;
  const statusEl = document.getElementById('lm-kommun-status');
  const reward = document.getElementById('lm-kommun-reward');
  document.getElementById('lm-kommun-print')?.addEventListener('click', () => window.print());

  const setStatus = (msg, kind = '') => {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.className = 'lm-status' + (kind ? ' ' + kind : '');
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (form.email?.value || '').trim();
    const name = (form.name?.value || '').trim();
    const kommun = (form.kommun?.value || '').trim();
    const roll = (form.roll?.value || '').trim();
    const consent = !!form.consent?.checked;
    if (!email || !name || !kommun) { setStatus('Fyll i namn, kommun och e-post.', 'err'); return; }
    if (!isConfigured()) { setStatus('Inloggning är inte konfigurerad ännu.', 'err'); return; }

    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    setStatus('Skickar…');
    const sb = await getSupabase();
    if (!sb) { setStatus('Kunde inte nå servern. Försök igen.', 'err'); if (btn) btn.disabled = false; return; }

    const { error } = await sb.from('leads').insert({
      email, magnet_type: 'whitepaper',
      city_slug: data?.citySlug || null, source_slug: data?.sourceSlug || 'for-kommuner',
      consent_marketing: consent, meta: { name, kommun, roll },
    });
    if (error) { setStatus('Något gick fel: ' + error.message, 'err'); if (btn) btn.disabled = false; return; }

    setStatus(`Tack ${name.split(' ')[0]}! Här är hela rapporten:`, 'ok');
    form.hidden = true;
    if (reward) reward.hidden = false;
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────
function start() {
  const page = document.body?.getAttribute('data-lm-page');
  const data = readData();
  if (page === 'teaser') { initMap(data); initGate(data); }
  else if (page === 'guide') { initGuide(); }
  else if (page === 'fakta') { initFaktaGate(data); }
  else if (page === 'kommun') { initKommunGate(data); }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else { start(); }
