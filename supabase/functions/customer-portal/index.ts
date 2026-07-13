// ── customer-portal ──────────────────────────────────────────────────────────
// Returnerar en URL till Stripes kundportal där användaren kan säga upp/ändra
// sin Stadsjakt-prenumeration och se kvitton. Kräver inloggad användare.
//   POST { lang?: 'sv' | 'en' }  →  { url }
import { corsHeaders, json } from "../_shared/cors.ts";
import { getStripe, getServiceClient, getUserClient } from "../_shared/stripe.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://stadsvandring.io";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const { data: { user } } = await getUserClient(authHeader).auth.getUser();
    if (!user) return json({ error: "ej inloggad" }, 401);

    const db = getServiceClient();
    const { data: cust } = await db
      .from("stripe_customers").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();
    if (!cust?.stripe_customer_id) return json({ error: "no_customer" }, 404);

    const session = await getStripe().billingPortal.sessions.create({
      customer: cust.stripe_customer_id,
      return_url: `${SITE_URL}/karta?tab=profile`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("customer-portal fel:", err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});
