# Säkerhets- & underhållslogg — Strosa / Stadsvandring

Levande dokument för **säkerhetsgenomgång**, **hälsokontroll** och **nattligt underhåll**.
Här loggas vad vi gör, vilka buggar/brister vi hittar och exakt hur de fixats. Senaste överst.

Relaterat: dev-changeloggen ligger i [`worklog.md`](worklog.md). Detta dokument är specifikt
för säkerhet, drift och "anti-clogging".

---

## 1. Hotmodell (kort)

- **Klienten är helt opålitlig.** Appen är en statisk PWA (GitHub Pages) som pratar direkt med
  Postgres via Supabase **anon-nyckeln**. Nyckeln är publik och får committas — *all* säkerhet
  ligger i RLS, triggers och SECURITY DEFINER-funktioner, aldrig i klientkoden.
- **Community-tips är angriparkontrollerat innehåll.** Allt en användare kan ljuga om (status,
  tier, reputation, författarskap, röstvikt) sätts av databasen, aldrig av insert-payloaden.
- **Konton är app-isolerade.** Eget Supabase-projekt per app; session lagras per projekt-URL.
- **Skyddsvärden:** användares konton/PII, integriteten i peer-review/reputation, att kommunen
  litar på att publicerat innehåll faktiskt granskats, och att tjänsten inte "kloggar igen".

---

## 2. Heltäckande säkerhetskontroll — uppdelning i delmoment

Så här delar vi upp en fullständig granskning av hela kodbasen. Varje delmoment har eget
avsnitt längre ner där fynd och fixar loggas. Ordningen är efter risk/värde (störst först).

| # | Delmoment | Vad det täcker | Status |
|---|-----------|----------------|--------|
| A | **RLS & databaslogik** | Varje policy, trigger och SECURITY DEFINER-funktion i `community_tips.sql`. Kan klient förfalska status/tier/reputation/författarskap? Privilegieeskalering, RLS-rekursion, `search_path`, konsensusmotorn (kan en användare sock-puppet:a fram röstvikt?), admin-RPC:ernas `is_admin`-grind, `public_authors`-vyns PII-läckage. | ✅ **Klar (2026-06-11)** — modellen sund, se §6 |
| B | **Klient-XSS / DOM-sinks** | De 63 `innerHTML`-skrivningarna. Vilka interpolerar oescapead användardata (tips-titel/-body, `display_name`, challenge-inmatning, URL-parametrar, fjärrsvar)? Behov av escaping/sanitering. | ✅ **Klar (2026-06-11)** — ren, 1 härdning, se §6 |
| C | **Auth & sessioner** | Signup/bekräftelse/återställning, redirect-allowlist, Google-OAuth-konfig, sessionsisolering mellan appar, reset-token-hantering, kontouppräkning (account enumeration). | ✅ **Klar (2026-06-11)** — inga sårbarheter, se §6 |
| D | **Storage-bucket** | `tips`-bucketen: publik läsning + ägar-mapp-insert. Fil­typ/storleks­gräns, path-traversal i `foldername`-kollen, övergivna/abuse-objekt. | 🟡 **Delvis (2026-06-11)** — MIME/storleksgräns + orphan-städ klart; path-traversal kvar |
| E | **Beroenden / supply chain** | CDN-skript: Leaflet (har SRI ✓), `esm.sh/@supabase/supabase-js@2` (ingen SRI, flytande major), Google Fonts, `vendor/qrcode.js` (proveniens). SW:ns cachning av CDN. | 🟡 **Delvis (2026-06-11)** — CSP låser origins; esm.sh-pinning kvar, se §6 |
| F | **Secrets & konfig** | Vad som är committat (anon-nyckel = ok). Finns service_role-nyckel någonstans? `.gitignore`-täckning, inga server-hemligheter i klienten. | ✅ **Klar (2026-06-11)** — rent, se §6 |
| G | **Integritet & klientdata** | localStorage, geolocation, challenge-resultatkoder (manipulerbara per design?), PWA/SW-cache-poisoning, CSP/säkerhets-headers (GitHub Pages saknar by default). | ✅ **Klar (2026-06-11)** — CSP tillagd + verifierad, se §6 |
| H | **Missbruk / rate limiting** | Kvot & cooldown (`cfg_max_pending`, `trust_active_at`), flagg-abuse, röst-manipulation, kan en ihärdig användare farma reputation/tier. | ✅ **Klar (2026-06-11)** — robust, 1 härdning, se §6 |

