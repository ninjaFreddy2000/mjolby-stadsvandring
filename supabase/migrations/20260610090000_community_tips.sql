-- ═══════════════════════════════════════════════════════════════════════════
--  Stadsvandring — community tips + earned peer-review (reputation) model
--
--  Anyone who signs up can submit a "tip" (kind = memory | place | correction).
--  Tips start 'pending'. Eligible reviewers (earned tiers) vote approve/reject;
--  weighted consensus auto-publishes/-rejects. Reputation is ACCURACY-weighted
--  so trust is earned by being right, not by volume — which is what unlocks the
--  right to verify other people's tips. Kommun admins always override.
--
--  No trusted server layer exists: the PWA talks straight to Postgres with the
--  anon key. Therefore EVERYTHING the client could lie about (status, tier,
--  reputation, vote weight, authorship) is set by the database via DEFAULT /
--  trigger — never accepted from the insert payload — and all cross-table auth
--  checks go through SECURITY DEFINER functions to avoid RLS recursion.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.tip_kind      as enum ('memory', 'place', 'correction');
create type public.tip_status    as enum ('pending', 'published', 'rejected', 'withdrawn');
create type public.reject_reason as enum ('consensus', 'spam', 'abuse', 'duplicate', 'admin');
create type public.user_tier     as enum ('tipsare', 'granskare', 'ortskannare');  -- admin is a boolean, NOT a tier
create type public.vote_value    as enum ('approve', 'reject');
create type public.flag_reason   as enum ('spam', 'abuse', 'offensive', 'wrong', 'duplicate', 'other');

-- ── Tunables (single source of truth) ────────────────────────────────────────
-- Kept as immutable functions so policies/triggers reference them by name and a
-- future migration can re-tune in one place.
create or replace function public.cfg_publish_threshold() returns int language sql immutable as $$ select 3 $$;
create or replace function public.cfg_reject_threshold()  returns int language sql immutable as $$ select 3 $$;   -- symmetric: net <= -3
create or replace function public.cfg_min_reviewers()     returns int language sql immutable as $$ select 2 $$;   -- ≥2 distinct reviewers before any auto-decision
create or replace function public.cfg_max_pending()       returns int language sql immutable as $$ select 5 $$;
create or replace function public.cfg_cooldown()          returns interval language sql immutable as $$ select interval '24 hours' $$;
create or replace function public.cfg_tier_granskare_pts()   returns int language sql immutable as $$ select 50 $$;
create or replace function public.cfg_tier_granskare_pub()   returns int language sql immutable as $$ select 3 $$;
create or replace function public.cfg_tier_ortskannare_pts() returns int language sql immutable as $$ select 200 $$;

-- ── profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text not null default 'Tipsare',
  city            text,                                   -- home town slug, e.g. 'mjolby'
  tier            public.user_tier not null default 'tipsare',
  is_admin        boolean not null default false,
  is_suspended    boolean not null default false,
  reputation      integer not null default 0,
  published_count integer not null default 0,
  created_at      timestamptz not null default now(),
  trust_active_at timestamptz not null default (now() + interval '24 hours')  -- new-account cooldown anchor
);

-- ── tips ─────────────────────────────────────────────────────────────────────
create table public.tips (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references public.profiles(id) on delete cascade,
  kind          public.tip_kind not null,
  city          text not null,                            -- 'mjolby'
  stop_ref      text,                                     -- data.json slug; null for kind='place'
  title         text not null,
  body          text,
  media_url     text,                                     -- storage path or external URL
  lat           double precision,
  lng           double precision,
  status        public.tip_status not null default 'pending',
  reject_reason public.reject_reason,
  score         integer not null default 0,               -- cached net weighted score
  review_count  integer not null default 0,               -- cached distinct-reviewer count
  decided_at    timestamptz,
  decided_by    uuid references public.profiles(id),      -- set only on admin override
  promoted_ref  text,                                     -- slug it became once a 'place' lands in data.json
  promoted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint place_has_coords  check (kind <> 'place' or (lat is not null and lng is not null)),
  constraint ref_has_stop      check (kind = 'place' or stop_ref is not null)
);
create index tips_status_city_idx on public.tips (status, city);
create index tips_author_idx      on public.tips (author_id);
create index tips_pending_idx     on public.tips (city) where status = 'pending';
create index tips_stop_idx        on public.tips (city, stop_ref) where status = 'published';

