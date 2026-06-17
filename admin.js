// ── admin.js — enkel admin-dashboard + installationsguide ───────────────────
// Isolerad modul (samma mönster som tips.js/challenges.js). All känslig läsning
// skyddas av RLS i Supabase (profiles/tips/events syns bara för is_admin());
// den här filen är bara UI + anrop. Installationsguiden är öppen för alla.
import { getSupabase, isConfigured, APP_CITY } from './config.js';
import { isAdmin, getUser } from './auth.js';

let ctx = null, supa = null;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const en = () => ctx && ctx.lang === 'en';

// Lokal, självförsörjande ordlista (admin är svensk-primärt men appen kan växla).
const L = {
  sv: {
    title: 'Admin', sub: 'Översikt över användare, aktivitet och förslag.',
    loading: 'Hämtar…', refresh: 'Uppdatera', close: 'Stäng',
    k_users: 'Användare', k_new: 'Nya (7 dgr)', k_open: 'Att åtgärda', k_sessions: 'Sessioner (7 dgr)',
    h_users: '👥 Användare', u_total: 'Konton totalt', u_new: 'Nya senaste 7 dagarna', u_byTier: 'Per nivå',
    u_top: 'Toppbidragsgivare', u_none: 'Inga konton än.',
    h_activity: '📊 Aktivitet', a_note: 'Anonym förstaparts-data — inga cookies, ingen PII.',
    a_opens: 'App-öppningar', a_tours: 'Turstarter', a_checkins: 'Incheckningar',
    a_topPlaces: 'Mest öppnade platser', a_byCity: 'Per stad', a_none: 'Ingen data än.',
    h_tips: '💬 Förslag-loopen', t_pending: 'Väntar', t_needs: 'Komplettering', t_pub: 'Publicerade', t_rej: 'Avslagna',
    t_open: 'Öppna förslag att hantera', t_none: 'Inga öppna förslag — allt är hanterat. 🎉',
    t_pubBtn: '⚡ Publicera', t_rejBtn: '⛔ Avslå', t_infoBtn: '📝 Be om mer info',
    t_reason: 'Orsak (spam/abuse/duplicate/admin):', t_infoPrompt: 'Vad behöver kompletteras?',
    t_by: 'av', t_waiting: 'väntar på svar',
    h_install: '📲 Installera som app', install_open: 'Visa installationsguide',
    done: 'Klart', acted: 'Hanterat',
  },
  en: {
    title: 'Admin', sub: 'Overview of users, activity and suggestions.',
    loading: 'Loading…', refresh: 'Refresh', close: 'Close',
    k_users: 'Users', k_new: 'New (7d)', k_open: 'To handle', k_sessions: 'Sessions (7d)',
    h_users: '👥 Users', u_total: 'Total accounts', u_new: 'New in the last 7 days', u_byTier: 'By level',
    u_top: 'Top contributors', u_none: 'No accounts yet.',
    h_activity: '📊 Activity', a_note: 'Anonymous first-party data — no cookies, no PII.',
    a_opens: 'App opens', a_tours: 'Tour starts', a_checkins: 'Check-ins',
    a_topPlaces: 'Most opened places', a_byCity: 'By city', a_none: 'No data yet.',
    h_tips: '💬 Suggestion loop', t_pending: 'Pending', t_needs: 'Needs info', t_pub: 'Published', t_rej: 'Rejected',
    t_open: 'Open suggestions to handle', t_none: 'No open suggestions — all handled. 🎉',
    t_pubBtn: '⚡ Publish', t_rejBtn: '⛔ Reject', t_infoBtn: '📝 Request more info',
    t_reason: 'Reason (spam/abuse/duplicate/admin):', t_infoPrompt: 'What needs completing?',
    t_by: 'by', t_waiting: 'awaiting reply',
    h_install: '📲 Install as an app', install_open: 'Show install guide',
    done: 'Done', acted: 'Handled',
  },
};
const tx = k => (L[en() ? 'en' : 'sv'][k] ?? k);

const TIER_LABEL = { tipsare: '🌱 Tipsare', granskare: '🔎 Granskare', ortskannare: '🏅 Ortskännare' };

export function initAdmin(context) { ctx = context; }
async function ensureClient() { if (!supa && isConfigured()) supa = await getSupabase(); return supa; }
export function adminAvailable() { return isConfigured() && isAdmin(); }

