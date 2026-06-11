-- ═══════════════════════════════════════════════════════════════════════════
--  Stadsvandring — nattligt underhåll ("anti-clogging") + säkerhetshärdning
--
--  Syfte:
--   1. Härda 'tips'-Storage-bucketen (MIME- + storleksgräns) — säkerhet & abuse.
--   2. En idempotent städfunktion som rensar ackumulerat skräp i datan.
--   3. En observerbar körningslogg (maintenance_runs).
--   4. Schemaläggning varje natt via pg_cron (om tillgängligt).
--
--  Allt körs som ägaren (SECURITY DEFINER där det rör auth/storage). Funktionen
--  är skriven så att den kan köras manuellt: `select public.nightly_maintenance();`
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Storage-härdning ──────────────────────────────────────────────────────
-- Begränsa vad som får ligga i den publikt läsbara 'tips'-bucketen. Utan detta
-- kan en inloggad användare ladda upp godtyckliga filer (HTML för phishing,
-- stora filer för att blåsa upp lagringen) i sin egen mapp.
update storage.buckets
   set file_size_limit   = 5 * 1024 * 1024,            -- 5 MB / fil
       allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/gif',
         'audio/mpeg','audio/mp4','audio/webm','audio/ogg'
       ]
 where id = 'tips';

-- ── 1b. Profil-härdning: server-side längdtak på display_name ────────────────
-- Klienten kapar till 40 tecken, men en direkt API-anropare kunde sätta godtyckligt
-- långt namn (escapas vid rendering, så ej XSS — men abuse/UI-bloat). Sätt ett tak
-- i databasen. NOT VALID → påverkar inte ev. befintliga rader, gäller nya/ändrade.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'display_name_len') then
    alter table public.profiles
      add constraint display_name_len check (char_length(display_name) <= 80) not valid;
  end if;
end $$;

-- ── 2. Körningslogg ──────────────────────────────────────────────────────────
create table if not exists public.maintenance_runs (
  id      bigint generated always as identity primary key,
  ran_at  timestamptz not null default now(),
  summary jsonb       not null
);
alter table public.maintenance_runs enable row level security;
-- Endast admins får läsa loggen; ingen klient skriver (bara funktionen nedan).
drop policy if exists maintenance_runs_read_admin on public.maintenance_runs;
create policy maintenance_runs_read_admin on public.maintenance_runs
  for select using (public.is_admin());

-- ── Tunables för städning (single source of truth, samma mönster som cfg_*) ──
create or replace function public.cfg_stale_pending_days() returns int language sql immutable as $$ select 30 $$;
create or replace function public.cfg_terminal_keep_days() returns int language sql immutable as $$ select 90 $$;
create or replace function public.cfg_flag_keep_days()     returns int language sql immutable as $$ select 90 $$;
create or replace function public.cfg_audit_keep_days()    returns int language sql immutable as $$ select 365 $$;
create or replace function public.cfg_orphan_grace_days()  returns int language sql immutable as $$ select 7 $$;

-- ── 3. Nattlig städfunktion ──────────────────────────────────────────────────
-- Idempotent och säker att köra hur ofta som helst. Returnerar (och loggar) en
-- jsonb-sammanfattning av vad som rensades.
create or replace function public.nightly_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expired_pending int := 0;
  v_deleted_terminal int := 0;
  v_deleted_flags    int := 0;
  v_trimmed_audit    int := 0;
  v_orphan_media     int := 0;
  v_unconfirmed      int := 0;
  v_summary jsonb;
