// ── Supabase-konfiguration ────────────────────────────────────────────────
// Fyll i värdena från ditt Supabase-projekt: Dashboard → Project Settings →
// Data API (URL) och Project Settings → API Keys (anon/public). Båda är PUBLIKA
// och säkra att committa — all säkerhet ligger i RLS, inte i nyckeln.
//
// Tills dessa är ifyllda kör appen vidare i sitt lokala (localStorage-)läge:
// inloggning och community-tips visas som "kommer snart" istället för att krascha.

// Valfri override via webbläsarens localStorage (cfg_supabase_url / cfg_supabase_anon_key).
// Används för lokal demo/test utan att röra de publika värdena nedan — och som en
// no-code-väg att koppla en backend senare. Lämna nedan blanka för produktion tills
// de riktiga nycklarna fylls i.
const _ov = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };

export const SUPABASE_URL = _ov('cfg_supabase_url') || 'https://phkrlofngyobgupaepej.supabase.co';
export const SUPABASE_ANON_KEY = _ov('cfg_supabase_anon_key') || 'sb_publishable_YrrflIKTGbNQSofhlf3aZA_qONa6Xdc'; // publik (publishable) nyckel — säker att committa; säkerheten ligger i RLS

// Vilken stad denna installation gäller (matchar data.json-id:n och tips.city).
export const APP_CITY = 'mjolby';

// Publik dela-URL (återanvänds av profil/dela).
export const SHARE_URL = 'https://stadsvandring.io/';

export const isConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let _clientPromise = null;
// Använder @supabase/supabase-js som är vendor:ad lokalt (vendor/supabase.js, UMD →
// window.supabase) — ingen tredjeparts-CDN i runtime, så CSP:n kan hålla script-src 'self'
// och inloggning fungerar även om esm.sh/CDN ligger nere. Returnerar en singleton-klient,
// eller null om projektet inte är konfigurerat (eller biblioteket inte laddats).
export function getSupabase() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!_clientPromise) {
    const lib = (typeof window !== 'undefined') ? window.supabase : null;
    if (!lib || typeof lib.createClient !== 'function') {
      console.error('Supabase-biblioteket (vendor/supabase.js) laddades inte.');
      return Promise.resolve(null);   // försök igen vid nästa anrop
    }
    try {
      const client = lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
      _clientPromise = Promise.resolve(client);
    } catch (err) {
      console.error('Kunde inte skapa Supabase-klient:', err);
      return Promise.resolve(null);
    }
  }
  return _clientPromise;
}
