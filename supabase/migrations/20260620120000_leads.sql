-- ═══════════════════════════════════════════════════════════════════════════
--  leads — leadmagnet-motorn (M1: PDF-stadsvandring per ort)
--
--  En lead skapas när en besökare anger sin e-post i signup-gaten för att låsa
--  upp ett gated asset (PDF-vandringen, faktabank-PDF, m.fl.). Raden skrivs
--  DIREKT vid submit — även om besökaren aldrig klickar magic-länken — så att
--  vi fångar intresset oavsett om kontot aktiveras. Magic-länken (Supabase Auth
--  signInWithOtp) skapar/loggar in själva kontot separat.
--
--  Säkerhetsmodell: gaten är en KONVERTERINGS-mekanism, inte en åtkomstgräns.
--  Det gatade innehållet (PDF/full guide) byggs ur samma publika, fritt
--  licensierade data.json — det finns ingen hemlighet att skydda server-side i
--  Fas 1. Därför tillåts anonym INSERT (vem som helst kan lämna sin e-post),
--  men SELECT är låst till den inloggade ägaren. Ingen kan läsa andras leads.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.leads (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete set null,  -- fylls när/om kontot kopplas
  email             text not null,
  source_slug       text,                              -- vilken sida/magnet de kom från, t.ex. "stadsvandring/mjolby"
  magnet_type       text not null default 'pdf',       -- "pdf","quiz","faktabank","tema","whitepaper"
  city_slug         text,                              -- "mjolby"
  consent_marketing boolean not null default false,
  created_at        timestamptz not null default now()
);

comment on table public.leads is 'Leadmagnet-leads: e-post fångad i signup-gaten (M1+). Anonym insert, ägar-läsning.';

-- Snabb uppslagning per ort/magnet vid uppföljning och mätvärden (§9: konvertering per magnet-typ).
create index if not exists leads_city_magnet_idx on public.leads (city_slug, magnet_type, created_at desc);
create index if not exists leads_email_idx        on public.leads (lower(email));

alter table public.leads enable row level security;

-- Anonym + inloggad får skapa sin lead. Vi sätter aldrig user_id direkt från
-- klienten till en betrodd identitet här — den kopplas senare när kontot är känt.
-- with check (true): gaten är publik och får ta emot e-post från vem som helst.
drop policy if exists "insert lead" on public.leads;
create policy "insert lead"
  on public.leads for insert
  to anon, authenticated
  with check (true);

-- Bara den inloggade ägaren får läsa sina egna leads. Anonyma rader (user_id
-- null) är oläsbara via API:t — de når man bara via service-role i backoffice.
drop policy if exists "read own lead" on public.leads;
create policy "read own lead"
  on public.leads for select
  to authenticated
  using (auth.uid() = user_id);