-- ── tip_reviews ──────────────────────────────────────────────────────────────
create table public.tip_reviews (
  id          uuid primary key default gen_random_uuid(),
  tip_id      uuid not null references public.tips(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  vote        public.vote_value not null,
  weight      smallint not null default 0,                -- SNAPSHOT of reviewer weight at vote time (trigger-set)
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint one_vote_per_reviewer unique (tip_id, reviewer_id)
);
create index tip_reviews_tip_idx      on public.tip_reviews (tip_id);
create index tip_reviews_reviewer_idx on public.tip_reviews (reviewer_id);

-- ── tip_flags (reports) ──────────────────────────────────────────────────────
create table public.tip_flags (
  id          uuid primary key default gen_random_uuid(),
  tip_id      uuid not null references public.tips(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      public.flag_reason not null,
  note        text,
  resolved    boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint one_flag_per_reporter unique (tip_id, reporter_id)
);

-- ── audit_log (admin decision trail; written only by SECURITY DEFINER fns) ────
create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles(id),
  action      text not null,
  target_tip  uuid references public.tips(id),
  target_user uuid references public.profiles(id),
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ═══════════════════════════════════════════════════════════════════════════
--  Helper functions — SECURITY DEFINER + search_path='' run as owner with RLS
--  NOT applied to the tables they read, which is what breaks the policy
--  recursion chain (policy → reads profiles → profiles policy → reads tips …).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.user_tier(uid uuid default auth.uid())
returns public.user_tier language sql stable security definer set search_path = '' as $$
  select coalesce((select p.tier from public.profiles p where p.id = uid), 'tipsare'::public.user_tier);
$$;

create or replace function public.is_active_member()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_suspended = false and now() >= p.trust_active_at
  );
$$;

-- Vote weight: tipsare/admin = 0 (admins act via override RPC), granskare = 1, ortskannare = 2.
create or replace function public.vote_weight(uid uuid default auth.uid())
returns smallint language sql stable security definer set search_path = '' as $$
  select (case public.user_tier(uid)
            when 'ortskannare' then 2
            when 'granskare'   then 1
            else 0 end)::smallint;
$$;

create or replace function public.can_review(p_tip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_active_member()
     and public.vote_weight() > 0
     and exists (
       select 1 from public.tips t
       where t.id = p_tip_id and t.author_id <> auth.uid() and t.status = 'pending'
     );
$$;

create or replace function public.can_see_tip(p_tip_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tips t
    where t.id = p_tip_id
      and (t.status = 'published'
           or t.author_id = auth.uid()
           or public.is_admin()
           or public.vote_weight() > 0)
  );
$$;

-- ── New-user trigger: one profile per auth user ──────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''),
                           nullif(new.raw_user_meta_data->>'name',''),
                           split_part(new.email,'@',1),
                           'Tipsare'));
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── profiles: pin protected columns against client UPDATE ────────────────────
create or replace function public.profiles_protect_cols()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Trusted system path: the reputation/consensus SECURITY DEFINER functions set
  -- this transaction-local flag before writing reputation/tier. End users cannot
  -- inject set_config through the REST API, so this can't be spoofed by clients.
  if current_setting('app.reputation_write', true) = 'on' then
    return new;
  end if;
  -- Service-role / SQL-admin context (auth.uid() is null — seeding, bootstrapping
  -- the first kommun admin, support tooling) may set any column. End users cannot.
  if auth.uid() is not null and not public.is_admin() then
    if new.tier            is distinct from old.tier
       or new.is_admin        is distinct from old.is_admin
       or new.reputation      is distinct from old.reputation
       or new.published_count is distinct from old.published_count
       or new.is_suspended    is distinct from old.is_suspended
       or new.trust_active_at is distinct from old.trust_active_at then
      raise exception 'protected column may not be changed';
    end if;
  end if;
  return new;
end; $$;
create trigger trg_profiles_protect
  before update on public.profiles
  for each row execute function public.profiles_protect_cols();

