-- ── Admin-inkorg: feedback-tabell + admin-läs-RPC:er för feedback & leads ─────
-- Två inkorgar i admin-dashboarden:
--   1) Förfrågningar & meddelanden  → feedback (ny tabell) + leads (befintlig)
--   2) Platstips & bilder           → tips (finns redan, admin-läsbar)
-- Feedback (Tyck till) sparades tidigare BARA i localStorage — fångas nu i DB så
-- Fredrik kan se den. Läsning sker via SECURITY DEFINER-RPC:er gate:ade på
-- is_admin() (samma mönster som admin_customers / admin_partner_applications) så
-- ingen bred RLS-läspolicy behövs. Idempotent — säker att köra om.

-- ── Feedback-tabell ──────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null default 'message',   -- idea | bug | love | message
  message    text not null,
  email      text,
  lang       text,
  city       text,
  session    text,
  handled    boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.feedback is 'Feedback/meddelanden från appen (Tyck till). Anonym insert, admin-läsning via RPC.';
create index if not exists feedback_created_idx on public.feedback (handled, created_at desc);

alter table public.feedback enable row level security;

-- Vem som helst får skicka feedback. Ingen kan LÄSA via REST (bara admin-RPC nedan).
drop policy if exists "insert feedback" on public.feedback;
create policy "insert feedback" on public.feedback
  for insert to anon, authenticated with check (true);

-- ── Admin-läsning: feedback ──────────────────────────────────────────────────
create or replace function public.admin_feedback()
returns setof public.feedback language sql security definer set search_path = '' as $$
  select * from public.feedback
   where public.is_admin()
   order by handled asc, created_at desc
   limit 500;
$$;

create or replace function public.admin_set_feedback_handled(p_id uuid, p_handled boolean default true)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.feedback set handled = coalesce(p_handled, true) where id = p_id;
end; $$;

-- ── Admin-läsning: leads (befintlig tabell saknar admin-läspolicy) ───────────
create or replace function public.admin_leads()
returns setof public.leads language sql security definer set search_path = '' as $$
  select * from public.leads
   where public.is_admin()
   order by created_at desc
   limit 500;
$$;

grant execute on function public.admin_feedback() to authenticated;
grant execute on function public.admin_set_feedback_handled(uuid, boolean) to authenticated;
grant execute on function public.admin_leads() to authenticated;
