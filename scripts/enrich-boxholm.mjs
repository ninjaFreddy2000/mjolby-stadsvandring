import fs from 'node:fs';

const FILE = new URL('../data.json', import.meta.url);
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const byId = Object.fromEntries(data.entries.map(e => [e.id, e]));

// ---- Helpers ---------------------------------------------------------------
function update(id, patch) {
  const e = byId[id];
  if (!e) { console.error('MISSING for update:', id); return; }
  Object.assign(e, patch);
  // keep sources unique
  if (patch.sources) e.sources = Array.from(new Set([...(e.sources || []), ...patch.sources]));
}
function add(entry) {
  if (byId[entry.id]) { console.error('ALREADY EXISTS:', entry.id); return; }
  entry.images = entry.images || [];
  entry.image_source_pages = entry.image_source_pages || [];
  entry.city = 'Boxholm';
  data.entries.push(entry);
  byId[entry.id] = entry;
}

// ---- 1. Enrich existing entries -------------------------------------------

update('boxholm-orten', {
  era: 'Bruksort sedan 1754',
  summary: 'Östgötsk bruksort vid Svartån där det fria samhället växte fram i kamp mot järnbrukets järnhand.',
  description:
    'Boxholm är berättelsen om två samhällen som möttes. Söder om Svartån låg Bruket — strikt styrt av bolaget, med arbetarkaserner, brukskyrka och vattenkraft. Norr om stambanan växte Förstaden fram, ett fritt civilsamhälle av handlare, hantverkare och arbetare som byggde egna hem utanför bruksledningens kontroll. När järnvägen invigdes 1874 förflyttades ortens tyngdpunkt dit, och den första handelsboden restes 1876 i det som ännu var skogsmark med några få torp som Kolstorp, Gripsberg och Sandbacka.\n\nSjälva namnet går tillbaka till 1500-talet, då Arvid Stenbock — svåger till Gustav Vasa — lät anlägga sätesgården "Bocksholm" vid ån. Men det var järnbruket från 1754 som formade orten: i generationer levde Boxholm av smältugnar och hammarslag, och bygden intog en internationell särställning som vagga för svensk järnvägselektrifiering. Från trakten kommer också skalden Per Daniel Amadeus Atterbom, en av den svenska romantikens stora röster, född i Åsbo prästgård strax intill.',
  key_facts: [
    'Två samhällen: det styrda "Bruket" söder om ån och det fria "Förstaden" norr om stambanan',
    'Järnbruk sedan 1754; aktiebolag (Boxholms AB) från 1872',
    'Sveriges första elektrifierade järnväg (Lönnabanan) togs i drift här 1890',
    'Skalden P.D.A. Atterbom föddes i Åsbo strax intill',
    'Ligger vid Svartån, nära sjön Sommens nordvästra vikar',
  ],
  sources: ['https://www.krafttaget.com/', 'https://sv.wikipedia.org/wiki/Boxholm'],
});

update('boxholm-bruk', {
  name: 'Boxholms bruk & bruksmuseum (Gropa kvarn)',
  category: 'museum_hembygd',
  coordinates: { lat: 58.192433, lng: 15.048067 },
  era: 'Bruk 1754–1981; museum sedan 1987',
  summary: 'Vagga för svensk järnvägselektrifiering — bruksmuseet i den gamla kvarnen från 1777.',
  description:
    'Få svenska bruksorter bär en så tung teknikhistoria som Boxholm. Grunden lades den 31 maj 1754, när Gabriel Adolf Ribbing fick kungliga privilegier att uppföra två manufakturhammare vid Svartåns fall — Gabriel och Beate, uppkallade efter honom själv och hustrun. Under familjen Burén expanderade bruket kraftigt och fick 1782 namnet Boxholms järnbruk; 1872 ombildades det till Boxholms AB. Masugnen blåstes första gången 1874 och var i drift till 1959, innan hela anläggningen sprängdes 1971.\n\nHär skrevs världshistoria i det lilla. 1890 togs Lönnabanan i bruk — Sveriges allra första elektrifierade järnväg. 1894 startade världens första elektriskt drivna valsverk i Övre verket, och 1977 togs världens första digitalt styrda valsverk i drift. Enligt lokal tradition lyste landets första elektriska glödlampa i Boxholm, åtta år innan kung Oscar II tände den på Stockholms slott. Bruksepoken upphörde 1981.\n\nIdag bor museet i Gropa kvarn från 1777 — ortens bäst bevarade industriminne, byggt av Kiähl Lind på platsen för en medeltida kvarn. Utomhus står de mäktiga maskinerna: en lancashirehärd, en mumblingshammare, en ånghammare och det historiska elloket från Lönnabanan med flakvagn.',
  key_facts: [
    'Privilegier 1754; namnet Boxholms järnbruk från 1782',
    'Lönnabanan 1890 — Sveriges första elektrifierade järnväg',
    'Världens första elektriska valsverk 1894; första digitalt styrda 1977',
    'Museet ligger i Gropa kvarn från 1777, öppnat 1987',
    'Bruksepoken upphörde 1981 när Boxholms AB styckades upp',
  ],
  sources: ['https://sv.wikipedia.org/wiki/Boxholms_bruksmuseum', 'https://www.krafttaget.com/'],
});

