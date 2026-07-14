// Delad Stripe- och Supabase-klientfabrik för edge functions (Deno-runtime).
// Stripe-biblioteket måste använda fetch-baserad HTTP-klient i Deno (ingen Node).
import Stripe from "https://esm.sh/stripe@17.7.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

export function getStripe(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY saknas i function-secrets");
  return new Stripe(key, {
    apiVersion: "2024-12-18.acacia",
    httpClient: Stripe.createFetchHttpClient(),
  });
}

// Service-role-klient: kringgår RLS. Används ENBART i webhooken för att skriva
// betaltabellerna. Nyckeln injiceras automatiskt av Supabase i edge-runtime.
export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

// Anon-klient bunden till den anropande användarens JWT — för att verifiera vem
// som ringer (checkout/portal). Läser bara auth-kontexten, inga tabeller.
export function getUserClient(authHeader: string | null) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader ?? "" } },
    },
  );
}

// Lookup keys → pris. Sätts i Stripe Dashboard (se docs/stripe-setup.md).
export const LOOKUP = {
  stadsjakt: "stadsjakt_monthly", // prenumeration 49 kr/mån (recurring)
  city: "stadsvandring_city", // engångsköp 19 kr (one_time)
} as const;
