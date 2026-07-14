// ── enhance-content ──────────────────────────────────────────────────────────
// Låter Fredrik (admin) polera ett partnerbidrag med Claude innan publicering:
// snyggare rubrik, en varm text i appens ton (kort om företaget + en liten story
// kring byggnaden), och en alt-text till bilden. Fredrik granskar/redigerar
// resultatet och publicerar sedan själv — ingen auto-publish.
//
//   POST { title, body, city?, kind? }  →  { title, body, alt }
//
// Kräver inloggad ADMIN. Anropar Anthropic server-side (ingen CSP-gräns här);
// nyckeln ANTHROPIC_API_KEY sätts som function-secret.
import { corsHeaders, json } from "../_shared/cors.ts";
import { getUserClient } from "../_shared/stripe.ts";

const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Bytbar modell. claude-opus-4-8 = mest kapabel; byt till claude-haiku-4-5 för
// lägre kostnad om volymen blir stor (samma API-format).
const MODEL = Deno.env.get("ENHANCE_MODEL") ?? "claude-opus-4-8";

const SYSTEM = `Du är redaktör för Stadsvandring.io, en app med guidade stadsvandringar i svenska städer.
Du får ett råmaterial från en partner (t.ex. en hembygdsgård, butik eller ett företag) om en plats/byggnad.
Skriv om det till appens ton: varm, nyfiken, lokalhistorisk och lättläst — som en kunnig men vänlig stadsguide.
Regler:
- Hitta ALDRIG på fakta. Behåll alla konkreta uppgifter (namn, årtal, adresser). Är något oklart, utelämna det.
- Lyft gärna fram en liten story kring byggnaden om materialet ger underlag för det.
- Håll det kort: rubrik max ~60 tecken, brödtext ~2–4 meningar.
- Svara på svenska.
Svara ENBART med ett JSON-objekt: {"title": "...", "body": "...", "alt": "..."} där alt är en kort bildbeskrivning (alt-text) för tillgänglighet.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!ANTHROPIC_KEY) return json({ error: "ANTHROPIC_API_KEY saknas i function-secrets" }, 500);

  try {
    const authHeader = req.headers.get("Authorization");
    const supa = getUserClient(authHeader);
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "ej inloggad" }, 401);

    // Bara admin får köra AI-förbättring.
    const { data: prof } = await supa.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    if (!prof?.is_admin) return json({ error: "admin only" }, 403);

    const { title, body, city, kind } = await req.json().catch(() => ({}));
    if (!title && !body) return json({ error: "title eller body krävs" }, 400);

    const userMsg = [
      city ? `Stad: ${city}` : "",
      kind ? `Typ: ${kind}` : "",
      `Rubrik (rå): ${title ?? ""}`,
      `Text (rå): ${body ?? ""}`,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        output_config: {
          format: {
            type: "json_schema",
            schema: {
              type: "object",
              properties: { title: { type: "string" }, body: { type: "string" }, alt: { type: "string" } },
              required: ["title", "body", "alt"],
              additionalProperties: false,
            },
          },
        },
        messages: [{ role: "user", content: userMsg }],
      }),
    });

    if (!res.ok) {
      const errTxt = await res.text();
      console.error("anthropic-fel:", res.status, errTxt);
      return json({ error: `AI-tjänsten svarade ${res.status}` }, 502);
    }

    const data = await res.json();
    // output_config.format garanterar att första text-blocket är giltig JSON.
    const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
    let out: { title?: string; body?: string; alt?: string } = {};
    try { out = JSON.parse(textBlock?.text ?? "{}"); } catch { /* faller igenom */ }

    return json({ title: out.title ?? title, body: out.body ?? body, alt: out.alt ?? "" });
  } catch (err) {
    console.error("enhance-content fel:", err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});
