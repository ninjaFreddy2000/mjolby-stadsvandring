// ─────────────────────────────────────────────────────────────────────────
//  STADENS BERÄTTARE  —  skalbart register
//
//  Varje stad kan ha sin EGEN berättare: en lokal röst som guidar besökaren
//  i sin egen ton. Lägg till en stad genom att lägga en post i STORYTELLERS
//  med samma form som 'mjolby' nedan, och peka ut den med ACTIVE_CITY.
//  Saknar en stad berättare? Sätt bara ingen post — appen funkar ändå.
//
//  Fältform (alla utom name/greeting är valfria):
//    {
//      cityId, city, id, name, realName, years, role, avatar, accent, entryId,
//      voice:   { tagline, summary, traits[], phrases[], signoff },
//      greeting:  "...",                       // i karaktär, första mötet
//      remarks:   { '<stop-id>': "..." },      // handskrivna repliker per stopp
//      fallbacks: [ "...{name}..." ],          // generiska repliker i samma röst
//    }
// ─────────────────────────────────────────────────────────────────────────

import { cityIntro } from './cityintros.js';

export const ACTIVE_CITY = 'mjolby';

export const STORYTELLERS = {

  mjolby: {
    cityId: 'mjolby',
    city: 'Mjölby',
    id: 'skanska-lasse',
    name: 'Skånska Lasse',
    realName: 'Theodor Lorentz Larsson',
    years: '1880–1937',
    role: 'Bondkomiker & stadens berättare',
    avatar: '🪗',
    portrait: 'images/skanska-lasse.jpg',   // tidsfoto, public domain (Wikimedia Commons)
    portraitCredit: 'Foto: okänd · Public domain (Wikimedia Commons)',
    accent: '#E2A21A',
    entryId: 'skanska-lasse',   // länkar till hans post i kunskapsdatabasen

    // ── Röstprofil: HUR han kommunicerar ──────────────────────────────────
    voice: {
      tagline: 'Långrock, blommig väst och dragspel — och ett rim på lut.',
      summary:
        'Skånska Lasse pratar som en varm, slug bonde som förundras över ' +
        'världen och rimmar om den. Han vänder sig alltid direkt till dej, ' +
        'med glimten i ögat och en nypa folklig visdom, och drar gärna en ' +
        'parallell till dragspelet eller någon av sina visor.',
      traits: [
        'Folklig och varm — pratar med dej, inte till dej',
        'Bondens förundran inför det moderna (elektricitet, bilar, allt nytt)',
        'Glimten i ögat, milt satirisk men aldrig elak',
        'Rimmar gärna, i sjungande takt',
        'Hemspunnen visdom ur vardagen — och alltid med tid att stanna',
      ],
      phrases: ['Kära du,', 'Si,', 'Begrip,', 'Ja må ja säja,', 'Höhö,'],
      signoff: '— Lasse, me dragspele på ryggen',
    },

    // ── Första mötet, i karaktär ──────────────────────────────────────────
    greeting:
      'Goddag, goddag, kära du! Lasse heter ja — Skånska Lasse om vi ska va ' +
      'noga, fast ja har bott här i Mjölby längre än ja nånsin bodde i Skåne.\n\n' +
      'Förr om åren stog ja på scenen i långrock å blommig väst, me dragspele ' +
      'i famnen, å sjöng om allt som rörde sej — elektrisiteten, Johan på ' +
      'Snippens Ford, å allt det nymodiga som kom farandes.\n\n' +
      'Nu ska ja visa dej runt i min stad. Ja lovar inga märkvärdigheter, men ' +
      'ja känner var sten å var fors, å ja har ett rim på lut te varje hörn. ' +
      'Häng me — å ha int så bråttom. Dä bästa kommer te den som stannar te.',

    // ── Handskrivna repliker per stopp (Lasses egen röst) ─────────────────
    remarks: {
      'mjolby-station':
        'Si, här kom ja farandes en gång, me dragspele i ena handen å hoppe i ' +
        'andra. Tåge förde hit halva Sverige — å mej me. Tänk att en sån ' +
        'bullrande best kunde göra en kvarnby te en hel stad!',
      'mjolby-stadshotell':
        'Här inne har mången resande tagit sej en styrketår. Dom hitta en ' +
        'tidning från 1901 inne i väggen, säjer dom — ja hade hellre dom hitta ' +
        'en gömd visa, men dä får man int begära för mycke.',
      'stora-torget':
        'På torget bytte di hästar förr, å skvallre gick livligt som forsen. ' +
        'Ja har stått här mången gång — ett torg ä bästa scenen, för folke ä ' +
        'redan samlat.',
      'mjolby-kyrka':
        'Tornet stog kvar när allt anna brann 1771 — segt som en östgöte, må ' +
        'ja säja. Ja sjöng helst ute i det fria, men för det tornet lyfter ja ' +
        'på hatten.',
      'mjolby-hembygdsgard':
        'På holmen här förvaras lite av varje av det gamla — å mitt eget lilla ' +
        'hus lär höra te föreningens omsorg. Gå in å titta; dä ä trevligare att ' +
        'minnas en levande än en död, men ja klagar int.',
      'galleria-kvarnen':
        'Kvarnen i namne, fast int en mjölsäck i sikte! Tiderna byts — förr ' +
        'maldes säd, nu mals dä väl mest kort i kassan. Höhö.',
      'gamla-stadshuset':
        'Här dansar två figurer i brons, gjorda av en världskänd herre vid namn ' +
        'Milles. Ja dansa hellre te dragspel, dä ska erkännas — men fint ä dä.',
      'kvarnparken':
        'Här står ja själv i brons numera — tänk dä! En möbelsnickare från ' +
        'Skåne, gjuten å ställd vid ån. Sätt dej hos mej en stund, vetja.',
      'konditori-hornet':
        'Nu, kära du, ä dä dags för en kafferast. En stadsvandring utan fika ä ' +
        'som en visa utan refräng — den går, men den sjunger inte.',
      'skanska-lasse':
        'Ja, dä ä ja dä. Theodor hette ja egentligen, men Skånska Lasse ' +
        'fastna. Ja snickra möbler om dan å rimma om kvällen — å så blev rimmen ' +
        'mitt levebröd te slut. Livet ä underligt, kära du.',
      'skanska-lasses-staty':
        'Där står ja å glor ut över parken. Konstig känsla att möta sej själv i ' +
        'brons — men ja klagar int, dä ä int alla bönder som får en staty.',
      'skanska-lasses-hus':
        'Här bodde ja me hustru å ungar på Sandgatan. Trångt? Ja. Men i ett ' +
        'litet kök ryms mången stor visa, dä kan ja lova dej.',
      'potatisrondellen':
        'En potatis så stor som en lada, mitt i rondellen! Hade ja levat hade ja ' +
        'skrivit en visa på fläcken — "Potäten på Viringe" kunde hon hetat.',
      'det-kom-en-gang-en-mjolnare':
        'En mjölnare i brons vid ån — dä ä rätt karl på rätt plats. Utan mjölnarn ' +
        'å hans kvarn hade dä varken funnits stad eller visor att sjunga.',

      // ── Medeltidsringen ──
      'bjalbo-kyrka':
        'Si på det tornet, kära du — som en hel borg av sten! Här lär kungar ha ' +
        'vaggats. Ja sjöng om bilar å elektrisitet, men inför sånt här gammalt ' +
        'tar ja av mej hatten å tiger en stund. Dä säjer en del.',
      'hogbystenen':
        'Tänk att nån för tusen år sen högg sin sorg i sten — å att den står kvar ' +
        'än. Mina visor klingar väl bort om hundra år, men den där bonden Gulle å ' +
        'hans pojkar minns vi ännu. Dä ä också ett slags odödlighet.',
      'skanninge-orten':
        'Skänninge va stort när Mjölby va smått, dä ska erkännas. En riktig stad ' +
        'me köpmän å kloster medan vi ännu mol mjöl vid forsen. Var sak har sin ' +
        'tid, kära du — å Skänninge hade sannerlin sin.',
      'varfrukyrkan-skanninge':
        'Tyska köpmän reste den här tegelkolossen — "Garpekyrkan" kalla folke ' +
        'den. Ett granne bygge, må ja säja, fast ja trivs bäst där det ä lite ' +
        'enklare å mer plats för ett dragspel.',
      'sta-ingrids-kloster':
        'Här levde systrarna i landets första kvinnokloster — å sen bar di stenarna ' +
        'härifrån ända te Vadstena slott. Tänk vad folk hinner riva å bygga om. ' +
        'Men ruinen står kvar, å den viskar om man lyssnar.',
      'ture-lang':
        'En ståljätte på torget som vakar över rättvisan! Honom skulle ja int ' +
        'vilja sjunga en spefull visa om — han ser inte ut att skratta lätt. Höhö.',
      'svaneholms-borgruin':
        'Ut på udden i hagen ligger en gammal borg å smular. På våren lyser dä ' +
        'blått av sippor mellan stenarna. Naturen tar tillbaks sitt te slut — ' +
        'oss alla, kära du, men sätt dej å njut så länge.',

      // ── Fler centrala & nära ──
      'linds-mjolby':
        'Eget bageri, säjer du? Då luktar dä rätt härifrån. Ta en bulle åt mej me ' +
        '— en visa går alltid bättre på mätt mage.',
      'mjolby-ai-ff-vifolkavallen':
        'På Vifolkavallen skriker hela stan med ett halsljud. Ja har spelat för ' +
        'mången publik, men inget tar sån sats som ett mål i sista minuten.',
    },

    // ── Generiska repliker i samma röst (när handskriven saknas) ──────────
    fallbacks: [
      'Stanna te vid {name} en stund, kära du — dä bästa ser man int i fart.',
      'Si, {name} har ock sin historia. Allt har dä, om man bara lyssnar.',
      'Här vid {name} har ja ett rim på lut — fast ja sparar dä te ja har ' +
        'dragspele me.',
      'Begrip att även {name} hör staden te. Inget ä för smått för en visa.',
      'Ja må ja säja — {name} ä värd en funderare. Sätt dej ner om benen tröttnar.',
    ],
  },

  // ── Lokala berättare för övriga orter (ersätter generiska "Din Stadsguide"
  //    för just dessa städer). Varje röst är knuten till ortens egen identitet. ──

  motala: {
    cityId: 'motala', city: 'Motala', name: 'Radio-Greta', role: 'Rösten från radions stad',
    avatar: '📻', accent: '#3E78A8',
    voice: {
      tagline: 'En varm stämma från kanalstaden — som förr ur en radio i finrummet.',
      summary: 'Greta pratar som en gammal radiopresentatör: tydligt, vänligt och med en känsla för det stora i det lilla. Hon älskar Göta kanal, Vättern och allt som susar i etern.',
      traits: ['Varm radioröst', 'Stolt över kanalen och Vättern', 'Ser det stora i det lilla'],
      phrases: ['Hör hör,', 'Mina vänner,', 'Tänk er,'],
      signoff: '— Greta, Motala motala motala',
    },
    greeting: 'Hör hör, och hjärtligt välkommen till Motala! Härifrån bar en gång radion ut över hela Sverige — och härifrån ska jag bära dig genom kanalstaden.\n\nFölj med längs Göta kanal och Vätterns strand, så berättar jag medan vi går.',
    fallbacks: [
      'Stanna en stund vid {name}, mina vänner — det är värt en paus.',
      'Tänk er allt {name} sett genom åren. Platser minns, om man lyssnar.',
      'Hör hör — {name} har sin egen lilla historia också.',
      'Vid {name} sänker vi tempot. Det bästa kommer till den som dröjer kvar.',
    ],
  },

  ydre: {
    cityId: 'ydre', city: 'Ydre', name: 'Sigrid i Asby', role: 'Bygdens sägenberättare',
    avatar: '🌲', accent: '#5E8C53',
    voice: {
      tagline: 'Mormor i skogsbygden som kan varenda sägen kring Sommen.',
      summary: 'Sigrid berättar som man gjorde förr vid brasan — om jätten Bule, om urkon som sparkade upp sjön Sommen, om vårdkasar och troll. Lugn, klok och med glimten kvar.',
      traits: ['Sägner och folktro', 'Lugn skogsbygdsvisdom', 'Glimten i ögat'],
      phrases: ['Hör du,', 'Si,', 'Förr i världen,'],
      signoff: '— Sigrid, vid Sommens strand',
    },
    greeting: 'Hör du, lilla vän — välkommen till Ydre, längst ner i Östergötland där skogen tar vid. Här bor sägnerna kvar mellan sjöar och berg.\n\nKom, så går vi en sväng, så ska jag berätta vad bergen och vattnet minns.',
    fallbacks: [
      'Si, {name} har också sin saga — det mesta har det här i bygden.',
      'Hör du, stanna vid {name} en stund och lyssna på tystnaden.',
      'Förr i världen visste man att akta {name}. Stå still och känn efter.',
      'Vid {name} är det fint att dröja. Skogen har gott om tid, och det har vi med.',
    ],
  },

  valdemarsvik: {
    cityId: 'valdemarsvik', city: 'Valdemarsvik', name: 'Skepparn', role: 'Gammal skärgårdsskeppare',
    avatar: '⚓', accent: '#3E78A8',
    voice: {
      tagline: 'Pensionerad skutskeppare som kan varje grund i Gryts skärgård.',
      summary: 'Skepparn pratar saltstänkt och varmt, med havet i blicken. Han känner öarna, fiskelägena och fågelskären utantill och har en historia till varje vik.',
      traits: ['Salt sjömanston', 'Kan skärgården utantill', 'Varm under det barska'],
      phrases: ['Aja,', 'Hör nu,', 'Längst där ute,'],
      signoff: '— Skepparn, med kurs mot Harstena',
    },
    greeting: 'Aja, välkommen ombord i Valdemarsvik — porten ut mot Gryts skärgård och tusen öar. Här slutar landet och havet tar vid.\n\nHåll i hatten, så lotsar jag dig genom viken och berättar om det som döljer sig där ute.',
    fallbacks: [
      'Hör nu, {name} är värd ett stopp — lägg till en stund.',
      'Aja, {name} har sett sin beskärda del av väder och folk.',
      'Längst in vid {name} är det lugnt. Sjön lär en att inte ha bråttom.',
      'Kasta loss tankarna vid {name} och se dig omkring, vetja.',
    ],
  },

  boxholm: {
    cityId: 'boxholm', city: 'Boxholm', name: 'Bruks-Valle', role: 'Smed vid järnbruket',
    avatar: '🔨', accent: '#AC3F22',
    voice: {
      tagline: 'Gammal brukssmed med sot under naglarna och hjärtat på rätta stället.',
      summary: 'Valle pratar rakt och hjärtligt, som folk gör i en bruksort. Han kan järnets historia, Svartåns kraft och varenda gård i bygden — och stoltserar gärna med poeten Atterbom.',
      traits: ['Rättfram bruksanda', 'Kan järn och vatten', 'Stolt över bygdens folk'],
      phrases: ['Joho,', 'Ser du,', 'Här om åren,'],
      signoff: '— Valle, vid hammaren',
    },
    greeting: 'Joho, välkommen till Boxholm! Här slog hammaren och maldes järn medan Svartån drog sitt strå till stacken.\n\nFölj med, ser du, så visar jag bruket och bygden — och kanske drar vi en rad av skalden Atterbom på vägen.',
    fallbacks: [
      'Ser du {name}? Stanna till — det är värt en titt.',
      'Joho, {name} hör bygden till. Inget är för litet för en historia.',
      'Här om åren var {name} en självklar plats att stanna vid. Är det än.',
      'Ta det lugnt vid {name}, ser du. Bruksfolk vet att vila lönar sig.',
    ],
  },

  odeshog: {
    cityId: 'odeshog', city: 'Ödeshög', name: 'Runa vid Rökstenen', role: 'Bygdens runtydare',
    avatar: '🪨', accent: '#E0A331',
    voice: {
      tagline: 'Hon som vakar vid världens längsta runinskrift, vid Ombergs fot.',
      summary: 'Runa talar stillsamt och gåtfullt, som den som lever nära forntiden. Hon kan Rökstenens runor, Alvastra klosters murar och Ombergs sägner — och tycker om en god gåta.',
      traits: ['Lever nära forntiden', 'Gåtfull och stillsam', 'Älskar en god gåta'],
      phrases: ['Lyssna,', 'För länge sedan,', 'Stenen minns,'],
      signoff: '— Runa, under Omberg',
    },
    greeting: 'Lyssna — välkommen till Ödeshög, där Vättern möter Omberg och varje åker döljer forntid. Här står Rökstenen med världens längsta runinskrift.\n\nKom, så vandrar vi bland runor, klosterruiner och berg, och låter stenarna viska sina gåtor.',
    fallbacks: [
      'Stenen minns {name}. Stanna och lyssna, så kanske du också gör det.',
      'För länge sedan kände man {name} väl. Tiden glömmer inte allt.',
      'Lyssna vid {name} — det gamla talar tyst, men det talar.',
      'Dröj vid {name}. Det som varat länge har lärt sig tålamod.',
    ],
  },

  alingsas: {
    cityId: 'alingsas', city: 'Alingsås', name: 'Konditor Alström', role: 'Värd i fikastaden',
    avatar: '☕', accent: '#E0A331',
    voice: {
      tagline: 'Stadens käraste kafévärd — alltid med kaffe på och en historia till.',
      summary: 'Alström är gemytlig och pratglad, som sig bör i Sveriges fikastad. Han kan trästadens gränder, Alströmers potatis och ljusen som tänds varje höst — och bjuder gärna på en bulle.',
      traits: ['Gemytlig kafévärd', 'Stolt fikastads-anda', 'Bjuder gärna på en historia'],
      phrases: ['Slå dig ner,', 'Ska vi se,', 'Apropå det,'],
      signoff: '— Alström, med kaffet på',
    },
    greeting: 'Slå dig ner och välkommen till Alingsås — Sveriges fikastad, där Jonas Alströmer en gång gav potatisen ett hem. Här tas pauser på allvar.\n\nKom, så strosar vi genom trästaden, och på vägen blir det förstås en fika.',
    fallbacks: [
      'Slå dig ner vid {name} en stund — allt blir bättre med en paus.',
      'Apropå det, {name} har en alldeles egen historia att bjuda på.',
      'Ska vi se… {name} är värd ett stopp, det kan jag lova.',
      'Ingen brådska vid {name}. Det bästa serveras långsamt.',
    ],
  },

  goteborg: {
    cityId: 'goteborg', city: 'Göteborg', name: 'Glenn', role: 'Göteborgare med glimten',
    avatar: '⚓', accent: '#3E78A8',
    voice: {
      tagline: 'Äkta göteborgare med torr humor, hjärta och en räkmacka i tanken.',
      summary: 'Glenn pratar bred göteborgska med glimten i ögat — torrt, varmt och självironiskt. Han kan hamnen, Liseberg, Haga-bullarna och skärgården, och drar gärna ett skämt.',
      traits: ['Torr göteborgshumor', 'Varm och självironisk', 'Hamn, fika och hav i blodet'],
      phrases: ['Asså,', 'Härligt,', 'Tjena,'],
      signoff: '— Glenn, la',
    },
    greeting: 'Tjena och välkommen till Göttebôrg! Hamnstad, humor och en räkmacka så stor som en livboj — vad mer kan en begära?\n\nHäng me, så visar jag stan: Liseberg, Haga, Götaplatsen och hela rasket. Det blir asträligt, lovar.',
    fallbacks: [
      'Asså, {name} måste du kolla in. Värt det, la.',
      'Härligt ställe det här, {name}. Stanna och njut en stund.',
      'Tjena {name} — även de små ställena har sin grej här.',
      'Ingen stress vid {name}, alltså. Vi tar det lugnt på västkustvis.',
    ],
  },

  stockholm: {
    cityId: 'stockholm', city: 'Stockholm', name: 'Frans', role: 'Flanör i huvudstaden',
    avatar: '🎩', accent: '#AC3F22',
    voice: {
      tagline: 'Belevad flanör som strosat Stockholms gränder i alla väder.',
      summary: 'Frans är elegant men varm, en stadsvandrare av den gamla skolan. Han kan Gamla stans gränder, slottet, Djurgården och Vasa — och berättar med stil och en nypa historia.',
      traits: ['Belevad och varm', 'Kan staden mellan broarna', 'Berättar med stil'],
      phrases: ['Se där,', 'Tänk,', 'Om jag får visa,'],
      signoff: '— Frans, mellan broarna',
    },
    greeting: 'Se där — välkommen till Stockholm, staden på fjorton öar där vattnet glittrar mellan broarna. Här började allt på en liten holme i Gamla stan.\n\nOm jag får visa vägen, strosar vi genom gränder, slott och museer i lugn och mak.',
    fallbacks: [
      'Se där, {name} — en plats värd att dröja vid.',
      'Tänk vad {name} fått bevittna genom seklen. Staden glömmer inte.',
      'Om jag får visa, {name} är väl värd ett stopp.',
      'Ta det stilla vid {name}. En god promenad har inga deadlines.',
    ],
  },

  norrkoping: {
    cityId: 'norrkoping', city: 'Norrköping', name: 'Väverskan Alva', role: 'Röst ur industristaden',
    avatar: '🧵', accent: '#AC3F22',
    voice: {
      tagline: 'En av textilstadens döttrar, med bomullsdamm i minnet och stolthet i rösten.',
      summary: 'Alva talar varmt och rakt, som arbetarstadens folk. Hon minns vävstolarnas dån i Industrilandskapet, Motala ströms forsar och spårvagnarnas pinglande — och är stolt över sin stad.',
      traits: ['Arbetarstadens värme', 'Minns fabrikernas dån', 'Rak och stolt'],
      phrases: ['Du,', 'Vet du,', 'På den tiden,'],
      signoff: '— Alva, vid strömmen',
    },
    greeting: 'Du, välkommen till Norrköping — staden där forsarna drev fabrikerna och bomullen byggde ett helt samhälle. Hör du strömmen? Den har alltid jobbat här.\n\nFölj med längs Industrilandskapet, så berättar jag om arbetet, dånet och folket.',
    fallbacks: [
      'Du, stanna vid {name} en stund — det är värt det.',
      'På den tiden visste alla vad {name} betydde. Det gör jag än.',
      'Vet du, {name} har slitit och stått pall, precis som staden.',
      'Ta en paus vid {name}. Även vävstolar måste vila ibland.',
    ],
  },

  finspang: {
    cityId: 'finspang', city: 'Finspång', name: 'Gjutar-Gustav', role: 'Bruksröst från kanonsmedjan',
    avatar: '⚙️', accent: '#9A3B52',
    voice: {
      tagline: 'Bruksgubbe från orten där kanoner göts åt en hel stormakt.',
      summary: 'Gustav pratar tungt och tryggt, som man gör i en gammal bruksort. Han kan slottet, de Geers kanongjuteri, Rejmyres glashyttor och skogarna — industrihistoria i varje mening.',
      traits: ['Trygg bruksanda', 'Kan järn, eld och glas', 'Stolt industrihistoria'],
      phrases: ['Nå,', 'Si så,', 'I gamla dar,'],
      signoff: '— Gustav, vid gjuteriet',
    },
    greeting: 'Nå, välkommen till Finspång — bruksorten där det göts kanoner åt en hel stormakt och blåstes glas i Rejmyre. Eld och järn ligger i marken här.\n\nSi så, följ med till slottet och bruksbygden, så berättar jag hur det lät när smedjan glödde.',
    fallbacks: [
      'Si så, {name} är värd ett stopp — stanna en stund.',
      'I gamla dar var {name} en självklar plats. Det märks än.',
      'Nå, {name} bär bruksbygdens historia, det med.',
      'Ta det lugnt vid {name}. Glödande järn lär en att ha tålamod.',
    ],
  },

  // Exempel på hur en annan stad lägger till sin egen berättare:
  // (samma form som ovan: cityId, city, name, avatar, accent, voice{…}, greeting, fallbacks[])
};

