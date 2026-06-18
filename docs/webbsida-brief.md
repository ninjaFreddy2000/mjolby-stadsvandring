# Designbrief: Stadsvandring.io — företagshemsida (fristående)

> Klistra in hela detta dokument i Claude Design. Det beskriver en **fristående marknadsföringshemsida** som frontar bolaget bakom appen. Appen själv ligger kvar på samma adress (kartan/PWA:n) — den här sidan är "skyltfönstret" som berättar *varför* appen finns, *visionen*, och som värvar bidragsgivare och samarbetspartners.

---

## 1. Uppdraget i en mening

Bygg en varm, modern och förtroendeingivande hemsida som får besökaren att känna: *"Vilken fin idé — jag vill ut och uppleva min stad, och jag vill bidra."* Sidan ska sälja in både **upplevelsen** (för invånare/turister), **enkelheten att bidra** (för hembygdsföreningar och privatpersoner) och **partnerskapet** (för butiker, caféer, restauranger, museer och företag).

## 2. Vad är Stadsvandring.io? (bakgrund till Claude)

- En **gratis webbapp (PWA, ingen nedladdning)** för guidade stadsvandringar. Du utforskar sevärdheter, byggnader, historia och personer via en interaktiv karta, samlar digitala stämplar när du besöker platser, och testar dig själv med quiz.
- Startade i **Mjölby** (med Skänninge & Bjälbo) och växer ort för ort. **Även små orter kan läggas till** — det är en uttalad styrka, inte en eftertanke.
- Varje stad får en egen lokal **berättare** som guidar i sin egen röst. Mjölbys är *Skånska Lasse* (bondkomikern Theodor Lorentz Larsson, 1880–1937 — dragspel, blommig väst, fyndig folklig humor). Detta är en del av charmen och bör synas på sidan.
- Fyra typer av stopp på samma karta (kärnan i affärsidén — visa dem tydligt med färg och ikon):
  1. **Berättelse** (sjöblå) — platser, byggnader, personer, historia.
  2. **Förening** (skogsgrön) — hembygd, sport, kultur. Den "varma vägen in".
  3. **Affär** (honungsgul) — café/butik/hantverk. Samarbetspartners med erbjudanden & incheckning.
  4. **InfoPunkt** (bärröd) — toalett/parkering/laddning. Praktisk nytta.

## 3. Vision & ton (det här ska genomsyra texterna)

**Visionen:** *Få ut folk i sina egna städer — på riktigt, till fots — och låta historien komma till liv där den faktiskt hände.* Vi tror att varje gata, kvarn och torg har en berättelse, och att lokalhistoria blir levande när den är promenadvänlig, gratis och rolig. Vi bygger ett verktyg som är **enkelt nog att alla kan bidra** och **skalbart nog att passa både en stad och en liten by**.

**Tonläge:** Varmt, inbjudande, stolt-lokalt, lite nyfiket och lekfullt — aldrig stelt eller myndighetstorrt. Tänk "kär granne som vill visa dig sin hembygd", inte "kommunal informationsfolder". Svenska som förstaspråk.

## 4. Varumärke & visuell identitet (matcha appen — "Strosa"-stilen)

Hemsidan ska kännas som en naturlig storasyster till appen. Återanvänd appens designspråk:

**Färgpalett (Strosa / "Sommardag"):**
- Bakgrund/pergament: `#F3EAD8` (och `#ECE0C9`)
- Kort/yta: `#FFFDF7` / `#FBF4E6`
- Bläck (text): `#2F2A20`, sekundär `#6E6452`
- **Primär (terrakotta):** `#AC3F22` (CTA-knappar, accenter)
- Honung: `#E0A331`  ·  Sjö: `#3E78A8`  ·  Skog: `#5E8C53`  ·  Bär: `#9A3B52`
- Stopptyps-färger: berättelse=sjö, förening=skog, affär=honung, info=bär

**Typografi:**
- Rubriker: **Fredoka** (mjuk, rundad, vänlig), vikt ~600
- Brödtext: **Mulish**
- Mjuka, rundade hörn (radie 14–28px), varma mjuka skuggor, generöst luftigt.

**Bildspråk:** Varma, soliga foton av riktiga gator/torg/byggnader (gärna sepiavarm ton), blandat med enkla illustrationer i appens stil (små hus, kullar, vatten, vägar). Undvik stockfoto-känsla; sikta på "vår stad, en solig dag".

**Tillgänglighet är ett krav:** WCAG 2.1 AA. God kontrast, tydligt fokus, läsbar text, fungerar på mobil först.