update('boxholm-kyrka', {
  name: 'Boxholms kyrka (Brukskyrkan)',
  coordinates: { lat: 58.1891, lng: 15.0541 },
  era: 'Invigd 1897',
  summary: 'Nygotisk brukskyrka byggd av 200 000 slaggstenar från valsverket — en av landets mest ovanliga.',
  description:
    'Boxholms kyrka är en av Sveriges mest egenartade kyrkobyggnader: hela fasaden är klädd med mörk, glänsande vällugnsslaggsten — restprodukt från valsverket. Bruket bekostade kyrkan, brukets snickerifabrik gjorde inredningen och taket täcktes med plåt från valsverket. Cirka 200 000 slaggstensblock murades samman till den nygotiska byggnaden, som ritades av Gustaf Petterson och invigdes den 12 september 1897.\n\nInteriören rymmer en predikstol i ek med målade evangelistbilder och en dopfunt skuren i oxelträ av bildhuggaren Bernhard Fälth i Tranås. Innan kyrkan restes stod här den lilla timrade arbetarbaracken Kasern Sandholmen på kullen, och området runtom — Vaxholmarna — utgjorde bostäder åt brukets arbetare. Mellersta Vaxholmen skänktes senare av bolaget och invigdes som församlingshem 1963.',
  key_facts: [
    'Fasad av ca 200 000 slaggstensblock från valsverket',
    'Nygotik, ritad av Gustaf Petterson, invigd 12 september 1897',
    'Dopfunt i oxelträ av bildhuggaren Bernhard Fälth',
    'Bekostad av Boxholms bruk; inredning från brukets egen snickerifabrik',
  ],
  sources: ['https://sv.wikipedia.org/wiki/Boxholms_kyrka', 'https://www.krafttaget.com/'],
});

update('boxholm-ekeby-kyrka', {
  era: 'Stenkyrka från 1100-talet',
  summary: 'Medeltida patronatskyrka med 1100-talsdopfunt och den rörliga "Fattiggubben" från 1686.',
  description:
    'Ekeby kyrka hör till de delar av Östergötland som kristnades mycket tidigt och restes som stenkyrka redan på 1100-talet. I 300 år, fram till 1919, var den patronatskyrka — vilket knöt den hårt till Boxholms herrar och bruksägare; på kyrkogården vilar brukspatroner, hammarsmedsmästare och hammarsmedsåldermän.\n\nKyrkans äldsta klenod är en sandstensdopfunt från 1100-talet, huggen av den östgötske mästaren Arkadius och smyckad med en karakteristisk arkad, samt ett triumfkrucifix från 1300-talet. Den mest egenartade sevärdheten är "Fattiggubben" från 1686 — en rörlig träskulptur som ursprungligen satt i ett litet skjul på kyrkovallen. När en besökare öppnade dörren sträckte gubben fram handen för att ta emot allmosor till de fattiga. Det var här Sara Netz son Frans Enoch döptes, utan att någon ur hennes familj var närvarande.',
  key_facts: [
    'Stenkyrka från 1100-talet; patronatskyrka i 300 år (till 1919)',
    'Dopfunt av sandsten huggen av Mäster Arkadius',
    'Triumfkrucifix från 1300-talet',
    'Den rörliga allmoseskulpturen "Fattiggubben" från 1686',
  ],
  sources: ['https://www.svenskakyrkan.se/', 'https://www.krafttaget.com/'],
});

