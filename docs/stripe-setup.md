# Stripe-setup — så tänder du betalningen

Allt är byggt. När du gjort de sju stegen nedan tar Stadsvandring.io betalt:
**19 kr för en stad** (engångsköp) eller **Stadsjakten 49 kr/mån** (prenumeration, alla städer).

Räknar med ~30 min. Du behöver bara ett Stripe-konto och Supabase CLI (redan installerad).

---

## Översikt av vad som redan finns

| Del | Fil | Status |
|---|---|---|
| DB: prenumeration, stadsköp, kundmappning | `supabase/migrations/20260713110000_billing.sql` | ✅ klar |
| DB: anonym analytics (tidigare saknad!) | `supabase/migrations/20260713100000_events.sql` | ✅ klar |
| Checkout (skapa köp) | `supabase/functions/create-checkout/` | ✅ klar |
| Webhook (skriver tillgång) | `supabase/functions/stripe-webhook/` | ✅ klar |
| Kundportal (säg upp) | `supabase/functions/customer-portal/` | ✅ klar |
| Klient: tillgång + paywall + konto | `billing.js` | ✅ klar |
| Integritetspolicy | `integritet.html` → `/integritet` | ✅ klar |

Du behöver bara: **skapa 2 priser i Stripe**, **lägga in 2 hemligheter**, **deploya**.

---

## Steg 1 — Skapa produkterna & priserna i Stripe

I [Stripe Dashboard](https://dashboard.stripe.com/products) (börja i **testläge**), skapa två produkter.
Det viktiga är **lookup key** på priset — koden slår upp priset via den, aldrig via ett hårdkodat pris-id.

**Produkt A – "Stadsjakten"**
- Pris: **49,00 SEK**, **Återkommande / månad** (recurring, monthly)
- Klicka fram *Advanced* → sätt **Lookup key** = `stadsjakt_monthly`

**Produkt B – "Stadsvandring – en stad"**
- Pris: **19,00 SEK**, **Engångs** (one time)
- **Lookup key** = `stadsvandring_city`

> Samma engångspris återanvänds för *alla* städer — staden skickas med som metadata vid köpet. Du behöver alltså inte ett pris per stad.

## Steg 2 — Hämta din hemliga API-nyckel

Stripe → Developers → **API keys** → kopiera **Secret key** (`sk_test_…` i testläge).

## Steg 3 — Länka Supabase-projektet (om inte redan gjort)

```bash
cd ~/Desktop/Stadsvandring
supabase link --project-ref phkrlofngyobgupaepej
```

## Steg 4 — Kör migrationerna (skapar tabellerna)

```bash
supabase db push
```

Detta lägger till `entitlements`, `city_purchases`, `stripe_customers`, `events` m.m.

## Steg 5 — Lägg in hemligheterna och deploya funktionerna

```bash
# Stripe-nyckeln (webhook-secret sätts i steg 6)
supabase secrets set STRIPE_SECRET_KEY=sk_test_DIN_NYCKEL
supabase secrets set SITE_URL=https://stadsvandring.io

# Deploya de tre funktionerna (webhook utan JWT-verifiering)
supabase functions deploy create-checkout
supabase functions deploy customer-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY` och `SUPABASE_SERVICE_ROLE_KEY` injiceras automatiskt av Supabase — dem behöver du **inte** sätta.

## Steg 6 — Registrera webhooken

Stripe → Developers → **Webhooks** → *Add endpoint*:
- **URL:** `https://phkrlofngyobgupaepej.supabase.co/functions/v1/stripe-webhook`
- **Events att lyssna på:**
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Spara → kopiera **Signing secret** (`whsec_…`) och lägg in det:

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_DITT_SECRET
supabase functions deploy stripe-webhook --no-verify-jwt   # deploya om så secret laddas
```

## Steg 7 — Slå på betalningen i appen

Paywallen är default **avstängd** (visar "kommer snart") tills du tänder den, så inget går sönder innan Stripe är klart. Slå på:

1. I appen: koppla `BILLING_ENABLED` till på (sätt `localStorage.cfg_billing = '1'` för test, eller ändra defaulten i `config.js` för alla).
2. Testa med Stripes testkort `4242 4242 4242 4242`, valfri framtida utgång/CVC.

Klart. Gå från testläge till skarpt genom att byta `sk_test_…`/`whsec_…` mot live-nycklarna och registrera webhooken igen i live-läge.

---

## Så gör du dig själv till admin

Kundlistan och statistiken visas bara för admin. Sätt din profil till admin i Supabase (SQL editor):

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'fredrik.lundberg@grantigo.com');
```

## Vad du ser som admin

- **Antal kunder** och per nivå (Stadsjakten / enstaka städer) — via `admin_customer_count()`.
- **Kundlista**: e-post + nivå + antal köpta städer — via `admin_customers()`. Ingen annan persondata.
- **Anonym statistik**: app-öppningar, turstarter, incheckningar, mest öppnade platser (admin-dashboarden i appen).

## Viktigt att veta om modellen

- **Egen inloggning.** Det här är ett eget Supabase-projekt med egna konton — krockar inte med Spökkartan eller Cellary (de har sina egna).
- **Anonym data.** All mätning är utan cookies och utan PII. Bara admin ser aggregaten.
- **Gaten är en konverterings-gate, inte kopieringsskydd.** Innehållet är delvis publikt (SEO-sidorna) — värdet ligger i den guidade appupplevelsen. Samma filosofi som den befintliga leads-gaten.
- **Partner (hembygdsgård) & kommun:** grunden finns (`profiles.is_partner` / `partner_org`, samt `leads`). Partner-portalen och kommun-kontaktflödet byggs i nästa iteration.