## 5. Sidstruktur (sitemap)

1. **Startsida** (hero + vision + hur det funkar + app-features + de tre vägarna in + socialt bevis + CTA)
2. **Bidra / Hembygdsgårdar** (egen sida — föreningar & privatpersoner)
3. **Partners** (egen sida — butik/restaurang/café/museum/företag)
4. **Lägg till din ort** (för små orter & kommuner)
5. (Befintliga: Om, Alla platser, samt själva appen/kartan — länkas till)

Genomgående: en **återkommande "så ser appen ut"-modul** (telefon-mockup med kartan, stopp-pins, berättarbubbla, stämplar/quiz) som dyker upp på flera ställen så appen alltid är närvarande.

---

## 6. STARTSIDAN — sektion för sektion

**A. Hero**
- Stor varm rubrik, t.ex. *"Upptäck din stad — en berättelse i taget."*
- Underrubrik om gratis webbapp, ingen nedladdning, karta + berättelser + stämplar.
- Två CTA: **"Öppna kartan"** (primär, terrakotta → appen) och **"Se hur det funkar"** (sekundär, scrollar ner).
- Bredvid texten: telefon-mockup som visar appens karta med färgade pins. Mjuk illustrerad bakgrund (kullar, Svartån, små hus).

**B. Vision / "Varför vi finns"**
- Kort, känslosam text om att få ut folk till fots och väcka lokalhistorien till liv. 3 korta värdeord i kort: *Nära* · *Gratis* · *För alla*.

**C. "Så funkar appen" — feature-showcase (återkommande modul)**
- 3–4 feature-kort med ikon + telefonbild:
  - **Interaktiv karta** med fyra sorters stopp (visa färgförklaringen).
  - **Lokal berättare** ("Hör Skånska Lasse berätta") — uppspelad röst/auto-guide via GPS.
  - **Stämplar & quiz** — samla stämplar vid besök, testa dig själv, gamification.
  - **Turer steg för steg** — tematiska vandringar, följer gatorna, fungerar offline.
- Lägg gärna en bred "appen i bruk"-bild som binder ihop sektionen.

**D. "Enkelt och skalbart"**
- Förklara kort: bygger på en delad kunskapsbas, en ny ort = bara att lägga till. Ingen app att ladda ner, funkar i webbläsaren, på mobil och dator. Betona att **både stora städer och små byar** ryms.

**E. "Tre vägar att bidra"** (tre kort som länkar vidare)
- **Invånare** → upptäck & föreslå platser.
- **Hembygd & föreningar** → lägg in bilder, text och placera platser. → *Bidra-sidan*.
- **Företag & butiker** → bli partner. → *Partner-sidan*.

**F. Socialt bevis / trygghet**
- Plats för citat, antal platser/orter, "i samarbete med Mjölby kommun"-känsla, källor (Wikipedia, mjölby.se, lokalhistoriskt material).

**G. Avslutande CTA-band**
- Varm uppmaning + knapp "Öppna kartan" och "Lägg till din ort".

---

## 7. SIDAN "BIDRA / HEMBYGDSGÅRDAR"

Egen, hjärtlig sida riktad till hembygdsföreningar, lokalhistoriker och engagerade privatpersoner. **Budskap nummer ett: det är löjligt enkelt.**

- **Rubrik:** t.ex. *"Er kunskap förtjänar att vandras."*
- **Empatisk ingress:** Ni sitter på bilderna, berättelserna och kunskapen. Vi gör det enkelt att dela den — utan teknikkrångel.
- **"Så enkelt bidrar ni" — 3 steg (visuellt, stort, vänligt):**
  1. **Skriv en kort text** om platsen (eller skicka oss det ni har — vi hjälper till att putsa).
  2. **Ladda upp en bild** (gammalt foto, nytt foto, vykort — funkar).
  3. **Placera platsen på kartan** — peka eller dra en nål, klart. Inga koordinater att fippla med.
- **Betona:** ingen inloggningströskel som skrämmer, mobilvänligt, vi granskar och hjälper till, ni får erkännande ("Bidrag av [förening]").
- **Lyft fram värdet:** föreningsstopp är gröna på kartan, gratis/bidragsfinansierade, och blir den "varma vägen in" för nya besökare till just er hembygd.
- **CTA:** "Börja bidra" / "Boka en kort genomgång med oss" (low-friction, t.ex. formulär eller mejl).
- Återanvänd app-mockupen som visar ett föreningsstopp med foto + text.

---

## 8. SIDAN "PARTNERS"

