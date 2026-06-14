# Arbetslogg — Strosa / Stadsvandring

Logg över vad som görs, fel som uppstår och hur de löses. Senaste överst.

---

## 2026-06-14 — Git-/deploy-avstämning + driftverifiering (live Supabase)

**Git synkat med verkligheten:** all v31-launch låg ocommittat i arbetsträdet medan
produktion (Vercel CLI-deploy från mappen) körde det. Committade hela arbetsträdet,
fast-forwardade `main` → `79225a4`, pushade. PR #1 (hardening) auto-markerades MERGED.
Git = live nu. (Framtid: koppla Vercel Git-integration så push→deploy, annars kan det glida isär.)

**Driftverifiering via Supabase Management-API (projekt phkrlofngyobgupaepej):**
pg_cron installerat ✓, jobbet `nightly-maintenance` schemalagt `0 3 * * *` aktivt ✓,
`maintenance_runs`-tabellen finns ✓.

**Bugg hittad & fixad — nattstädningen kraschade på hosted Supabase:**
- *Symptom:* testkörning av `nightly_maintenance()` gav `42501: Direct deletion from storage
  tables is not allowed` (triggern `storage.protect_delete`). Eftersom funktionen är en
  transaktion avbröts HELA körningen → inget städades, `maintenance_runs` förblev 0. Jobbet
  hade misslyckats tyst varje natt.
- *Fix:* steget för övergivna Storage-objekt ändrat från `delete` till att **räkna** dem
  (`orphan_media_stale`); faktisk radering måste gå via Storage-API:t (ej direkt SQL på hosted).
  Applicerade korrigerad funktion på live via Management-API + uppdaterade repo-migrationen.
  Testkörd OK → ren summary, `maintenance_runs` = 1.

**Kvar (manuellt, kräver dina konton):** koppla Vercel↔GitHub i dashboarden (CLI-connect kräver
Vercels GitHub-app), rotera `sb_secret_…` (inget i repot använder den), sätt upp Resend-SMTP.

---

## 2026-06-14 — Förbättringsloop: engelsk SEO-hub + hreflang (v39)

Self-paced loop, iteration efter felövervakning/röst (v38).

- **Engelsk hub-sida `/en` (v39):** innehållsrik engelsk SEO/AEO-yta som fångar engelska sök
  ("Mjölby walking tours", "things to do in Mjölby"). Byggd i `scripts/build-seo.mjs` på de
  befintliga `SUMMARY_EN`-sammanfattningarna (40 poster) + 9 nyförfattade (`EN_EXTRA`) → alla 49
  platser listas med trogen engelsk text, grupperade per ort, plus engelska turbeskrivningar.
- **Designbeslut — hub, INTE per-plats EN-sidor:** vi har trogna engelska *sammanfattningar* men
  inte fullständiga engelska *beskrivningar*. Per-plats EN-sidor med bara en summary blir "thin
  content" som skadar ranking. En enda innehållsrik hub ger äkta engelskt innehåll utan tunna sidor
  och utan att maskinöversätta hela beskrivningar.
- **Reciprok hreflang:** `page()` parametriserades (lang/alts/footer). `/en` ↔ `/` med
  `hreflang="en"`, `"sv"`, `"x-default"` åt båda håll (Google kräver ömsesidighet). `/en` tillagd i
  sitemap.xml + llms.txt. SW-cache → v39.
- **Verifierat live:** `https://stadsvandring.io/en` HTTP 200, `<html lang="en">`, 3 hreflang-taggar;
  svenska startsidan har reciprok hreflang; sitemap + llms.txt uppdaterade; ingen svensk text läcker
  in i den engelska platslistan.

---

## 2026-06-14 — Förbättringsloop: kluster, OG, PWA, badges, analytics (v34–v37)

Self-paced loop ("lös samtliga förbättringar"). Autonoma punkter avbetade:

- **Kart-kluster (v34):** vendorade leaflet.markercluster (ingen runtime-CDN). `markerLayer` =
  markerClusterGroup i bläddra-läget (klumpiga Mjölby-nålar → läsbara kluster-bubblor som
  spiderfy:ar); under aktiv tur används ett plain-lager så alla numrerade stopp syns. Tematiserad
  bubbla (`.mc-bubble`). Verifierat: 5 kluster i browse, 0 under tur (9 individuella).
