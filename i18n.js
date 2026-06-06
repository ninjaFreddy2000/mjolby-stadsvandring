// Lättviktig i18n för det turistvända gränssnittet (sv/en).
// De djupa berättelserna är kvar på svenska (full översättning = Spår B);
// sponsorpanelen är medvetet på svenska (publik: kommun & lokala företag).

export const STRINGS = {
  sv: {
    brand_sub: 'Upptäck staden — en plats i taget',
    act_stories: 'Berättelser', act_stories_full: 'Personer & berättelser',
    stories_sub: 'Alla platser, personer och händelser — även de som inte har en egen nål på kartan.',
    stories_search: 'Sök…',
    act_progress: 'Mina stämplar',
    tours_all: 'Alla platser', stops: 'stopp',
    type_story: 'Berättelse', type_assoc: 'Förening', type_biz: 'Affär', type_info: 'InfoPin',
    tour_central_name: 'Centrala vandringen', tour_central_sub: 'Från stationen genom kvarnbyns hjärta — ca 2 km.',
    tour_medieval_name: 'Medeltidsringen', tour_medieval_sub: 'Folkungaätten, kloster och runstenar runt Skänninge & Bjälbo.',
    teller_by: 'Berättad av', teller_meet: 'Möt mig ›',
    quest: 'Quest-läge', quest_on: 'Quest-läge: på', quest_off: 'Quest-läge: av',
    quiz_cta: 'Testa dina kunskaper — quiz',
    checkin: 'Checka in & samla stämpel', checkin_done: '✓ Incheckad – stämpel sparad',
    photo_cta: '📸 Foto-utmaning – ta en bild här', photo_share: '📤 Dela din bild',
    speak_pre: 'Hör', speak_suf: 'berätta', speak_stop: '⏸️ Sluta lyssna',
    story_note: '', // ingen notis på svenska
    prog_stamps: 'stämplar', prog_city: 'av staden', prog_total: 'stopp totalt',
    directions: 'vägbeskrivning', source: 'källa', only_story: 'endast berättelse',
    lang_btn: 'EN',
  },
  en: {
    brand_sub: 'Discover the town — one place at a time',
    act_stories: 'Stories', act_stories_full: 'People & stories',
    stories_sub: 'Every place, person and event — including the ones without a pin on the map.',
    stories_search: 'Search…',
    act_progress: 'My stamps',
    tours_all: 'All places', stops: 'stops',
    type_story: 'Story', type_assoc: 'Community', type_biz: 'Business', type_info: 'InfoPin',
    tour_central_name: 'The Central Walk', tour_central_sub: 'From the station through the heart of the mill town — about 2 km.',
    tour_medieval_name: 'The Medieval Ring', tour_medieval_sub: 'The Folkung dynasty, monasteries and runestones around Skänninge & Bjälbo.',
    teller_by: 'Narrated by', teller_meet: 'Meet me ›',
    quest: 'Quest mode', quest_on: 'Quest mode: on', quest_off: 'Quest mode: off',
    quiz_cta: 'Test your knowledge — quiz',
    checkin: 'Check in & collect a stamp', checkin_done: '✓ Checked in – stamp saved',
    photo_cta: '📸 Photo challenge – take a picture here', photo_share: '📤 Share your photo',
    speak_pre: 'Hear', speak_suf: 'tell it', speak_stop: '⏸️ Stop listening',
    story_note: 'The full story is told in Swedish — English narration is coming.',
    prog_stamps: 'stamps', prog_city: 'of the town', prog_total: 'stops total',
    directions: 'directions', source: 'source', only_story: 'story only',
    lang_btn: 'SV',
  },
};

