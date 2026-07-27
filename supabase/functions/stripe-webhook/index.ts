// ── stripe-webhook ───────────────────────────────────────────────────────────
// Den ENDA skrivaren av betaltabellerna. Verifierar Stripe-signaturen och
// skriver entitlements (prenumeration) / city_purchases (engångsköp) med
// service role. Får ALDRIG kräva JWT — registrera med --no-verify-jwt.
//
// Hanterade events:
//   checkout.session.completed            → engångsköp av stad (mode=payment)
//   customer.subscription.created|updated|deleted → Stadsjakten-prenumeration
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { getStripe, getServiceClient } from "../_shared/stripe.ts";
import { axiomLog } from "../_shared/axiom.ts";

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig || !WEBHOOK_SECRET) return new Response("missing signature", { status: 400 });

  const stripe = getStripe();
  const body = await req.text(); // RÅ body krävs för signaturverifiering
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig, WEBHOOK_SECRET, undefined, Stripe.createSubtleCryptoProvider?.(),
    );
  } catch (err) {
    console.error("signaturfel:", (err as Error).message);
    // Larmvärt: en riktig kund kan ha betalat men webhooken avvisas.
    await axiomLog({ level: "error", kind: "webhook_signature_fail", msg: (err as Error).message }, "stripe-webhook");
    return new Response("bad signature", { status: 400 });
  }

  const db = getServiceClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        // deno-lint-ignore no-explicit-any
        const s = event.data.object as any;
        if (s.mode === "payment" && s.payment_status === "paid") {
          const userId = s.metadata?.user_id;
          const city = (s.metadata?.city || "").toLowerCase();
          if (userId && city) {
            await db.from("city_purchases").upsert({
              user_id: userId,
              city,
              amount: s.amount_total ?? null,
              currency: s.currency ?? "sek",
              stripe_session_id: s.id,
            }, { onConflict: "user_id,city", ignoreDuplicates: true });
            await axiomLog({
              kind: "purchase", type: "city", city,
              amount: s.amount_total ?? null, currency: s.currency ?? "sek",
              user_id: userId, session_id: s.id,
            }, "stripe-webhook");
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // deno-lint-ignore no-explicit-any
        const sub = event.data.object as any;
        const userId = sub.metadata?.user_id ?? await userIdFromCustomer(db, sub.customer);
        if (!userId) break;
        const periodEnd = sub.current_period_end
          ?? sub.items?.data?.[0]?.current_period_end
          ?? null;
        await db.from("entitlements").upsert({
          user_id: userId,
          status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
          plan: sub.metadata?.plan ?? "stadsjakt_monthly",
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        await axiomLog({
          kind: "subscription", type: event.type,
          status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
          plan: sub.metadata?.plan ?? "stadsjakt_monthly", user_id: userId,
          subscription_id: sub.id,
        }, "stripe-webhook");
        break;
      }
    }
  } catch (err) {
    console.error("webhook-hantering fel:", err);
    await axiomLog({ level: "error", kind: "webhook_handler_error", event_type: event.type, msg: String(err) }, "stripe-webhook");
    return new Response("handler error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
});

// Fallback när subscription-metadata saknar user_id: slå upp via kundmappningen.
// deno-lint-ignore no-explicit-any
async function userIdFromCustomer(db: any, customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const { data } = await db
    .from("stripe_customers").select("user_id").eq("stripe_customer_id", customerId).maybeSingle();
  return data?.user_id ?? null;
}