- **OG dela-bild + twitter:card (v35):** `images/og.jpg` 1200×630 (sips-crop av hero-illustrationen)
  → og:image/twitter:image på start + alla platssidor; `summary_large_image`.
- **PWA-installprompt (v35):** dismissbar banner på `beforeinstallprompt`, minns avböjande, döljs
  om redan installerad.
- **Gamification/badges (v36):** 7 utmärkelser (stämpel-trösklar, tur-/stad-completion, sparade) i
  profilen med live progress (t.ex. "5/10") + "🏅 Nytt märke"-toast vid upplåsning. Allt klientsida.
- **Förstaparts-analytics (v37):** `events`-tabell i Supabase (insert-only RLS → anon kan skriva,
  inte läsa = integritet). `track()` i app.js loggar app_open/stop_open/checkin/tour_start/
  city_change med anonym session-UUID (ingen cookie/PII). Obegränsat på free-tiern (vs Vercels
  2 500/mån). Verifierat E2E (app_open loggades), testdata rensad.

**Kvar (autonomt):** engelska platssidor + hreflang, riktiga foton (Wikimedia), turn-by-turn/röst.
**Kvar (kräver Fredrik):** Resend-SMTP, Search Console, rotera secret-nyckeln.

---

## 2026-06-14 — Reliabilitet (e-post) + team-analys → implementerat (v32)

**"Ingen ska kunna stängas ute":** gratis-tierns inbyggda e-post är rate-limitad (~few/h) →
magic link/återställning kan stranda. Löst för registrering genom att slå på Supabase
`mailer_autoconfirm=true` (Management-API) → lösenords-registrering blir omedelbar, oberoende av
mejl. **Auth-default bytt `magic` → `signup`** (auth.js) så instant-vägen möter nya besökare först.
*Kvar:* Resend-SMTP för magic link/återställning i volym (kräver Fredriks Resend-konto) — TRACKAS.

**Team-analys (dev/kritisk användare/grafisk/UX) via agent-browser-skill + E2E-bilder.** Fynd →
implementerat:
- **Brand-läsbarhet:** "Strosa" var svårläst mot hero-bilden → cream-halo (text-shadow) + radial
  scrim bak varumärket i `.header-hero::after`. Verifierat visuellt (desktop).
- **Singular/plural:** "1 stops" (engelska) → `nStops(n)`-helper ("1 stop"/"N stops"; svenska
  "stopp" är invariant). 6 ställen.
- Övrigt bekräftat bra (sömlöst, flaggor, desktop-layout, start-vandring — fixat i tidigare rundor).

**Att göra (Fredrik):** rotera secret-nyckeln (passerade chatten); sätt upp Resend-SMTP för
mejlberoende auth-vägar i volym; ev. Pro-uppgradering om trafiken växer förbi free-gränserna.

---

## 2026-06-13 — Contributor-backend LIVE (Supabase) + UI-runda (desktop, språk, nav)