Egen säljande men charmig sida för **butik, restaurang, café, museum eller företag**.

- **Rubrik:** t.ex. *"Bli en del av berättelsen om er stad."*
- **Ingress:** Som partner får ni en egen plats på kartan där besökare redan rör sig till fots — och en chans att berätta om värdet ni skapar för staden och dess invånare.
- **"Vad ni får" (kort med ikoner):**
  - En **egen platsmarkör** (honungsgul affärs-pin) på kartan.
  - **Egen text + bild** — berätta er historia, er hantverksstolthet, vad ni betyder för orten. (Skriv själva eller med vår hjälp.)
  - **Erbjudanden & incheckning** — besökare kan checka in, ta del av erbjudanden, och ni får mätbar fottrafik.
  - **Synlighet** i turer och bland berättelserna — ni blir en del av stadens väv, inte en annons.
- **Tonen:** det här handlar om värde för staden, inte om reklam. Betona att en bra partnertext berättar *varför ni finns och vad ni ger lokalsamhället*.
- **"Så blir ni partner" — enkla steg:** Hör av er → vi sätter upp er plats → ni (själva eller med hjälp) skriver text & väljer bild → ni går live på kartan.
- **CTA:** "Bli partner" / "Boka ett samtal". Plats för enkelt kontaktformulär.
- Visa en app-mockup med ett affärsstopp öppet (bild, trevlig text, "erbjudande"-knapp, incheckning).

---

## 9. SIDAN "LÄGG TILL DIN ORT"

Kort sida som gör tröskeln låg för **små orter och kommuner**.

- Budskap: *"Liten by eller stor stad — alla förtjänar sin vandring."*
- Förklara skalbarheten: en ny ort = en egen berättare, egna platser, samma enkla verktyg. Inget stort projekt.
- Riktad både till kommuner (prenumeration som täcker berättelsestoppen) och till lokala eldsjälar.
- CTA: "Hör av dig om din ort".

---

## 10. Återkommande element & komponenter

- **App-showcase-modul** (telefon-mockup + 1–2 features) — återanvänds på start, bidra- och partner-sidan så appen alltid är synlig.
- **Stopptyps-legend** (fyra färgade pins med etikett) — liten, fin, förklarande.
- **Steg-för-steg-kort** (1-2-3) i samma stil på både bidra- och partner-sidan.
- **Mjuk sektionsväxling** med illustrerade horisonter (kullar/vatten) mellan block.
- **Header:** liten "S"-logga + "Stadsvandring.io", enkel meny (Hem · Bidra · Partners · Lägg till din ort · Öppna appen). Sticky, lätt.
- **Footer:** kort visionsmening, länkar (appen, Om, Alla platser, Bidra, Partners), kontakt.
- **Knappar:** primär = terrakotta fylld; sekundär = vit med terrakotta-ram. Rundade, mjuk skugga.

## 11. Microcopy-exempel (ton att härma)

- Hero: *"Strosa runt i din stad. Lyssna på historierna. Samla stämplar längs vägen."*
- Bidra: *"Har du ett gammalt foto och en historia? Då har du allt som behövs."*
- Partner: *"Berätta vad ni ger staden — vi ger er en plats på kartan."*
- Ort: *"Vi började i Mjölby. Härnäst: er ort?"*

## 12. Tekniska & praktiska ramar

- **Fristående sida**, men appen/kartan ligger kvar på samma adress — länka till den, ersätt den inte.
- **Mobil först**, snabb, lätt. Helst statisk/lätt (matchar nuvarande stack: HTML/CSS, inga tunga ramverk krävs).
- **SEO/AEO:** semantisk HTML, bra titlar/meta, schema.org där det passar (Organization, FAQ), snabb laddning. Innehållet ska kunna citeras av AI-svarsmotorer.
- **Tillgänglighet:** WCAG 2.1 AA (0 violations är målet, som i appen).
- **Språk:** svenska primärt; engelsk version kan komma senare (appen har redan sv/en).

## 13. Leverans jag vill ha av Claude Design

1. En **startsida** enligt sektionerna ovan.
2. **Bidra/Hembygd-sida** och **Partner-sida** som egna vyer.
3. Konsekvent komponentbibliotek (header, footer, knappar, kort, app-mockup, stopptyps-legend).
4. Allt i Strosa-paletten + Fredoka/Mulish, varmt och tillgängligt.
5. Responsivt, mobil först.

> Viktigast av allt: sidan ska kännas **trevlig, varm och inbjudande** — så att en hembygdsförening, en cafégare och en nyfiken invånare alla tänker "det här vill jag vara med i".
