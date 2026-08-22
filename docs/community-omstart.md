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
  *positioneringen*: från "guidade stadsvandringar" till **"Folkets egen
  stadsvandring"**. Säg till om du vill byta namn på riktigt, det ändrar fas 5.
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

1. **Kartnålar i skala.** Göteborg har 609 stopp; alla ritas som egna
   DOM-markörer. Klustring (leaflet.markercluster) + rita bara det som syns.
2. **Dela upp `app.js`** (2 600 rader, en fil) i moduler med tydliga gränser:
   karta, platser/detaljvy, community, rutter, UI-skal. Idag importerar allt
   allt, och en ändring i en vy tvingar om-parse av hela filen.
3. **CSS.** `styles.css` 84 kB + `webbsida.css` 42 kB, båda blockerande. Dela i
   ett litet kritiskt skal + resten lazy.
4. **Bilder.** Hero- och listbilder utan storleksattribut → layoutskutt.
   Moderna format, rätt dimensioner, `loading="lazy"` överallt.
5. **Mät.** Lighthouse/CWV före och efter, så påståendena är belagda.

## Fas 3 — Community-kärnan

Mycket finns redan men ligger undanstoppat: `tips.js` har både inskick och
träffsäkerhetsviktad peer-review mot Supabase, och `app.js` har ett lokalt
bidragsflöde (foto + text) som bara sparas i `localStorage`.

1. **Ett bidragsflöde, inte två.** Slå ihop det lokala `contribs`-flödet med
   Supabase-tipsen. Foto + text på vilken plats som helst, från kartan, i två
   tryck. Utan konto: sparas lokalt och laddas upp vid inloggning.
2. **Kommentarer per plats.** Ny tabell `place_comments` (text + valfri bild),
   synliga direkt i platsens detaljvy. Rapportering + moderering.
3. **Verifiering som eget flöde.** Granskningskön får en egen ingång i menyn,
   inte en knapp i profilen. "Godkänn / behöver mer info / avslå", tydlig
   tröskel för publicering, och synligt vem som verifierat.
4. **Lägg till en helt ny plats** — inte bara bidra till en befintlig. Kartnål
   sätts genom att peka på kartan.
5. **Profilen blir en bidragsprofil**: mina bidrag, mina bilder, min nivå,
   vad jag verifierat åt andra.

## Fas 4 — Egna rutter

`challenges.js` (830 rader) har redan halva bygget: plocka stopp, generera en
delbar länk + QR, spela, topplista. Den ska generaliseras från "stadsutmaning
för arrangör" till **"min rutt"** för vem som helst.

1. **`routes`-tabell i Supabase**: namn, stad, stopp i ordning, typ
   (promenad / löprunda / cykel), publik eller privat, skapare.
2. **Ruttbyggare**: välj stopp på kartan eller ur listan, dra för att ordna om,
   se längd och tid. Löprunda = samma sak med annan tempoprofil.
3. **Dela och utmana**: länk + QR, "vi går den här på lördag kl 10",
   utmaningsläge med tid/poäng, resultat för alla som gått den.
4. **Upptäck rutter**: andras publika rutter i staden, sorterat på populärast.

## Fas 5 — Rebrand

1. `index.html`, `karta.html`, `om.html`, `manifest.webmanifest`, OG-taggar,
   `llms.txt` — från "guidade stadsvandringar" till folkets egen.
2. `i18n.js` — svensk och engelsk copy för de nya flödena.
3. Startsidan säljer **deltagandet**: senaste bidragen, platser som behöver
   bilder, rutter folk skapat den här veckan.
4. De 364 statiska platssidorna (`/p/*`) får "bidra med en bild"-ingång — de
   är trafikmagneterna och därmed rekryteringsytan.

---

## Ordning och varför

Fas 1 först: en app som ska bäras av frivilliga får inte fråga efter pengar,
och den fick inte kosta 1,9 MB att öppna. Fas 2 fortsätter för att fas 3 och 4
lägger till *mer* som ska renderas — bygg inte community ovanpå en trög app.
Fas 3 före fas 4 eftersom rutter är meningslösa utan platser värda att gå
förbi. Fas 5 sist: brandar det som faktiskt finns, inte det som är planerat.