update('boxholm-asbo-kyrka', {
  era: 'Stenkyrka från 1100-talet',
  summary: 'Höjdkyrka över Åsboåns dal med 1200-talsdopfunt — bygden där skalden Atterbom verkade.',
  description:
    'Åsbo kyrka ligger vackert på en höjd med utsikt över Åsboåns dalgång. Den uppfördes på 1100-talet och utvidgades både under 1400-talet och 1749, och rymmer en dopfunt av sandsten från 1200-talet. Gravvårdarna på kyrkogården speglar agrarsamhällets, skogsbrukets och järnvägens historia, med titlar som komminister och kyrkovärd.\n\nDet var i Åsbo som den namnkunnige skalden och professorn Per Daniel Amadeus Atterbom — en av den svenska romantikens stora röster — verkade under delar av sitt liv. Bygden kring kyrkan hör till de äldsta odlade markerna i kommunen, präglad av stensträngssystem och gravfält ända från brons- och järnålder.',
  key_facts: [
    'Stenkyrka från 1100-talet, utvidgad på 1400-talet och 1749',
    'Dopfunt av sandsten från 1200-talet',
    'Knuten till skalden P.D.A. Atterbom',
    'Ligger på höjd över Åsboåns dalgång',
  ],
  sources: ['https://www.krafttaget.com/', 'https://sv.wikipedia.org/wiki/%C3%85sbo_kyrka'],
});

update('boxholm-boxholms-sateri', {
  category: 'slott',
  coordinates: { lat: 58.213611, lng: 15.018056 },
  era: 'Säteri sedan 1594',
  summary: 'Sätesgården som gav orten dess namn — anlagd av Gustav Vasas svåger Arvid Stenbock.',
  description:
    'Här ligger ursprunget till hela ortnamnet. Säteriet bar först namnet Flemminge och låg i Ekeby socken, ägt på 1500-talet av friherre Jöran Holgersson. 1584 fick Arvid Gustafsson Stenbock — svåger till kung Gustav Vasa — mark för att anlägga ett säteri, och 1594 bildades herrgården officiellt genom sammanslagning av hemman i Flemminge och Stertinge. Gården gavs namnet Bocksholm, där "Bock" syftade på Stenbocks eget namn och "holm" var ett tidsenligt tillägg. Eftersom Stenbock stödde kung Sigismund landsförvisades han 1596 och säteriet tillföll kronan.\n\nUnder 1600- och 1700-talen gick gården mellan ätterna Wrangel, Ribbing och Falkenberg och lade under sig en mängd torp och gårdar. Huvudbyggnadens nuvarande form med fyra flyglar fastställdes vid en ombyggnad omkring 1710. Sedan den ursprungliga träbyggnaden brunnit ner 1746 uppfördes en ny 1747, som moderniserades till sitt nuvarande utseende omkring 1852. Carl Daniel Burén byggde här upp ett bibliotek på över 20 000 band, senare skänkt till Linköpings stiftsbibliotek. Det var på säteriets marker brukspatron Ivar af Burén mötte den utstötta Sara Netz under sina jaktturer.',
  key_facts: [
    'Hette ursprungligen Flemminge; namnet Bocksholm efter Arvid Stenbock 1594',
    'Stenbock var svåger till Gustav Vasa, landsförvisad 1596',
    'Fyra flyglar efter ombyggnad ca 1710; nuvarande utseende ca 1852',
    'Buréns bibliotek på 20 000+ band skänktes till Linköpings stiftsbibliotek',
  ],
  sources: ['https://sv.wikipedia.org/wiki/Boxholms_s%C3%A4teri', 'https://www.krafttaget.com/'],
});

update('boxholm-stralsnas-jarnvagsstation', {
  era: 'Station invigd 1874',
  summary: 'Stationssamhälle som kung Oscar II invigde 1874 — med bank, brandkår och vapenfabrik.',
  description:
    'Strålsnäs järnvägsstation invigdes i november 1874 av kung Oscar II, när Södra stambanan drogs fram över skattehemmanet Ingemarstorps marker. Stationen blev en katalysator för ett helt samhälle: hit kom postkontor, brandkår, polisstation med arrestlokal, bank, Konsumaffär och kafé, och industrier som sågverk, en vapenfabrik och ett aluminiumsmältverk etablerades. Av de ursprungliga fem banvaktarstugorna återstår idag bara en, kallad "Banvakt", och själva stationen lades ned under 1970-talet.\n\nI trakten ligger herrgårdarna Grönlund (tidigt 1800-tal) och Strålsnäs (tidigt 1900-tal) i kulturmiljön Åsbosänkan, med monumentala ekonomibyggnader, arbetarbostäder och ståtliga alléer. Vid Lillån har arkeologer frilagt äldre husgrunder med rikligt av formgjuten slaggsten.',
  key_facts: [
    'Invigd av kung Oscar II i november 1874',
    'Gav upphov till bank, brandkår, vapenfabrik och aluminiumsmältverk',
    'Endast en av fem banvaktarstugor återstår ("Banvakt")',
    'Nära herrgårdarna Grönlund och Strålsnäs i Åsbosänkan',
  ],
  sources: ['https://www.ostgotaleden.se/', 'https://www.krafttaget.com/'],
});

