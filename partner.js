// ── partner.js — partner-ansökan (partners.html) ─────────────────────────────
// Skriver en rad i partner_applications (anonym insert tillåten via RLS).
// Fredrik godkänner sedan i admin (admin_approve_partner). CSP script-src 'self'.
import { getSupabase, isConfigured } from './config.js';

// Tier-knapparna (Kommun/Hembygd/Företag) förväljer typ i formuläret och rullar dit.
// CSP är script-src 'self' → ingen inline-JS; vi kopplar allt här.
const TYPE_LABELS = {
  kommun:  'Kommun / turism',
  hembygd: 'Hembygdsgård / förening',
  foretag: 'Butik / café / restaurang / företag (299 kr/år)',
  annat:   'Annat',
};
document.querySelectorAll('[data-partner-type]').forEach(el => {
  el.addEventListener('click', () => {
    const sel = document.getElementById('partner-type');
    if (sel) sel.value = el.getAttribute('data-partner-type') || '';
  });
});

const form = document.getElementById('partner-form');
if (form) {
  const msg = (t, ok) => {
    const m = document.getElementById('partner-msg');
    if (m) { m.textContent = t; m.style.color = ok ? '#2e7d32' : (t ? '#c0392b' : 'inherit'); }
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const org_name = (fd.get('org_name') || '').toString().trim();
    const email = (fd.get('email') || '').toString().trim();
    if (!org_name || !email.includes('@')) { msg('Fyll i företag och en giltig e-post.', false); return; }

    const btn = document.getElementById('partner-submit');
    if (btn) btn.disabled = true;
    msg('Skickar…', true);

    if (!isConfigured()) { msg('Kunde inte skicka just nu — mejla partner@stadsvandring.io.', false); if (btn) btn.disabled = false; return; }
    const sb = await getSupabase();
    if (!sb) { msg('Kunde inte skicka just nu — mejla partner@stadsvandring.io.', false); if (btn) btn.disabled = false; return; }

    // Partnertyp lagras inte i egen kolumn (undviker schemaändring) — prependas i
    // about-fältet så Fredrik ser vilken typ det gäller i admin.
    const ptype = (fd.get('partner_type') || '').toString().trim();
    const aboutRaw = (fd.get('about') || '').toString().trim();
    const typeLine = ptype ? `[Typ: ${TYPE_LABELS[ptype] || ptype}]` : '';
    const about = [typeLine, aboutRaw].filter(Boolean).join('\n') || null;

    const { error } = await sb.from('partner_applications').insert({
      org_name,
      contact_name: (fd.get('contact_name') || '').toString().trim() || null,
      email,
      city: (fd.get('city') || '').toString().trim() || null,
      about,
      building_story: (fd.get('building_story') || '').toString().trim() || null,
    });

    if (error) {
      console.warn('partner-ansökan:', error.message);
      msg('Något gick fel — mejla oss gärna på partner@stadsvandring.io.', false);
      if (btn) btn.disabled = false;
      return;
    }

    form.reset();
    msg('Tack! Vi har fått er ansökan och hör av oss inom kort. 💛', true);
  });
}
