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

// Publik dela-URL (återanvänds av profil/dela). Appen bor på /karta; webbplatsen på roten.
export const SHARE_URL = 'https://stadsvandring.io/karta';

export const isConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// ── Betalning (Stripe via Supabase Edge Functions) ───────────────────────────
// Edge functions bor på samma Supabase-host (/functions/v1/...), redan tillåtet
// av CSP:ns connect-src https://*.supabase.co. Ingen Stripe.js i sidan — vi
// redirectar till Stripes hostade checkout, så CSP kan hålla script-src 'self'.
export const FUNCTIONS_BASE = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, '') + '/functions/v1' : '';

// Priser (visning). Faktiskt belopp sätts i Stripe (lookup keys stadsjakt_monthly
// / stadsvandring_city). Håll i synk med Stripe-priserna.
export const PRICES = {
  city:      { amount: 19, currency: 'kr', period: null,    label_sv: '19 kr',        label_en: '19 kr' },
  stadsjakt: { amount: 49, currency: 'kr', period: 'mnd',   label_sv: '49 kr/mån',    label_en: '49 kr/mo' },
};

// Slås på när Stripe-produkterna är skapade och edge-functions deployade.
// Tills dess visar appen "kommer snart" istället för en trasig köp-knapp.
export const BILLING_ENABLED = (() => { try { return localStorage.getItem('cfg_billing') === '1'; } catch (e) { return false; } })();

// ── Lätt paywall via Stripe Payment Links (utan edge-function-backend) ────────
// Gate:ar de guidade vandringarna. Köp-knappen skickar till en hostad Stripe-
// länk (riktig betalning → intäkt). Upplåsningen är MJUK: sker via localStorage
// när användaren kommer tillbaka via länkens success-URL (?unlocked=1), med en
// "har du redan betalat?"-fallback. Konverterings-gate, inte kopieringsskydd.
// När den riktiga Checkout-backenden (create-checkout + webhook + entitlements)
// är deployad: sätt PAYWALL_LINKS=false, så tar BILLING_ENABLED-flödet över.
export const PAYWALL_LINKS = true;

// Friktionsfri gratis provperiod (reverse trial): ett tryck låser upp alla
// guidade vandringar i TRIAL_DAYS dygn — inget konto, inget kort. Lagras i
// localStorage (sv_trial_start), samma mjuka filosofi som sv_access. När
// perioden gått ut återkommer paywallen med köpalternativen.
export const TRIAL_DAYS = 7;

export const PAYMENT_LINKS = {
  stadsjakt: 'https://buy.stripe.com/9B628q3TOe8yeeS3qj08g00',  // Stadsjakten (alla städer)
  city:      'https://buy.stripe.com/4gM3cu61W1lM0o23qj08g01',  // Stadsvandring (en stad)
};

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