// ---- 2. New walking-tour stops --------------------------------------------

add({
  id: 'boxholm-station',
  name: 'Boxholms station',
  category: 'station',
  coordinates: { lat: 58.1903, lng: 15.0575 },
  era: 'Invigd 1874',
  summary: 'Startpunkten för den moderna orten — här flyttade tyngdpunkten bort från det gamla brukstorget.',
  description:
    'Vid Boxholms station börjar berättelsen om det moderna samhället. När Södra stambanan invigdes 1874 etablerades ortens nya centrum just här, på långt avstånd från det gamla brukstorget söder om ån — och det förklarar varför Boxholms centrum ligger där det gör. Stationen blev navet kring vilket Förstaden, det fria handels- och hantverkarsamhället, kunde växa.\n\nStationen fick elektrisk belysning redan 1905. En av ortens stora dagar var den 21 april 1933, då stora delar av Boxholms befolkning samlades på perrongerna för att bevittna det allra första elektriska tåget passera. Härifrån går vandringen söderut längs Järnvägsgatan in mot Storgatan och Förstadens kvarter.',
  key_facts: [
    'Invigd 1874 när Södra stambanan drogs genom orten',
    'Flyttade ortens tyngdpunkt bort från det gamla bruksområdet',
    'Elektrisk belysning 1905',
    'Folkfest på perrongen 21 april 1933 när första eltåget passerade',
  ],
  sources: ['https://www.krafttaget.com/', 'https://sv.wikipedia.org/wiki/Boxholm'],
});

add({
  id: 'boxholm-forstaden-storgatan',
  name: 'Förstaden – Storgatan & Nygatan',
  category: 'sevardhet',
  coordinates: { lat: 58.1898, lng: 15.0568 },
  era: 'Bebyggd från 1876',
  summary: 'Det fria samhällets kvarter som utmanade brukets monopol — med "Fahlénakröken" och jugendvillor.',
  description:
    'Förstaden växte fram som en självständig stadsdel utanför brukets kontroll. Här slog sig fria näringsidkare, hantverkare och arbetare ner och byggde egna hem, särskilt längs Nygatan under det tidiga 1900-talet. På Storgatan 4 reste konsumtionsföreningen Ringen 1896 sin första handelsbod — ett direkt trots mot bruksmonopolet, sedan föreningen blivit uppsagd från sina tidigare lokaler av en brukslednings som ogillade självständig arbetarkooperation.\n\nEn viktig nod var "Fahlénakröken", korsningen där Järnvägsgatan, Storgatan och Parkgatan möttes. Här uppfördes år 1900 det monumentala Hellbergshuset, byggt i en tid före biltrafiken och placerat så nära landsvägen att det skapade en ökänd, skymd kurva. Huset rymde länge Olle Rosenlövs färghandel och revs i slutet av 1960-talet när riksväg 32 rätades ut. På Nygatan står ännu den jugendinspirerade Doktorsvillan från 1914.',
  key_facts: [
    'Förstadens första hus restes 1876, ca 600–700 m från det gamla brukstorget',
    'Arbetarnas Ring byggde handelsbod på Storgatan 4 redan 1896',
    'Hellbergshuset (1900) skapade den ökända "Fahlénakröken" – revs på 1960-talet',
    'Jugendvillan Doktorsvillan från 1914 står kvar på Nygatan',
  ],
  sources: ['https://www.krafttaget.com/'],
});

