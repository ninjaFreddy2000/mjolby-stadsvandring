// ── Axiom-loggning för edge functions (server-side) ──────────────────────────
// Skickar strukturerade loggar/händelser till Axiom med en token som ligger som
// Supabase-SECRET (aldrig i klienten). Används främst för de betalningskritiska
// flödena (stripe-webhook) så tappade köp/webhook-fel larmar direkt.
//
// Aktivera: sätt secrets i projektet, t.ex.
//   supabase secrets set AXIOM_TOKEN=xaat-... AXIOM_DATASET=stadsvandring
// Utan secrets är detta en no-op (loggning får aldrig blockera betalflödet).
const TOKEN = Deno.env.get("AXIOM_TOKEN");
const DATASET = Deno.env.get("AXIOM_DATASET");
const BASE = (Deno.env.get("AXIOM_INGEST_URL") || "https://api.axiom.co").replace(/\/$/, "");

export function axiomEnabled(): boolean {
  return !!(TOKEN && DATASET);
}

// Fire-and-forget: kastar aldrig, väntar aldrig på nätet i onödan. await:a bara
// om du vill vara säker på att loggen hann iväg innan funktionen returnerar.
export async function axiomLog(
  fields: Record<string, unknown>,
  source = "edge",
): Promise<void> {
  if (!axiomEnabled()) return;
  try {
    await fetch(`${BASE}/v1/datasets/${encodeURIComponent(DATASET!)}/ingest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`,
      },
      body: JSON.stringify([{
        _time: new Date().toISOString(),
        app: "stadsvandring",
        source,
        ...fields,
      }]),
    });
  } catch (_e) {
    // Tyst: en trasig loggkanal får inte fälla betalflödet.
  }
}
