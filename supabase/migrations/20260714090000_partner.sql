-- ═══════════════════════════════════════════════════════════════════════════
--  partner — partner-ansökningar (hembygdsgård/företag) + AI-granskning
--
--  Modell (§ Fredriks beslut):
--    • Partner = företag/förening som vill berätta kort om sig, gärna med en
--      liten story kring sin byggnad. De ANSÖKER; Fredrik godkänner manuellt
--      (sätter profiles.is_partner + partner_org).
--    • Partnerns material går genom samma tips-flöde (pending → publicerat).
--      Fredrik granskar, låter en LLM förbättra/anpassa text (edge function
--      enhance-content), redigerar vid behov och publicerar. Ingen auto-publish.
--
--  Säkerhet: anonym/inloggad får skapa en ansökan; bara ägaren läser sin egen;
--  Fredrik (is_admin) hanterar via SECURITY DEFINER-RPC:er.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.partner_applications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete set null,  -- fylls om inloggad
  org_name       text not null,                       -- "Mjölby hembygdsgård"
  contact_name   text,
  email          text not null,
  city           text,                                -- stad-slug de vill bidra till
  about          text,                                -- kort om företaget/föreningen
  building_story text,                                -- story kring byggnaden
  status         text not null default 'pending',     -- pending | approved | rejected
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists partner_app_status_idx on public.partner_applications (status, created_at desc);

comment on table public.partner_applications is 'Partner-ansökningar (företag/hembygdsgård). Anonym insert, ägar-läsning, admin-hantering.';

alter table public.partner_applications enable row level security;

-- Vem som helst får ansöka. status/decided_at sätts aldrig från klienten.
create or replace function public.guard_partner_app_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.status     := 'pending';
  new.decided_at := null;
  new.created_at := now();
  new.user_id    := auth.uid();          -- null för anonym ansökan
  new.city       := lower(new.city);
  if coalesce(btrim(new.org_name), '') = '' or coalesce(btrim(new.email), '') = '' then
    raise exception 'org_name och email krävs';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_partner_app_insert on public.partner_applications;
create trigger trg_guard_partner_app_insert
  before insert on public.partner_applications
  for each row execute function public.guard_partner_app_insert();

drop policy if exists "insert partner app" on public.partner_applications;
create policy "insert partner app" on public.partner_applications
  for insert to anon, authenticated with check (true);

drop policy if exists "read own partner app" on public.partner_applications;
create policy "read own partner app" on public.partner_applications
  for select to authenticated using (auth.uid() = user_id);

-- ── Admin: lista ansökningar ──────────────────────────────────────────────────
create or replace function public.admin_partner_applications()
returns setof public.partner_applications
language sql stable security definer set search_path = '' as $$
  select * from public.partner_applications
   where public.is_admin()
   order by (status = 'pending') desc, created_at desc;
$$;

-- ── Admin: godkänn en ansökan → gör användaren till partner ───────────────────
create or replace function public.admin_approve_partner(p_app_id uuid, p_org text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_org text;
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  select user_id, coalesce(p_org, org_name) into v_user, v_org
    from public.partner_applications where id = p_app_id;
  if not found then raise exception 'application not found'; end if;
  update public.partner_applications
     set status = 'approved', decided_at = now() where id = p_app_id;
  -- Om ansökaren hade ett konto: markera profilen som partner.
  if v_user is not null then
    update public.profiles set is_partner = true, partner_org = v_org where id = v_user;
  end if;
end; $$;

create or replace function public.admin_reject_partner(p_app_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.partner_applications
     set status = 'rejected', decided_at = now() where id = p_app_id;
end; $$;

-- ── Admin: spara AI-förbättrad/redigerad text på ett öppet tips ────────────────
-- Låter granskaren skriva tillbaka den polerade texten innan publicering, utan
-- att röra betrodda kolumner. Endast pending|needs_info-tips.
create or replace function public.admin_update_tip_content(p_tip_id uuid, p_title text, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admin only'; end if;
  update public.tips
     set title = coalesce(nullif(btrim(p_title), ''), title),
         body  = coalesce(p_body, body),
         updated_at = now()
   where id = p_tip_id and status in ('pending', 'needs_info');
  if not found then raise exception 'tip not found or not open'; end if;
end; $$;
