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

export const SUPABASE_URL = _ov('cfg_supabase_url') || '';          // t.ex. 'https://abcd1234.supabase.co'
export const SUPABASE_ANON_KEY = _ov('cfg_supabase_anon_key') || ''; // den långa "anon public"-nyckeln

// Vilken stad denna installation gäller (matchar data.json-id:n och tips.city).
export const APP_CITY = 'mjolby';

// Publik dela-URL (återanvänds av profil/dela).
export const SHARE_URL = 'https://ninjafreddy2000.github.io/mjolby-stadsvandring/';

export const isConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

let _clientPromise = null;
// Lazy-laddar @supabase/supabase-js från ESM-CDN (inget byggsteg) och returnerar
// en singleton-klient. Returnerar null om projektet inte är konfigurerat ännu.
export function getSupabase() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!_clientPromise) {
    _clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      }))
      .catch(err => { console.error('Kunde inte ladda Supabase:', err); _clientPromise = null; return null; });
  }
  return _clientPromise;
}
