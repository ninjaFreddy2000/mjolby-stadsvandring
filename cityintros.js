// ─────────────────────────────────────────────────────────────────────────
//  STADSINTRODUKTIONER — en egen röst för varje stad
//
//  Varje stad har:
//    blurb — en kort rad för stadskort/listor (landningssidan, Städer-fliken)
//    intro — 2–3 meningar som hälsar besökaren välkommen och sätter stadens
//            karaktär. Används i "Din Stadsguide"-hälsningen för städer som
//            inte har en egen namngiven berättare (som Skånska Lasse i Mjölby).
//
//  Nyckel = stadens namn exakt som i data.json (fältet "city").
// ─────────────────────────────────────────────────────────────────────────

export const CITY_INTROS = {
  'Mjölby': {
    blurb: 'Kvarnbyn vid Svartån — kyrka, järnväg & Skånska Lasse.',
    intro: 'Mjölby började som en kvarnby vid Svartåns forsar redan på 1100-talet, och än idag hörs vattnet mitt i stan. Järnvägen gjorde kvarnbyn till stad — och bondkomikern Skånska Lasse gjorde den folkkär.',
  },
  'Stockholm': {
    blurb: 'Huvudstaden på fjorton öar — Gamla stan, slott & sjöglitter.',
    intro: 'Stockholm byggdes där Mälaren möter Östersjön, på fjorton öar med vatten i varje vy. Här ligger 700 år av historia packad i Gamla stans gränder — och runt hörnet väntar slott, museer och kajer.',
  },
  'Göteborg': {
    blurb: 'Hamnstaden vid Göta älv — kanaler, kran-siluetter & västkustlynne.',
    intro: 'Göteborg anlades 1621 som Sveriges port mot väster, med kanaler ritade av holländare och en hamn som byggde staden. Idag möts varvshistoria, fika i Haga och skärgårdsluft — allt inom promenadavstånd.',
  },
  'Malmö': {
    blurb: 'Kontinentens början — Malmöhus, torgen & Öresundsbron.',
    intro: 'Malmö växte fram som dansk handelsstad vid Öresund och blev svensk först 1658. Mellan Malmöhus slott, Lilla Torgs korsvirke och Turning Torso ryms 700 år av möten mellan Sverige och kontinenten.',
  },
  'Uppsala': {
    blurb: 'Lärdomsstaden — domkyrkan, universitetet & kungshögarna.',
    intro: 'Uppsala har varit Sveriges religiösa centrum sedan vikingatiden, från kungshögarna i Gamla Uppsala till Nordens största domkyrka. Sedan 1477 är det också universitetsstaden där Linné, Celsius och Rudbeck satt sina spår.',
  },
  'Visby': {
    blurb: 'Hansestaden innanför ringmuren — rosor, ruiner & världsarv.',
    intro: 'Visby är Nordens bäst bevarade medeltidsstad, omsluten av en 3,4 kilometer lång ringmur från 1200-talet. Innanför murarna trängs kyrkoruiner, packhus och rosor — ett levande världsarv vid Östersjön.',
  },
  'Lund': {
    blurb: 'Domkyrkan, universitetet & tusen år av lärdom.',
    intro: 'Lund grundades för över tusen år sedan och var ärkebiskopssäte för hela Norden. Kring domkyrkan med sitt astronomiska ur slingrar sig kullerstensgatorna mellan universitetsbyggnader, professorsvillor och kaféer.',
  },
  'Karlskrona': {
    blurb: 'Örlogsstaden i skärgården — barockplan & världsarv.',
    intro: 'Karlskrona anlades 1680 som Sveriges nya örlogsbas och ritades som en barockstad på öar i Blekinges skärgård. Stortorget, varvet och fästningarna gav staden en plats på Unescos världsarvslista.',
  },
  'Sala': {
    blurb: 'Silverstaden — gruvan som betalade stormaktens räkningar.',
    intro: 'Sala byggdes på silver: gruvan här kallades "rikets skattkammare" och bekostade en god del av stormaktstidens Sverige. Staden ovan jord planerades på 1620-talet med raka gator, gröna promenader och gruvdammar.',
  },
  'Halmstad': {
    blurb: 'Slottsstaden vid Nissan — danskt arv & laxfiske.',
    intro: 'Halmstad var i århundraden en dansk gränsstad, befäst av Kristian IV vars slott ännu speglar sig i Nissan. Innanför de gamla vallgatorna möts korsvirkeshus, konst och havsluft från Tylösand.',
  },
  'Varberg': {
    blurb: 'Fästningen, kallbadhuset & kurortsflärden.',
    intro: 'Varberg vakar över Kattegatt från sin mäktiga medeltidsfästning, där Bockstensmannen ligger utställd. Nedanför väntar kurortsstadens kallbadhus, societetspark och långa stränder.',
  },
  'Kalmar': {
    blurb: 'Nyckeln till Sverige — renässansslottet vid Sundet.',
    intro: 'Kalmar kallades "Sveriges nyckel" — gränsfästningen mot Danmark där Kalmarunionen slöts 1397. Renässansslottet är ett av Nordens bäst bevarade, och kvarteren på Kvarnholmen är en barockstad i miniatyr.',
  },
  'Linköping': {
    blurb: 'Domkyrkostaden — flyghistoria & Gamla Linköping.',
    intro: 'Linköping har samlats kring sin domkyrka i över 800 år — en av Sveriges finaste gotiska katedraler. Här ryms också biskopsgårdar, flyghistoria och friluftsmuseet Gamla Linköping, en hel trästad att strosa i.',
  },
  'Falkenberg': {
    blurb: 'Laxfiskets stad vid Ätran — Tullbron & gamla stan.',
    intro: 'Falkenberg växte upp kring laxfisket i Ätran, där engelska lorder på 1800-talet vallfärdade med flugspö. Gamla stans krokiga gator, Tullbron och S:t Laurentii kyrka minns en stad äldre än stormakterna.',
  },
  'Västerås': {
    blurb: 'Aros vid Mälaren — domkyrka, gruvguld & industrikraft.',
    intro: 'Västerås var medeltida biskopssäte och riksdagsstad — här gjorde Gustav Vasa Sverige lutherskt 1527. Med ASEA blev staden svensk industrihistorias hjärta, men kring domkyrkan lever det gamla Aros kvar.',
  },
  'Falun': {
    blurb: 'Gruvstaden — Stora Kopparberget & faluröda trähus.',
    intro: 'Falun byggdes kring Stora Kopparberget, gruvan som under 1600-talet stod för två tredjedelar av världens koppar. Gruvan, de faluröda trähusen i Elsborg och herrgårdslandskapet är idag världsarv.',
  },
  'Norrköping': {
    blurb: 'Industrilandskapet vid Strömmen — Sveriges Manchester.',
    intro: 'Norrköping drevs av Motala ströms forsar — textilfabrikernas stad som kallades Sveriges Manchester. Idag är Industrilandskapet ett av Europas finaste, med gula spårvagnar som pinglar mellan tegelkatedralerna.',
  },
  'Åre': {
    blurb: 'Fjällbyn — Åreskutan, forsar & alpin historia.',
    intro: 'Åre var kurort och pilgrimsmål långt innan liftarna kom — redan medeltidens vandrare stannade vid den gamla kyrkan under Åreskutan. Här möts fjällvärld, forsar och över hundra år av svensk turisthistoria.',
  },
  'Helsingborg': {
    blurb: 'Kärnan, Sundet & utsikten mot Danmark.',
    intro: 'Helsingborg har vaktat Öresunds smalaste del i tusen år, och medeltidstornet Kärnan reser sig ännu över staden. Från terrasserna ser du Danmark på andra sidan — närmare kontinenten kommer ingen svensk stadskärna.',
  },
  'Gävle': {
    blurb: 'Trähusstaden Gamla Gefle, hamnen & bocken.',
    intro: 'Gävle är Norrlands äldsta stad, med stadsprivilegier från 1446 och en hamn som skeppade järn och timmer ut i världen. I Gamla Gefle står trähuskvarteren kvar som före stadsbranden — och vid jul vakar bocken.',
  },
  'Alingsås': {
    blurb: 'Fikastaden — trähus, kaféer & Alströmers potatis.',
    intro: 'Alingsås är Sveriges fikastad, där Jonas Alströmer på 1720-talet byggde manufakturer och lärde svenskarna odla potatis. Trästadens gränder kantas av kaféer — och varje höst lyser staden upp av Lights in Alingsås.',
  },
  'Östersund': {
    blurb: 'Vinterstaden vid Storsjön — och gäckande Storsjöodjuret.',
    intro: 'Östersund grundades 1786 som Jämtlands enda stad, med utsikt över Storsjön och fjällen bortom. Här möts vinterstadens idrottsarv, Jamtlis levande historia — och berättelserna om odjuret i sjöns djup.',
  },
  'Eskilstuna': {
    blurb: 'Smedstaden vid ån — Rademachersmedjorna & stålarvet.',
    intro: 'Eskilstuna bär namn efter helgonet S:t Eskil men byggdes av smeder — Rademachersmedjorna från 1650-talet står kvar mitt i stan. Åns vatten drev hamrarna som gjorde staden till Sveriges stålcentrum.',
  },
  'Jönköping': {
    blurb: 'Staden mellan sjöarna — tändstickor & Vätterutsikt.',
    intro: 'Jönköping klämmer sig in mellan Vättern, Munksjön och Rocksjön — en stad på vatten sedan 1284. Här tändes den svenska tändsticksindustrin, och längs Vätterstranden möts fabrikshistoria och sjöglitter.',
  },
  'Umeå': {
    blurb: 'Björkarnas stad vid älven — universitet & kultur.',
    intro: 'Umeå planterades full av björkar efter storbranden 1888 — brandgator av grönska som gav staden dess namn. Idag är björkarnas stad norra Sveriges kulturmotor, med älven som stilla puls genom alltihop.',
  },
  'Sundsvall': {
    blurb: 'Stenstaden — träpatronernas praktkvarter.',
    intro: 'När Sundsvall brann 1888 byggdes staden upp igen i sten av sågverkens miljoner — Stenstaden är Nordens mest påkostade 1800-talskärna. Bakom fasadernas ornament ryms historien om träpatroner och sågverksarbetare.',
  },
  'Sigtuna': {
    blurb: 'Sveriges första stad — runstenar & kyrkoruiner.',
    intro: 'Sigtuna grundades på 970-talet och räknas som Sveriges första stad. Längs Stora gatan — landets äldsta gata som ännu används — trängs runstenar, kyrkoruiner och små trähus vid Mälarens strand.',
  },
  'Ronneby': {
    blurb: 'Kurorten i Blekinge — Brunnsparken & Heliga Kors kyrka.',
    intro: 'Ronneby var Blekinges medeltida huvudort, med anor från dansktiden och en av Sveriges finaste brunnsmiljöer. I Brunnsparken kurerade sig 1800-talets societet — idag är den prisad som en av landets vackraste parker.',
  },
  'Skanör Falsterbo': {
    blurb: 'Sillamarknadens medeltidsstäder på näset.',
    intro: 'Skanör och Falsterbo levde på medeltidens sillamarknader, när tusentals köpmän från hela Europa möttes på näset. Kvar finns två av Sveriges minsta städer med kyrkor, borgruin och ändlösa stränder.',
  },
  'Arboga': {
    blurb: 'Riksdagsstaden vid ån — medeltidskvarter & munkar.',
    intro: 'I Arboga hölls Sveriges första riksdag 1435, och stadskärnan vid Arbogaån hör till landets bäst bevarade medeltidsmiljöer. Här minner klosterkyrka, trähus och gränder om en stad som en gång var rikets mittpunkt.',
  },
  'Strängnäs': {
    blurb: 'Domkyrkoberget vid Mälaren — här valdes Gustav Vasa.',
    intro: 'Strängnäs är biskopsstaden där Gustav Vasa valdes till kung 1523 — beslutet ropades ut från domkyrkoberget. Nedanför tegelkatedralen ringlar trähusgränderna ner mot Mälarens vatten.',
  },
  'Vadstena': {
    blurb: 'Klosterstaden vid Vättern — Heliga Birgitta & slottet.',
    intro: 'Vadstena var medeltidens andliga centrum i Sverige — hit vallfärdade Europa till Heliga Birgittas kloster. Vid Vätterns strand möts klosterkyrkan, Vasaslottets vallgravar och gränder som knappt ändrats sedan 1400-talet.',
  },
  'Söderköping': {
    blurb: 'Medeltidsstaden vid Göta kanal — gränder & glass.',
    intro: 'Söderköping var en av medeltidens viktigaste svenska städer, med kröningar och hansehandel vid Storåns kaj. Idag flanerar man mellan medeltidskyrkor och trähus — gärna med en berömd glass vid kanalkajen.',
  },
  'Nyköping': {
    blurb: 'Slottet, gästabudet & åpromenaden.',
    intro: 'Nyköping är platsen för Sveriges mest ökända middag — Nyköpings gästabud 1317, då kung Birger lät fängsla sina bröder i slottets torn. Kring Nyköpingshus och åns promenadstråk berättar staden än om medeltidens maktspel.',
  },
  'Västervik': {
    blurb: 'Skärgårdsstaden — trähuskvarter & visfestival.',
    intro: 'Västervik ligger som en amfiteater mot sin skärgård, med anor som medeltida hamnstad vid gränsen mot Danmark. Trähusen vid Fiskaretorget, varvshistorien och visorna har gjort staden till Tjustkustens pärla.',
  },
  'Kristianstad': {
    blurb: 'Kristian IV:s mönsterstad — renässans & vattenrike.',
    intro: 'Kristianstad grundades 1614 av den danske kungen Kristian IV som en befäst mönsterstad — rutnätet och Heliga Trefaldighetskyrkan, Nordens vackraste renässanskyrka, står kvar. Runt staden breder Vattenriket ut sig.',
  },
  'Landskrona': {
    blurb: 'Citadellet vid Sundet — fästningsstad & kolonilotter.',
    intro: 'Landskrona anlades 1413 som dansk hamnstad och fick med Citadellet en av Nordens starkaste fästningar. Kring vallgravarna ligger idag Sveriges äldsta koloniområde — och färjan till Ven lockar ut i Sundet.',
  },
  'Trelleborg': {
    blurb: 'Sveriges sydspets — vikingaborgen & palmerna.',
    intro: 'Trelleborg är Sveriges sydligaste stad, porten mot kontinenten sedan sillamarknadens dagar. Här står en rekonstruerad vikingatida ringborg mitt i stan — och längs boulevarden vajar faktiskt palmer.',
  },
  'Karlshamn': {
    blurb: 'Sjöfartsstaden — utvandrarnas hamn & punschens.',
    intro: 'Karlshamn fick sitt namn av Karl X Gustav och blev Blekinges handelsstad med salt, sprit och sjöfart. Härifrån lämnade utvandrarna Sverige — Karl Oskar och Kristina står ännu i hamnen och ser mot havet.',
  },
  'Växjö': {
    blurb: 'Domkyrkan, glasriket & Kronobergs slottsruin.',
    intro: 'Växjö samlades kring sin domkyrka och S:t Sigfrids källa redan på 1100-talet. Mellan sjöarna ryms idag domkyrkans glaskonst, utvandrarnas historia och en slottsruin på sin holme — Smålands huvudstad i miniatyr.',
  },
  'Karlstad': {
    blurb: 'Solstaden i Klarälvens delta — Sola & residenstorget.',
    intro: 'Karlstad ligger på deltat där Klarälven möter Vänern, döpt efter hertig Karl 1584. Staden är känd för sitt soliga humör — serveringsflickan Sola log sig in i historien — och för Sveriges längsta stenvalvsbro.',
  },
  'Örebro': {
    blurb: 'Slottet på holmen — Svartån, Wadköping & riksmöten.',
    intro: 'Örebro växte fram vid Svartåns vadställe, och mitt i strömmen tronar slottet på sin holme. Här valdes Bernadotte till svensk tronföljare 1810 — och i trästaden Wadköping lever hantverkets Örebro kvar.',
  },
  'Luleå': {
    blurb: 'Kyrkstaden Gammelstad & skärgårdens ljus.',
    intro: 'Luleå bär på ett världsarv: kyrkstaden Gammelstad, där över 400 röda kyrkstugor kurar kring stenkyrkan från 1400-talet. Vid kusten väntar den moderna staden med isvägar, skärgård och midnattsljus.',
  },
  'Piteå': {
    blurb: 'Solkusten i norr — kyrkstad & havsbad.',
    intro: 'Piteå fick stadsrättigheter 1621 och samlas ännu kring sin träkyrka och sitt torg — ett av få slutna stadstorg i landet. Om somrarna blir "Norrbottens riviera" ett myller av havsbad och festival.',
  },
  'Härnösand': {
    blurb: 'Stiftsstaden vid Höga kusten-porten.',
    intro: 'Härnösand blev stiftsstad 1647 och kallades Norrlands Aten för sina läroverk och sin lärdom. Mellan domkyrkan — Sveriges minsta — och Östanbäckens trähusgränder börjar vägen mot Höga kusten.',
  },
  'Vaxholm': {
    blurb: 'Skärgårdens huvudstad — kastellet & ångbåtarna.',
    intro: 'Vaxholm har vaktat inloppet till Stockholm sedan Gustav Vasas dagar — kastellet ligger kvar mitt i farleden. Idag är trästaden skärgårdens huvudstad, dit ångbåtarna fortfarande lägger till vid kajen.',
  },
  'Trosa': {
    blurb: '"Världens ände" — åkanter, trähus & sommarflärd.',
    intro: 'Trosa kallar sig skämtsamt Världens ände — en fiskarstad där ån kantas av sjöbodar och trähus i pastell. Här har sommargäster flanerat längs åpromenaden sedan sekelskiftets badortsdagar.',
  },
  'Mariefred': {
    blurb: 'Gripsholms stad — slottet, ångtåget & idyllen.',
    intro: 'Mariefred växte upp i skuggan av Gripsholms slott, Gustav Vasas tegelborg vid Mälaren med kungaporträtt i tusental. Trästaden med ångtåg och ångbåt är en av Sveriges mest kompletta småstadsidyller.',
  },
  'Enköping': {
    blurb: 'Parkernas stad — närmast i Mälardalen.',
    intro: 'Enköping var medeltida handelsstad med fyra kyrkor och berömda pepparrotsodlingar — "Sveriges närmaste stad" ligger mitt i Mälardalen. Idag är det parkerna, fickparkerna framför allt, som gjort staden känd.',
  },
  'Eksjö': {
    blurb: 'Trästaden — hela kvarter från 1600-talet.',
    intro: 'Eksjö är en av Europas bäst bevarade trästäder — Gamla stan norr om torget överlevde både bränder och rivningsvågor. Här går du genom hela 1600-talskvarter där hantverkare bott och verkat i sekler.',
  },
  'Hjo': {
    blurb: 'Trästaden vid Vättern — "I love Hjo".',
    intro: 'Hjo är kurortsstaden vid Vättern där helaträstadskärnan är byggnadsminne — snickarglädje, badhus och hamnpir i ett. Ångaren Trafik ligger vid kaj, precis som när badgästerna kom för vattenkurerna.',
  },
  'Nora': {
    blurb: 'Bergslagens trästadspärla — järnväg & glass.',
    intro: 'Nora är Bergslagens bäst bevarade trästad, byggd på järnhantering och gruvor. Kullerstensgatorna, Sveriges äldsta normalspåriga järnväg och den berömda glassen gör staden till en levande 1800-talsidyll.',
  },
  'Askersund': {
    blurb: 'Sjöstaden vid norra Vättern — trähus & skärgård.',
    intro: 'Askersund ligger där Vättern smalnar till sin norra skärgård, en trästad med anor från 1640-talet. Kring Rådhustorget och hamnen lever småstadens lugn — och Landskyrkan hör till Sveriges finaste barockkyrkor.',
  },
  'Mariestad': {
    blurb: 'Vänerns pärla — domkyrkan & gamla stan.',
    intro: 'Mariestad grundades 1583 av hertig Karl och fick en domkyrka ståtligare än stadens storlek — beställd i trots mot brodern kungen. Gamla stans trähuskvarter vid Tidans mynning hör till Vänerkustens finaste.',
  },
  'Lidköping': {
    blurb: 'Porslinsstaden vid Vänern — Rörstrand & rådhuset.',
    intro: 'Lidköping vid Vänern är porslinets stad — Rörstrands serviser stod på svenska bord i århundraden. Vid torget står det gamla rådhuset, en flyttad jaktstuga från 1600-talet, mitt i en av Sveriges bredaste gågator.',
  },
  'Gränna': {
    blurb: 'Polkagrisstaden under Grännaberget.',
    intro: 'Gränna klättrar uppför sitt berg med utsikt över Vättern och Visingsö — greve Brahes stad från 1652. Här kokas polkagrisar i vartannat skyltfönster, och härifrån lyfte Andrée mot Nordpolen i ballong.',
  },
  'Borgholm': {
    blurb: 'Öländsk badort — slottsruinen & Solliden.',
    intro: 'Borgholm växte fram som badort i skuggan av Nordeuropas mäktigaste slottsruin, Borgholms slott. Här möts öländsk sten, kunglig sommarflärd på Solliden och en skärgårdsstads lugna kvarter.',
  },
  'Marstrand': {
    blurb: 'Fästningsön — Carlsten, segel & societetsliv.',
    intro: 'Marstrand är ön där Carlstens fästning ruvar över trähusstaden — byggd av fångar, bebodd av societeten. Sillperioder, kungabesök och kappseglingar har gjort den lilla ön till västkustens mest anrika.',
  },
  'Smögen': {
    blurb: 'Bryggan, sjöbodarna & saltstänkt bohuslän.',
    intro: 'Smögen är fiskeläget som blev hela Sveriges sommarbild — sjöbodar i rad längs den långa bryggan, granit i ryggen och havet rakt fram. Bakom turistmyllret lever ännu ett äkta bohuslänskt kustsamhälle.',
  },
  'Dalby': {
    blurb: 'Nordens äldsta stenkyrka & kungsgården.',
    intro: 'Dalby gömmer en av Nordens största skatter: Heligkorskyrkan, rest omkring 1060 och Nordens äldsta bevarade stenkyrka. Här låg kungsgård och biskopssäte när Skåne var danskt kärnland.',
  },
  'Vellinge': {
    blurb: 'Söderslätt — pilevallar, kyrkbyar & näset.',
    intro: 'Vellinge ligger mitt på Söderslätt, där pilevallarna radar upp sig mellan kyrkbyar och gårdar. Härifrån når du både Foteviken, vikingarnas slagfältsvatten, och näsets långa stränder.',
  },
  'Hässleholm': {
    blurb: 'Järnvägsknuten mitt i Göingeskogarna.',
    intro: 'Hässleholm föddes med stambanan 1860 — en järnvägsknut som växte till stad mitt i Göinges skogar. Kring stationen och Hovdala slott berättas historien om snapphanar, rälsläggare och det moderna Skåne.',
  },
  'Åtvidaberg': {
    blurb: 'Kopparbygden — bruksherrgårdar & facit-epoken.',
    intro: 'Åtvidaberg byggdes på koppar — gruvorna här försörjde Sverige i århundraden innan Facits räknemaskiner tog vid. Bruksmiljön med herrgårdar, arbetarbostäder och gruvhål är en av Östergötlands mest kompletta.',
  },
  'Motala': {
    blurb: 'Göta kanals huvudstad — Platen, radion & Vättern.',
    intro: 'Motala ritades av Baltzar von Platen som Göta kanals huvudstad — gatorna strålar ut solfjäderformat från hamnen. Härifrån sände Sveriges radio ut över landet, och längs kanalen vandrar man i Platens fotspår.',
  },
  'Boxholm': {
    blurb: 'Bruksorten vid Svartån — järn, ost & Sommen.',
    intro: 'Boxholm är bruksorten där Svartån drev järnbruket i över 300 år — och där osten sedan gjorde namnet rikskänt. Runt bruket, folkets hus och Sommens stränder berättas den svenska bruksbygdens historia.',
  },
  'Ödeshög': {
    blurb: 'Rökstenen, Alvastra & Ombergs sagoskog.',
    intro: 'Ödeshög vid Vätterns strand rymmer mer forntid än de flesta landskap: Rökstenen med världens längsta runinskrift, Alvastra klosterruin och Omberg — drottning Ommas sägenomspunna berg.',
  },
  'Valdemarsvik': {
    blurb: 'Porten till Gryts skärgård.',
    intro: 'Valdemarsvik ligger längst inne i sin långsmala havsvik, garveristaden som blev porten till Gryts skärgård. Härifrån väntar tusen öar, fyrar och fiskelägen — Östergötlands egen väg ut mot havet.',
  },
  'Finspång': {
    blurb: 'Kanonbruket — slottet, De Geer & Rejmyre glas.',
    intro: 'Finspång var stormaktstidens vapensmedja — här göt släkten De Geer kanoner åt Europas krig. Slottet från 1660-talet, bruksmiljön och Rejmyres glasbruk bär ännu järnets och eldens historia.',
  },
  'Ydre': {
    blurb: 'Sommens sjörike — sägner, skogar & utsikter.',
    intro: 'Ydre är Östergötlands sydligaste hörn, ett höglänt sjörike kring Sommen där sägnerna bott kvar — om jätten Bule och urkon som sparkade fram sjön. Här vandrar du mellan medeltidskyrkor, utsiktsberg och tysta skogar.',
  },
  'Kinda': {
    blurb: 'Kinda kanal, Rimforsa & eklandskapet.',
    intro: 'Kinda är sjöarnas och kanalens bygd — Kinda kanal slingrar sig från Åsunden mot Linköping genom ett av Europas rikaste eklandskap. Vid stränderna ligger kyrkbyar, säterier och badklippor på rad.',
  },
  'Mullsjö': {
    blurb: 'Friluftsbygd på Hökensås — sjöar & vandringsleder.',
    intro: 'Mullsjö ligger högt på Hökensås sluttningar, en frilufts- och kurortsbygd sedan järnvägen kom. Här möts vandringsleder, mörka skogssjöar och backig småländsk-västgötsk gränsbygd.',
  },
  'Värnamo': {
    blurb: 'Store Mosse, Apladalen & möbelbygden.',
    intro: 'Värnamo växte från marknadsplats vid Lagan till möbelbygdens huvudort — Bruno Mathsson formgav sina klassiker här. Strax utanför breder Store Mosse ut sig, södra Sveriges största vildmark av myr och tranrop.',
  },
};

// Blurb för stadskort/listor — city-namn → kort rad (fallback hanteras i appen).
export const cityBlurb = name => CITY_INTROS[name] && CITY_INTROS[name].blurb;
// Intro för guide-hälsningen — city-namn → 2–3 meningar (eller null).
export const cityIntro = name => CITY_INTROS[name] && CITY_INTROS[name].intro;
