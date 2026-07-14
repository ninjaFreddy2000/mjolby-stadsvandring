// ── partner.js — partner-ansökan (partners.html) ─────────────────────────────
// Skriver en rad i partner_applications (anonym insert tillåten via RLS).
// Fredrik godkänner sedan i admin (admin_approve_partner). CSP script-src 'self'.
import { getSupabase, isConfigured } from './config.js';

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

    const { error } = await sb.from('partner_applications').insert({
      org_name,
      contact_name: (fd.get('contact_name') || '').toString().trim() || null,
      email,
      city: (fd.get('city') || '').toString().trim() || null,
      about: (fd.get('about') || '').toString().trim() || null,
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
