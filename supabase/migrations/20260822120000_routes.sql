-- ═══════════════════════════════════════════════════════════════════════════
--  routes — egna rutter som man går med sina kompisar (community-omstarten)
--
--  Skilt från `challenges` (challenges.js), som är ett ARRANGÖRSVERKTYG: en
--  skola eller ett företag bygger en geocaching-tävling med poäng, uppgifter
--  och topplista, och hela tävlingen kodas i URL:ens hash. Det fungerar bra för
--  sitt syfte men bär för mycket för "jag och Sara springer en runda på
--  lördag": organisationsnamn, uppgiftstyper, poäng per stopp.
--
--  En rutt är enklare — namn, en följd av platser, hur man tar sig runt — och
--  ligger i databasen i stället för i länken. Det är själva poängen: andras
--  rutter ska gå att UPPTÄCKA i staden, inte bara tas emot av den som fick
--  länken. Dessutom slipper vi tvåtusenteckens-URL:er.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.route_mode as enum ('walk', 'run', 'bike');

-- ── Tunables ─────────────────────────────────────────────────────────────────
create or replace function public.cfg_route_max_stops()   returns int language sql immutable as $$ select 40 $$;
create or replace function public.cfg_route_max_per_day() returns int language sql immutable as $$ select 20 $$;

-- ── routes ───────────────────────────────────────────────────────────────────
create table public.routes (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  city        text not null,                            -- stadsslug
  title       text not null,
  intro       text,
  mode        public.route_mode not null default 'walk',
  -- Stoppen i ordning, som plats-id ur data/city/<slug>.json. Läses alltid som
  -- en helhet, aldrig stopp för stopp — därför jsonb och ingen kopplingstabell.
  stops       jsonb not null,
  is_public   boolean not null default true,            -- syns i "rutter i staden"
  -- Planerad start: "vi går den här på lördag kl 10". Null = ingen tid satt.
  starts_at   timestamptz,
  hidden      boolean not null default false,           -- modererad
  walk_count  integer not null default 0,               -- antal som gått den
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint route_title_not_empty check (length(btrim(title)) > 0),
  constraint route_title_len       check (length(title) <= 120),
  constraint route_intro_len       check (intro is null or length(intro) <= 600),
  constraint route_stops_is_array  check (jsonb_typeof(stops) = 'array'),
  constraint route_stops_count     check (jsonb_array_length(stops) between 2 and 40)
);
-- Läsvägen "publika rutter i den här staden, nyast först".
create index routes_city_idx   on public.routes (city, created_at desc) where is_public and not hidden;
create index routes_author_idx on public.routes (author_id, created_at desc);

-- ── route_walks — vem som gått rutten (och ev. på tid) ───────────────────────
-- Gör "utmana en kompis" meningsfullt: man ser vilka som gått den och hur fort.
create table public.route_walks (
  id          uuid primary key default gen_random_uuid(),
  route_id    uuid not null references public.routes(id) on delete cascade,
  walker_id   uuid not null references public.profiles(id) on delete cascade,
  seconds     integer,                                  -- null = gick den, tog inte tid
  stops_done  integer not null default 0,
  finished_at timestamptz not null default now(),
  constraint walk_seconds_sane check (seconds is null or (seconds > 0 and seconds < 86400))
);
create index route_walks_route_idx on public.route_walks (route_id, seconds nulls last);

-- ── Insert-vakt ──────────────────────────────────────────────────────────────
-- Samma princip som tips och kommentarer: klienten bestämmer inte författare,
-- moderationsflagga, räknare eller tidsstämplar.
create or replace function public.guard_route_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_today int;
begin
  new.author_id  := auth.uid();
  new.city       := lower(new.city);
  new.hidden     := false;
  new.walk_count := 0;
  new.created_at := now();
  new.updated_at := now();

  if not public.is_active_member() then
    raise exception 'account is suspended or still in its new-account cooldown';
  end if;

  select count(*) into v_today
    from public.routes where author_id = auth.uid() and created_at > now() - interval '24 hours';
  if v_today >= public.cfg_route_max_per_day() then
    raise exception 'too many routes today (max %)', public.cfg_route_max_per_day();
  end if;
  return new;