// ── Admin-dashboard ──────────────────────────────────────────────────────────
export async function openAdminDashboard() {
  await ensureClient();
  if (!supa || !isAdmin()) { ctx.toast(en() ? 'Admins only' : 'Endast admin'); return; }
  const overlay = document.querySelector('#admin');
  const card = document.querySelector('#admin-card');
  const close = () => { overlay.setAttribute('aria-hidden', 'true'); if (ctx.restoreFocus) ctx.restoreFocus(); };
  overlay.setAttribute('aria-hidden', 'false');
  if (ctx.markFocus) ctx.markFocus();

  const WEEK = 7 * 24 * 3600 * 1000;
  const stat = (v, l) => `<div class="prog-box"><b>${v}</b><small>${esc(l)}</small></div>`;
  const nameOf = id => { const x = (ctx.DATA || []).find(d => d.id === id); return x ? x.name : id; };
  const tally = (rows, key) => {
    const m = {}; rows.forEach(e => { const k = key(e); if (k) m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  async function load() {
    card.innerHTML = `<button class="fb-x" id="adm-x" aria-label="${tx('close')}">&times;</button>
      <h3>🛡️ ${tx('title')}</h3><p class="fb-sub">${tx('loading')}</p>`;
    card.querySelector('#adm-x').onclick = close;

    const now = Date.now();
    // Parallella läsningar (alla admin-skyddade via RLS).
    const [pRes, eRes, tRes] = await Promise.all([
      supa.from('profiles').select('id,display_name,tier,is_admin,reputation,published_count,created_at').limit(2000),
      supa.from('events').select('name,city,session,props,ts').order('ts', { ascending: false }).limit(5000),
      // select('*') so the dashboard survives whether or not the place-contributions
      // migration (which adds info_request/consent) has been deployed yet.
      supa.from('tips').select('*')
        .eq('city', APP_CITY).order('created_at', { ascending: false }).limit(500),
    ]);
    if (pRes.error || tRes.error) {
      card.innerHTML = `<button class="fb-x" id="adm-x">&times;</button><h3>🛡️ ${tx('title')}</h3>
        <p class="auth-fine err">${esc((pRes.error || tRes.error).message)}</p>`;
      card.querySelector('#adm-x').onclick = close; return;
    }
    const profiles = pRes.data || [], ev = eRes.data || [], tips = tRes.data || [];

    // Användare
    const nameById = {}; profiles.forEach(p => nameById[p.id] = p.display_name || (en() ? 'Contributor' : 'Tipsare'));
    const newUsers = profiles.filter(p => p.created_at && (now - new Date(p.created_at).getTime()) < WEEK).length;
    const byTier = ['tipsare', 'granskare', 'ortskannare'].map(tr => [tr, profiles.filter(p => p.tier === tr && !p.is_admin).length]);
    const admins = profiles.filter(p => p.is_admin).length;
    const topContrib = profiles.filter(p => (p.published_count || 0) > 0)
      .sort((a, b) => (b.published_count || 0) - (a.published_count || 0)).slice(0, 6);

    // Aktivitet (anonyma events)
    const cnt = nm => ev.filter(e => e.name === nm).length;
    const recent = ev.filter(e => e.ts && (now - new Date(e.ts).getTime()) < WEEK);
    const sessions7 = new Set(recent.map(e => e.session)).size;
    const topPlaces = tally(ev.filter(e => e.name === 'stop_open'), e => e.props && e.props.id).slice(0, 6);
    const byCity = tally(ev.filter(e => e.city), e => e.city).slice(0, 6);

    // Förslag-loopen
    const byStatus = s => tips.filter(t => t.status === s).length;
    const open = tips.filter(t => t.status === 'pending' || t.status === 'needs_info');

    const liNum = (rows, fmt) => rows.length ? rows.map(fmt).join('') : `<li class="ch-empty">${tx('a_none')}</li>`;

    card.innerHTML = `
      <button class="fb-x" id="adm-x" aria-label="${tx('close')}">&times;</button>
      <h3>🛡️ ${tx('title')}</h3>
      <p class="fb-sub">${tx('sub')}</p>

      <div class="prog-stat adm-kpi">
        ${stat(profiles.length, tx('k_users'))}
        ${stat(newUsers, tx('k_new'))}
        ${stat(open.length, tx('k_open'))}
        ${stat(sessions7, tx('k_sessions'))}
      </div>

      <h4 class="cb-h">${tx('h_tips')}</h4>
      <div class="adm-pills">
        <span class="adm-pill warn">${byStatus('pending')} ${tx('t_pending')}</span>
        <span class="adm-pill warn">${byStatus('needs_info')} ${tx('t_needs')}</span>
        <span class="adm-pill ok">${byStatus('published')} ${tx('t_pub')}</span>
        <span class="adm-pill">${byStatus('rejected')} ${tx('t_rej')}</span>
      </div>
      <div class="adm-tips" id="adm-tips">
        ${open.length ? open.map(tp => {
          const where = tp.kind === 'place' ? '📍' : '✎';
          const needs = tp.status === 'needs_info';
          return `<div class="adm-tip" data-row="${tp.id}">
            <div class="adm-tip-main">
              <b>${where} ${esc(tp.title)}</b>
              <small>${tx('t_by')} ${esc(nameById[tp.author_id] || '—')}${needs ? ` · ⏳ ${tx('t_waiting')}` : ''}</small>
              ${tp.body ? `<p>${esc(tp.body)}</p>` : ''}
              ${needs && tp.info_request ? `<p class="adm-inforeq">📝 ${esc(tp.info_request)}</p>` : ''}
            </div>
            <div class="adm-tip-actions">
              <button class="rev-admin" data-pub="${tp.id}">${tx('t_pubBtn')}</button>
              <button class="rev-admin" data-info="${tp.id}">${tx('t_infoBtn')}</button>
              <button class="rev-admin danger" data-rej="${tp.id}">${tx('t_rejBtn')}</button>
            </div>
          </div>`;
        }).join('') : `<div class="screen-empty">${tx('t_none')}</div>`}
      </div>

      <h4 class="cb-h">${tx('h_users')}</h4>
      <ul class="admin-list">
        <li><span>${tx('u_total')}</span><b>${profiles.length}</b></li>
        <li><span>${tx('u_new')}</span><b>${newUsers}</b></li>
        ${byTier.map(([tr, c]) => `<li><span>${TIER_LABEL[tr]}</span><b>${c}</b></li>`).join('')}
        <li><span>🛡️ Admin</span><b>${admins}</b></li>
      </ul>
      ${topContrib.length ? `<h5 class="adm-h5">${tx('u_top')}</h5><ul class="admin-list">${
        topContrib.map(p => `<li><span>${esc(p.display_name || '—')}</span><b>${p.published_count} · ${p.reputation}p</b></li>`).join('')}</ul>` : ''}

      <h4 class="cb-h">${tx('h_activity')}</h4>
      <p class="fb-sub">${tx('a_note')}</p>
      <div class="prog-stat">
        ${stat(cnt('app_open'), tx('a_opens'))}
        ${stat(cnt('tour_start'), tx('a_tours'))}
        ${stat(cnt('checkin'), tx('a_checkins'))}
      </div>
      <h5 class="adm-h5">${tx('a_topPlaces')}</h5>
      <ul class="admin-list">${liNum(topPlaces, ([id, c]) => `<li><span>${esc(nameOf(id))}</span><b>${c}</b></li>`)}</ul>
      <h5 class="adm-h5">${tx('a_byCity')}</h5>
      <ul class="admin-list">${liNum(byCity, ([c, v]) => `<li><span>${esc(c)}</span><b>${v}</b></li>`)}</ul>

      <h4 class="cb-h">${tx('h_install')}</h4>
      <button class="fb-cta" id="adm-install">${tx('install_open')}</button>

      <button class="ch-btn-ghost" id="adm-refresh" style="margin-top:14px">↻ ${tx('refresh')}</button>`;

    card.querySelector('#adm-x').onclick = close;
    card.querySelector('#adm-refresh').onclick = load;
    card.querySelector('#adm-install').onclick = () => openInstallGuide();
    card.querySelectorAll('[data-pub]').forEach(b => b.onclick = () => decide(b.dataset.pub, 'published'));
    card.querySelectorAll('[data-rej]').forEach(b => b.onclick = () => decide(b.dataset.rej, 'rejected'));
    card.querySelectorAll('[data-info]').forEach(b => b.onclick = () => requestInfo(b.dataset.info));
  }

  async function decide(id, status) {
    const reason = status === 'rejected' ? (window.prompt(tx('t_reason'), 'spam') || 'admin') : 'admin';
    const { error } = await supa.rpc('admin_decide_tip', { p_tip_id: id, p_status: status, p_reason: reason });
    if (error) { ctx.toast(error.message); return; }
    ctx.toast('🛡️ ' + tx('acted')); load();
  }
  async function requestInfo(id) {
    const note = window.prompt(tx('t_infoPrompt'), '');
    if (note == null || !note.trim()) return;
    const { error } = await supa.rpc('admin_request_info', { p_tip_id: id, p_note: note.trim() });
    if (error) { ctx.toast(error.message); return; }
    ctx.toast('📝 ' + tx('done')); load();
  }

  load();
}

// ── Installationsguide (öppen för alla) ──────────────────────────────────────
export function openInstallGuide() {
  const overlay = document.querySelector('#install');
  const card = document.querySelector('#install-card');
  const close = () => { overlay.setAttribute('aria-hidden', 'true'); if (ctx && ctx.restoreFocus) ctx.restoreFocus(); };
  overlay.setAttribute('aria-hidden', 'false');
  if (ctx && ctx.markFocus) ctx.markFocus();

  const ua = navigator.userAgent || '';
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (/(macintosh)/i.test(ua) && 'ontouchend' in document);
  const isAndroid = /android/i.test(ua);
  const installed = matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const platform = installed ? 'done' : isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

  const D = {
    sv: {
      title: '📲 Installera Stadsvandring.io', close: 'Stäng',
      lead: 'Spara appen på hemskärmen så öppnas den i helskärm, laddar snabbare och fungerar även offline.',
      done: '✓ Appen är redan installerad — du kör den som en app just nu.',
      ios_h: 'iPhone / iPad (Safari)', ios: ['Tryck på <b>Dela</b>-knappen (fyrkanten med pilen uppåt) i verktygsfältet.', 'Bläddra ner och välj <b>Lägg till på hemskärmen</b>.', 'Tryck <b>Lägg till</b> uppe till höger. Ikonen hamnar på hemskärmen.'],
      and_h: 'Android (Chrome)', and: ['Tryck på <b>⋮</b>-menyn uppe till höger.', 'Välj <b>Installera app</b> (eller <b>Lägg till på startskärmen</b>).', 'Bekräfta med <b>Installera</b>.'],
      desk_h: 'Dator (Chrome / Edge)', desk: ['Klicka på <b>installationsikonen</b> (⊕ eller en skärm-ikon) längst till höger i adressfältet.', 'Eller öppna menyn <b>⋮</b> → <b>Installera Stadsvandring.io…</b>', 'Klicka <b>Installera</b>. Appen får ett eget fönster och en ikon.'],
      note: 'Tips: ser du ingen installationsknapp? Ladda om sidan en gång, eller använd menyn enligt stegen ovan.',
      yours: 'Din enhet',
    },
    en: {
      title: '📲 Install Stadsvandring.io', close: 'Close',
      lead: 'Add the app to your home screen for full-screen, faster loading and offline use.',
      done: '✓ The app is already installed — you’re running it as an app right now.',
      ios_h: 'iPhone / iPad (Safari)', ios: ['Tap the <b>Share</b> button (square with an up arrow) in the toolbar.', 'Scroll down and choose <b>Add to Home Screen</b>.', 'Tap <b>Add</b> in the top right. The icon lands on your home screen.'],
      and_h: 'Android (Chrome)', and: ['Tap the <b>⋮</b> menu in the top right.', 'Choose <b>Install app</b> (or <b>Add to Home screen</b>).', 'Confirm with <b>Install</b>.'],
      desk_h: 'Desktop (Chrome / Edge)', desk: ['Click the <b>install icon</b> (⊕ or a monitor icon) at the right of the address bar.', 'Or open the <b>⋮</b> menu → <b>Install Stadsvandring.io…</b>', 'Click <b>Install</b>. The app gets its own window and an icon.'],
      note: 'Tip: no install button? Reload the page once, or use the menu steps above.',
      yours: 'Your device',
    },
  };
  const d = D[en() ? 'en' : 'sv'];
  const block = (key, head, steps) => `<div class="ig-block${platform === key ? ' ig-here' : ''}">
      <h4>${head}${platform === key ? ` <span class="ig-badge">${d.yours}</span>` : ''}</h4>
      <ol>${steps.map(s => `<li>${s}</li>`).join('')}</ol></div>`;

  card.innerHTML = `
    <button class="fb-x" id="ig-x" aria-label="${d.close}">&times;</button>
    <h3>${d.title}</h3>
    <p class="fb-sub">${d.lead}</p>
    ${installed ? `<div class="ig-done">${d.done}</div>` : ''}
    ${block('ios', d.ios_h, d.ios)}
    ${block('android', d.and_h, d.and)}
    ${block('desktop', d.desk_h, d.desk)}
    <p class="fb-sub" style="margin-top:12px">${d.note}</p>`;
  card.querySelector('#ig-x').onclick = close;
  setTimeout(() => { const x = card.querySelector('#ig-x'); if (x) x.focus(); }, 30);
}
