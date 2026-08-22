# Community-omstart — Folkets egen stadsvandring

**Beslutad inriktning (2026-08-22):** Stadsvandring går från kurerad, betald
guideapp till en **gratis community-app**. Innehållet fylls av användarna:
bilder, texter och kommentarer som andra verifierar och godkänner. Man skapar
egna rutter — en kvällspromenad, en löprunda förbi spännande platser — delar
dem med kompisar och utmanar varandra.

Allt ska gå **snabbt**. Appen bar tidigare på 9,6 MB data och en 2 600 rader
lång app.js; det är den skulden som betalas av parallellt med ombyggnaden.

## Antaganden jag kör på tills annat sägs

- **Namnet behålls** — `stadsvandring.io` är domänen, appnamnet och SEO-kapitalet
  (364 statiska platssidor + sitemap rankar på det). Det som byts är
  *positioneringen*. **Taglinen är "Upptäck Sveriges städer"** (Fredriks beslut
  2026-08-22) — den sitter i appheadern, på webbsidan och i OG-taggarna.
- **Partner-/sponsorspåret rörs inte.** `partners.html` (299 kr/år) är B2B mot
  näringsidkare, inte betalning för användaren. "Betalning ska tas bort" tolkar
  jag som konsument-paywallen. Säg till om även partnerspåret ska bort.
- **Supabase-projektet behålls** — konton, tips och peer-review finns redan där.

---

## Fas 1 — Röj undan (KLART)

| | |
|---|---|
| ✅ | **Betalningen borttagen.** `billing.js`, paywall-overlay, Stripe-checkout, entitlements, presentkoder och "Din tillgång"-kortet. Guidade vandringar öppna för alla. Stripe ur integritetspolicyn. `commit de5db49` |
| ✅ | **Datalagret uppdelat.** `data.json` (1,9 MB gzip) → `data/cities.json` (12 kB) + en chunk per stad. Centrumslingan förberäknas i byggsteget i stället för i klienten. Startladdning: **48 kB**. `commit f14c15c` |

## Fas 2 — Snabbhet resten av vägen

| | |
|---|---|
| ✅ | **Kartnålar i skala.** Mätt i Göteborg zoom 15: 444 nålnoder i DOM:en, 56 synliga. Klustrar nu över hela staden (stabila siffror) men ritar bara inom vyn + 35 %, och klustringen hinkas i rutnät i stället för linjärsökning. → 140 noder. `commit 7cadf76` |
| ✅ | **Bilder.** 6,9 MB råa JPEG:er på ~1100 px användes både som 88 px-miniatyr och hero. WebP i w320/w800/w1200 via `scripts/build-images.mjs`; Mjölby kyrka 410 kB → 18 kB som miniatyr. `commit b41ea80` |
| ✅ | **Lat laddning av tung kod.** `admin.js` (24 kB) och `challenges.js` (39 kB) laddades av alla men behövs av få — nu dynamisk import. Installationsguiden bröts ut till `install.js` eftersom den är öppen för alla. `commit 7ec875e` |
| ✅ | **Vendor ur kritiska vägen.** `karta.html` laddade leaflet + supabase-js (199 kB) + qrcode (14 kB) med `<script defer>`. Bara leaflet behövs för kartan; de andra hämtas nu på begäran, och auth/tips startar på `requestIdleCallback`. `commit eb1dc86` |
| ⏸ | **CSS-uppdelning — mätt och avfärdad.** `styles.css` är 19 kB gzip, `webbsida.css` 9 kB. Att dela i kritiskt skal + lazy hade gett kanske 10 kB mot risk för FOUC. Inte värt det. |
| ✅ | **Typsnitten självhostade** i stället. Google Fonts var en render-blockerande extern rundtur — dyrare än hela styles.css — och gjorde appen fontlös offline eftersom gstatic låg utanför service workerns cache. CSP:n har nu inga Google-domäner kvar. `commit 2b921da` |
| ✅ | **Mätt.** Se tabellen nedan. |

### Vad snabbhetsarbetet faktiskt gav

Mätt som **överförd vikt (gzip)** för en kall sidladdning av `/karta`, Mjölby.
Samma fil-uppsättning i båda kolumnerna, med skillnaden att det som i dag laddas
lat räknas separat.

| | Före | Nu |
|---|---:|---:|
| Kritiska vägen | **2 481 kB** | **397 kB** |
| Inkl. supabase-js (laddas på idle) | – | 447 kB |
| Externa värdar under laddning | Google Fonts × 2 | inga |
| Nålnoder i DOM (Göteborg, zoom 15) | 444 | 140 |

Den stora posten är `data.json`: 1 909 kB gzip som hämtades vid varje start, mot
48 kB för stadsindexet plus Mjölbys chunk. Resten kommer från betalningskoden,
lat laddning av admin/utmaningar, vendor-biblioteken ur kritiska vägen och
headerbilden (245 → 88 kB).

**Förbehåll:** detta är överförd vikt, mätt lokalt. Det är inte Core Web Vitals
från riktiga enheter — den siffran går inte att få härifrån, och bör mätas i
fält efter deploy.
| ⏸ | **Dela upp `app.js`** (2 600 rader). Medvetet uppskjuten: stor omflyttning med liten mätbar vinst nu när den tunga koden ändå laddas lat. Görs hellre stegvis medan fas 3–4 lägger till kod, än som en storstädning med regressionsrisk. |

## Fas 3 — Community-kärnan

Mycket finns redan men ligger undanstoppat: `tips.js` har både inskick och
träffsäkerhetsviktad peer-review mot Supabase, och `app.js` har ett lokalt
bidragsflöde (foto + text) som bara sparas i `localStorage`.

