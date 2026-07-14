-- ═══════════════════════════════════════════════════════════════════════════
--  billing — betalning för stadsvandringar (Stripe)
--
--  Två produkter (se docs/stripe-setup.md):
--    • Stadsjakten — prenumeration 49 kr/mån → låser upp ALLA städer.
--    • En stad     — engångsköp 19 kr → låser upp EN stads vandring för alltid.
--
--  Isolationsdoktrin (cell-payments): den här appen har sitt EGET Supabase-
--  projekt och sina EGNA konton (ingen delad identitet med Spökkartan/Cellary).
--  Därför säljs och gate:as prenumerationen enbart i det här projektet. Ett
--  ev. framtida "All-access"-bundle kräver explicit account-linking och byggs
--  separat — vi fejkar det inte genom att dela kund/entitlement mellan appar.
--
--  Säkerhetsmodell:
--    • Klienten har bara anon-nyckeln. ALLA skrivningar till betaltabellerna
--      sker via Stripe-webhooken med SERVICE ROLE (edge function), aldrig från
--      klienten. Därför finns INGA insert/update-policies för anon/authenticated.
--    • Användaren får LÄSA sina egna rader (RLS: auth.uid() = user_id) så appen
--      kan visa "du har Stadsjakten / du äger Mjölby".
--    • Gating i appen (billing.js) är en KONVERTERINGS-gate, inte DRM — samma
--      filosofi som leads-gaten. Innehållet är delvis publikt (SEO-sidor), värdet
--      ligger i den guidade upplevelsen. Se docs/stripe-setup.md.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. stripe_customers — mappning user_id → Stripe-kund ──────────────────────
-- En Stripe-kund per app-konto (återanvänds ALDRIG mellan appar, per doktrinen).
create table if not exists public.stripe_customers (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

-- ── 2. entitlements — Stadsjakten-prenumerationen (en rad per användare) ──────
create table if not exists public.entitlements (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  status                 text not null,          -- active | trialing | past_due | canceled | incomplete
  plan                   text,                   -- 'stadsjakt_monthly' (lookup key)
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  updated_at             timestamptz not null default now()
);

-- ── 3. city_purchases — engångsköp av en stads vandring (19 kr) ───────────────
-- En rad per (användare, stad). stripe_session_id ger idempotens: samma
-- checkout-session kan webhook:as flera gånger utan att skapa dubbletter.
create table if not exists public.city_purchases (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  city              text not null,               -- stad-slug, t.ex. 'mjolby'
  amount            integer,                     -- ören (1900 = 19 kr), för bokföring
  currency          text default 'sek',
  stripe_session_id text unique,                 -- idempotensnyckel
  created_at        timestamptz not null default now(),
  unique (user_id, city)
);
create index if not exists city_purchases_user_idx on public.city_purchases (user_id);

-- ── 4. profiles: partner-flagga (hembygdsgård m.fl.) ──────────────────────────
-- Ett partner-konto får bidra med material (text/bild/koordinater) till en stad.
-- Innehållet går genom samma tips-flöde (pending → publicerat) men partnern
-- märks så admin kan lita på källan. Partner-portalen byggs i en senare iteration;
-- fälten läggs här så gating/UI kan referera dem.
alter table public.profiles add column if not exists is_partner  boolean not null default false;
alter table public.profiles add column if not exists partner_org text;   -- 'Mjölby hembygdsgård'

-- ── 5. RLS: användaren läser sina egna rader; ingen klientskrivning ───────────
alter table public.stripe_customers enable row level security;
alter table public.entitlements     enable row level security;
alter table public.city_purchases   enable row level security;

drop policy if exists "own customer" on public.stripe_customers;
create policy "own customer" on public.stripe_customers
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own entitlement" on public.entitlements;
create policy "own entitlement" on public.entitlements
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own purchases" on public.city_purchases;
create policy "own purchases" on public.city_purchases
  for select to authenticated using (auth.uid() = user_id);

-- ── 6. Access-helpers (SECURITY DEFINER) ──────────────────────────────────────
-- Bekvämt, betrott ja/nej som appen kan rpc:a. Klienten kan också läsa raderna
-- direkt (RLS ovan) och räkna själv — båda vägarna ger samma svar.
create or replace function public.has_stadsjakt()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.entitlements
     where user_id = auth.uid()
       and status in ('active', 'trialing')
       and (current_period_end is null or current_period_end > now())
  );
$$;

create or replace function public.owns_city(p_city text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_stadsjakt() or exists (
    select 1 from public.city_purchases
     where user_id = auth.uid() and city = lower(p_city)
  );
$$;

-- ── 7. Admin: kundöversikt (antal kunder, nivå, e-post) ───────────────────────
-- "jag vill kunna se antal kunder, det räcker med nivå och mailadress."
-- E-post ligger i auth.users (inte profiles) → SECURITY DEFINER krävs för att
-- läsa den. Endast is_admin() slipper igenom. Returnerar EN rad per betalande
-- konto (Stadsjakten eller minst ett stadsköp) — gratiskonton är inte kunder.
create or replace function public.admin_customers()
returns table (
  email    text,
  level    text,          -- 'stadsjakt' | 'stad'
  status   text,          -- prenumerationsstatus, null för rena engångsköp
  cities   integer,       -- antal köpta städer
  since    timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    u.email::text,
    case when e.status in ('active','trialing') then 'stadsjakt' else 'stad' end            as level,
    e.status                                                                                 as status,
    (select count(*)::int from public.city_purchases cp where cp.user_id = u.id)             as cities,
    coalesce(e.updated_at,
             (select min(cp.created_at) from public.city_purchases cp where cp.user_id = u.id)) as since
  from auth.users u
  left join public.entitlements e on e.user_id = u.id
  where public.is_admin()
    and (
      (e.status in ('active','trialing'))
      or exists (select 1 from public.city_purchases cp where cp.user_id = u.id)
    )
  order by since desc nulls last;
$$;

-- Snabb räknare för dashboard-toppen ("X kunder totalt").
create or replace function public.admin_customer_count()
returns table (stadsjakt integer, stad integer, total integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.entitlements where status in ('active','trialing')) as stadsjakt,
    (select count(distinct user_id)::int from public.city_purchases
       where user_id not in (select user_id from public.entitlements where status in ('active','trialing'))) as stad,
    (select count(*)::int from (
       select user_id from public.entitlements where status in ('active','trialing')
       union
       select user_id from public.city_purchases
     ) s) as total
  where public.is_admin();
$$;
