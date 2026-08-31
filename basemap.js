// ── basemap.js — EN definition av kartunderlaget ─────────────────────────────
// Rut-URL:en låg hårdkodad på tre ställen: app.js (huvudkartan), tips.js
// (platsväljaren när man bidrar) och leadmagnet.js (kartan på alla 72
// ortssidor). När huvudkartan byttes från Carto till Esri följde de andra två
// inte med, och eftersom CSP:n bara släpper igenom arcgisonline blev de inte
// bara annorlunda — de blev helt tomma. En källa i stället.
//
// Byter man leverantör måste img-src uppdateras på BÅDA ställena:
// vercel.json (CSP-headern) och karta.html (meta-taggen).
//
// OBS: Esri använder ordningen {z}/{y}/{x}, inte {z}/{x}/{y} som de flesta
// andra. Kastas de om svarar servern 200 med rutor från fel plats på jorden.
export const TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
export const TILE_ATTR = '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap-bidragsgivare';
export const TILE_MAXZOOM = 19;

// map: en Leaflet-karta. attribution:false för minikartor där upphovsraden
// inte får plats (kartan har då redan attributionControl avstängd).
export function addBasemap(map, { attribution = true } = {}) {
  return window.L.tileLayer(TILE_URL, {
    maxZoom: TILE_MAXZOOM,
    attribution: attribution ? TILE_ATTR : '',
  }).addTo(map);
}
