-- ═══════════════════════════════════════════════════════════════════════════
--  Bidragsroller — presentation, avsikt och stadsmoderatorer
--
--  Modellen är Wikipedias: behörighet FÖRTJÄNAS, den väljs inte. Ett klick på
--  "Jag vill bidra" styr väg och ton — aldrig makt. Annars hade den första
--  spammaren kunnat utnämna sig till moderator över Göteborg.
--
--  Tre delar:
--   1. `intent`  — vad man kom hit för. Ren routing, noll behörighet.
--   2. `bio`     — vem du är och varför du bidrar. KRÄVS för att granska andras
--                  bidrag, inte för att bidra själv. Wikipedias användarsida-norm:
--                  ska du döma andras arbete står du bakom några rader om dig.
--   3. `city_moderators` — "mini-admin" över EN stad. Nivån `ortskannare` var
--                  global, så någon med djup Mjölbykunskap rankade automatiskt
--                  över lokalborna i Kiruna. Nu är den bunden till den stad man
--                  faktiskt bidragit i, tilldelas automatiskt vid tröskeln, och
--                  loggas så att den går att återkalla.
-- ═══════════════════════════════════════════════════════════════════════════

create type public.user_intent as enum ('explore', 'contribute');

-- ── Tunables ────────────────────────────────────────────────────────────────
-- Vad som krävs för att bli stadsmoderator. Medvetet lågt i början: en stad utan
-- moderator är en stad där ingenting blir granskat. Höj när communityn växer.
create or replace function public.cfg_moderator_min_published() returns int language sql immutable as $$ select 5 $$;
create or replace function public.cfg_bio_max_len()             returns int language sql immutable as $$ select 600 $$;

-- ── profiles: avsikt + presentation ─────────────────────────────────────────
alter table public.profiles
  add column if not exists intent    public.user_intent,          -- null = har inte valt än
  add column if not exists bio       text,
  add column if not exists home_city text;                        -- stadsslug man känner bäst

alter table public.profiles
  add constraint profiles_bio_len check (bio is null or length(bio) <= 600);

comment on column public.profiles.intent is
  'Vad användaren kom hit för. Styr onboarding-vägen — ger ALDRIG behörighet.';
comment on column public.profiles.bio is
  'Presentation. Krävs för att granska andras bidrag, inte för att bidra själv.';

-- Kolumnvakten i community_tips skyddar betrodda fält (tier, reputation,
-- is_admin …). intent, bio och home_city är användarens egna och ska vara fria
-- att ändra — de listas därför inte där, och behöver ingen ändring i vakten.

-- ── city_moderators ─────────────────────────────────────────────────────────
-- Egen tabell i stället för en kolumn på profiles: behörighet ska vara
-- granskningsbar. Vem fick den, när, varför, och av vem om den gavs för hand.
create table public.city_moderators (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  city       text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),   -- null = automatiskt på meriter
  reason     text,
  revoked_at timestamptz,
  constraint one_moderator_row_per_city unique (profile_id, city)
);
create index city_moderators_city_idx on public.city_moderators (city) where revoked_at is null;

-- ── Är jag moderator i den här staden? ──────────────────────────────────────
create or replace function public.is_city_moderator(p_city text, p_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select true from public.city_moderators m
     where m.profile_id = p_uid and m.city = lower(p_city) and m.revoked_at is null
     limit 1), false)
     or public.is_admin();
$$;