-- ── tips: force trusted defaults on insert + quota/cooldown guard ────────────
create or replace function public.guard_tip_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_pending int;
begin
  new.status        := 'pending';
  new.score         := 0;
  new.review_count  := 0;
  new.reject_reason := null;
  new.decided_at    := null;
  new.decided_by    := null;
  new.promoted_ref  := null;
  new.promoted_at   := null;
  new.author_id     := auth.uid();
  new.city          := lower(new.city);
  new.created_at    := now();
  new.updated_at    := now();

  if not public.is_active_member() then
    raise exception 'account is suspended or still in its new-account cooldown';
  end if;

  select count(*) into v_pending
    from public.tips where author_id = auth.uid() and status = 'pending';
  if v_pending >= public.cfg_max_pending() then
    raise exception 'too many pending tips (max %)', public.cfg_max_pending();
  end if;
  return new;
end; $$;
create trigger trg_tip_guard
  before insert on public.tips
  for each row execute function public.guard_tip_insert();

-- Keep "withdraw" honest: an author UPDATE may only move pending -> withdrawn,
-- never smuggle status='published' or touch trusted columns.
create or replace function public.guard_tip_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Only restrict the AUTHOR editing their own tip from the API. Admin updates
  -- (is_admin) and system updates driven by SECURITY DEFINER functions — the
  -- consensus engine (runs as the voting reviewer, author_id <> auth.uid()) and
  -- the admin RPCs — are trusted and pass through. RLS already forbids any other
  -- user from updating a tip they neither own nor admin.
  if auth.uid() is null or public.is_admin() or auth.uid() <> old.author_id then
    return new;
  end if;
  -- non-admin author edits: pin everything except body/title/withdrawal
  if new.status not in ('pending','withdrawn') then
    raise exception 'not allowed to set this status';
  end if;
  new.author_id     := old.author_id;
  new.kind          := old.kind;
  new.score         := old.score;
  new.review_count  := old.review_count;
  new.reject_reason := old.reject_reason;
  new.decided_at    := old.decided_at;
  new.decided_by    := old.decided_by;
  new.promoted_ref  := old.promoted_ref;
  new.promoted_at   := old.promoted_at;
  new.updated_at    := now();
  return new;
end; $$;
create trigger trg_tip_update_guard
  before update on public.tips
  for each row execute function public.guard_tip_update();

-- ── tip_reviews: snapshot the weight, reject illegal votes ───────────────────
create or replace function public.set_review_weight()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_author uuid; v_status public.tip_status;
begin
  select author_id, status into v_author, v_status from public.tips where id = new.tip_id;
  if v_author = new.reviewer_id then raise exception 'cannot review your own tip'; end if;
  if v_status <> 'pending'      then raise exception 'tip is not open for review'; end if;
  new.reviewer_id := auth.uid();
  new.weight := public.vote_weight(auth.uid());
  if new.weight = 0 then raise exception 'not eligible to vote'; end if;
  new.updated_at := now();
  return new;
end; $$;
create trigger trg_review_weight
  before insert or update on public.tip_reviews
  for each row execute function public.set_review_weight();