begin
  -- (a) Övergivna pending-tips: äldre än N dagar och har inte fått tillräckligt
  --     med granskare för ett konsensusbeslut → markera 'withdrawn'. Reputations-
  --     neutralt (apply_reputation körs ej) och frigör författarens pending-kvot.
  with done as (
    update public.tips
       set status = 'withdrawn', updated_at = now()
     where status = 'pending'
       and created_at < now() - (public.cfg_stale_pending_days() || ' days')::interval
       and review_count < public.cfg_min_reviewers()
    returning 1)
  select count(*) into v_expired_pending from done;

  -- (b) Gamla terminala icke-publicerade tips (rejected/withdrawn) → radera.
  --     Publicerade tips behålls för alltid. Cascade tar reviews + flags.
  with done as (
    delete from public.tips
     where status in ('rejected','withdrawn')
       and updated_at < now() - (public.cfg_terminal_keep_days() || ' days')::interval
    returning 1)
  select count(*) into v_deleted_terminal from done;

  -- (c) Avklarade flaggor (resolved) äldre än N dagar → radera.
  with done as (
    delete from public.tip_flags
     where resolved = true
       and created_at < now() - (public.cfg_flag_keep_days() || ' days')::interval
    returning 1)
  select count(*) into v_deleted_flags from done;

  -- (d) Trimma audit_log (behåll ett år).
  with done as (
    delete from public.audit_log
     where created_at < now() - (public.cfg_audit_keep_days() || ' days')::interval
    returning 1)
  select count(*) into v_trimmed_audit from done;

  -- (e) Övergivna Storage-objekt: filer i 'tips'-bucketen som inget tip pekar på
  --     (uppladdning avbröts, eller tipset raderades) och som passerat grace.
  with done as (
    delete from storage.objects o
     where o.bucket_id = 'tips'
       and o.created_at < now() - (public.cfg_orphan_grace_days() || ' days')::interval
       and not exists (
         select 1 from public.tips t
          where t.media_url is not null and t.media_url like '%' || o.name)
    returning 1)
  select count(*) into v_orphan_media from done;

  -- (f) Obekräftade konton: RÄKNA bara (radera inte härifrån — att städa
  --     auth.users/identities/sessions görs säkrast via Supabase Admin-API:t,
  --     annars riskerar man orphan-rader i auth-schemat). Siffran flaggar för
  --     admin att rensa vid behov.
  select count(*) into v_unconfirmed
    from auth.users
   where email_confirmed_at is null
     and created_at < now() - (public.cfg_orphan_grace_days() || ' days')::interval;

  v_summary := jsonb_build_object(
    'expired_pending',  v_expired_pending,
    'deleted_terminal', v_deleted_terminal,
    'deleted_flags',    v_deleted_flags,
    'trimmed_audit',    v_trimmed_audit,
    'orphan_media',     v_orphan_media,
    'unconfirmed_stale', v_unconfirmed
  );

  insert into public.maintenance_runs(summary) values (v_summary);
  return v_summary;
end; $$;

-- Bara admins (och servern) får anropa den manuellt via RPC.
revoke all on function public.nightly_maintenance() from public, anon, authenticated;

-- ── 4. Schemaläggning (pg_cron) ──────────────────────────────────────────────
-- pg_cron måste vara aktiverat (Supabase: Dashboard → Database → Extensions →
-- pg_cron). Vi wrappar i en DO-block med EXCEPTION så att migrationen ändå går
-- igenom lokalt/i miljöer där pg_cron inte är tillgängligt.
do $$
begin
  create extension if not exists pg_cron;
  -- Idempotent: ta bort ev. tidigare jobb innan vi (om)schemalägger.
  perform cron.unschedule('nightly-maintenance')
    where exists (select 1 from cron.job where jobname = 'nightly-maintenance');
  perform cron.schedule('nightly-maintenance', '0 3 * * *',
                        'select public.nightly_maintenance();');
  raise notice 'pg_cron: nattligt underhåll schemalagt 03:00.';
exception when others then
  raise notice 'pg_cron ej tillgängligt (%). Aktivera extensionen och kör om '
               'cron.schedule-raden, eller anropa public.nightly_maintenance() '
               'från en extern scheduler.', sqlerrm;
end $$;
