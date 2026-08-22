-- ═══════════════════════════════════════════════════════════════════════════
--  place_comments — kommentarer på en plats (community-omstarten)
--
--  Skiljer sig medvetet från `tips`: ett tips är ett INNEHÅLLSBIDRAG som ska
--  granskas av andra innan det publiceras (peer review, konsensuströsklar). En
--  kommentar är ett SAMTAL — den publiceras direkt och modereras i efterhand
--  via rapportering. Att köra kommentarer genom granskningskön skulle både
--  dränka kön och göra samtalet dött.
--
--  Skydden här är därför: takt (antal per dygn), samma nykomlings-cooldown som
--  tips, och auto-döljning när tillräckligt många oberoende personer rapporterat.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tunables (samma mönster som cfg_* i community_tips) ──────────────────────
create or replace function public.cfg_comment_max_per_day() returns int language sql immutable as $$ select 30 $$;
create or replace function public.cfg_comment_hide_flags()  returns int language sql immutable as $$ select 3 $$;
create or replace function public.cfg_comment_max_len()     returns int language sql immutable as $$ select 2000 $$;

-- ── place_comments ───────────────────────────────────────────────────────────
create table public.place_comments (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  city       text not null,                              -- stadsslug, t.ex. 'goteborg'
  stop_ref   text not null,                              -- plats-id ur data/city/*.json
  body       text not null,
  media_url  text,                                       -- storage-sökväg i 'tips'-bucketen
  hidden     boolean not null default false,             -- dold av moderering/rapporter
  hidden_reason public.flag_reason,
  flag_count integer not null default 0,                 -- cachat antal olösta rapporter
  edited     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comment_not_empty check (length(btrim(body)) > 0),
  constraint comment_not_too_long check (length(body) <= 2000)
);
-- Läsvägen: alla synliga kommentarer för en plats, nyast först.
create index place_comments_stop_idx   on public.place_comments (city, stop_ref, created_at desc) where hidden = false;
create index place_comments_author_idx on public.place_comments (author_id);

-- ── comment_flags (rapporter) ────────────────────────────────────────────────
create table public.comment_flags (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.place_comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      public.flag_reason not null,
  note        text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint one_comment_flag_per_reporter unique (comment_id, reporter_id)
);
create index comment_flags_comment_idx on public.comment_flags (comment_id) where resolved = false;

-- ── Insert-vakt: sätt betrodda fält själva, håll takten ──────────────────────
-- Samma princip som guard_tip_insert: klienten får inte bestämma author_id,
-- hidden eller tidsstämplar, oavsett vad som skickas in.
create or replace function public.guard_comment_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_today int;
begin
  new.author_id     := auth.uid();
  new.city          := lower(new.city);
  new.hidden        := false;
  new.hidden_reason := null;
  new.flag_count    := 0;
  new.edited        := false;
  new.created_at    := now();
  new.updated_at    := now();

  if not public.is_active_member() then
    raise exception 'account is suspended or still in its new-account cooldown';
  end if;

  select count(*) into v_today
    from public.place_comments
    where author_id = auth.uid() and created_at > now() - interval '24 hours';
  if v_today >= public.cfg_comment_max_per_day() then
    raise exception 'too many comments today (max %)', public.cfg_comment_max_per_day();
  end if;
  return new;
end; $$;
create trigger trg_comment_guard
  before insert on public.place_comments
  for each row execute function public.guard_comment_insert();

-- ── Update-vakt: en författare får ändra sin egen TEXT, inget annat ──────────
-- Utan den här kunde en redigering smyga in hidden=false efter moderering, eller
-- flytta kommentaren till en annan plats.
create or replace function public.guard_comment_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() then
    new.updated_at := now();
    return new;
  end if;
  -- Författarens egen redigering: bara body och media_url får röras.
  new.author_id     := old.author_id;
  new.city          := old.city;
  new.stop_ref      := old.stop_ref;
  new.hidden        := old.hidden;
  new.hidden_reason := old.hidden_reason;
  new.flag_count    := old.flag_count;
  new.created_at    := old.created_at;
  new.edited        := (new.body is distinct from old.body) or old.edited;
  new.updated_at    := now();
  return new;
end; $$;
create trigger trg_comment_update_guard
  before update on public.place_comments
  for each row execute function public.guard_comment_update();

-- ── Rapport → räknare, och auto-döljning vid tillräckligt många ──────────────
-- Tröskeln räknar OBEROENDE rapportörer (unik-villkoret ovan garanterar en per
-- person), så en enskild person kan inte tysta någon.
create or replace function public.sync_comment_flags()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_open int; v_reason public.flag_reason;
begin
  v_id := coalesce(new.comment_id, old.comment_id);

  select count(*), mode() within group (order by reason)
    into v_open, v_reason
    from public.comment_flags where comment_id = v_id and resolved = false;

  update public.place_comments c
     set flag_count    = v_open,
         hidden        = (v_open >= public.cfg_comment_hide_flags()) or (c.hidden and c.hidden_reason = 'admin'),
         hidden_reason = case
                           when c.hidden and c.hidden_reason = 'admin' then 'admin'::public.flag_reason
                           when v_open >= public.cfg_comment_hide_flags() then v_reason
                           else null
                         end,
         updated_at    = now()
   where c.id = v_id;
  return null;
end; $$;
create trigger trg_comment_flags_sync
  after insert or update or delete on public.comment_flags
  for each row execute function public.sync_comment_flags();

-- ── public_authors: ta med dem som bara kommenterat ──────────────────────────
-- Vyn visade tidigare bara författare till PUBLICERADE tips. Utan den här
-- utvidgningen skulle varje kommentar visas som "En tipsare", eftersom
-- profiles-RLS döljer bastabellen för anon.
create or replace view public.public_authors as
  select p.id, p.display_name, p.tier
  from public.profiles p
  where exists (select 1 from public.tips t where t.author_id = p.id and t.status = 'published')
     or exists (select 1 from public.place_comments c where c.author_id = p.id and c.hidden = false);
grant select on public.public_authors to anon, authenticated;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.place_comments enable row level security;
alter table public.comment_flags  enable row level security;

-- Synliga kommentarer är öppna för alla (även utloggade — de ska kunna läsa
-- samtalet innan de bestämmer sig för att gå med).
create policy comments_read_visible on public.place_comments for select
  using (hidden = false);
-- Författaren ser alltid sina egna, även dolda, så hen förstår vad som hänt.
create policy comments_read_own on public.place_comments for select
  using (author_id = auth.uid() or public.is_admin());

create policy comments_insert_self on public.place_comments for insert
  to authenticated with check (author_id = auth.uid());
create policy comments_author_update on public.place_comments for update
  to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_author_delete on public.place_comments for delete
  to authenticated using (author_id = auth.uid() or public.is_admin());
create policy comments_admin_update on public.place_comments for update
  to authenticated using (public.is_admin()) with check (public.is_admin());

-- Rapporter: skriv egna, läs egna (admin läser alla). Ingen ser vem som
-- rapporterat vad — annars blir rapportering ett socialt vapen.
create policy comment_flags_insert on public.comment_flags for insert
  to authenticated with check (reporter_id = auth.uid());
create policy comment_flags_read on public.comment_flags for select
  using (reporter_id = auth.uid() or public.is_admin());
create policy comment_flags_admin_update on public.comment_flags for update
  to authenticated using (public.is_admin()) with check (public.is_admin());
