-- ═══════════════════════════════════════════════════════════════════════════
--  "Lägg till plats" — contributor flow hardening
--
--  1. Drop the 24h new-account cooldown so someone who signs up specifically to
--     add a place can submit immediately (spam is still gated by admin approval).
--  2. tips.consent — author must attest accuracy + grant usage rights; required
--     for kind='place' (enforced server-side, not just in the UI).
--  3. tips.info_request + status 'needs_info' + admin_request_info() — the admin
--     can return a submission for completion; the author edits and resubmits,
--     which clears the request and moves it back to 'pending'.
--
--  Depends on 20260616090000 (which adds the 'needs_info' enum value in its own
--  transaction — required before this migration can reference it).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Remove the new-account cooldown ───────────────────────────────────────
-- is_active_member() still requires now() >= trust_active_at; defaulting that to
-- now() makes new accounts active immediately. Keeping the column (not dropping
-- the check) means a future migration can re-introduce a cooldown by changing
-- this default alone.
alter table public.profiles alter column trust_active_at set default now();
update public.profiles set trust_active_at = now() where trust_active_at > now();

-- ── 2. New columns ───────────────────────────────────────────────────────────
alter table public.tips add column if not exists consent      boolean not null default false;  -- author attests accuracy + usage rights
alter table public.tips add column if not exists info_request text;                            -- admin's note when status='needs_info'

-- ── 3. Insert guard: force trusted defaults + require consent for places ──────
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
  new.info_request  := null;
  new.author_id     := auth.uid();
  new.city          := lower(new.city);
  new.created_at    := now();
  new.updated_at    := now();

  if not public.is_active_member() then
    raise exception 'account is suspended or still in its new-account cooldown';
  end if;

  -- A place pin carries a name, coordinates, often a photo — it gets published as
  -- map content, so the author must explicitly attest accuracy + usage rights.
  if new.kind = 'place' and coalesce(new.consent, false) = false then
    raise exception 'place submissions require consent (accuracy + usage rights)';
  end if;

  select count(*) into v_pending
    from public.tips where author_id = auth.uid() and status = 'pending';
  if v_pending >= public.cfg_max_pending() then
    raise exception 'too many pending tips (max %)', public.cfg_max_pending();
  end if;
  return new;
end; $$;

-- ── 4. Update guard: allow author to edit + resubmit a returned tip ───────────
-- An author may move pending|needs_info -> pending|withdrawn and edit
-- title/body/media/coords/consent. Resubmitting a returned tip (needs_info ->
-- pending) clears the admin's info_request; otherwise info_request is pinned so
-- the author can't tamper with it. Trusted columns stay pinned as before.
create or replace function public.guard_tip_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or public.is_admin() or auth.uid() <> old.author_id then
    return new;  -- admin / system (SECURITY DEFINER) paths are trusted
  end if;
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
  if old.status = 'needs_info' and new.status = 'pending' then
    new.info_request := null;             -- request fulfilled on resubmit
  else
    new.info_request := old.info_request; -- author may not set/clear it otherwise
  end if;
  new.updated_at    := now();
  return new;
end; $$;

-- ── 5. RLS: author may update their own returned (needs_info) tips ────────────
drop policy if exists tips_author_update on public.tips;
create policy tips_author_update on public.tips for update
  using (author_id = auth.uid() and status in ('pending','withdrawn','needs_info'))
  with check (author_id = auth.uid());

-- ── 6. Admin RPC: return a tip for completion ────────────────────────────────
create or replace function public.admin_request_info(p_tip_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  if coalesce(btrim(p_note), '') = '' then raise exception 'a note is required'; end if;
  update public.tips
     set status        = 'needs_info',
         info_request  = p_note,
         reject_reason = null,
         decided_at    = null,
         decided_by    = auth.uid(),
         updated_at    = now()
   where id = p_tip_id and status in ('pending','needs_info');
  if not found then raise exception 'tip not found or not open'; end if;
  insert into public.audit_log(actor_id, action, target_tip, detail)
  values (auth.uid(), 'request_info', p_tip_id, jsonb_build_object('note', p_note));
end; $$;
