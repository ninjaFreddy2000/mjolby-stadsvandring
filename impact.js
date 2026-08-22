// ── impact.js — "Ditt avtryck": vad du bidragit med ─────────────────────────
// Liten, fokuserad modul. Profilen visade tidigare bara vad man KONSUMERAT —
// besökta platser, stämplar, sparade. I en app som bärs av frivilliga är det
// fel sida av bytet: den som lagt upp trettio platser och granskat femtio tips
// åt andra ska se det, annars är arbetet osynligt.
//
// Räknar över tips, kommentarer, rutter och granskningar med count-frågor
// (head: true) — inga rader hämtas, bara siffror.
import { getSupabase, isConfigured } from './config.js';
import { getUser, getProfile, tierLabel } from './auth.js';

let ctx = null, supa = null;
const t = k => (ctx && ctx.t ? ctx.t(k) : k);
const en = () => ctx && ctx.lang === 'en';

export function initImpact(context) { ctx = context; }
async function ensureClient() { if (!supa && isConfigured()) supa = await getSupabase(); return supa; }

// En count-fråga. Saknas tabellen (migration inte körd) returneras null, och
// rutan utelämnas i stället för att visa en nolla som ser ut som ett resultat.
async function count(table, filters) {
  try {
    let q = supa.from(table).select('id', { count: 'exact', head: true });
    for (const [col, val] of Object.entries(filters)) q = q.eq(col, val);
    const { count: n, error } = await q;
    if (error) return null;
    return n || 0;
  } catch (e) { return null; }
}

export async function mountImpact(el, opts = {}) {
  if (!isConfigured() || !el) return;
  // Platshållaren sätts in SYNKRONT och prepend:as, så den hamnar direkt under
  // kontokortet (som mountAuthProfile prepend:ar efteråt) i stället för längst
  // ned bland besöksstatistiken. Bidragen är det viktigare talet nu.
  const wrap = document.createElement('div');
  wrap.className = 'impact';
  wrap.innerHTML = `<div class="contrib-optimizing">${t('impact_loading')}</div>`;
  el.prepend(wrap);

  await ensureClient();
  const me = getUser();
  if (!supa || !me) { wrap.remove(); return; }

  const [published, pending, comments, routes, reviews] = await Promise.all([
    count('tips',           { author_id: me.id, status: 'published' }),
    count('tips',           { author_id: me.id, status: 'pending' }),
    count('place_comments', { author_id: me.id, hidden: false }),
    count('routes',         { author_id: me.id }),
    count('tip_reviews',    { reviewer_id: me.id }),
  ]);

  // Bara det som finns visas. En användare som aldrig kommenterat behöver inte
  // en nolla — men den som gjort det ska se sitt tal även om det är litet.
  const boxes = [
    [published, t('impact_published')],
    [comments,  t('impact_comments')],
    [routes,    t('impact_routes')],
    [reviews,   t('impact_reviews')],
  ].filter(([n]) => n !== null);

  if (!boxes.length) { wrap.remove(); return; }

  const p = getProfile() || {};
  const total = boxes.reduce((s, [n]) => s + n, 0);
  // Den som inte bidragit än får en uppmaning i stället för fyra nollor.
  if (total === 0) {
    wrap.innerHTML = `
      <h3 class="prof-h">${t('impact_title')}</h3>
      <div class="impact-empty">
        <p>${t('impact_none')}</p>
        <button class="cta" id="impact-go">${t('impact_start')}</button>
      </div>`;
    const b = wrap.querySelector('#impact-go');
    if (b) b.onclick = () => (opts.onContribute ? opts.onContribute() : null);
    return;
  }

  wrap.innerHTML = `
    <h3 class="prof-h">${t('impact_title')}</h3>
    <div class="prog-stat impact-stat">
      ${boxes.map(([n, label]) => `<div class="prog-box"><b>${n}</b><small>${label}</small></div>`).join('')}
    </div>
    ${pending ? `<p class="impact-pending">⏳ ${pending} ${t('impact_pending')}</p>` : ''}
    <p class="impact-tier">${t('impact_level')}: <b>${tierLabel(p.tier)}</b>${
      p.reputation ? ` · ${p.reputation} ${en() ? 'points' : 'poäng'}` : ''}</p>`;
}