add({
  id: 'boxholm-folkets-hus',
  name: 'Folkets hus (Minerva)',
  category: 'byggnad',
  coordinates: { lat: 58.1895, lng: 15.0560 },
  era: 'Minerva 1900, nuvarande hus 1939',
  summary: 'Folkrörelsernas trotsiga samlingslokal — med en monumental väggmålning av Vera Bugatti (2024).',
  description:
    'Folkets hus är ett monument över arbetar- och nykterhetsrörelsens kamp för en egen mötesplats fri från brukets inblandning. Våren 1899 bildade nykterhetslogen Templet Rätt och Sanning byggnadsföreningen Minerva — uppkallad efter den romerska gudinnan för konst och hantverk. Spånspringaren Claes Andersson (far till konstnären Ivar Frostling) sålde en tomt på Bryggaregatan för 787 kronor och 50 öre, och schaktningen gjorde medlemmarna själva på sin lediga tid. Föreningens skattmästare gick personligen i borgen för trävirket.\n\nDe första hyresgästerna flyttade in 1901, och 1901–1903 hyrdes salen ut som skolsal åt skolstyrelserna i Åsbo och Ekeby, mot löfte att skolan ersatte krossade fönsterrutor. 1909 ombildades verksamheten till Folkets hus. Det nuvarande funkishuset uppfördes 1939, och 2024 pryddes det av en monumental väggmålning av den internationellt kända gatukonstnären Vera Bugatti. Nedanför huset låg en gång folkparken "Gropa" (eller "Hôla") med dansbana, använd till 1926.',
  key_facts: [
    'Byggnadsföreningen Minerva grundades 1899 av nykterhetslogen Templet Rätt och Sanning',
    'Tomten på Bryggaregatan köptes för 787 kr och 50 öre; medlemmarna grävde själva',
    'Nuvarande funkishus uppfört 1939',
    'Väggmålning av gatukonstnären Vera Bugatti 2024',
  ],
  sources: ['https://sv.wikipedia.org/wiki/Folkets_hus,_Boxholm', 'https://folketshusboxholm.se/'],
});

add({
  id: 'boxholm-bredgardsbron',
  name: 'Bredgårdsbron',
  category: 'bro',
  coordinates: { lat: 58.1915, lng: 15.0495 },
  era: 'Stenvalvsbro från 1789',
  summary: 'Stenvalvsbron över Svartån från 1789 — vid den gamla mejeri- och bryggerimiljön.',
  description:
    'Bredgårdsbron är en stenvalvsbro som bröderna Lars och Per Matsson uppförde över Svartån 1789. På 1970-talet byggdes den om med en dold betongkärna men bevarade sina ursprungliga stenfasader, och idag är den avstängd för biltrafik. Bron knyter samman bruksområdets olika delar och har sett över 200 år av brukshistoria passera.\n\nInvid bron låg ett rikt knippe äldre byggnader. Det historiska mejeriet från 1890 — där Sveriges första runda, vaxade gräddost tillverkades 1952 — konverterades till tvättstuga 1940 och blev sedan musteri innan det brann ned, en händelse som fotografen Inge Strand dokumenterade. Det intilliggande röda huset uppfördes 1820 som tvättstuga, blev bayerskt ölbryggeri på 1850-talet och fungerade sedan som lantarbetarbostad fram till rivningen på 1970-talet.',
  key_facts: [
    'Byggd 1789 av Lars och Per Matsson',
    'Ombyggd på 1970-talet med dold betongkärna, men bevarade stenfasader',
    'Idag avstängd för biltrafik',
    'Vid mejeriet (1890) tillverkades Sveriges första vaxade gräddost 1952',
  ],
  sources: ['https://www.krafttaget.com/'],
});

