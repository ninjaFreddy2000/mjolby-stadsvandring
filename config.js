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

// ── E-postleverans ───────────────────────────────────────────────────────────
// Supabase kör på sin INBYGGDA e-posttjänst tills Custom SMTP är påslaget i
// dashboarden (Authentication → Emails → SMTP Settings). Den är strypt till ett
// par mejl i timmen och levererar i praktiken bara till projektets egna
// medlemmar — alltså: magisk länk och lösenordsåterställning tystnar för
// riktiga användare. Att visa knapparna ändå skickar folk in i en återvändsgränd
// där ingenting syns hända.
//
// Konto + lösenord fungerar utan mejl (mailer_autoconfirm är på), och Google-
// inloggning rör inte e-post alls. Därför döljs bara de två flödena.
//
// SÄTT DENNA TILL true när Custom SMTP är verifierat och ett testmejl gått fram.
// Ingen annan kod behöver röras.
export const EMAIL_DELIVERY = false;

// Startstad vid allra första besöket, innan användaren valt. Detta är INTE
// längre "appens stad": community-tips och granskning följer den stad man är i
// (app.js skickar in citySlug), så alla 72 städer har ett eget flöde.
export const DEFAULT_CITY = 'mjolby';

// Publik dela-URL (återanvänds av profil/dela). Appen bor på /karta; webbplatsen på roten.
export const SHARE_URL = 'https://stadsvandring.io/karta';

export const isConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Bas-URL för Supabase Edge Functions (t.ex. enhance-content). Ligger på samma
// Supabase-host (/functions/v1/…) och är redan tillåten av CSP:ns connect-src.
export const FUNCTIONS_BASE = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, '') + '/functions/v1' : '';

// ── Axiom (observability / loggning) ─────────────────────────────────────────
// Speglar anonyma händelser + JS-fel till Axiom (se axiom.js). TOMT = AV; ingen
// loggning sker förrän en ingest-token är satt. Två sätt att aktivera:
//   • Alla användare (produktion): ersätt '' nedan med din Axiom-token + dataset.
//     En committad klient-token är PUBLIK men enbart SKRIV till ETT dataset —
//     använd ett separat dataset (t.ex. 'stadsvandring') och rotera vid behov.
//   • Bara denna enhet (test): sätt localStorage cfg_axiom_token / cfg_axiom_dataset.
export const AXIOM_INGEST_URL = 'https://api.axiom.co';
export const AXIOM_DATASET = _ov('cfg_axiom_dataset') || 'stadsvandring';   // datasetets namn i Axiom
// ▼▼▼ KLISTRA IN DIN AXIOM INGEST-TOKEN HÄR (xaat-…) FÖR ATT SLÅ PÅ LOGGNING ▼▼▼
// Tomt = av (inget skickas). Committad token är PUBLIK men bara SKRIV till ovan
// dataset — använd ett separat dataset och rotera vid behov. Se docs/axiom-setup.md.
export const AXIOM_TOKEN = _ov('cfg_axiom_token') || '';   // ← t.ex. 'xaat-xxxxxxxx-...'

let _clientPromise = null, _libPromise = null;

// Laddar vendor/supabase.js (UMD → window.supabase) på begäran. Biblioteket är
// 199 kB — den enskilt största posten i appen — och behövs bara för inloggning
// och community-innehåll. Tidigare låg det som <script defer> i karta.html och
// laddades av varje besökare innan kartan var klar. Vendor:at lokalt, så CSP:n
// kan hålla script-src 'self' och inloggning fungerar även om ett CDN är nere.
function loadSupabaseLib() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    return Promise.resolve(window.supabase);
  }
  if (!_libPromise) {
    _libPromise = new Promise((resolve) => {
      const el = document.createElement('script');
      el.src = 'vendor/supabase.js';
      el.async = true;
      el.onload = () => resolve(window.supabase || null);
      el.onerror = () => { _libPromise = null; resolve(null); };   // låt nästa anrop försöka igen
      document.head.appendChild(el);
    });
  }
  return _libPromise;
}

// Returnerar en singleton-klient, eller null om projektet inte är konfigurerat
// (eller biblioteket inte gick att ladda).
export function getSupabase() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!_clientPromise) {
    _clientPromise = loadSupabaseLib().then((lib) => {
      if (!lib || typeof lib.createClient !== 'function') {
        console.error('Supabase-biblioteket (vendor/supabase.js) kunde inte laddas.');
        _clientPromise = null;          // försök igen vid nästa anrop
        return null;
      }
      try {
        return lib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
      } catch (err) {
        console.error('Kunde inte skapa Supabase-klient:', err);
        _clientPromise = null;
        return null;
      }
    });
  }
  return _clientPromise;
}