**Arbetssätt per delmoment:** läs → lista fynd (med allvarlighetsgrad) → verifiera (helst
reproducerbart, t.ex. SQL-test mot lokal Supabase) → fixa → logga fix här → bocka av.

---

## 3. Hälsokontroll — initial scanning (2026-06-11)

Snabb maskinell genomlysning innan djupgranskning:

- ✅ Inga `eval`/`new Function`. Inga `TODO/FIXME/HACK` i koden.
- ✅ Backend: trusted-column-mönstret konsekvent; SECURITY DEFINER + `search_path=''` överallt.
- ✅ **63 `innerHTML`-skrivningar genomgångna** (delmoment B) — alla escapas. 1 härdning gjord.
- ✅ **`pg_cron`-städjobb byggt** (se §4) — server kloggar inte längre igen.
- ✅ **SW-cachetak + FIFO-eviction byggt** (se §4) — klient kloggar inte längre igen.
- ✅ **`prod_home.png` borttaget** (392 kB) — repo-skräp.
- ⏭️ `esm.sh/@supabase/supabase-js@2` utan SRI/flytande major — kvar till delmoment E.

---

## 4. Nattligt underhåll ("anti-clogging") — BYGGT (2026-06-11)

**Server (Supabase):** `supabase/migrations/20260611120000_maintenance_and_hardening.sql`
- Funktionen `public.nightly_maintenance()` (idempotent, SECURITY DEFINER) som varje natt:
  - markerar övergivna `pending`-tips (> 30 d, < min-granskare) som `withdrawn` — reputations-neutralt, frigör författarens kvot;
  - raderar gamla terminala `rejected`/`withdrawn`-tips (> 90 d) — publicerade behålls;
  - raderar avklarade `tip_flags` (> 90 d);
  - trimmar `audit_log` (behåller 365 d);
  - raderar övergivna Storage-objekt i `tips` (ingen tip pekar på dem, > 7 d grace);
  - **räknar** (raderar ej) obekräftade konton > 7 d — radering görs säkrast via Admin-API.
- Varje körning loggas i `public.maintenance_runs` (jsonb-summary, admin-läsbar) → observerbarhet.
- Schemalagt **03:00** via `pg_cron` (`cron.schedule('nightly-maintenance', '0 3 * * *', …)`),
  wrappat i `DO/EXCEPTION` så migrationen går igenom även där pg_cron inte är aktiverat.
  **Att göra i prod:** aktivera pg_cron (Dashboard → Database → Extensions) och kör migrationen.
- Tunables (`cfg_stale_pending_days` m.fl.) som immutable-funktioner → re-tuna på ett ställe.

**Klient:** `sw.js` (cache v18 → **v19**)
- Bytte den obegränsade "everything else"-cachen mot en separat `mjolby-runtime-v1`-cache
  med **tak (`RUNTIME_MAX = 250`) + FIFO-eviction** (`trimCache`). Kartrutor/foton kan inte
  längre växa obegränsat på användarens enhet. Runtime-cachen överlever kodbumpar (raderas inte
  vid varje ny shell-version), men hålls trimmad.

**Hälsokontroll:** `scripts/healthcheck.sh`
- Repo-genomlysning (secrets, XSS-heuristik, eval, stora binärer, SW-version/tak, migrationer,
  git-status) + valfri Supabase-koll (`SUPABASE_DB_URL`) som verifierar att nattjobbet kört.
  Exit 1 om något bör åtgärdas. Körs manuellt eller nattligt.