-- ═══════════════════════════════════════════════════════════════════════════
--  Reputation settlement (idempotent; shared by consensus + admin override)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.recompute_tier(p_uid uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_rep int; v_pub int; v_new public.user_tier;
begin
  select reputation, published_count into v_rep, v_pub from public.profiles where id = p_uid;
  if v_rep is null then return; end if;
  v_new := case
    when v_rep >= public.cfg_tier_ortskannare_pts() then 'ortskannare'
    when v_pub >= public.cfg_tier_granskare_pub() or v_rep >= public.cfg_tier_granskare_pts() then 'granskare'
    else 'tipsare'
  end::public.user_tier;
  update public.profiles set tier = v_new where id = p_uid and tier is distinct from v_new;
end; $$;

-- Apply (sign = +1) or reverse (sign = -1) the reputation deltas for a terminal outcome.
create or replace function public.apply_reputation(
  p_tip_id uuid, p_status public.tip_status, p_reason public.reject_reason, p_sign int)
returns void language plpgsql security definer set search_path = '' as $$
declare v_author uuid; r record;
begin
  -- authorise the protected-column writes below (transaction-local; see profiles_protect_cols)
  perform set_config('app.reputation_write', 'on', true);
  select author_id into v_author from public.tips where id = p_tip_id;

  -- Author delta
  if p_status = 'published' then
    update public.profiles
       set reputation = reputation + (10 * p_sign),
           published_count = greatest(0, published_count + (1 * p_sign))
     where id = v_author;
  elsif p_status = 'rejected' and p_reason in ('spam','abuse') then
    update public.profiles set reputation = reputation - (5 * p_sign) where id = v_author;
  end if;

  -- Reviewer accuracy: agree with outcome => +2, disagree => -1.
  for r in select reviewer_id, vote from public.tip_reviews where tip_id = p_tip_id loop
    if (r.vote = 'approve' and p_status = 'published')
       or (r.vote = 'reject' and p_status = 'rejected') then
      update public.profiles set reputation = reputation + (2 * p_sign) where id = r.reviewer_id;
    else
      update public.profiles set reputation = reputation - (1 * p_sign) where id = r.reviewer_id;
    end if;
  end loop;

  -- Recompute tiers for everyone touched
  perform public.recompute_tier(v_author);
  perform public.recompute_tier(t.reviewer_id)
    from (select distinct reviewer_id from public.tip_reviews where tip_id = p_tip_id) t;
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Consensus engine: recompute score on each vote, transition at thresholds,
--  settle reputation once on the transition INTO a terminal state.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.recompute_consensus()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_tip_id   uuid := coalesce(new.tip_id, old.tip_id);
  v_status   public.tip_status;
  v_net      int;
  v_count    int;
  v_new      public.tip_status;
  v_reason   public.reject_reason;
begin
  -- Serialize concurrent votes that might both cross the threshold.
  select status into v_status from public.tips where id = v_tip_id for update;

  select coalesce(sum(case when vote = 'approve' then weight else -weight end), 0),
         count(distinct reviewer_id)
    into v_net, v_count
    from public.tip_reviews where tip_id = v_tip_id;

  -- Already terminal → refresh cached numbers only; never re-transition or re-award.
  if v_status <> 'pending' then
    update public.tips set score = v_net, review_count = v_count where id = v_tip_id;
    return null;
  end if;

  if v_count >= public.cfg_min_reviewers() and v_net >= public.cfg_publish_threshold() then
    v_new := 'published'; v_reason := null;
  elsif v_count >= public.cfg_min_reviewers() and v_net <= -public.cfg_reject_threshold() then
    v_new := 'rejected';  v_reason := 'consensus';
  else
    v_new := 'pending';   v_reason := null;
  end if;

  update public.tips
     set score = v_net, review_count = v_count, status = v_new, reject_reason = v_reason,
         decided_at = case when v_new <> 'pending' then now() else null end,
         updated_at = now()
   where id = v_tip_id;

  if v_new <> 'pending' then
    perform public.apply_reputation(v_tip_id, v_new, v_reason, 1);
  end if;
  return null;
end; $$;
create trigger trg_consensus
  after insert or update or delete on public.tip_reviews
  for each row execute function public.recompute_consensus();

-- ═══════════════════════════════════════════════════════════════════════════
--  Admin RPCs (decisive; bypass consensus). SECURITY DEFINER, gated by is_admin.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.admin_decide_tip(
  p_tip_id uuid, p_status public.tip_status, p_reason public.reject_reason default 'admin')
returns void language plpgsql security definer set search_path = '' as $$
declare v_prev public.tip_status; v_prev_reason public.reject_reason;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if p_status not in ('published','rejected') then raise exception 'status must be published or rejected'; end if;

  select status, reject_reason into v_prev, v_prev_reason from public.tips where id = p_tip_id for update;

  -- Reverse a prior terminal settlement so an override flips reputation cleanly.
  if v_prev in ('published','rejected') then
    perform public.apply_reputation(p_tip_id, v_prev, v_prev_reason, -1);
  end if;

  update public.tips
     set status = p_status,
         reject_reason = case when p_status = 'rejected' then p_reason else null end,
         decided_at = now(), decided_by = auth.uid(), updated_at = now()
   where id = p_tip_id;

  perform public.apply_reputation(p_tip_id, p_status,
            case when p_status = 'rejected' then p_reason else null end, 1);

  insert into public.audit_log(actor_id, action, target_tip, detail)
  values (auth.uid(), 'override_'||p_status::text, p_tip_id,
          jsonb_build_object('prev', v_prev, 'reason', p_reason));
end; $$;

create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.profiles set is_suspended = p_suspended where id = p_user;
  insert into public.audit_log(actor_id, action, target_user, detail)
  values (auth.uid(), case when p_suspended then 'suspend_user' else 'unsuspend_user' end,
          p_user, jsonb_build_object('suspended', p_suspended));
end; $$;

create or replace function public.admin_mark_promoted(p_tip_id uuid, p_slug text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.tips set promoted_ref = p_slug, promoted_at = now() where id = p_tip_id;
end; $$;

-- ═══════════════════════════════════════════════════════════════════════════
--  Public attribution view: expose ONLY display_name + tier of authors of
--  PUBLISHED tips (so the app can show "inskickat av …" without leaking PII).
--  Deliberately a SECURITY DEFINER view (security_invoker NOT set) so anon can
--  read this safe, published-only subset even though profiles RLS hides the
--  base table. The WHERE clause is the guard: only authors of published tips.
-- ═══════════════════════════════════════════════════════════════════════════
create view public.public_authors as
  select p.id, p.display_name, p.tier
  from public.profiles p
  where exists (select 1 from public.tips t where t.author_id = p.id and t.status = 'published');
grant select on public.public_authors to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
--  RLS
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.profiles    enable row level security;
alter table public.tips        enable row level security;
alter table public.tip_reviews enable row level security;
alter table public.tip_flags   enable row level security;
alter table public.audit_log   enable row level security;

-- profiles: self + admin read full row; (public attribution is via the view above)
create policy profiles_self_read   on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- no client INSERT (handled by handle_new_user trigger); no client DELETE (cascade from auth.users)

-- tips: cheap anon path is a plain index predicate; privileged branch is separate.
create policy tips_read_published  on public.tips for select using (status = 'published');
create policy tips_read_privileged on public.tips for select
  using (author_id = auth.uid() or public.is_admin() or public.vote_weight() > 0);
create policy tips_insert_self on public.tips for insert
  with check (author_id = auth.uid() and status = 'pending');
create policy tips_author_update on public.tips for update
  using (author_id = auth.uid() and status in ('pending','withdrawn'))
  with check (author_id = auth.uid());
create policy tips_admin_update on public.tips for update
  using (public.is_admin()) with check (public.is_admin());

-- tip_reviews
create policy reviews_read on public.tip_reviews for select using (public.can_see_tip(tip_id));
create policy reviews_insert on public.tip_reviews for insert
  with check (reviewer_id = auth.uid() and public.can_review(tip_id));
create policy reviews_update_own on public.tip_reviews for update
  using (reviewer_id = auth.uid() and public.can_review(tip_id)) with check (reviewer_id = auth.uid());
create policy reviews_delete_own on public.tip_reviews for delete
  using (reviewer_id = auth.uid() and public.can_review(tip_id));

-- tip_flags
create policy flags_insert on public.tip_flags for insert
  with check (reporter_id = auth.uid() and public.is_active_member());
create policy flags_read on public.tip_flags for select
  using (reporter_id = auth.uid() or public.is_admin());

-- audit_log: admins read; nobody writes via the client (only SECURITY DEFINER fns).
create policy audit_read_admin on public.audit_log for select using (public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
--  Storage: 'tips' bucket for photos/audio (public read, auth insert in own folder)
-- ═══════════════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public) values ('tips', 'tips', true)
  on conflict (id) do nothing;

create policy "tips media public read" on storage.objects for select
  using (bucket_id = 'tips');
create policy "tips media owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'tips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tips media owner update" on storage.objects for update to authenticated
  using (bucket_id = 'tips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "tips media owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tips' and (storage.foldername(name))[1] = auth.uid()::text);
