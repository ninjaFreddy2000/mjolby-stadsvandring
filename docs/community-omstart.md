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
| ⬜ | **CSS.** `styles.css` 84 kB + `webbsida.css` 42 kB, båda blockerande. Dela i ett litet kritiskt skal + resten lazy. |
| ⬜ | **Mät.** Lighthouse/CWV före och efter, så påståendena är belagda. |
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
5. ⬜ **Profilen blir en bidragsprofil**: mina bidrag, mina bilder, min nivå,
   vad jag verifierat åt andra.
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
| ⬜ | `i18n.js` — engelsk copy för de nya flödena finns, men webbsidans engelska hub (`en.html`) är inte omskriven. |
| ⚠️ | **De genererade sidorna är INTE omkörda.** Se nedan — det är ett beslut, inte en detalj. |

### ⚠️ Att ta ställning till: SEO-ytan har vuxit ur sig själv

`node scripts/build-seo.mjs` kördes för att uppdatera copyn — och visade sig
generera **9 774 platssidor** där repot har **362**. Plus leadmagnet-sidor för
72 orter och en sitemap på 10 131 URL:er (1,8 MB mot dagens 96 kB). Jag backade
ut allt genererat och committade bara källändringen; att 27-faldiga den
indexerbara ytan är Fredriks beslut, inte en bieffekt av en textändring.

Underlaget, mätt på `data.json` (9 774 poster):

| Textmängd (summary + description) | Antal |
|---|---|
| 0–150 tecken | 1 239 |
| 150–400 | 5 491 |
| 400–800 | 2 292 |
| 800+ | 752 |

Bara 1 718 poster har en bild. Alla har källa.

Risken är tunt innehåll: 6 730 av sidorna skulle ha under 400 tecken brödtext.
Google hanterar den sortens massgenererade ytor hårt, och det kan dra ned även
de sidor som faktiskt är bra. Tre vägar:

1. **Publicera allt** — maximal täckning, störst risk för tunn-innehålls-straff.
2. **Tröskel** — generera bara sidor med t.ex. ≥400 tecken (3 044 sidor). De
   tunna posterna finns kvar i appen och på ortssidorna, men får ingen egen
   indexerbar sida förrän någon bidragit till dem.
3. **Låt stå** — behåll de 362 och väx organiskt i takt med att communityn
   fyller på. Passar community-tanken bäst men lämnar trafik på bordet.

Alternativ 2 rimmar bäst med omstarten: en tunn plats blir en *inbjudan att
bidra* i appen, och förtjänar en egen sida först när den har innehåll. Men det
är ett beslut som rör intäkt och synlighet — fråga innan något körs.

---

## Ordning och varför

Fas 1 först: en app som ska bäras av frivilliga får inte fråga efter pengar,
och den fick inte kosta 1,9 MB att öppna. Fas 2 fortsätter för att fas 3 och 4
lägger till *mer* som ska renderas — bygg inte community ovanpå en trög app.
Fas 3 före fas 4 eftersom rutter är meningslösa utan platser värda att gå
förbi. Fas 5 sist: brandar det som faktiskt finns, inte det som är planerat.