**Schemalagd Claude-agent (opt-in):** se §7.

---

## 5. Bugg- & fixlogg

| Datum | Delm. | Allvarlighet | Fynd | Fix | Verifierat |
|-------|-------|--------------|------|-----|------------|
| 2026-06-11 | D | **Medel** | `tips`-Storage-bucketen saknade MIME-/storleksgräns → inloggad användare kunde ladda upp godtyckliga filer (HTML-phishing på Supabase-domänen, stora filer för storage-abuse) i sin publikt läsbara mapp. | `update storage.buckets set file_size_limit=5MB, allowed_mime_types=[bild/ljud]` i hardening-migrationen. | ⏳ Kör `supabase db reset` när stacken är uppe |
| 2026-06-11 | B | Låg (latent) | `esc()` i `challenges.js` escapade inte `'` (till skillnad från de tre andra esc-helperarna). Ej exploaterbart idag (alla attribut dubbelciterade) men footgun. | La till `.replace(/'/g,'&#39;')`. | ✅ Kodgranskat |
| 2026-06-11 | — | Hygien | `prod_home.png` (392 kB skärmdump) committad, oanvänd → repo-skräp. | `git rm prod_home.png`. | ✅ |
| 2026-06-11 | A | Info (ej bugg) | Granskare (vote_weight>0) kan via `tips_read_privileged` läsa *alla* tips (även rejected/withdrawn i alla städer), inte bara köns pending. | Accepterat per design (granskarroll); dokumenterat. Kan snävas till `status='pending'` om önskat. | — |
| 2026-06-11 | G | **Medel** | Ingen CSP/säkerhets-headers (GitHub Pages sätter inga). XSS och en komprometterad CDN-modul körde med full åtkomst. | La till `<meta http-equiv="Content-Security-Policy">` i `index.html` med snäv `script-src` (ingen unsafe-inline/eval), origins för unpkg/esm.sh/fonts/OSM/Supabase. | ✅ Verifierat i browser (preview): Leaflet, OSM-rutor, fonts laddar utan CSP-fel. ⏳ esm.sh/Supabase-vägen verifieras när nycklar är live |
| 2026-06-11 | C/H | Låg | `display_name` kapas bara klient-side (40 tecken) → direkt API-anrop kunde sätta godtyckligt långt namn (UI-bloat/abuse, ej XSS). | `check (char_length(display_name) <= 80)` (NOT VALID) i hardening-migrationen. | ⏳ `supabase db reset` |
| 2026-06-11 | E | Medel → **löst** | `esm.sh/@supabase/supabase-js@2` — flytande major, ingen SRI, tredjeparts-CDN = single point of failure + supply-chain-risk vid skala. | **Vendor:ad lokalt** (`vendor/supabase.js`, UMD `@2.108.1`); `config.js` använder `window.supabase` istället för dynamisk CDN-import. CSP skärpt till `script-src 'self'`. Även Leaflet vendor:ad (`vendor/leaflet/`). | ✅ Verifierat i browser: klient instansieras, karta+rutor laddar, 0 CSP-fel |
| 2026-06-11 | G/H | Info (per design) | Challenge-resultatkoder är base64-JSON utan signatur → en spelare kan förfalska sin poäng. | Inneboende utan backend; accepterat för skol/kommun-kontext. HMAC kräver delad hemlighet som ändå syns i länken. Dokumenterat. | — |

---

## 6. Detaljerade fynd per delmoment

### A — RLS & databaslogik → **modellen är sund**
- Trusted-kolumner (status/tier/reputation/published_count/författarskap) sätts av triggers, aldrig
  från payload. `app.reputation_write`-GUC:n kan inte sättas av klienter via PostgREST → kan ej spoofas.
