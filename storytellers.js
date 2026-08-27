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

// ENDAST verkliga, dokumenterade personer hör hemma här. Appens hela premiss är
// riktig lokalhistoria från riktiga invånare — uppdiktade guidefigurer med
// emoji-avatarer undergräver just det, och läser som maskingenererat.
//
// Tio påhittade karaktärer (Radio-Greta, Glenn, Skepparn, Bruks-Valle m.fl.) togs
// bort 2026-08-27. Skånska Lasse är kvar: Theodor Lorentz Larsson var en verklig
// bondkomiker i Mjölby, med porträtt i public domain.
//
// Städer utan en dokumenterad karaktär får defaultTeller() — "Din Stadsguide" —
// som lånar sin ortsintroduktion från cityintros.js. Hellre en ärlig neutral röst
// än en påhittad lokalprofil.
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
