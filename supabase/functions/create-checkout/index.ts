// ── create-checkout ──────────────────────────────────────────────────────────
// Skapar en Stripe Checkout Session och returnerar { url } som appen redirectar
// till. Kräver inloggad användare (Supabase-JWT i Authorization-headern).
//
//   POST { plan: 'stadsjakt' | 'city', city?: string, lang?: 'sv' | 'en' }
//     plan='stadsjakt' → prenumeration (mode=subscription), låser upp allt
//     plan='city'      → engångsköp (mode=payment), låser upp `city`
//
// En Stripe-kund per app-konto (aldrig delad mellan appar, per cell-doktrinen).
import { corsHeaders, json } from "../_shared/cors.ts";
import { getStripe, getServiceClient, getUserClient, LOOKUP } from "../_shared/stripe.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://stadsvandring.io";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const { plan, city, lang } = await req.json().catch(() => ({}));
    if (plan !== "stadsjakt" && plan !== "city") {
      return json({ error: "okänd plan" }, 400);
    }
    if (plan === "city" && !city) {
      return json({ error: "city krävs för stadsköp" }, 400);
    }
    const citySlug = city ? String(city).toLowerCase().slice(0, 64) : null;

    // Vem ringer? Verifiera JWT:n.
    const authHeader = req.headers.get("Authorization");
    const { data: { user } } = await getUserClient(authHeader).auth.getUser();
    if (!user) return json({ error: "ej inloggad" }, 401);

    const stripe = getStripe();
    const db = getServiceClient();

    // Redan köpt den här staden? (idempotent UX — skicka inte till checkout igen)
    if (plan === "city") {
      const { data: owned } = await db
        .from("city_purchases")
        .select("id").eq("user_id", user.id).eq("city", citySlug).maybeSingle();
      if (owned) return json({ error: "already_owned" }, 409);
    }

    // Hämta/skapa Stripe-kund för det här app-kontot.
    const customerId = await getOrCreateCustomer(stripe, db, user.id, user.email);

    // Slå upp priset via lookup key → koden hårdkodar aldrig price-id:t.
    const lookupKey = plan === "stadsjakt" ? LOOKUP.stadsjakt : LOOKUP.city;
    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) return json({ error: `pris saknas (lookup_key '${lookupKey}')` }, 400);

    const en = lang === "en";
    const session = await stripe.checkout.sessions.create({
      mode: plan === "stadsjakt" ? "subscription" : "payment",
      customer: customerId,
      line_items: [{ price: price.id, quantity: 1 }],
      locale: en ? "en" : "sv",
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/karta?checkout=success&plan=${plan}${citySlug ? `&city=${citySlug}` : ""}`,
      cancel_url: `${SITE_URL}/karta?checkout=cancel`,
      metadata: { user_id: user.id, plan, city: citySlug ?? "" },
      ...(plan === "stadsjakt"
        ? { subscription_data: { metadata: { user_id: user.id, plan } } }
        : { payment_intent_data: { metadata: { user_id: user.id, plan, city: citySlug ?? "" } } }),
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("create-checkout fel:", err);
    return json({ error: String((err as Error).message ?? err) }, 500);
  }
});

async function getOrCreateCustomer(
  // deno-lint-ignore no-explicit-any
  stripe: any, db: any, userId: string, email?: string,
): Promise<string> {
  const { data: existing } = await db
    .from("stripe_customers").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId, app: "stadsvandring" },
  });
  await db.from("stripe_customers").insert({ user_id: userId, stripe_customer_id: customer.id });
  return customer.id;
}