- Konsensusmotorn settlas **en gång** vid övergång till terminalt läge (`recompute_consensus` är
  idempotent och no-op:ar efter terminalt); inga nya/ändrade röster efter terminalt (`set_review_weight`
  + `can_review` kräver `status='pending'`). Reputation kan inte dubbelutdelas.
- Reputation-/tier-farming bundet: för röstvikt måste man bli `granskare`, vilket kräver *andras*
  godkännanden → kan inte bootstrappas av nya sock-puppet-konton (24 h-cooldown + vote_weight 0).
- Admin-RPC:er grindade med `is_admin()`; `public_authors`-vyn läcker bara `display_name`+`tier` för
  författare till *publicerade* tips. Alla SECURITY DEFINER-funktioner har `search_path=''`.

### B — Klient-XSS → **ren**
- Fyra escape-helpers (`app.js escapeHtml`, `tips.js esc`, `challenges.js esc`, `auth.js esc`) används
  konsekvent på varje dynamisk sink. Verifierade kritiska cross-user-sinks:
  - `tips.js stopBlockHtml` (publicerade tips till **alla** besökare) — `esc()` på title/body/media_url/författare ✓
  - `tips.js` review-kön (andras pending-tips till granskare) — `esc()` på allt ✓
  - `challenges.js` (challenge-data **base64-avkodad från delningslänk/QR**) — `esc()` på title/intro/org/quiz ✓
- Inga `eval`/`new Function`. Härdning: `challenges.js esc` escapar nu även `'`.

### C — Auth & sessioner → **inga sårbarheter**
- Alla redirects använder `location.origin` (ej angriparstyrt) → ingen open-redirect. Robusthet:
  på en GitHub *project page* saknar `origin` sökvägen `/mjolby-stadsvandring/`; Supabase faller
  då tillbaka på `site_url` (som har sökvägen) → landar rätt. Fungerar, men ömtåligt — överväg
  `location.origin + location.pathname` i redirect-URL:erna.
- Reset/login läcker inte om e-post finns (`resetPasswordForEmail` + "Invalid login credentials"
  är generiska). `signUp` kan avslöja "User already registered" — Supabase-inneboende, mindre vektor.
- Sessionsisolering mellan appar ✓ (eget projekt, session per projekt-URL i localStorage).

### E/F — Supply chain & secrets → **allt vendor:at, inga CDN i runtime**
- **Alla JS-beroenden vendor:ade lokalt** (2026-06-11): `supabase-js` (UMD `@2.108.1` →
  `vendor/supabase.js`, `window.supabase`), Leaflet (`vendor/leaflet/` inkl. marker-bilder),
  `qrcode.js`. Ingen tredjeparts-CDN laddas vid runtime → ingen single point of failure, ingen
  flytande-version-supply-chain-risk, och CSP kan hålla `script-src 'self'`.
- Kvar externt (medvetet, låg risk): Google Fonts (fallback-font om nere) + OSM-kartrutor +
  Supabase-API. Self-hosta fonts är en valfri framtida finputs.
- Inga `service_role`/privata nycklar i klientkoden ✓. `.gitignore` täcker `.DS_Store`,
  `node_modules`, `*.log`, `.claude/` ✓. Anon-nyckeln (tom ännu) är publik = ok.

### G — Integritet & klientdata → **CSP tillagd + verifierad**
- **CSP** (`<meta http-equiv>` i `index.html` + riktig header via `vercel.json`):
  `default-src 'self'`, `script-src 'self'` (all JS vendor:ad — **ingen** CDN/unsafe-inline/eval),
  `object-src 'none'`, `base-uri 'self'`. Verifierat i browser-preview efter vendoring: Leaflet,
  OSM-rutor och Google Fonts laddar utan CSP-överträdelser (0 console-fel).
- **Clickjacking:** `frame-ancestors 'none'` + `X-Frame-Options: DENY` kräver HTTP-header →
  finns i `vercel.json`. På GitHub Pages går det inte (en anledning till att flytta till Vercel
  inför lansering — se §8).
