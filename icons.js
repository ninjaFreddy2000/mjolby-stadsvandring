// ── icons.js — ett enda ikonspråk ────────────────────────────────────────────
// Appen blandade 144 emoji med nio handskrivna inline-SVG:er. Två visuella språk
// sida vid sida, där emoji-som-knappikon är den tydligaste signalen på en app
// ingen formgett. Här ligger i stället EN uppsättning: samma rutnät, samma
// linjetjocklek, samma runda ändar, alltid `currentColor` så färgen ärvs.
//
// Använd: ico('pin')            → 20 px, ärver textfärgen
//         ico('pin', 20, 'x')   → egen storlek och extra klass
//
// Emoji finns kvar där de är INNEHÅLL snarare än gränssnitt: kategorinålarna på
// kartan och berättarens ansikte. Skillnaden är om symbolen är en knapp eller en
// bild av något.

const P = {
  // Plats & karta
  pin:      '<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',
  map:      '<path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  compass:  '<circle cx="12" cy="12" r="8.5"/><path d="m15 9-2 5-5 2 2-5 5-2Z"/>',
  locate:   '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2.5M12 19.5V22M22 12h-2.5M4.5 12H2"/>',
  globe:    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.2 2.4 3.3 5.4 3.3 8.5s-1.1 6.1-3.3 8.5c-2.2-2.4-3.3-5.4-3.3-8.5S9.8 5.9 12 3.5Z"/>',
  // Rörelse
  walk:     '<circle cx="13" cy="4.5" r="1.8"/><path d="M11 21l1.6-5.2 2.6 1.8V21m-1-9.6-2.8 1.4L9.6 16"/>',
  run:      '<circle cx="15" cy="4.5" r="1.8"/><path d="M8 21l3.2-4.6 1.2-3.6 3 2.2 2.6.6M6.5 11l3-2.4 3.2-.8 2.4 2.2 2.4.8"/>',
  bike:     '<circle cx="6" cy="16.5" r="3.5"/><circle cx="18" cy="16.5" r="3.5"/><path d="M6 16.5 10 8h4l3 8.5M9 8h5"/>',
  // Handling
  plus:     '<path d="M12 5.5v13M5.5 12h13"/>',
  check:    '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  camera:   '<path d="M3.5 8.5h3l1.5-2h8l1.5 2h3v10h-17z"/><circle cx="12" cy="13" r="3.4"/>',
  share:    '<circle cx="17.5" cy="6" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18" r="2.5"/><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6"/>',
  search:   '<circle cx="11" cy="11" r="6"/><path d="m15.5 15.5 4 4"/>',
  chat:     '<path d="M20 12.5c0 3.9-3.6 7-8 7-1 0-2-.2-2.9-.5L4 20.5l1.6-3.8A6.6 6.6 0 0 1 4 12.5c0-3.9 3.6-7 8-7s8 3.1 8 7Z"/>',
  book:     '<path d="M4 5.5h6a3 3 0 0 1 3 3v10a2.4 2.4 0 0 0-2.4-2.4H4Z"/><path d="M20 5.5h-6a3 3 0 0 0-3 3v10a2.4 2.4 0 0 1 2.4-2.4H20Z"/>',
  shield:   '<path d="M12 3.2 5 6v6c0 4.2 2.9 7.4 7 8.8 4.1-1.4 7-4.6 7-8.8V6Z"/>',
  lock:     '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  headset:  '<path d="M5 14v-2a7 7 0 0 1 14 0v2"/><rect x="3.2" y="13.5" width="3.6" height="6" rx="1.6"/><rect x="17.2" y="13.5" width="3.6" height="6" rx="1.6"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/>',
  clock:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.4 2"/>',
  flag:     '<path d="M6 21V4m0 1.5 4.5-1 4 1.5 4-1v9l-4 1-4-1.5-4.5 1"/>',
  heart:    '<path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z"/>',
  install:  '<rect x="6" y="2.8" width="12" height="18.4" rx="2.4"/><path d="M10.5 18.2h3"/>',
  sprout:   '<path d="M12 20v-6.5M12 13.5C12 10.5 9.5 8.5 6.5 8.5c0 3 2.5 5 5.5 5Zm0 0c0-3.3 2.5-5.5 5.5-5.5 0 3.3-2.5 5.5-5.5 5.5Z"/>',
  inbox:    '<path d="M4 13.5 6 5.5h12l2 8v5H4Z"/><path d="M4 13.5h4l1 2.5h6l1-2.5h4"/>',
  ghost:    '<path d="M5 20V11a7 7 0 0 1 14 0v9c-1.2 1.2-2.3 0-3.5-.8-1.2 1.4-2.3 1.4-3.5 0-1.2 1.4-2.3 1.4-3.5 0C7.3 20 6.2 21.2 5 20Z"/><circle cx="9.6" cy="11" r=".9" fill="currentColor" stroke="none"/><circle cx="14.4" cy="11" r=".9" fill="currentColor" stroke="none"/>',
  wave:     '<path d="M7 12.5V6.8a1.6 1.6 0 0 1 3.2 0v4.4m0-4.4V5.2a1.6 1.6 0 0 1 3.2 0v6m0-5.2a1.6 1.6 0 0 1 3.2 0v6.4c0 4-2.6 7-6.4 7-3.2 0-4.8-1.6-6.6-4.6l-1.1-2a1.5 1.5 0 0 1 2.5-1.7Z"/>',
  pencil:   '<path d="m4.5 19.5.6-3.6L16 5a2.1 2.1 0 0 1 3 3L8.1 18.9Z"/>',
  thumbUp:  '<path d="M7 10.5v9H4.5v-9Zm0 0 4-6.5a2 2 0 0 1 2.8 2.4L13 10h4.6a2 2 0 0 1 2 2.5l-1.3 5.5a2.4 2.4 0 0 1-2.3 1.5H7Z"/>',
  thumbDown:'<path d="M7 13.5v-9H4.5v9Zm0 0 4 6.5a2 2 0 0 0 2.8-2.4L13 14h4.6a2 2 0 0 0 2-2.5l-1.3-5.5A2.4 2.4 0 0 0 16 4.5H7Z"/>',
  bolt:     '<path d="M13.5 3 5.5 13.5H12l-1.5 7.5 8-10.5H12Z"/>',
  note:     '<path d="M5 4.5h14v15H5Z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
  ban:      '<circle cx="12" cy="12" r="8.5"/><path d="m6.4 6.4 11.2 11.2"/>',
  link:     '<path d="M10 13.5a3.6 3.6 0 0 0 5.2.3l2.6-2.6a3.7 3.7 0 0 0-5.2-5.2l-1.5 1.5"/><path d="M14 10.5a3.6 3.6 0 0 0-5.2-.3l-2.6 2.6a3.7 3.7 0 0 0 5.2 5.2l1.5-1.5"/>',
  copy:     '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2"/>',
  print:    '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7Z"/>',
  satellite:'<path d="M12 19a7 7 0 0 0-7-7M12 19a11 11 0 0 0-11-11"/><circle cx="17.5" cy="6.5" r="3"/>',
  speaker:  '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4Z"/><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4"/>',
  trash:    '<path d="M5 7h14M10 7V4.8h4V7M6.5 7l.8 12.2h9.4L17.5 7"/><path d="M10.5 10.5v6M13.5 10.5v6"/>',
  close:    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  trophy:   '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 5.5H5.5V7a3 3 0 0 0 3 3M16 5.5h2.5V7a3 3 0 0 1-3 3M12 13v3.5M9 20h6l-.6-3.5H9.6Z"/>',
};

// 1.75 px linje på 24-rutnät är tunt nog att kännas ritat, tjockt nog att hålla
// på en mobilskärm. Ingen fyllning: fyllda ikoner blandat med tunna linjer är
// precis den grötighet vi tar bort.
export function ico(namn, storlek = 20, klass = '') {
  const d = P[namn];
  if (!d) return '';
  return `<svg class="ico${klass ? ' ' + klass : ''}" width="${storlek}" height="${storlek}" viewBox="0 0 24 24"` +
    ` fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"` +
    ` stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
}

export const ikonFinns = (namn) => !!P[namn];
