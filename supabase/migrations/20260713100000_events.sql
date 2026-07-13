-- ═══════════════════════════════════════════════════════════════════════════
--  events — anonym förstaparts-analytics
--
--  app.js:track() skriver redan hit ({ name, path, city, props, session }) och
--  admin.js läser den för aktivitetsöversikten (app-öppningar, turstarter,
--  incheckningar, mest öppnade platser, sessioner/7d). Tabellen har hittills
--  SAKNATS i schemat → varje insert har tyst misslyckats och all data tappats.
--  Den här migrationen skapar den och stänger gapet.
--
--  Integritetsmodell (§ användarens krav: "datan ska annars vara anonym"):
--    • Ingen PII, ingen cookie. `session` är ett slumpat localStorage-id (sv_sid)
--      utan koppling till identitet — bara för att räkna unika sessioner.
--    • INSERT är öppet för anon + authenticated (mätning ska ske på hela sajten,
--      även utloggade besökare). Men klienten får ALDRIG sätta betrodda fält:
--      `ts` sätts av DEFAULT now(), aldrig av payloaden.
--    • SELECT är låst till is_admin() — bara Fredrik ser aggregaten. Ingen
--      besökare kan läsa andras (eller ens sina egna) events via API:t.
--    • Fritt fält `props` (jsonb) hålls litet av en storleksguard så tabellen
--      inte kan pumpas full av en illvillig klient.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.events (
  id       bigint generated always as identity primary key,
  name     text not null,                        -- 'app_open' | 'tour_start' | 'checkin' | 'stop_open' | 'js_error' | ...
  path     text,                                 -- location.pathname
  city     text,                                 -- aktiv stad-slug, kan vara null
  session  text,                                 -- anonymt localStorage-id (sv_sid), ej identitet
  props    jsonb,                                -- fritt: { id: 'stora-torget' }, { tour: 'central' }, ...
  ts       timestamptz not null default now()
);

-- Aggregaten i admin.js filtrerar på name/ts och räknar per props->>'id' / city.
create index if not exists events_ts_idx        on public.events (ts desc);
create index if not exists events_name_ts_idx   on public.events (name, ts desc);
create index if not exists events_city_idx      on public.events (city, ts desc);

comment on table public.events is 'Anonym förstaparts-analytics: inga cookies, ingen PII. Anonym insert, admin-läsning.';

alter table public.events enable row level security;

-- ── Insert-guard: tvinga betrodda defaults, håll props litet ──────────────────
-- ts sätts alltid server-side. props begränsas till ~2 kB så tabellen inte kan
-- fyllas med skräp. Övriga fält trimmas till rimliga längder.
create or replace function public.guard_event_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.ts   := now();
  new.name := left(coalesce(new.name, ''), 64);
  new.path := left(new.path, 256);
  new.city := left(new.city, 64);
  new.session := left(new.session, 64);
  if new.name = '' then
    raise exception 'event name required';
  end if;
  if new.props is not null and length(new.props::text) > 2048 then
    raise exception 'event props too large';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_event_insert on public.events;
create trigger trg_guard_event_insert
  before insert on public.events
  for each row execute function public.guard_event_insert();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Mätning på hela sajten: vem som helst får skapa en event-rad.
drop policy if exists "insert event" on public.events;
create policy "insert event"
  on public.events for insert
  to anon, authenticated
  with check (true);

-- Bara admin får läsa. is_admin() är den befintliga SECURITY DEFINER-helpern
-- (definierad i community_tips-migrationen) som slår upp profiles.is_admin.
drop policy if exists "admin read events" on public.events;
create policy "admin read events"
  on public.events for select
  to authenticated
  using (public.is_admin());