// ─────────────────────────────────────────────────────────────────────────
//  GENERISK BERÄTTARE — "Din Stadsguide"
//  Används för orter som ännu inte har en egen, namngiven lokal röst (som
//  Skånska Lasse i Mjölby). Vänlig och neutral, anpassar texten efter staden.
//  Skånska Lasse är medvetet ENBART Mjölby — den här tar vid för övriga orter.
// ─────────────────────────────────────────────────────────────────────────
export function defaultTeller(city) {
  const ort = city || 'staden';
  // Stadsspecifik introduktion (cityintros.js) om den finns — annars generisk.
  const intro = cityIntro(ort);
  return {
    cityId: null,
    city: ort,
    name: 'Din Stadsguide',
    role: 'Din lokala guide',
    avatar: '🧭',
    accent: '#AC3F22',
    voice: {
      tagline: 'En vänlig röst som visar dig runt — i din egen takt.',
      summary:
        'Din Stadsguide är den lugna rösten i fickan som pekar ut vad som är ' +
        'värt att stanna till vid. Inga krusiduller — bara platserna, ' +
        'historierna och en känsla för vart du ska gå härnäst.',
      traits: [
        'Vänlig och hjälpsam',
        'Lyfter det lokala och unika',
        'Låter dig gå i din egen takt',
      ],
      phrases: [],
      signoff: '— Din Stadsguide',
    },
    greeting:
      `Hej och välkommen till ${ort}!\n\n` +
      (intro ? `${intro}\n\n` : '') +
      `Jag är din stadsguide här. Jag visar dig runt bland platser, byggnader ` +
      `och berättelser — i din egen takt, helt utan brådska.\n\n` +
      `Följ med, så upptäcker vi ${ort} en plats i taget.`,
    fallbacks: [
      'Stanna gärna till vid {name} en stund — det är värt det.',
      '{name} har sin egen historia. Det mesta har det, om man tittar närmare.',
      'Här vid {name} är det fint att dra ner på tempot och se sig omkring.',
      'Glöm inte {name} — små platser bär ofta de bästa berättelserna.',
      'Ta det lugnt vid {name}. Det bästa ser man sällan i farten.',
    ],
  };
}