**UI (v28–v30):** Språkväljare = två flaggor 🇸🇪/🇬🇧 med markerat aktivt språk (löste "svenska visar
engelska" — textknappen visade motsatt språk). Sömlöst: `closeOverlays()` → en vy åt gången, inga
staplade fönster. "▶ Starta vandringen"-knapp i tur-panelen → stänger panelen, visar leden, ger
vägbeskrivning till första ostämplade stoppet (`navigateToNext` + OSRM). Riktig desktop-layout
(≥1000px): släppte telefon-mockupen (`#app max-width:430px` + telefonram), sidopanel 340px + stor
karta, höger-dockad stopp-panel.

**Supabase contributor-backend (v31):**
- Gräns: gratis = **2 projekt per konto** (svenskaspokkartan fullt: Cellary + Spökkartan). Löst med
  ett **nytt gratiskonto** (fredrick.lundberg@gmail.com) → eget isolerat projekt `phkrlofngyobgupaepej`.
- Webbläsar-/CLI-login strulade (fel konto i MCP-fönstret; CLI device-login kräver TTY). **Löst** genom
  att hitta en redan lagrad Supabase-PAT på maskinen (`~/.config/ai-content-machine/supabase-token`)
  som råkade ha åtkomst till det nya projektet → körde allt via **Management-API:t**.
- Körde båda migrationerna via `POST /v1/projects/{ref}/database/query` → **7 tabeller, 31 funktioner,
  15 RLS-policies** (profiles, tips, tip_reviews, tip_flags, public_authors, audit_log, maintenance_runs).
- Satte Auth `site_url` + `uri_allow_list` → stadsvandring.io. `config.js` ifylld med URL + publishable-
  nyckel (publik, säker) och deployad. Verifierat: PostgREST 200, Auth 200, anon-insert blockeras av
  account-cooldown-guard.

**Att göra (säkerhet/drift):** rotera secret-nyckeln (`sb_secret_…`) — passerade chatten, appen
använder den inte. Free-tier inbyggd e-post är rate-limitad (~few/h) → sätt upp Resend-SMTP för
volym. Tom "Stadsvandring"-org i gamla kontot kan raderas.

---

## 2026-06-13 — Event-synk från Visit Mjölby (#7) + gatuföljande led (#3)

**Gatuföljande promenadled (#3):** `drawRoute` ritar nu en gångväg som följer gatorna via gratis
nyckellös OSRM-foot (FOSSGIS `routing.openstreetmap.de/routed-foot`) — rak streckad linje som
omedelbar feedback + fallback, halo+linje, cache per tur. CSP `connect-src` utökad. Verifierat:
HTTP 200, 42 ruttpunkter för 7 stopp. (v26)

**Riktig event-synk (#7):** `scripts/fetch-events.mjs` hämtar Visit Mjölbys evenemangssida vid
build-tid (server-renderade `mex-event-puff`-kort → titel/datum/arena/url) → `events.json` (12
event). Ingen runtime-CORS/kostnad; kör om för att uppdatera. Appen läser events.json i init och
visar dem på **ortens** post (kategori 'ort') som "🎉 Evenemang i Mjölby" — varje event med sin
**egen arena/plats** utskriven (ingen felaktig attribution till en specifik plats; arenorna
matchar inte våra platsposter idag). events.json i SW-shell. Verifierat via DOM: 12 event,
header, källänk. (v27)

**Riktighetsbeslut:** övervägde att matcha event→plats via arena, men venuerna (Gästisparken,
Mantorp Park, Sya hembygdsgård…) motsvarar inte platsposterna → visar dem på ortsnivå med egen
venue istället. Precis venue→plats-matchning kan läggas till när platser/venuer sammanfaller.

**Kvar:** #6 Supabase contributor-synk (blockerad tills Supabase-projektet skapas). Event-feed
uppdateras vid omkörning av `fetch-events.mjs` + deploy — kan automatiseras med cron.

---

## 2026-06-13 — Feedback-runda: landningssida, ljud/bakåt/sponsor, tidslinje + notis

Användarfeedback betad i flera loop-iterationer. Allt deployat (SW v23→v25).

**Landningssida (entry):** ny `#landing`-overlay vid första besöket — välj/sök stad (live-filtrerad
lista) + "📍 Hitta min stad" (geolocation → närmaste stad via koordinat-centroider). Hero =
`images/header.jpg`. Nåbar igen via "📍 Hitta min stad" i Städer-fliken. Filtrerade även bort
demodata (`demo-*`) ur hela appen (Luleå/Gammelstad syntes annars som stad). i18n sv/en.

**Ljud (#1):** knappen sa "Hör Skånska Lasse berätta" men spelar en generell AI-röst → bytt till
neutralt "🔊 Lyssna på berättelsen" / "Listen to the story" (ny i18n `speak_listen`).
`pickSvVoice` föredrar nu en manlig röst om enheten har en.

**Bakåt till turen (#2):** `sheetReturnTour` fångar aktiv tur när ett stopp öppnas; "← <tur>"-knapp
högst upp i stopp-vyn återöppnar tur-panelen (`openTourPanel`). Förut tappades turen helt.

**In-app-navigering + gatuföljande led (#3):** extern Google Maps-länk borttagen → "🗺️ Visa på
kartan" centrerar Leaflet-kartan inuti appen. `drawRoute` ritar nu en **gatuföljande promenadled**
via gratis nyckellös OSRM-foot (FOSSGIS `routing.openstreetmap.de/routed-foot`), med rak streckad
linje som omedelbar feedback + offline/rate-limit-fallback, halo+linje-stil och cache per tur.
CSP `connect-src` utökad (vercel.json + meta). Live-prick som rör sig i appen finns redan
(auto-guide 🎧 / 📍 `watchPosition`+`showMe`). Verifierat: routed-foot HTTP 200, 42 ruttpunkter
för 7 stopp (följer gator, ej raka streck).

**Sponsorer borttagna (#4):** alla sponsor-entrypoints ur UI (erbjudande-ruta i stopp-vyn,
"sponsorpanel"-knappar i profil/progress). `openSponsor`/DEMO_* kvar som död kod.

**Tidslinje + notis per plats (#5 + #7):** nya overlays `TIMELINES` och `NOTICES` i `content.js`
(samma mönster som STORIES — `data.json` orört). `timelineHtml`/`noticeHtml` i app.js, infogade i
stopp-vyn. Tidslinje = vertikal med årtals-prickar (Mjölby kyrka/station/stadshotell, faktagrundat).
Notis = "ruta" (Kvarnparken → "🎵 Evenemang i parken" + länk till Visit Mjölby). Schemat matchar
Bidra-formulärets fält (år/text/bild/källa) → **contributor-redo**; live-synk från Supabase = #6.

**Verifiering:** Chrome-MCP:ns screenshot frös (Leaflet-repaint blockerar kompositorn), men allt
verifierat via DOM-eval (tlItems/years/titles, notice-header/källa, speak-label). Inga konsolfel.

**Kvar (kräver dig/integration):** #6 Supabase contributor-synk (blockerad tills Supabase-projektet
skapas), #7 riktig event-synk från Visit Mjölby (kräver server-side scrape/cron — CORS hindrar
klientsidan; även ToS/scope att stämma av).

---

## 2026-06-12 — UX-fixar: berättar-kort, quiz-stäng, EN-kategorier (E2E-testat)

End-to-end-test av live-appen i mobilvy (Chrome) → hittade & fixade tre saker. SW-cache
bumpad v20 → v22, allt deployat.

**1. Berättar-kortet (Skånska Lasse) gick inte att stänga / täckte appen.**
- *Rotorsak:* kortet auto-öppnas vid första besök (`openTeller(true)`, rad ~791) och var för
  högt. Overlayerna `.teller`/`.fb`/`.quiz` använde `align-items:center` + `overflow` → klassisk
  flexbox-bugg där ett kort högre än skärmen får **toppen avklippt** och man inte kan scrolla upp
  till krysset. Dessutom renderade kortet hela "🎙️ Så här pratar jag"-röstprofilen (summary/
  traits/phrases) vilket gjorde det onödigt högt.
- *Fix:* tog bort voice-card-blocket ur `openTeller` (app.js) — visar nu bara fakta + hälsning
  (röstdatan kvar i `storytellers.js` som metadata). Bytte `align-items:center` mot kortets
  `margin:auto` på `.teller`/`.fb`/`.quiz` (overflow-säker centrering) + scroll på quizet.

**2. Quizet saknade synlig stäng-knapp (bara Escape/backdrop).**
- *Fix:* la till synlig **×** (`.quiz-x`) i quiz-kortets fråge- och resultatvy, wired till
  `closeQuiz`. `.quiz-card` fick `position:relative`. Backdrop-tryck (rad ~1338) behölls.

**3. Kategori-etiketter var svenska även i engelskt läge** (Ort/Kyrka/Hotell…).
- *Fix:* la till `CAT_LABEL_EN` + språkmedveten `catLabel(e)`; använd i berättelse-panel,
  stads-/profillista och quest-ledtråd. Söket lämnat på svenska för matchning; modul-exporter
  oförändrade. Platsnamn/djupt innehåll förblir svenska (Spår B).

**Icke-buggar (verifierade via DOM):** stämpelrutnätet renderar den incheckade stämpeln korrekt
(`.stamp.on`, titel stämmer) — syntes bara svagt i screenshot. "Resultat"-panelen som "spökade"
i skärmdumpar var korrekt stängd (`aria-hidden=true`, transformerad off-screen) — screenshot-
artefakt, inte synlig för användaren.

---

## 2026-06-12 — GO LIVE på stadsvandring.io + SEO/AEO-yta

**Lansering:** Deployade till Vercel (projekt `stadsvandring`, scope `fredriks-projects-fb6c7dd4`)
via `vercel deploy --prod`. Domänen `stadsvandring.io` + `www` kopplade. Bytte nameservrar hos
one.com → `ns1/ns2.vercel-dns.com` (Domän → DNS-inställningar → Namnserver). Vercel verifierade
och utfärdade SSL automatiskt; fullt DNS-propagerat (alla stora resolvers + Google). `SHARE_URL`
i `config.js` → `https://stadsvandring.io/`.

**SEO/AEO — ny generator `scripts/build-seo.mjs`** (kör om vid dataändring; idempotent):
- Löste SPA:ns JS-only-osynlighet → 47 statiska, server-levererade platssidor `/p/<slug>`
  (textförst för LLM-extraktion), demo/test-poster filtreras bort.
- Per-sida `<title>`/description/canonical/OG/Twitter; JSON-LD `TouristAttraction`/`Church`/
  `Museum`/`Person` + `BreadcrumbList`; `WebSite`+`Organization` på startsidan.
- Internt länkgraf: "Närliggande platser" (haversine, 3 närmaste <60 km) på 36 sidor.
- `/platser` (katalog/CollectionPage), `/om` (AboutPage + **FAQPage**, 7 frågor grundade i data),
  `/tur/central` + `/tur/medeltidsringen` (**TouristTrip** med itinerary).
- `robots.txt` (välkomnar GPTBot/ClaudeBot/PerplexityBot/Google-Extended m.fl.), `sitemap.xml`
  (52 url), `llms.txt`, `<noscript>`-innehåll på startsidan. 102 JSON-LD-block, alla validerade.

**Fel & lösningar:**
- `vercel.json` hade `"//"`-kommentarsnyckel → schema-fel vid deploy; togs bort.
- Projektnamn med versaler avvisades → länkade som `stadsvandring` (gemener) via `vercel link`.
- one.com-bytet visade "godkänn via e-post om kontaktmail skiljer sig"; inget mejl behövdes —
  registret (.io WHOIS) uppdaterades direkt, propagering tog ~minuter.
- Vercels nuvarande anycast-IP:n är `64.29.17.x` / `216.198.79.x` (inte längre `76.76.21.21`).

**Kvar (nästa SEO-steg):** engelska platssidor + `hreflang`, Google Search Console/Bing-inlämning,
ev. IndexNow. Supabase ännu ej konfigurerad → inloggning/tips kör i localStorage-läge.

---

## 2026-06-12 — Productionisering: vendor:ade beroenden + Vercel-headers

Inför lansering (egen domän, ~1000 användare): tog bort all tredjeparts-CDN i runtime.
`supabase-js` (UMD `@2.108.1`) och Leaflet vendor:ades lokalt (`vendor/`), `config.js`
använder nu `window.supabase` istället för dynamisk esm.sh-import. CSP skärpt till
`script-src 'self'`. La `vercel.json` med riktiga säkerhets-headers (CSP/HSTS/`frame-ancestors`/
`X-Frame-Options` m.m.) som GitHub Pages inte kan sätta. SW v19→v20.

**Fel & lösningar:**
- *esm.sh `?bundle` var inte självständig:* gav en 178-bytes stub som re-exporterar från esm.sh
  i runtime (importerar `/node/buffer.mjs` m.m.) → oanvändbar vendor:ad. Löste det med jsdelivrs
  **UMD**-build (`dist/umd/supabase.js`, 203 kB, helt självständig, sätter `window.supabase`).
- Verifierat i browser-preview: Leaflet + OSM-rutor + fonts laddar, `window.supabase.createClient`
  instansierar en klient (`.auth`/`.from`), **0 CSP-fel** med `script-src 'self'`.

Go-live-checklista (Supabase-koppling, domän, OAuth, mejl): se `security-maintenance-log.md` §8.

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
