# Mjölby Stadsvandring

En installerbar webbapp (PWA) som tar besökaren på guidad stadsvandring genom
Mjölby, Skänninge och Bjälbo — karta, berättelser, stämplar och quiz, med
**Skånska Lasse** som stadens egen berättare.

## Funktioner
- **Karta** med färgkodade stopp i fyra typer: Berättelse, Förening, Affär, InfoPin.
- **Vandringar**: Centrala vandringen + Medeltidsringen, med ordnad stopplista och rutt.
- **Detaljvyer** med stora bilder, guideberättelser och källor.
- **Stadens berättare** (`storytellers.js`) — Skånska Lasse guidar i sin egen röst.
  Skalbart: varje stad kan lägga till sin egen berättare.
- **Personer & berättelser** — sök bland alla poster, även de utan kartnål.
- **Intäktsmotor**: affärsstopp med erbjudanden + **sponsorpanel** som visar
  mätbar fottrafik (incheckningar) — det en sponsor betalar för.
- **Gamification**: stämplar (incheckning) och quiz per vandring.
- Fungerar offline (service worker) och kan installeras på hemskärmen.

## Köra lokalt
```bash
python3 -m http.server 8123
# öppna http://localhost:8123
```
Ren statisk app — ingen byggprocess i webbläsaren. Ikoner genereras med
`node make-icons.mjs`.

## Data
`data.json` är **källan** (9 774 platser i 72 städer) och läses aldrig av appen.
Kör build-steget när den ändrats:
```bash
node scripts/build-data.mjs
```
Det skriver:
- `data/cities.json` (~40 kB) — en rad per stad: centrumpunkt, antal stopp, vilka
  leder som finns och den förberäknade centrumslingan. Detta är allt appen behöver
  för kartöversikt, stadsväljare och ledräkning.
- `data/city/<slug>.json` — den stadens platser. Hämtas när staden väljs.
- `data/place-city.json` — id → stad, hämtas bara när en sparad plats ligger i en
  stad som inte är laddad.

Startladdningen gick därmed från 1,9 MB till ~48 kB (gzip).

## Bilder
`images/*.jpg` är originalen (~1100 px, 300–500 kB styck). Appen visar
webbstorlekar som byggs med:
```bash
node scripts/build-images.mjs
```
Det skriver `images/w320/` (listminiatyrer), `images/w800/` (hero i detaljvyn)
och `images/w1200/header.webp` (CSS-bakgrunden). Kräver `brew install webp`.
Appen faller tillbaka på originalet om en variant saknas, så steget är valfritt
men sparar ungefär 20× på en listvy.

## Typsnitt
Fredoka och Mulish är **självhostade** i `vendor/fonts/` (OFL-licensade). Hämta om
dem bara om vikterna ska ändras:
```bash
node scripts/build-fonts.mjs
```
Sidorna länkade tidigare till fonts.googleapis.com med en render-blockerande
`<link>` — en extra DNS + TLS + hämtning före first paint, plus en rundtur till
gstatic för filerna. Och eftersom gstatic ligger utanför service workerns cache
var appen **fontlös offline**. Nu ligger inga Google-domäner kvar i CSP:n.

## Lägg till en ny stad / berättare
Lägg en post i `STORYTELLERS` i `storytellers.js` och peka ut den med `ACTIVE_CITY`.
Endast `name` + `greeting` krävs; `fallbacks` ger repliker även utan handskriven text.

## Källor & licenser
- Innehåll: `data.json` (Wikipedia, mjolby.se, visitmjolby.se, Per Anderssons
  Mjölbyhistoria m.fl. — se `sources` per post).
- Porträtt på Skånska Lasse: Wikimedia Commons, **public domain**.
- Platsfoton: Google Maps/Places (kontrollera villkor före publicering).
- Kartdata: © OpenStreetMap-bidragsgivare.

*Prototyp. Sponsorsiffror och erbjudanden är demoexempel.*
