// ── ghosts.js — spökplatser runtom i Sverige (korsmarknadsföring → Spökkartan) ──
// ~100 platser i hela Sverige som enligt sägnen är hemsökta. Eget kartlager med
// spök-ikon. Ett klick öppnar en teaser: "här sägs det spöka" + länk till
// Spökkartan (systerapp). Detta är avsiktligt en TEASER — de riktiga historierna
// bor på spokkartan.se. Koordinaterna är på landmärkesnivå (ungefärliga) och
// räcker gott för en nål; ingen exakt navigering sker hit.
//
// CSP: modulen är förstaparts (script-src 'self'). Länken går till spokkartan.se
// via vanlig <a target="_blank"> (topp-navigering, ej connect-src).
export const SPOKKARTAN_URL = 'https://www.spokkartan.se';

export const GHOSTS = [
  // ── Skåne / Blekinge ─────────────────────────────────────────────────────
  { name: 'Häckeberga slott',        region: 'Skåne',        lat: 55.533, lng: 13.467 },
  { name: 'Kronovalls slott',        region: 'Skåne',        lat: 55.669, lng: 14.036 },
  { name: 'Marsvinsholms slott',     region: 'Skåne',        lat: 55.487, lng: 13.786 },
  { name: 'Vittskövle slott',        region: 'Skåne',        lat: 55.850, lng: 14.150 },
  { name: 'Bäckaskog slott',         region: 'Skåne',        lat: 56.029, lng: 14.250 },
  { name: 'Wanås slott',             region: 'Skåne',        lat: 56.283, lng: 14.049 },
  { name: 'Christinehofs slott',     region: 'Skåne',        lat: 55.703, lng: 14.033 },
  { name: 'Krapperups slott',        region: 'Skåne',        lat: 56.284, lng: 12.551 },
  { name: 'Kulla Gunnarstorp',       region: 'Skåne',        lat: 56.133, lng: 12.667 },
  { name: 'Sofiero slott',           region: 'Helsingborg',  lat: 56.100, lng: 12.660 },
  { name: 'Övedskloster',            region: 'Skåne',        lat: 55.683, lng: 13.650 },
  { name: 'Trolleholms slott',       region: 'Skåne',        lat: 55.867, lng: 13.250 },
  { name: 'Malmöhus slott',          region: 'Malmö',        lat: 55.596, lng: 12.995 },
  { name: 'Sölvesborgs slottsruin',  region: 'Blekinge',     lat: 56.050, lng: 14.583 },
  { name: 'Karlskrona örlogsstad',   region: 'Blekinge',     lat: 56.161, lng: 15.586 },

  // ── Halland / Bohuslän / Västergötland ───────────────────────────────────
  { name: 'Varbergs fästning',       region: 'Halland',      lat: 57.105, lng: 12.245 },
  { name: 'Halmstads slott',         region: 'Halland',      lat: 56.672, lng: 12.863 },
  { name: 'Tjolöholms slott',        region: 'Halland',      lat: 57.467, lng: 12.083 },
  { name: 'Skottorps slott',         region: 'Halland',      lat: 56.400, lng: 13.000 },
  { name: 'Carlstens fästning',      region: 'Marstrand',    lat: 57.887, lng: 11.585 },
  { name: 'Bohus fästning',          region: 'Kungälv',      lat: 57.864, lng: 11.991 },
  { name: 'Nya Älvsborgs fästning',  region: 'Göteborg',     lat: 57.689, lng: 11.826 },
  { name: 'Läckö slott',             region: 'Västergötland', lat: 58.675, lng: 13.219 },
  { name: 'Nääs slott',              region: 'Västergötland', lat: 57.717, lng: 12.367 },
  { name: 'Torpa stenhus',           region: 'Västergötland', lat: 57.917, lng: 13.167 },
  { name: 'Hunnebergs klev',         region: 'Västergötland', lat: 58.353, lng: 12.452 },
  { name: 'Axevalla hed',            region: 'Västergötland', lat: 58.383, lng: 13.567 },
  { name: 'Hjo gamla stad',          region: 'Västergötland', lat: 58.303, lng: 14.288 },

  // ── Småland / Öland / Gotland ────────────────────────────────────────────
  { name: 'Kalmar slott',            region: 'Småland',      lat: 56.661, lng: 16.357 },
  { name: 'Kronobergs slottsruin',   region: 'Växjö',        lat: 56.917, lng: 14.783 },
  { name: 'Bergkvara slott',         region: 'Växjö',        lat: 56.800, lng: 14.733 },
  { name: 'Teleborgs slott',         region: 'Växjö',        lat: 56.850, lng: 14.833 },
  { name: 'Huseby bruk',             region: 'Småland',      lat: 56.717, lng: 14.667 },
  { name: 'Eksjö gamla stad',        region: 'Småland',      lat: 57.667, lng: 14.967 },
  { name: 'Skurugata',               region: 'Småland',      lat: 57.683, lng: 15.117 },
  { name: 'Brahehus',                region: 'Jönköping',    lat: 58.053, lng: 14.505 },
  { name: 'Visingsborgs slottsruin', region: 'Visingsö',     lat: 58.041, lng: 14.371 },
  { name: 'Borgholms slottsruin',    region: 'Öland',        lat: 56.878, lng: 16.649 },
  { name: 'Halltorps gästgiveri',    region: 'Öland',        lat: 56.733, lng: 16.533 },
  { name: 'Eketorps borg',           region: 'Öland',        lat: 56.317, lng: 16.500 },
  { name: 'Visby ringmur',           region: 'Gotland',      lat: 57.640, lng: 18.290 },
  { name: 'Roma klosterruin',        region: 'Gotland',      lat: 57.520, lng: 18.470 },

  // ── Östergötland ─────────────────────────────────────────────────────────
  { name: 'Vadstena slott',          region: 'Östergötland', lat: 58.443, lng: 14.888 },
  { name: 'Vadstena klosterhotell',  region: 'Östergötland', lat: 58.448, lng: 14.890 },
  { name: 'Bjärka-Säby slott',       region: 'Östergötland', lat: 58.300, lng: 15.717 },
  { name: 'Löfstad slott',           region: 'Norrköping',   lat: 58.556, lng: 16.075 },
  { name: 'Söderköpings brunn',      region: 'Östergötland', lat: 58.480, lng: 16.323 },
  { name: 'Stegeborgs slottsruin',   region: 'Östergötland', lat: 58.428, lng: 16.605 },

  // ── Södermanland / Närke ─────────────────────────────────────────────────
  { name: 'Gripsholms slott',        region: 'Mariefred',    lat: 59.254, lng: 17.214 },
  { name: 'Julita gård',             region: 'Sörmland',     lat: 59.175, lng: 16.158 },
  { name: 'Sundbyholms slott',       region: 'Sörmland',     lat: 59.450, lng: 16.433 },
  { name: 'Ericsbergs slott',        region: 'Sörmland',     lat: 59.067, lng: 16.567 },
  { name: 'Tullgarns slott',         region: 'Sörmland',     lat: 58.950, lng: 17.617 },
  { name: 'Nyköpingshus',            region: 'Nyköping',     lat: 58.752, lng: 17.010 },
  { name: 'Örebro slott',            region: 'Närke',        lat: 59.274, lng: 15.217 },
  { name: 'Askersunds gamla stad',   region: 'Närke',        lat: 58.879, lng: 14.905 },
  { name: 'Göksholms slott',         region: 'Närke',        lat: 59.145, lng: 15.522 },

  // ── Uppland / Stockholm ──────────────────────────────────────────────────
  { name: 'Skokloster slott',        region: 'Uppland',      lat: 59.700, lng: 17.633 },
  { name: 'Rosersbergs slott',       region: 'Uppland',      lat: 59.617, lng: 17.850 },
  { name: 'Steninge slott',          region: 'Uppland',      lat: 59.633, lng: 17.800 },
  { name: 'Wiks slott',              region: 'Uppland',      lat: 59.700, lng: 17.433 },
  { name: 'Örbyhus slott',           region: 'Uppland',      lat: 60.233, lng: 17.700 },
  { name: 'Salsta slott',            region: 'Uppland',      lat: 60.050, lng: 17.583 },
  { name: 'Uppsala domkyrka',        region: 'Uppsala',      lat: 59.858, lng: 17.633 },
  { name: 'Uppsala slott',           region: 'Uppsala',      lat: 59.851, lng: 17.634 },
  { name: 'Gamla Uppsala',           region: 'Uppsala',      lat: 59.898, lng: 17.632 },
  { name: 'Drottningholms slott',    region: 'Stockholm',    lat: 59.322, lng: 17.887 },
  { name: 'Stockholms slott',        region: 'Stockholm',    lat: 59.327, lng: 18.072 },
  { name: 'Riddarholmskyrkan',       region: 'Stockholm',    lat: 59.325, lng: 18.064 },
  { name: 'Långholmens fängelse',    region: 'Stockholm',    lat: 59.320, lng: 18.030 },
  { name: 'Bogesunds slott',         region: 'Vaxholm',      lat: 59.426, lng: 18.286 },
  { name: 'Ulriksdals slott',        region: 'Stockholm',    lat: 59.383, lng: 18.017 },
  { name: 'Silverpilen (Kymlinge)',  region: 'Stockholm',    lat: 59.411, lng: 17.981 },
  { name: 'Skogskyrkogården',        region: 'Stockholm',    lat: 59.277, lng: 18.100 },

  // ── Västmanland / Bergslagen / Dalarna ───────────────────────────────────
  { name: 'Sala silvergruva',        region: 'Västmanland',  lat: 59.905, lng: 16.601 },
  { name: 'Engelsbergs bruk',        region: 'Västmanland',  lat: 59.967, lng: 16.017 },
  { name: 'Strömsholms slott',       region: 'Västmanland',  lat: 59.533, lng: 16.233 },
  { name: 'Västerås domkyrka',       region: 'Västerås',     lat: 59.611, lng: 16.545 },
  { name: 'Arboga gamla stad',       region: 'Västmanland',  lat: 59.394, lng: 15.838 },
  { name: 'Falu gruva',              region: 'Dalarna',      lat: 60.600, lng: 15.610 },
  { name: 'Nora gamla stad',         region: 'Bergslagen',   lat: 59.516, lng: 15.038 },

  // ── Värmland / Gästrikland / Hälsingland ─────────────────────────────────
  { name: 'Karlstads gamla kvarter', region: 'Värmland',     lat: 59.379, lng: 13.503 },
  { name: 'Gävle slott',             region: 'Gästrikland',  lat: 60.673, lng: 17.142 },
  { name: 'Furuviks gamla värdshus', region: 'Gästrikland',  lat: 60.630, lng: 17.283 },
  { name: 'Hälsinglands hälsingegårdar', region: 'Hälsingland', lat: 61.700, lng: 16.300 },

  // ── Medelpad / Ångermanland / Jämtland ───────────────────────────────────
  { name: 'Borgvattnets prästgård',  region: 'Jämtland',     lat: 63.383, lng: 15.933 },
  { name: 'Svanö vandrarhem',        region: 'Ångermanland', lat: 62.896, lng: 17.872 },
  { name: 'Härnösands gamla teater', region: 'Ångermanland', lat: 62.632, lng: 17.940 },
  { name: 'Sundsvalls stenstad',     region: 'Medelpad',     lat: 62.391, lng: 17.306 },
  { name: 'Frösö gamla kyrka',       region: 'Jämtland',     lat: 63.180, lng: 14.590 },
  { name: 'Åre gamla kyrka',         region: 'Jämtland',     lat: 63.400, lng: 13.083 },
  { name: 'Jamtli',                  region: 'Östersund',    lat: 63.187, lng: 14.641 },
  { name: 'Höga kusten',             region: 'Ångermanland', lat: 62.800, lng: 18.100 },

  // ── Västerbotten / Norrbotten / Lappland ─────────────────────────────────
  { name: 'Gammlia',                 region: 'Umeå',         lat: 63.828, lng: 20.286 },
  { name: 'Bonnstan kyrkstad',       region: 'Skellefteå',   lat: 64.750, lng: 20.950 },
  { name: 'Öjebyns kyrkstad',        region: 'Piteå',        lat: 65.343, lng: 21.416 },
  { name: 'Gammelstads kyrkstad',    region: 'Luleå',        lat: 65.642, lng: 22.026 },
  { name: 'Bodens fästning',         region: 'Norrbotten',   lat: 65.826, lng: 21.689 },
  { name: 'Jokkmokks gamla kyrka',   region: 'Lappland',     lat: 66.606, lng: 19.826 },
  { name: 'Kiruna kyrka',            region: 'Lappland',     lat: 67.850, lng: 20.220 },
  { name: 'Kvikkjokks fjällkyrka',   region: 'Lappland',     lat: 66.950, lng: 17.717 },
];