add({
  id: 'boxholm-arbetarkaserner',
  name: 'Arbetarkasernerna & Vattentornet',
  category: 'handelse',
  coordinates: { lat: 58.1918, lng: 15.0500 },
  era: '1850-tal–1959',
  summary: 'De hårda levnadsvillkoren bakom järnet — trångbodda kaserner, slaggstenstorn och varmbadhus.',
  description:
    'Bakom Boxholms tekniska stordåd fanns en hård vardag för brukets arbetare. Den massiva kasernen Gamla Bredgård (1858–1959) rymde stora familjer i extremt trånga enrumshushåll. Hammarsmeden Carl Johan Herrmann beskrev hur en familj med sex barn, föräldrar och en piga trängdes i ett enda rum, där man tvingades slakta, byka, baka och stöpa ljus samtidigt som fadern försökte sova mellan skiften — och där en hönsbur med levande höns förvarades inomhus hela vintern.\n\nSöder om kyrkan låg Sandholmarna med kasernerna Östra och Västra Sandholmen; idag återstår bara den lilla tjänstemannabostaden Lilla Sandholmen, där bolagets veterinär bodde. Vattentornet av mörk slaggsten restes 1891 för att förse arbetarbostäderna med vatten — ett viktigt sanitärt framsteg, även om avloppet fortfarande leddes orenat ut i Svartån. Vid Bredgård byggdes 1901 ett varmbadhus med karbad och bastu, uppvärmt med spillvärme från lancashirehärdarna.',
  key_facts: [
    'Gamla Bredgård (1858–1959): stora familjer i enrumshushåll',
    'Smeden C.J. Herrmanns ögonvittnesskildring av trångboddheten',
    'Vattentornet av slaggsten (1891) – ett landmärke än idag',
    'Varmbadhus från 1901 uppvärmt med spillvärme från härdarna',
  ],
  sources: ['https://www.krafttaget.com/'],
});

add({
  id: 'boxholm-lonnabanan',
  name: 'Lönnabanan – Sveriges första elbana',
  category: 'handelse',
  coordinates: { lat: 58.1915, lng: 15.0530 },
  era: 'I drift 1890–1968',
  summary: 'Här rullade Sveriges allra första elektrifierade järnväg 1890 — och banade väg för hela landets eltåg.',
  description:
    'På denna sträcka skrevs svensk järnvägshistoria. År 1890 tog Boxholms järnbruk i drift Sveriges allra första elektrifierade järnväg, för att frakta gods mellan bruket och stationen. Den smalspåriga banan — 891 mm spårvidd och bara 750 meter lång — projekterades av ASEA, medan det ursprungliga loket var amerikanskt och strömmen kom från en generator på 220 volt och 90 ampere.\n\nDenna lilla godsbana var pionjären som banade väg för hela den framtida järnvägselektrifieringen i Sverige. Den var i kontinuerlig drift ända fram till 1968. Ett bevarat ellok med lyftkransvagn från 1918 står idag uppställt utanför bruksmuseet — ett konkret minne av att det moderna eltågslandet Sverige delvis föddes just i Boxholm.',
  key_facts: [
    'Sveriges första elektrifierade järnväg, i drift 1890',
    'Smalspårig (891 mm), endast 750 meter lång',
    'Projekterad av ASEA; generator på 220 V / 90 A',
    'I drift till 1968; ellok från 1918 bevarat vid bruksmuseet',
  ],
  sources: ['https://www.krafttaget.com/', 'https://sv.wikipedia.org/wiki/Boxholms_bruksmuseum'],
});

add({
  id: 'boxholm-karlsberg',
  name: 'Karlsberg (Disponentbostaden)',
  category: 'byggnad',
  coordinates: { lat: 58.1885, lng: 15.0455 },
  era: 'Herrgård från 1806',
  summary: 'Disponentbostaden med den ståtliga allén som rakt vittnade om brukspatronernas makt.',
  description:
    'Vid Karlsberg avslutas gärna vandringen genom Boxholms bruksvärld. Platsen var det forna frälsehemmanet Berg, som införlivades i säteriet 1614. Herrgården uppfördes 1806 och beboddes från 1812 av brukspatron Peter Carl af Burén; sedan dess har den fungerat som disponentbostad för Boxholms AB. Åren 1828–1838 bodde Peter Carls änka Hedda kvar här, medan den nya disponenten Didrik Pontus Burén höll till på närbelägna Ekebergs herrgård.\n\nUnder 1880-talet gjordes Karlsberg tillfälligt om till arbetarbostäder innan det återgick till disponentbostad. Den bevarade, ståtliga allén som en gång ledde i en rak linje ner till järnindustrins hjärta vittnar än idag om brukspatronernas monumentala självbild — en rät axel mellan makten och produktionen.',
  key_facts: [
    'Forna frälsehemmanet Berg, infört i säteriet 1614',
    'Herrgården uppförd 1806; disponentbostad för Boxholms AB',
    'Bebodd av brukspatron Peter Carl af Burén från 1812',
    'Den raka allén ledde ner mot bruket — en symbol för patronernas makt',
  ],
  sources: ['https://www.krafttaget.com/'],
});