end; $$;
create trigger trg_route_guard
  before insert on public.routes
  for each row execute function public.guard_route_insert();

-- ── Update-vakt ──────────────────────────────────────────────────────────────
-- Författaren får redigera sin rutt (titel, text, stopp, läge, publik, starttid)
-- men inte flytta den till någon annan, avdölja den efter moderering eller
-- skruva upp walk_count. Systemets egen räknar-skrivning får undantag via en
-- transaktions-lokal GUC — samma mönster som app.reputation_write i
-- community_tips och app.comment_moderation i place_comments.
create or replace function public.guard_route_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.route_system_write', true) = 'on' then
    return new;
  end if;
  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  new.author_id  := old.author_id;
  new.city       := old.city;
  new.hidden     := old.hidden;
  new.walk_count := old.walk_count;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end; $$;
create trigger trg_route_update_guard
  before update on public.routes
  for each row execute function public.guard_route_update();

-- ── Gången rutt → räkna upp, en gång per person ──────────────────────────────
-- walk_count räknar DISTINKTA vandrare, inte antal loggade rundor. Annars kunde
-- man pumpa upp sin egen rutt genom att gå den om och om igen.
create or replace function public.guard_route_walk_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.walker_id   := auth.uid();
  new.finished_at := now();
  if not public.is_active_member() then
    raise exception 'account is suspended or still in its new-account cooldown';
  end if;
  return new;
end; $$;
create trigger trg_route_walk_guard
  before insert on public.route_walks
  for each row execute function public.guard_route_walk_insert();

create or replace function public.sync_route_walk_count()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_n int;
begin
  v_id := coalesce(new.route_id, old.route_id);
  perform set_config('app.route_system_write', 'on', true);
  select count(distinct walker_id) into v_n from public.route_walks where route_id = v_id;
  update public.routes set walk_count = v_n, updated_at = now() where id = v_id;
  return null;
end; $$;
create trigger trg_route_walk_sync
  after insert or delete on public.route_walks
  for each row execute function public.sync_route_walk_count();

-- ── public_authors: ta med dem som gjort en publik rutt ──────────────────────
-- Annars visas "Rutt av En stadsvandrare" för alla, eftersom profiles-RLS
-- döljer bastabellen för anon.
create or replace view public.public_authors as
  select p.id, p.display_name, p.tier
  from public.profiles p
  where exists (select 1 from public.tips t where t.author_id = p.id and t.status = 'published')
     or exists (select 1 from public.place_comments c where c.author_id = p.id and c.hidden = false)
     or exists (select 1 from public.routes r where r.author_id = p.id and r.is_public and not r.hidden);
grant select on public.public_authors to anon, authenticated;

-- ── Tabellrättigheter ────────────────────────────────────────────────────────
-- RLS avgör vilka rader man ser; PostgREST behöver dessutom vanliga
-- tabellrättigheter för att komma in alls.
grant select                 on public.routes      to anon, authenticated;
grant insert, update, delete on public.routes      to authenticated;
grant select                 on public.route_walks to anon, authenticated;
grant insert, delete         on public.route_walks to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.routes      enable row level security;
alter table public.route_walks enable row level security;

-- Publika rutter är öppna för alla — även utloggade. En delad rutt ska gå att
-- öppna direkt, utan konto; kontot behövs först när man vill spara eller svara.
create policy routes_read_public on public.routes for select
  using (is_public and not hidden);
create policy routes_read_own on public.routes for select
  using (author_id = auth.uid() or public.is_admin());

create policy routes_insert_self on public.routes for insert
  to authenticated with check (author_id = auth.uid());
create policy routes_author_update on public.routes for update
  to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy routes_author_delete on public.routes for delete
  to authenticated using (author_id = auth.uid() or public.is_admin());
create policy routes_admin_update on public.routes for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- Rundor är öppna att läsa (det är topplistan), men bara den som gått en runda
-- får skriva eller ta bort sin egen.
create policy walks_read on public.route_walks for select using (true);
create policy walks_insert_self on public.route_walks for insert
  to authenticated with check (walker_id = auth.uid());
create policy walks_delete_own on public.route_walks for delete
  to authenticated using (walker_id = auth.uid() or public.is_admin());