0. ✅ **Community-flödet följer staden.** Tipsen var låsta till `APP_CITY='mjolby'`
   — i övriga 71 städer hämtades inga tips, granskningskön var tom och inskick
   bokfördes på Mjölby. Nu följer allt den aktiva staden. `commit a089244`
1. ✅ **Ett bidragsflöde, inte två.** Det lokala `contribs`-flödet var död kod i
   produktion — och visade en låtsas-granskningskö för utloggade. Borttaget,
   117 rader. Riktiga bidrag går genom `tips.js`. `commit 977b0d1`
2. ✅ **Kommentarer per plats.** `place_comments` + `comment_flags`, publiceras
   direkt och modereras i efterhand (till skillnad från tips, som peer-review:as
   före publicering). Testsvit med 9 kontroller hittade två riktiga buggar.
   `commit d189383`, `86a7e2e`
3. ✅ **Verifiering som eget flöde.** Ny **Bidra**-flik: lägg till en plats, bidra
   med bild och text, granska andras. Utloggade ser vad de får göra innan
   inloggningsväggen. `commit ede76cd`
4. ✅ **Lägg till en helt ny plats** — fanns redan i `tips.js` (kind `place` med
   kartväljare), men var osynlig. Nu förstahandsvalet på Bidra-fliken.
5. ✅ **Profilen blir en bidragsprofil.** "Ditt avtryck" direkt under kontokortet:
   publicerade tips, kommentarer, rutter, granskningar, nivå och poäng.
   `commit 101fb56`
6. ⬜ **Migrationen är inte körd i prod** — Fredriks beslut. Tills dess döljer
   appen kommentarssektionen automatiskt.

## Fas 4 — Egna rutter

Byggdes som en **egen modul** (`routes.js`) i stället för att generalisera
`challenges.js`. Den senare är ett arrangörsverktyg — poäng, uppgiftstyper,
organisationsnamn — och att skala bort allt det hade lämnat mer kvar än det
tagit bort. Rutterna ligger dessutom i databasen, inte i länken, så andras
rutter går att upptäcka och inte bara tas emot.

1. ✅ **`routes` + `route_walks`** — namn, stad, stopp i ordning, färdsätt,
   publik/privat, valfri starttid. `walk_count` räknar distinkta vandrare.
   `commit fdf5746`
2. ✅ **Ruttbyggare** med sökbar stopplista, omordning och löpande sträck- och
   tidsuppskattning per färdsätt.
3. ✅ **Dela och utmana** — delningslänk `?rutt=<id>` som öppnas utan konto,
   starttiden följer med i texten, "Jag gick den" med valfri tid och topplista.
4. ✅ **Upptäck rutter** — andras publika rutter i staden, under de kurerade
   lederna på Leder-fliken.
5. ⬜ Ruttbygge direkt från kartan (peka ut stoppen) i stället för via sökfältet.
6. ⬜ QR-kod för en rutt (koden finns redan i `vendor/qrcode.js`).

## Fas 5 — Rebrand

| | |
|---|---|
| ✅ | **Tagline** "Upptäck Sveriges städer" i appheadern, `index.html`, `karta.html` och manifestet. `commit 7c4a2a2` |
| ✅ | **Startsidan säljer deltagandet.** Hero omskriven, ny sektion "Kartan fylls av folk som du" (lägg till → andra granskar → den blir stadens), "Turer"-fliken blev "Rutter". `commit 523c970` |
| ✅ | **`build-seo.mjs`**: bidra-ruta på varje platssida, om-sidan och FAQ:n omskrivna + tre nya frågor (kostar det något, hur lägger jag till en plats, kan jag skapa en egen rutt). |
| ✅ | Webbsidans engelska hub (`en.html`) omskriven — i källan och på plats, utan att regenerera. |
| ⚠️ | **De genererade sidorna är INTE omkörda.** Se nedan — det är ett beslut, inte en detalj. |

### SEO-ytan — avgjort och genomfört

Generatorn hade inte körts sedan `data.json` var mycket mindre: 362 sidor för
9 774 platser. Fredrik valde "det som är bäst för användarna och för att bli
hittad" (`commit 725c5f5`).

**Tröskel: 600 tecken egen prosa** (summary + description + snabbfakta) → 2 321
platssidor. Mätt på *unikt* innehåll, inte på renderad sida — första försöket
räknade även bidra-rutan och rubrikerna, som är identiska överallt, och gav
4 036 sidor på delad standardtext.

**Ingen befintlig sida togs bort.** De 362 grandfathras även under tröskeln;
att avindexera något som rankar är sämre än att avstå från att lägga till.

**De 7 453 övriga listas på sin ortssida** med namn och sammanfattning,
grupperade per kategori. Konsoliderat i stället för utspätt. Platser utan egen
sida öppnas i kartan via `?plats=<id>`.

Tröskeln ändras på ett ställe: `MIN_UNIQUE_CHARS` i `scripts/build-seo.mjs`.
Nästa körning lyfter automatiskt in platser som passerat gränsen sedan sist —
det är så communityns bidrag växer SEO-ytan.

| Tröskel | Sidor totalt |
|---|---:|
| 600 (valt) | 2 321 |
| 800 | ~1 200 |
| 1 000 | ~800 |

**Att komma ihåg vid nästa körning:** `/p/` måste vara i sitt committade skick
innan generatorn körs, annars grandfathras föregående körnings resultat.

## Ordning och varför

Fas 1 först: en app som ska bäras av frivilliga får inte fråga efter pengar,
och den fick inte kosta 1,9 MB att öppna. Fas 2 fortsätter för att fas 3 och 4
lägger till *mer* som ska renderas — bygg inte community ovanpå en trög app.
Fas 3 före fas 4 eftersom rutter är meningslösa utan platser värda att gå
förbi. Fas 5 sist: brandar det som faktiskt finns, inte det som är planerat.