- `cfg_supabase_url/_anon_key`-override i localStorage påverkar bara den egna webbläsaren (self-targeting).
- Geolocation används bara on-demand (incheckning/auto-guide) och skickas inte till tredje part.

### H — Missbruk / rate limiting → **robust**
- Kvot (`cfg_max_pending=5`) + 24 h-cooldown (`trust_active_at`) + accuracy-viktad reputation gör
  sock-puppet-/röst-farming opraktiskt (se A). `tip_flags` har `one_flag_per_reporter`-unik.
- Härdning: server-side `display_name`-längdtak (se §5). Auth-velocity sköts av Supabase egna gränser.

---

## 7. Schemalagd Claude-agent (opt-in) — "be Claude reapportera varje natt"

Den deterministiska städningen (§4) sköts av pg_cron + SW och kräver **ingen** Claude-körning.
Om du dessutom vill att *Claude* nattligen kör hälsokontrollen, analyserar och fixar smått, är det en
återkommande agent (kostar tokens varje natt). Aktivera vid behov:

```
/schedule  →  varje natt 03:30:  kör `bash scripts/healthcheck.sh`, åtgärda FLAG-punkter,
              och logga ev. fix i docs/security-maintenance-log.md (§5).
```

Eller via cron/launchd lokalt: `30 3 * * *  cd <repo> && bash scripts/healthcheck.sh >> docs/health.log 2>&1`.

> Inte aktiverat automatiskt — säg till så sätter jag upp den schemalagda agenten.

---

## 8. Go-live-checklista (egen domän + Vercel)

Statisk PWA utan byggsteg → den klarar 1000+ användare på vilken CDN-host som helst. Vercel
väljs för **riktiga säkerhets-headers** (CSP/HSTS/clickjacking) + konsekvent pipeline med övriga appar.

**Gjort (kod):**
- ✅ Alla JS-beroenden vendor:ade lokalt (ingen CDN-driftrisk) — se §6 E/F.
- ✅ `vercel.json` med säkerhets-headers (CSP, `frame-ancestors`, HSTS, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy`).
- ✅ CSP verifierad i browser (0 fel).

**Kvar (kräver dina konton/nycklar) — i ordning:**
1. **Skapa Supabase-projektet** (om ej gjort) och kör migrationerna: `supabase link` + `supabase db push`.
   Aktivera **pg_cron** (Dashboard → Database → Extensions) så nattstädningen kör.
2. **Fyll `config.js`** med projektets `SUPABASE_URL` + `anon`-nyckel (publika, säkra att committa).
3. **Köp domänen** och koppla den i **Vercel** (Project → Domains). Importera GitHub-repot i Vercel
   (Framework preset: *Other* / static; ingen build-command).
4. **Uppdatera URL:er till domänen:** `SHARE_URL` i `config.js`, `start_url`/`scope` i
   `manifest.webmanifest`, samt Supabase **`site_url` + `additional_redirect_urls`** (annars funkar
   inte inloggnings-/återställningslänkar). Överväg `location.origin + location.pathname` i auth-redirects.
5. **Google OAuth:** lägg `GOOGLE_CLIENT_ID`/`SECRET` i Supabase och domänen i Googles redirect-URI:er.
6. **E-post:** koppla SMTP/Resend i Supabase för bekräftelse-/återställningsmejl i prod.
7. **Supabase-plan:** bedöm **Pro ($25/mån)** om fotouppladdningar/bandbredd närmar sig free-taket
   (nattstädningen i §4 håller lagringen nere).
8. **Smoke-test i prod:** logga in (Google + e-post), lämna ett tips, granska, ladda upp foto,
   verifiera att inget bryts av CSP:n i den riktiga miljön (DevTools-konsolen).

> Frontend-deploy (Vercel) och backend-deploy (Supabase) är **separata** — koden vet inget om
> hosten; den pratar bara med Supabase via de publika nycklarna i `config.js`.

---
