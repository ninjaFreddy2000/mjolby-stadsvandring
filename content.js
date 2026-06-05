// Berättelseöverlägg — guideröst för Mjölby stadsvandring.
// Faktagrundat i data.json, men berättat som av en levande Mjölbyguide.
// Texterna ersätter "description" i detaljvyn; originaldatan lämnas orörd.

// Extra bilder för poster som saknar foto i kunskapsdatabasen
// (självhostade, fria bilder). Används som reservbild i detalj/lista.
export const EXTRA_IMAGES = {
  'skanska-lasse':        { url:'images/skanska-lasse.jpg', attribution:'Public domain (Wikimedia Commons)' },
  'skanska-lasses-staty': { url:'images/skanska-lasse.jpg', attribution:'Public domain (Wikimedia Commons)' },
  'skanska-lasses-hus':   { url:'images/skanska-lasse.jpg', attribution:'Public domain (Wikimedia Commons)' },
};

export const STORIES = {
  'mjolby-orten':
    'Välkommen till Mjölby — en stad som bokstavligen är byggd på malet mjöl. Lyssna efter Svartåns brus, för det var forsarna här som drog hit de första kvarnarna redan på 1100-talet, långt innan någon drömde om järnväg eller stadsrättigheter.\n\nI själva namnet bor historien: Mölloby, byn vid kvarnen. När du går genom centrum trampar du i spåren av mjölnare, bönder och resenärer på väg mot Småland — och du står på den nordligaste plats dit Dackefejdens upprorsmän nådde på 1540-talet. Stadsrättigheterna kom så sent som 1920, men byn har då redan levt i åtta sekel.',

  'svartan':
    'Allt börjar med vattnet. Svartån rinner från sjön Sommen, slingrar förbi Tranås och kastar sig genom Mjölby i forsar som en gång malde säd och senare drev industrins hjul, innan den möter Motala ström vid Roxen.\n\nStanna vid räcket en stund och se hur ån fortfarande arbetar sig fram genom staden. Utan dessa forsar hade Mjölby aldrig funnits. I dag kantas vattnet av parker och promenadstråk, men strömmen under ytan är densamma som en gång gav byn dess existensberättigande.',

  'mjolby-kyrka':
    'Res blicken mot tornet — det är det äldsta du ser i hela Mjölby. När den stora branden 1771 slukade nästan allt stod det medeltida kyrktornet kvar i röken, och kring det reste byggmästaren Peter Östberg den kyrka du nu går in i, färdig 1772–1777.\n\nInne väntar professor Crodels glasmålningar, där dagsljuset bryts i färg. Kyrkan vilar på byns högsta punkt, precis som sin föregångare i kalk- och gråsten gjort sedan 1100-talet — en fast punkt medan allt annat brann och byggdes om.',

  'mjolby-station':
    'Här vände Mjölbys historia tvärt. Den 11 maj 1873 ångade det första tåget in, och kvarnbyn vid ån förvandlades nästan över en natt till järnvägsknut.\n\nSamma år möttes stambanan och den privata banan från Hallsberg och Motala just här — plötsligt låg lilla Mjölby mitt i rikets blodomlopp. Ur spåren växte en helt ny stadsdel, Mjölby östra, och tvärs över rälsen restes hotellet för alla resande. Blunda, så hör du nästan ångloken väsa och stinsen vissla.',

  'mjolby-stadshotell':
    'Tvärs över spåren från stationen reser sig timmerhuset som byggdes för järnvägens resenärer redan 1873 — då hette det helt enkelt Järnvägshotellet.\n\nUnder 1970-talets plåt göms en vittrande putsfasad, återställd av nya ägare runt 2017. I stommen hittade hantverkarna en hopvikt dagstidning från 1901, en tyst hälsning från husets ungdom. Kliv in i whiskybaren med dess hundratals sorter och känn hur resenärernas hotell lever vidare, rum efter rum.',

  'stora-torget':
    'Du står nu i byns gamla hjärta, mitt emot kyrkan, där jordbruksbyns tyngdpunkt en gång låg. Vid vägskälet mot Småland fanns gästgivaregården — krog och skjutsstation där trötta resenärer bytte hästar och utbytte nyheter.\n\nHärifrån har stadskärnan långsamt förnyats sedan medeltiden, lager på lager. Lyssna förbi trafiken, så anar du hjulskrammel och hovslag mot kullersten.',

  'mjolby-hembygdsgard':
    'Gå över bron till Norrgårdsholmen, en grön holme mitt i Svartån där tiden saktar in. Här har Mjölby hembygdsförening samlat faluröda hus och föremål som berättar ortens historia ända från 1700-talet.\n\nFramför allt rymmer holmen en lysande samling intarsia — den träinläggningskonst som blev Mjölbys signatur ute i världen. Slå dig ner vid kaffeserveringen Åttakanten och låt holmen, ån och historien mötas. Det är här staden minns sig själv.',

  'galleria-kvarnen':
    'Till och med stadens galleria bär kvarnbyns arv i namnet. Bakom de moderna skyltfönstren bor samma identitet som forsarna en gång gav Mjölby — och doften från Linds bageri leder dig rätt. Här möts vardagshandel och historia under samma tak.',

  'gamla-stadshuset':
    'Mitt i staden, granne med gallerian och biblioteket, står stadshuset. Stanna till vid entrén, för där dansar två figurer i brons — ett verk av självaste Carl Milles, en av Sveriges största skulptörer.\n\nAtt en världskonstnär vakar över mjölbybornas väg in genom dörren säger något om stadens stilla stolthet.',

  'kvarnparken':
    'Vid åkanten breder Kvarnparken ut sig — en samlingsplats med restaurang, pub och dagens lunch, där Mjölby träffas. Mitt bland borden står han som fick hela Sverige att skratta: bondkomikern Skånska Lasse, fastfrusen i brons med blicken mot vattnet.\n\nSätt dig en stund vid ån, precis som generationer mjölbybor gjort före dig.',

  'konditori-hornet':
    'Varje stadsvandring behöver en paus, och mjölbyborna vet vart de går. Intill biblioteket ligger Konditori Hörnet, ett klassiskt konditori där smörgåsar och bakverk serveras i en värme som inte går att fejka. Ta en fika — guidens bästa råd är att inte ha bråttom.',

  'linds-mjolby':
    'Inne i Galleria Kvarnen ligger Linds, café och konditori med eget bageri. Doften av nybakat är vägvisaren; bakelser, smörgåsar och en lätt lunch belönar den som hittar hit. En modern fortsättning på Mjölbys långa kärlek till det malda mjölet.',

  'skanska-lasse':
    'Möt mannen bakom statyn i Kvarnparken. Theodor Lorentz Larsson föddes 1880 i skånska Gylle, men det var i Mjölby han blev Skånska Lasse — möbelsnickaren som klev upp på scenen i långrock och blommig väst, dragspel i hand.\n\nHans visor "Johan på Snippen", "Elektricitetsvisan" och "Bolsjevikvisan" fick hela folkhemmet att gnola, och när Tage Danielsson sjöng Elektricitetsvisan i 88-öresrevyn 1970 levde Lasse upp igen. Han dog i sin stad 1937, men skratten hänger kvar i luften.',

  'skanska-lasses-staty':
    'Här står han, Skånska Lasse själv, gjuten i brons mitt i Kvarnparken vid Svartån. Statyn vakar över parken där mjölbyborna fikar och firar — en hyllning till stadens folkkäraste son och hans visor. Säg gärna hej; han lär inte svara, men humorn finns kvar i blicken.',

  'skanska-lasses-hus':
    'På Sandgatan göms ett blygsamt litet hus där Skånska Lasse bodde med fru och barn från 1918 till sin död 1937. Föreställ dig hela familjelivet i en farstu, ett kök och en kammare, med två små sovrum på vinden — och ändå föddes här visor som hela Sverige sjöng.\n\nHusets framtid har debatterats på senare år; de mest tillförlitliga källorna pekar på nummer 2, andra på 12. Stanna upp och tänk på hur stora berättelser ryms i de minsta rum.',

  'potatisrondellen':
    'Och så den mest fotograferade mjölbybon av alla — en jättelik King Edward-potatis i en rondell vid Viringe. Den smiddes i Åtvidaberg, godkändes av potatisodlarna själva och invigdes på Potatisens dag den 26 oktober 2011, sedan Trafikverket först sagt nej men länsstyrelsen sagt ja: en symbol för lantbruksbygden.\n\nVarje år rullar runt fem miljoner fordon förbi, och till jul kläs potäten i julgris. Den har till och med en tvilling i Xylofagou på Cypern. För Mjölby står den helt enkelt för ordet "hemkär".',

  'mjolby-intarsia-fanerami':
    'Bakom ett oansenligt namn göms en världssensation. Omkring 1909 startade Knut Werner Dahlström det som 1917 blev AB Mjölby Intarsia, och härifrån skeppades konstfulla träinläggningar ut till atlantångare i Amerikatrafiken och till bankpalats och borgarsalar.\n\nKonstnärlige ledaren Erik Mattsson kunde foga samman bilder av över trettio träslag. Företaget lever vidare som Fanerami, i fjärde generationen Dahlström — och samlingen på hembygdsgården låter dig se hantverket på nära håll.',

  'ols-mobler-mio':
    'Allt började 1887 i ett uthus på Kungsvägen, där sadelmakaren Johannes Ohlsson från Skåne öppnade möbelaffär och blev pionjär för Mjölbys möbelindustri.\n\nGeneration efter generation har familjen Ohlsson hållit fast vid yrket — i dag i fjärde led, numera under namnet Mio vid Ryttarhagen nära E4. En mjölbysk möbelsaga som ännu inte tagit slut.',

  'mjolby-bryggeri':
    'Här fanns en gång stadens stolthet i glas: Mjölby Bryggeri. Från 1927 ägdes det av Centralbryggeriet i Linköping och inriktades efterhand på svagdricka och läsk.\n\n1954 tystnade tapparna, och i början av 1980-talet revs allt. I dag finns inte ett byggnadsspår kvar — bara minnet av en doft av jäst och en klirrande lastbil full av läskbackar.',

  'mjolby-ungdomsmusikkar':
    'Hör du blåset? Sedan 1956 har Mjölby Ungdomsmusikkår fått stadens unga att lyfta instrumenten, och i dag är de 120–140 musikanter och drillare — en av Sveriges främsta och största ungdomsorkestrar.\n\nDe färgar valborg, nationaldag och skolavslutning med mässing och puls. År 2026 fyller kåren 70 och bjuder in orkestrar från hela Europa till en jubileumsfestival den 7–9 augusti.',

  'mjolby-stadsmusikkar':
    'Mjölby Stadsmusikkår bär arbetarrörelsens toner i blodet. Föreningen bildades 1960 när ABF:s Musikkår från 1938 och Mjölby Janitscharkår från 1945 slogs samman till en symfonisk blåsorkester.\n\nUr kåren växte också Mjölby Storband, som klev ut på scen för första gången 1967. I dag spelar de vidare och är medlemmar i Lindbladssällskapet — uppkallat efter tonsättaren A.F. Lindblad från grannstaden Skänninge.',

  'carl-milles-staty':
    'Stanna framför stadshusets entré och titta upp: två figurer dansar i luften, gjutna av Carl Milles (1875–1955), en av 1900-talets största svenska skulptörer.\n\nMilles var besatt av rörelse, svävande och tyngdlöshet — och här i Mjölby fick han ett av sina dansande verk att lyfta. En liten bit världskonst, mitt i vardagen.',

  'det-kom-en-gang-en-mjolnare':
    'Längs åpromenaden möter du en mjölnare i brons — "Det kom en gång en mjölnare". Statyn knyter ihop hela stadens berättelse: det var mjölnaren och hans kvarn som en gång gav Mjölby både namn och liv. Låt vattnet bakom honom påminna dig om var allt började.',

  'bjalbo-kyrka':
    'Få platser bär så mycket svensk historia som Bjälbo. Här låg Folkungaättens stamgods, och kyrkans väldiga torn från omkring 1220 reser sig som en borg över slätten — tio meter brett, drygt tjugo högt, en gång i sex våningar med bostad, sädesmagasin och försvar.\n\nSägnen tillskriver tornet Ingrid Ylva, Birger jarls mor, och ett rum kallas ännu "drottning Ylvas kammare". Utanför står en minnessten över Birger jarl, och runstenarna viskar om att detta var en maktens plats redan på vikingatiden.',

  'birger-jarl':
    'I Bjälbo, omkring 1210, föddes en av Sveriges mäktigaste män. Birger Magnusson — Birger jarl — växte ur Bjälboätten till att bli rikets starke man från 1248, stamfader till en kungaätt och, enligt traditionen, Stockholms grundare.\n\nVid Skänninge möte samma år stod han mitt i händelsernas centrum. Att den lilla byn på östgötaslätten gav landet en sådan gestalt är värt att stanna upp inför.',

  'ingrid-ylva':
    'Bakom Bjälbos torn skymtar en av medeltidens mest sägenomspunna kvinnor: Ingrid Ylva, Birger jarls mor.\n\nHenne tillskrivs bygget av det mäktiga kyrktornet omkring 1220, och sägnen säger att hon själv bodde där uppe, i "drottning Ylvas kammare". Klok, stark och omgiven av myter — hon är gåtan som ger Bjälbo dess magi.',

  'hogbystenen':
    'Framför dig står en av Sveriges främsta runstenar, i Östergötland bara överträffad av Rökstenen. Den rödaktiga graniten, drygt tre och en halv meter hög och prydd med drakhuvuden i Ringerikestil, restes ur en familjs sorg.\n\nTorgärd lät hugga den efter sin morbror Assur, som dog långt borta "österut i Grekland". På baksidan löper en gripande vers om bonden Gulle och hans fem söner, alla döda fjärran hemmet. Ristaren Torkel gav sorgen ord som överlevt tusen år — och 1874, när Högby gamla kyrka revs, restes stenen åter på kyrkplatsen.',

  'skanninge-orten':
    'Välkommen till Skänninge — en av Sveriges äldsta städer, i dag en lugn del av Mjölby kommun, men en gång ett av rikets kraftcentra. På 1200- och 1300-talen möttes här landsvägarna, tyska köpmän styrde handeln, och staden hyste Sveriges första hospital och två dominikankloster.\n\nDet var hit landet samlades 1248, till det stora Skänninge möte. Gå långsamt — under den stillsamma ytan ligger medeltiden tätt.',

  'skanninge-mote-1248':
    'År 1248 blev Skänninge medelpunkt för hela Sverige. Med påvens sändebud och Birger jarl i spetsen samlades kyrkans män till ett möte som införde prästcelibat och kanonisk lag, stärkte biskoparna och knöt riket fastare till den västliga kristenheten.\n\nHär, på östgötaslätten, drogs alltså några av de linjer som format Sverige ända sedan dess.',

  'varfrukyrkan-skanninge':
    'Res blicken mot tegelmurarna — Vårfrukyrkan byggdes av Skänninges tyska köpmän och stod färdig i början av 1300-talet, ovanligt stor och påkostad, en av få stora medeltida tegelkyrkor i Östergötland.\n\nI folkmun kallades den "Garpekyrkan", efter garparna, de tyska handelsmännen. Stig in och se golvet, täckt av gravhällar från medeltid till 1700-tal — varje sten ett liv som en gång gick här.',

  'sta-ingrids-kloster':
    'Här grundades något helt nytt i Sverige: landets första kloster för kvinnor. S:ta Ingrids dominikankloster fick sina rättigheter 1282 och invigdes 1285, grundat av den högättade Ingrid Elovsdotter, sedermera helgonförklarad som S:ta Ingrid.\n\nPå 1500-talet revs byggnaderna och stenarna fördes till slottet i Vadstena — men ruinen står kvar och låter dig ana var systrarna en gång bad och levde.',

  'st-olofs-kloster-petrus-de-dacia':
    'På den här platsen låg S:t Olofs kloster, ett dominikankonvent från 1237 och värd för Skänninge möte 1248. Här verkade Petrus de Dacia, ofta kallad Sveriges förste författare, känd för sina innerliga brev till mystikern Kristina av Stommeln.\n\nTänk dig en munk vid sitt skrivbord som med darrande penna sätter några av de första svenska orden om kärlek och längtan på pergament.',

  'adolf-fredrik-lindblad':
    'Skänninge gav Sverige en av sina käraste tonsättare. Adolf Fredrik Lindblad föddes den 1 februari 1801 på gästgivaregården vid Stora torget, och blev mannen man kallat "den svenske Schubert" — sånger, körverk, symfonier och operan Frondörerna.\n\nI sin musikskola i Stockholm 1827–1861 hade han självaste Jenny Lind som elev. Lyssna efter honom i Lindbladsparken, där en byst bär hans drag.',

  'lindbladsparken-byst':
    'I Lindbladsparken vid Ågatan står en byst av tonsättaren Adolf Fredrik Lindblad, stadens son född 1801. Slå dig ner en stund — det är en lämplig plats att tänka på hur en liten stad kan sända musik ut över hela landet.',

  'ture-lang':
    'På Stora torget framför rådhuset vaktar en ståljätte: Ture Lång, en så kallad Rolandsstaty. Han är arvtagare till en medeltida tysk tradition, där en Rolandsfigur restes på torget som synlig symbol för stadens rätt att döma.\n\nAtt han står just i Skänninge påminner om de tyska köpmännens grepp om staden — rättvisan som reser sig i metall mitt bland torghandeln.',

  'svaneholms-borgruin':
    'Ta stigen ut på udden i Kilarpesjön, genom en lummig och kuperad fårhage, så når du Svaneholms borgruin. Murarna är rester av en borg från 1300-talet, och på våren lyser marken blå av sippor.\n\nSätt dig på en sten vid vattnet och föreställ dig vakten, vinden och vapnen — en glömd borg som naturen sakta tagit tillbaka.',

  'ojebro-stenvalvsbro':
    'Vid Öjebro välver sig en gammal stenbro över vattnet, i en by som själv en gång var en kvarnby. Stanna och låt blicken följa valvens båge — generationer av bönder, foror och resande har rullat över just dessa stenar.',

  'branden-1771':
    'Den 28 maj 1771 förändrades Mjölby för alltid. På bara några timmar slukade en förödande brand nästan hela byn — kyrka, kvarnar, gårdar och hus föll för lågorna.\n\nÅteruppbyggnaden bekostades delvis av rikskollekter från kyrkor i både Sverige och Finland, och en ny kyrka togs i bruk 1775. Vid 1828 snurrade åter elva kvarnar. Genom en lycklig slump ritades en storskifteskarta bara tre och en halv månad före branden — och tack vare den känner vi än i dag den medeltida byplan som elden annars hade utplånat.',

  'dackefejden':
    'Under Dackefejden 1542–43, Sveriges största folkresning, vällde upproret från Småland norrut — och just här, i Mjölby, nådde de upproriska sin nordligaste punkt.\n\nStå still ett ögonblick och tänk på att gränsen mellan kungamakt och uppror en gång gick rakt genom denna bygd.',

  'mjolby-ai-ff-vifolkavallen':
    'På Vifolkavallen slår Mjölbys fotbollshjärta. Mjölby AI FF bildades den 26 maj 1912 och har spelat sina hemmamatcher här i mer än ett sekel. Kom en matchdag, så hör du staden heja på sina egna.',
};