// Engelska sammanfattningar per post (visas som ingress i EN-läge)
export const SUMMARY_EN = {
  'mjolby-orten': 'An old mill village on the Svartån that became a railway hub and the regional centre of south-west Östergötland.',
  'svartan': 'The river whose rapids gave Mjölby its mills — and its very reason to exist.',
  'mjolby-kyrka': "The town church on the village's highest point, with a medieval tower that survived the great fire of 1771.",
  'mjolby-station': 'The station that turned a mill village into a railway junction and regional hub.',
  'mjolby-stadshotell': 'A timber hotel opposite the station, built just after the railway arrived in 1873.',
  'stora-torget': "The village's historic heart, by the old crossroads toward Småland.",
  'mjolby-hembygdsgard': 'Falu-red museum houses on an island in the river, with a fine marquetry collection.',
  'galleria-kvarnen': "The town's shopping gallery, its name a nod to the milling heritage.",
  'gamla-stadshuset': 'The town hall by the gallery and library; a Carl Milles sculpture stands at the entrance.',
  'kvarnparken': 'A riverside park and venue with a restaurant, pub and the statue of Skånska Lasse.',
  'konditori-hornet': 'A cosy, central classic patisserie next to the library.',
  'linds-mjolby': 'Café and patisserie with its own bakery in Galleria Kvarnen.',
  'skanska-lasse': 'Rural comedian and songwriter, a Mjölby resident for most of his life.',
  'skanska-lasses-staty': "A statue in Kvarnparken of the town's beloved rural comedian.",
  'skanska-lasses-hus': 'The modest home where Skånska Lasse lived with his family.',
  'potatisrondellen': "The town's most talked-about symbol: a giant King Edward potato in a roundabout.",
  'mjolby-intarsia-fanerami': 'The marquetry firm that clad ocean liners and bank palaces in inlaid wood.',
  'ols-mobler-mio': 'A furniture dynasty founded in 1887 and still run by the same family.',
  'mjolby-bryggeri': "The town's old brewery, later focused on small-beer and soft drinks.",
  'mjolby-ungdomsmusikkar': "One of Sweden's foremost and largest youth wind orchestras.",
  'mjolby-stadsmusikkar': 'A symphonic wind band with roots in the labour movement.',
  'carl-milles-staty': 'A sculpture by the world-famous Carl Milles outside the town hall.',
  'det-kom-en-gang-en-mjolnare': "A riverside sculpture honouring Mjölby's miller and milling heritage.",
  'bjalbo-kyrka': "The Folkung dynasty's manor church and Birger jarl's country — with a mighty medieval tower.",
  'birger-jarl': "The Folkung dynasty's most famous son, often counted as Stockholm's founder — born in Bjälbo.",
  'ingrid-ylva': "Birger jarl's legendary mother, linked to Bjälbo's church tower.",
  'hogbystenen': "One of Sweden's foremost runestones, second in Östergötland only to the Rök stone.",
  'skanninge-orten': "One of Sweden's oldest towns and a medieval power centre, today part of Mjölby municipality.",
  'skanninge-mote-1248': 'A church council that introduced priestly celibacy and strengthened the Church in Sweden.',
  'varfrukyrkan-skanninge': "The German merchants' mighty brick church — one of few large medieval brick churches in Östergötland.",
  'sta-ingrids-kloster': "Sweden's first convent for women (Dominican).",
  'st-olofs-kloster-petrus-de-dacia': "The Dominican friary in Skänninge where 'Sweden's first author' worked.",
  'adolf-fredrik-lindblad': "Composer born in Skänninge, 'the Swedish Schubert', teacher of Jenny Lind.",
  'lindbladsparken-byst': 'A park in Skänninge with a bust of composer Adolf Fredrik Lindblad.',
  'ture-lang': "A steel giant on Skänninge's square, a symbol of justice in the medieval German tradition.",
  'svaneholms-borgruin': 'The ruins of a 14th-century castle on a headland in Lake Kilarpesjön.',
  'ojebro-stenvalvsbro': 'An old stone-arch bridge in the former mill village of Öjebro.',
  'branden-1771': 'The fire that almost wiped out the mill village — and lets us know its medieval layout today.',
  'dackefejden': 'Mjölby was the northernmost point reached by the Småland rebels of the Dacke War.',
  'mjolby-ai-ff-vifolkavallen': "The town's football club, with its home ground at Vifolkavallen.",
};

// Engelsk presentation av berättaren (dialektrepliker visas bara i sv-läge)
export const TELLER_EN = {
  mjolby: {
    role: 'Rural comedian & the town storyteller',
    tagline: 'Long coat, flowery waistcoat and an accordion — and a rhyme up his sleeve.',
    greeting:
      'Hello there, friend! I am Lasse — "Skånska Lasse" — though I lived longer here in ' +
      'Mjölby than I ever did down in Skåne.\n\n' +
      'In my day I stood on stage in a long coat and a flowery waistcoat, accordion in my arms, ' +
      'singing about everything new that came rolling in — electricity, motor cars, the lot.\n\n' +
      'Now let me show you around my town. No grand promises — but I know every stone and every ' +
      'rapid, and I have a rhyme for every corner. Come along, and don\'t be in a hurry.',
    voiceSummary:
      'Skånska Lasse speaks like a warm, sly countryman who marvels at the world and rhymes about it — ' +
      'always to you, with a twinkle in his eye and a pinch of homespun wisdom.',
    traits: [
      'Folksy and warm — talks with you, not at you',
      "A countryman's wonder at all things modern",
      'A twinkle in the eye, gently satirical but never unkind',
      'Loves a rhyme, in a sing-song beat',
      'Homespun wisdom from everyday life — always time to pause',
    ],
  },
};
