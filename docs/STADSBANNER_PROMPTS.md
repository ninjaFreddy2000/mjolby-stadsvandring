# Stadsbanner-prompter (måleriska stadsvyer)

> **Scope-notis 2026-07-07:** Fredriks omedelbara behov är EN cross-promo-banner för Stadsvandring (visas i Spökkartan/Haunted Places), se ghost-repots `112_PROMO_BANNERS_PROMPTS.md`. Listan nedan med panorama per stad är BACKLOG/framtid, inte beställt nu. Rör den bara på begäran.

Syfte: inbjudande, måleriska panoramabilder av svenska småstäder som lockar folk att testa Stadsvandring.io. Samma stil som nuvarande `images/header.jpg` men snyggare/bredare (referens: Fredriks Mjölby-bild 2026-07-07). Genereras i ChatGPT/DALL·E (kvot 6 bilder/dag, se spökkartan-projektets `tooling_chatgpt_image_workflow`).

## Stil (klistra in i varje prompt)

```
A wide panoramic elevated three-quarter aerial view of a charming Swedish small
town, in the style of a richly detailed classic storybook illustration (Anton
Pieck / naive realism). Bright clear summer daylight, deep blue sky with soft
white cumulus clouds. Warm inviting palette: Falu-red timber cottages with white
trim, ochre and yellow houses, terracotta rooftops, lush green trees with a few
early-autumn touches. The town is alive with tiny people strolling. Include: a
church with a tall spire as the focal landmark, a market square with striped
awnings and a fountain, cobbled streets, Swedish flags, and a calm blue lake or
river with a small wooden boat and swans. Painterly, warm, cozy, highly detailed,
NOT photorealistic, NOT dark. Landscape orientation, panoramic composition with
plenty of sky. No text, no watermark, no logo.
Landmark / character for this town:
```

Format: generera liggande (DALL·E max 1536×1024). Bannern använder `object-fit: cover` i ett brett band, så CSS beskär topp/botten, det blir rätt panoramakänsla. En bild per stad.

## Landmärke per stad (byt ut sista raden)

| Stad | slug | Landmärke att lyfta fram |
|------|------|--------------------------|
| Mjölby | mjolby | (KLAR via Fredriks bild) kyrka med grön spira, stenbvalvsbro över Svartån, torg, segelbåt, svanar |
| Motala | motala | Göta kanal med slussar, kanalbåt, Motala verkstad, sjön Vättern i fonden |
| Norrköping | norrkoping | industrilandskapet: gula stenfabriker längs Motala ström, forsar, skorstenar, broar |
| Vadstena | vadstena | Vadstena slott och klosterkyrkan vid Vätterns strand, medeltida stämning |
| Skänninge | skanninge | medeltida kyrkor, Vårfrukyrkan, gamla torg, låg stadsbebyggelse |
| Visby | visby | medeltida ringmur med torn, kyrkoruiner, rosor, hamnen och Östersjön |
| Karlskrona | karlskrona | barock örlogsstad, Fredrikskyrkan, Stortorget, skärgård och segelfartyg |
| Gävle | gavle | Gavleån, Gamla Gefle med trähus, rådhus, hamnkranar i fonden |
| Halmstad | halmstad | Nissan-ån, Norre port, Sankt Nikolai kyrka, torg med Europa-brunn |
| Varberg | varberg | Varbergs fästning vid havet, kallbadhuset, strandpromenad |
| Alingsås | alingsas | trästaden, kaffestugor (fika), Nolhaga, små torg |
| Piteå | pitea | trästaden, Rådhustorget, älvmynning, kust och midnattsljus |
| Västervik | vastervik | skärgårdshamn, trähus, båtar, kobbar och skär |
| Borgholm | borgholm | Borgholms slottsruin, öländsk kust, kvarnar |
| Göteborg | goteborg | Göta älv, Feskekôrka, spårvagn, hamnkranar, Älvsborgsbron i fonden |
| Stockholm | stockholm | Gamla stan, Riddarholmskyrkans spira, vatten och båtar, färgglada fasader |
| Smögen | smogen | Smögenbryggan med sjöbodar i alla färger, klippor, fiskebåtar |
| Marstrand | marstrand | Carlstens fästning, segelbåtar, badhus, bohuslänsk klippkust |
| Falkenberg | falkenberg | Ätran med Tullbron, Sankt Laurentii kyrka, laxfiske |
| Finspång | finspang | Finspångs slott, bruksmiljö, kanaler och sjöar |

## Att göra efter varje bild
1. Ladda ner PNG, `sips -s format jpeg -s formatOptions 82 <png> --out images/<slug>-panorama.jpg` (eller `header.jpg` för Mjölby/landning).
2. Koppla in där banner/stadskort visas (se index.html `.citybanner` och respektive `stadsvandring/<slug>.html`).
3. Commit + push (separat repo: `~/Desktop/Stadsvandring`, egen Vercel).

OBS: separat projekt och infra från Spökkartan/Haunted Places (isolationsdoktrinen). Bilderna är daglius/varma, INTE spökstil.
