# Arbetslogg — Strosa / Stadsvandring

Logg över vad som görs, fel som uppstår och hur de löses. Senaste överst.

---

## 2026-06-11 — Säkerhetsgenomgång (A–H) + nattligt underhåll + hälsokontroll

Heltäckande säkerhetskontroll uppdelad i 8 delmoment (A–H) — alla genomgångna. Backend-RLS
och XSS-yta visade sig sunda/rena; fynd & fixar: Storage-bucket MIME/storleksgräns, CSP tillagd
(verifierad i browser), `challenges.js esc` escapar nu `'`, server-side `display_name`-tak,
`prod_home.png` borttaget. Nattlig "anti-clogging" byggd: `nightly_maintenance()` + pg_cron
(03:00) + körningslogg, samt SW-cachetak (v18→v19). `scripts/healthcheck.sh` tillagt.
**Full detalj + bugg-/fixlogg: [`security-maintenance-log.md`](security-maintenance-log.md).**
Kvar: validera migrationen (`supabase db reset`), pinna esm.sh-version, ev. delmoment-finlir.

---

## 2026-06-11 — Konton: skapa / logga in / återställ lösenord (+ E2E-test)

**Mål:** Fungerande skapa-konto, inloggning och lösenordsåterställning, isolerat från andra
projekt, testat end-to-end.

**Gjort:**
- Lade till lösenordsåterställning i `auth.js`: "Glömt lösenord?"-länk → `resetPasswordForEmail`,
  hantering av `PASSWORD_RECOVERY`-event → ny vy `openSetNewPassword()` → `updateUser({password})`.
- Bytte alla auth-redirects från hårdkodad `SHARE_URL` till `location.origin` (funkar både lokalt
  och i produktion). Nya i18n-nycklar (sv/en) + `.auth-link`-stil. SW → v18.

**Isolering (viktigt — får inte blandas ihop med andra projekt):**
- Stadsvandring kör ett **eget** Supabase-projekt (`project_id=stadsvandring`, portar 55321/55322,
  Mailpit 55324) — helt skilt från `Scraper för visit sidor` (54321/54322) och `cell`.
- Verifierat: `auth.users` har 7 rader i stadsvandring, 0 i scrapern → separata konto-namnrymder.
  supabase-js lagrar dessutom sessionen per projekt-URL i localStorage, så inloggning i en app
  kan inte läcka till en annan. (Doktrin: ett Supabase-projekt per app — `cell-auth-accounts`.)

**E2E-test (mot lokal Supabase + Mailpit):**
- *Skapa konto:* `signUp` → bekräftelse-mejl i Mailpit → `verifyOtp(signup)` → **profil skapas av
  `handle_new_user`-triggern** (nivå tipsare) → utloggning + lösenordsinloggning ✓.
- *Logga in:* lösenordsinloggning ✓ (magic link/Google-UI finns; samma OTP-mekanism som verifierats).
- *Återställ lösenord:* UI-knappen "Glömt lösenord?" → recovery-mejl i Mailpit ✓ → token →
  nytt lösenord via UI → **gamla avvisas, nya fungerar** ✓.

**Fel & lösningar:**
- *"Error sending recovery/confirmation email" lokalt:* jag hade exkluderat mejl-servern (mailpit)
  vid `supabase start`. Lösning: starta om **med** mailpit (egen port 55324, ingen krock med
  scraperns 54324). Då fungerar signup-bekräftelse, magic link och reset lokalt. I produktion
  sköts mejl av projektets SMTP/Resend — ingen kodändring behövs.
- *Lokal redirect-allowlist:* för UI-djuplänk-test av recovery hade `localhost:8090` behövt
  ligga i `additional_redirect_urls`. Kringgicks genom att testa token-vägen (`verifyOtp`) direkt;
  i produktion läggs appens URL i projektets Redirect URLs.

---

## 2026-06-10 — Importera Östergötland/Vättern-platser från scrapern

**Mål:** Hämta ~7 innehållsrika platser nära Mjölby/Vättern från projektet
`~/Scraper för visit sidor` (lokal Supabase, port 54322) och lägga in dem som riktiga
stopp med korrekt stad.

**Urval (närmast Mjölby, koordinater verifierade mot ort):**
- Norra Vi (Ydre, Östergötland): Norra Vi kyrka, Korpberget, Skuru, Norra Vi vandringsled → 4 stopp (en liten vandring)
- Kinda: Östgötaleden
- Mullsjö: Mullsjö
- Värnamo: Store Mosse nationalpark

**Fel & lösningar:**
- *Tomt resultat med `c.is_current`-filter:* flera platser saknade `is_current`-flaggan på
  sin innehållsrad. Löste det genom att i stället ta raden med längst `body` per plats
  (`distinct on (p.id) ... order by length(body) desc`).
- *Haversine-query gav inget:* `acos/round` på sammansatt uttryck krånglade. Bytte till en
  enklare platt-jord-approximation (`111*sqrt(dlat²+(dlon·cosφ)²)`) för avstånd.
- *Koordinat/ort-krock i datan:* några kandidater (Prästgården, Mantorpsskogen) hade
  `locality` som inte stämde med koordinaterna → uteslöts för att inte sätta nålen fel.
- *Norra Vi vandringsled saknade koordinater* → satte byns centrum (57.8835, 15.3420).

---

## 2026-06-10 — Flerstadsstöd (välj stad)

**Mål:** Användaren ska kunna välja stad att vandra i; tydligt vilken stad varje plats
ligger i.

**Gjort:** `city`-fält på alla `data.json`-poster; `activeCity`-state (localStorage
`sv_city`); "Städer"-fliken blev en riktig väljare; `setActiveCity()` filtrerar
karta/turer/berättelser/profil + centrerar om kartan + byter rubrik + berättare per stad
(Skånska Lasse bara i Mjölby). `.city-tag` "📍 <stad>" på varje plats.

**Fel & lösningar:**
- *Konsensus-trigger blockerades av författar-vakten* (`guard_tip_update`) när systemet satte
  status → scopade vakten till enbart författarens egna API-redigeringar.
- *Rykte-skrivningar blockerades av kolumnskyddet* i röstarens kontext → transaktions-lokal
  GUC `app.reputation_write` som bara SECURITY DEFINER-funktioner sätter.
- *Service worker serverade gammal `data.json`* trots "network-first" (använde HTTP-cachen) →
  bytte till `fetch(req,{cache:'no-store'})`, cache-version v17.
- *esm.sh-modul kunde inte laddas i preview* efter cache-rensning → övergående; CDN svarar 200.

---

## 2026-06-10 — Konton + community-tips (Supabase)

Byggde riktiga konton (magic link/Google/lösen), tips (minne/plats/rättelse) och
träffsäkerhets-viktat peer-review. Verifierat end-to-end mot lokal Supabase (SQL-svit + live
frontend). Se minnesfilen `community_tips_auth.md` för detaljer. Två trigger-buggar hittades
och fixades under verifieringen (se ovan).
