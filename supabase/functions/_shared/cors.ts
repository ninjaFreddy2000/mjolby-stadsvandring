// Delade CORS-headers för edge functions. Appen ligger på stadsvandring.io men
// vi tillåter valfri origin här eftersom endpointsen ändå kräver en giltig
// Supabase-JWT (checkout/portal) resp. Stripe-signatur (webhook) — origin är
// inte säkerhetsgränsen. '*' krävs för att preflight ska funka från PWA:n.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