add({
  id: 'boxholm-liljeholmens-sateri',
  name: 'Liljeholmens säteri',
  category: 'slott',
  coordinates: { lat: 58.037300, lng: 15.063500 },
  era: 'Byggnadsminne, herrgård från 1650-talet',
  summary: 'Statligt byggnadsminne vid Sommens strand, med sällsynt välbevarade barockmålningar.',
  description:
    'På en halvö i sjön Sommen i Blåviks socken ligger Liljeholmens säteri, en av bygdens vackraste herrgårdsmiljöer. Platsen omnämns i skrift första gången 1280 — då lagmannen Bengt Magnusson upplät gården åt ätten Natt och Dag — och hette ursprungligen Ringshult. På 1650-talet lät Christer Lillie uppföra den nuvarande tvåvånings timmerbyggnaden och ändrade namnet till Lillieholm.\n\n1688 köptes säteriet av den legendariske majoren Gabriel Gyllenståhl, som genom militära framgångar och strategiska giftermål kom att äga över 60 gårdar och säterier. Under hans dotter Maria och hennes make amiralitetskaptenen Eric Ahlfort tillkom herrgårdens unika senbarockmålningar: takmålningen i mittsalen bär Maria Gyllenståhls spegelmonogram i centrum, medan väggarna pryds av imiterade vävda gobelänger. Den 26 maj 1719 brann en flygel med elva rum ner till grunden. Säteriet har sedan 1930-talet ägts av familjen Nisser och förklarades som statligt byggnadsminne 1975.',
  key_facts: [
    'Omnämnt redan 1280 (Ringshult); ägt av ätten Natt och Dag',
    'Nuvarande timmerbyggnad rest av Christer Lillie på 1650-talet',
    'Sällsynt välbevarade senbarockmålningar från tidigt 1700-tal',
    'Statligt byggnadsminne sedan 1975, vid sjön Sommen i Blåvik',
  ],
  sources: ['https://sv.wikipedia.org/wiki/Liljeholmen,_Boxholm', 'http://familjenalfort.se/liljeholmen/1191'],
});

add({
  id: 'boxholm-sara-netz',
  name: 'Sara Netz – kvinnan i skogen',
  category: 'person',
  coordinates: { lat: 58.1700, lng: 15.0400 },
  era: '1842–1898',
  summary: 'Det gripande ödet om soldatdottern som levde som eremit i Boxholmsskogen, helt utanför samhällets skyddsnät.',
  description:
    'Mitt i berättelsen om brukets rikedom och teknikens triumfer finns ett människoöde som ger djup åt hela Boxholms historia: Sara Netz (1842–1898). Hon föddes på soldattorpet Bäckhult som dotter till soldaten Fredrik Netz, som med knapp nöd skulle försörja åtta personer. Som tonåring drabbades Sara av en våldsam febersjukdom som skadade hennes hjärna och gjorde henne stum och extremt folkskygg.\n\nNär hon i tjugoårsåldern tvingades söka tjänst som piga blev hon gravid med en bonde som genast körde bort henne. Hon irrade omkring på vägarna som tiggare; en stormig höstkväll sökte hon skydd med ett nyfött barn i famnen, men barnet dog efter några dagar. Hennes verkliga hem blev till slut en primitiv skogskoja djupt inne i Boxholmsskogen, där hon levde som eremit. När folk sökte upp henne stirrade hon stumt i marken. Hennes få mänskliga kontakter var torparen i Simarp och brukspatron Ivar af Burén, som under sina jaktturer ibland gav henne mat. Sara dog 56 år gammal, döv och blind på ena ögat — en påminnelse om den djupa klyftan mellan bruksortens elit och dem som föll helt utanför.',
  key_facts: [
    'Född 1842 på soldattorpet Bäckhult, död 1898',
    'Blev stum och folkskygg efter en febersjukdom i tonåren',
    'Levde sina sista år som eremit i en koja i Boxholmsskogen',
    'Fick ibland hjälp av brukspatron Ivar af Burén under hans jaktturer',
  ],
  sources: ['https://iglabo.se/', 'https://www.krafttaget.com/'],
});

// ---- Save ------------------------------------------------------------------
if (data.metadata) {
  data.metadata.updated = '2026-06-25';
  if (typeof data.metadata.count === 'number') data.metadata.count = data.entries.length;
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n');
console.log('Boxholm entries now:', data.entries.filter(e => e.city === 'Boxholm').length);
console.log('Total entries:', data.entries.length);
