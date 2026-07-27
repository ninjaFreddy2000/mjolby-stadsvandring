// ── Axiom-loggning (observability) ───────────────────────────────────────────
// Speglar appens anonyma händelser + JS-fel till Axiom (axiom.co) så att fel hos
// riktiga användare och produkt-/konverteringsdata syns i realtid med dashboards
// och larm. Fire-and-forget, batchat, och HELT AVSTÄNGT tills en ingest-token är
// satt (AXIOM_TOKEN + AXIOM_DATASET i config.js). Skickar ingen PII — samma
// disciplin som förstaparts-analyticsen till Supabase.
//
// OBS: en ingest-token som committas i klienten är PUBLIK (men enbart skriv, till
// ETT dataset). Använd därför ett separat dataset och rotera vid behov. CSP:ns
// connect-src måste tillåta https://api.axiom.co (satt i vercel.json + karta.html).
import { AXIOM_INGEST_URL, AXIOM_TOKEN, AXIOM_DATASET } from './config.js';

export function axiomEnabled(){ return !!(AXIOM_TOKEN && AXIOM_DATASET); }

let queue = [];
let timer = null;

function endpoint(){
  const base = (AXIOM_INGEST_URL || 'https://api.axiom.co').replace(/\/$/, '');
  return `${base}/v1/datasets/${encodeURIComponent(AXIOM_DATASET)}/ingest`;
}

// Skicka köade händelser. keepalive gör att bufferten hinner iväg även när
// sidan stängs/byter flik. Tyst vid fel (loggning får aldrig störa appen).
export function flush(){
  if (timer){ clearTimeout(timer); timer = null; }
  if (!axiomEnabled() || !queue.length) return;
  const batch = queue; queue = [];
  try {
    fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AXIOM_TOKEN}` },
      body: JSON.stringify(batch),
      keepalive: true,
      mode: 'cors',
    }).catch(()=>{});
  } catch(_){}
}

// Lägg en händelse i kön. _time = Axioms tidsstämpel. app-fältet gör datasetet
// portfölj-redo (ett dataset kan ta emot flera appar och filtreras på app).
export function axiomLog(fields){
  if (!axiomEnabled()) return;
  try {
    queue.push({ _time: new Date().toISOString(), app: 'stadsvandring', ...(fields || {}) });
  } catch(_){ return; }
  if (queue.length >= 20) flush();
  else if (!timer) timer = setTimeout(flush, 4000);
}

if (typeof window !== 'undefined'){
  window.addEventListener('visibilitychange', ()=>{ if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
}