-- Städer jag modererar (klienten visar dem i profilen).
create or replace function public.my_moderated_cities()
returns table (city text, granted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.city, m.granted_at from public.city_moderators m
   where m.profile_id = auth.uid() and m.revoked_at is null
   order by m.granted_at;
$$;

-- ── Automatisk tilldelning på meriter ───────────────────────────────────────
-- Körs när ett tips publiceras. Villkoren är avsiktligt enkla och synliga för
-- användaren, så vägen dit går att förstå: tillräckligt många publicerade bidrag
-- i staden, en presentation, och inte avstängd.
create or replace function public.maybe_grant_city_moderator(p_uid uuid, p_city text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_pub int; v_bio text; v_susp boolean;
begin
  if p_uid is null or p_city is null then return; end if;

  select bio, is_suspended into v_bio, v_susp from public.profiles where id = p_uid;
  if v_susp is not false then return; end if;                    -- avstängd eller okänd
  if v_bio is null or length(btrim(v_bio)) < 40 then return; end if;  -- måste stå för något

  select count(*) into v_pub
    from public.tips
   where author_id = p_uid and city = lower(p_city) and status = 'published';
  if v_pub < public.cfg_moderator_min_published() then return; end if;

  insert into public.city_moderators (profile_id, city, reason)
  values (p_uid, lower(p_city), format('automatiskt: %s publicerade bidrag i %s', v_pub, p_city))
  on conflict (profile_id, city) do nothing;
end; $$;

-- Haka på publiceringen. AFTER UPDATE på tips: när ett tips går till published
-- prövas författaren för moderatorskap i just den staden.
create or replace function public.on_tip_published_check_moderator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    perform public.maybe_grant_city_moderator(new.author_id, new.city);
  end if;
  return null;
end; $$;
create trigger trg_tip_published_moderator
  after update on public.tips
  for each row execute function public.on_tip_published_check_moderator();

-- Skriver man en presentation EFTER att man redan kvalificerat sig ska den räknas
-- direkt — annars måste man vänta på nästa publicering för att få det man förtjänat.
create or replace function public.on_bio_written_check_moderator()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if new.bio is distinct from old.bio and new.bio is not null then
    for r in select distinct city from public.tips
              where author_id = new.id and status = 'published' loop
      perform public.maybe_grant_city_moderator(new.id, r.city);
    end loop;
  end if;
  return null;
end; $$;
create trigger trg_bio_written_moderator
  after update on public.profiles
  for each row execute function public.on_bio_written_check_moderator();

-- ── Rättigheter ─────────────────────────────────────────────────────────────
grant select on public.city_moderators to anon, authenticated;
grant execute on function public.is_city_moderator(text, uuid) to anon, authenticated;
grant execute on function public.my_moderated_cities() to authenticated;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.city_moderators enable row level security;

-- Vem som modererar en stad är öppen information — det är poängen med att
-- behörigheten är förtjänad och granskningsbar, inte hemlig.
create policy city_moderators_read on public.city_moderators for select using (true);
-- Bara admin delar ut för hand; automatiken går via SECURITY DEFINER-funktionen.
create policy city_moderators_admin_write on public.city_moderators for all
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── public_authors: ta med presentationen ───────────────────────────────────
-- Så att "inskickat av X" kan visa vem X är utan att blotta resten av profilen.
create or replace view public.public_authors as
  select p.id, p.display_name, p.tier, p.bio
  from public.profiles p
  where exists (select 1 from public.tips t where t.author_id = p.id and t.status = 'published')
     or exists (select 1 from public.place_comments c where c.author_id = p.id and c.hidden = false)
     or exists (select 1 from public.routes r where r.author_id = p.id and r.is_public and not r.hidden);
grant select on public.public_authors to anon, authenticated;

-- ── Stadsmoderatorer får dölja i SIN stad ───────────────────────────────────
-- Det konkreta "mini-admin"-mandatet: rensa i sin egen stad, ingen annans.
-- Moderatorn måste kunna SE det hen modererar, inklusive det som redan är dolt.
-- Utan den här policyn blev döljningen omöjlig på ett förrädiskt sätt: en
-- UPDATE med WHERE kräver att den NYA raden är synlig under SELECT-policyerna,
-- och en dold kommentar är osynlig för alla utom författaren. Moderatorn dolde
-- alltså bort sig själv ur sikte mitt i satsen och fick "violates row-level
-- security policy". Utan WHERE gick samma uppdatering igenom — men PostgREST
-- skickar alltid WHERE, så i appen hade det aldrig fungerat.
create policy comments_read_moderator on public.place_comments for select
  using (public.is_city_moderator(city));

create policy comments_moderator_update on public.place_comments for update
  to authenticated
  using (public.is_city_moderator(city))
  with check (public.is_city_moderator(city));

create policy routes_read_moderator on public.routes for select
  using (public.is_city_moderator(city));

create policy routes_moderator_update on public.routes for update
  to authenticated
  using (public.is_city_moderator(city))
  with check (public.is_city_moderator(city));

-- RLS räcker inte: kolumnvakterna skriver tillbaka `hidden` för alla utom admin
-- och systemet. Utan den här ändringen hade moderatorns döljning tyst runnit ut
-- i sanden — exakt samma fälla som gjorde auto-döljningen verkningslös när
-- kommentarerna byggdes. Moderatorn får röra moderationsfälten, inget annat.
create or replace function public.guard_comment_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.comment_moderation', true) = 'on' then
    return new;
  end if;
  if public.is_admin() or public.is_city_moderator(old.city) then
    -- Moderationsbeslut överlever rapport-synken.
    if new.hidden and not old.hidden then new.hidden_by_admin := true; end if;
    if old.hidden and not new.hidden then new.hidden_by_admin := false; end if;
    new.author_id  := old.author_id;      -- inte ens en moderator byter ägare
    new.city       := old.city;
    new.stop_ref   := old.stop_ref;
    new.updated_at := now();
    return new;
  end if;
  new.author_id       := old.author_id;
  new.city            := old.city;
  new.stop_ref        := old.stop_ref;
  new.hidden          := old.hidden;
  new.hidden_reason   := old.hidden_reason;
  new.hidden_by_admin := old.hidden_by_admin;
  new.flag_count      := old.flag_count;
  new.created_at      := old.created_at;
  new.edited          := (new.body is distinct from old.body) or old.edited;
  new.updated_at      := now();
  return new;
end; $$;

create or replace function public.guard_route_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.route_system_write', true) = 'on' then
    return new;
  end if;
  if public.is_admin() or public.is_city_moderator(old.city) then
    new.author_id  := old.author_id;
    new.city       := old.city;
    new.walk_count := old.walk_count;     -- räknaren ägs av systemet
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
