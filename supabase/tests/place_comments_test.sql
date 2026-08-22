-- ═══════════════════════════════════════════════════════════════════════════
--  place_comments — testsvit
--
--  Kör mot en lokal Supabase (supabase start; supabase db reset):
--    docker exec -i supabase_db_stadsvandring psql -U postgres -d postgres \
--      -q -f - < supabase/tests/place_comments_test.sql
--
--  Allt sker i en transaktion som rullas tillbaka — databasen lämnas orörd.
--  Sviten hittade två riktiga buggar när den skrevs:
--    • hidden_reason sattes till 'admin', ett värde som inte finns i
--      flag_reason-enumet → egen kolumn hidden_by_admin i stället.
--    • update-vakten skrev tillbaka flag_count/hidden när rapport-synken
--      försökte sätta dem, så auto-döljningen var tyst verkningslös → samma
--      GUC-undantag som app.reputation_write använder i community_tips.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

-- Tre användare: författare, två oberoende rapportörer.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
values
 ('11111111-1111-1111-1111-111111111111','a@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated'),
 ('22222222-2222-2222-2222-222222222222','b@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated'),
 ('33333333-3333-3333-3333-333333333333','c@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated'),
 ('44444444-4444-4444-4444-444444444444','d@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated');

-- profiles har en kolumnvakt som (med rätta) blockerar direkta ändringar av
-- betrodda fält. För testuppsättningen stängs den av inom transaktionen.
alter table public.profiles disable trigger trg_profiles_protect;
-- handle_new_user-triggern skapar profiler. Släpp cooldown för testet.
update public.profiles set trust_active_at = now() - interval '1 day';

\echo '--- 1. Nykomlings-cooldown blockerar ---'
update public.profiles set trust_active_at = now() + interval '1 day' where id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin
  insert into public.place_comments (city, stop_ref, body) values ('mjolby','x','hej');
  raise exception 'FEL: cooldown blockerade inte';
exception when others then
  if position('cooldown' in sqlerrm) > 0 then raise notice 'OK: cooldown blockerar (%)', sqlerrm;
  else raise; end if;
end $$;
reset role;
update public.profiles set trust_active_at = now() - interval '1 day' where id = '11111111-1111-1111-1111-111111111111';

\echo '--- 2. Klienten kan inte ljuga om author_id/hidden ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.place_comments (author_id, city, stop_ref, body, hidden)
  values ('22222222-2222-2222-2222-222222222222','MJOLBY','mjolby-kyrka','Min farmor gifte sig här 1948.', true);
reset role;
select case when author_id = '11111111-1111-1111-1111-111111111111' and hidden = false and city = 'mjolby'
            then 'OK: author_id, hidden och city sattes av vakten'
            else 'FEL: vakten släppte igenom klientens värden' end as r
  from public.place_comments limit 1;

\echo '--- 3. Författaren får ändra texten, men inte flytta eller avdölja ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.place_comments set body = 'Rättat: 1949.', stop_ref = 'nagon-annan-plats', hidden = false;
reset role;
select case when body = 'Rättat: 1949.' and stop_ref = 'mjolby-kyrka' and edited
            then 'OK: texten ändrad, stop_ref låst, edited satt'
            else 'FEL: ' || body || ' / ' || stop_ref || ' / ' || edited::text end as r
  from public.place_comments limit 1;

\echo '--- 4. Tre oberoende rapporter döljer kommentaren ---'
select id as cid from public.place_comments limit 1 \gset
insert into public.comment_flags (comment_id, reporter_id, reason) values
 (:'cid','22222222-2222-2222-2222-222222222222','abuse'),
 (:'cid','33333333-3333-3333-3333-333333333333','abuse');
select case when hidden = false and flag_count = 2 then 'OK: 2 rapporter döljer inte än'
            else 'FEL: hidden=' || hidden::text || ' flag_count=' || flag_count end as r
  from public.place_comments where id = :'cid';
insert into public.comment_flags (comment_id, reporter_id, reason) values
 (:'cid','44444444-4444-4444-4444-444444444444','abuse');
select case when hidden and flag_count = 3 and hidden_reason = 'abuse' then 'OK: 3 rapporter döljer'
            else 'FEL: hidden=' || hidden::text || ' flag_count=' || flag_count end as r
  from public.place_comments where id = :'cid';

\echo '--- 5. Samma person kan inte rapportera två gånger ---'
do $$ begin
  insert into public.comment_flags (comment_id, reporter_id, reason)
    select id, '22222222-2222-2222-2222-222222222222','spam' from public.place_comments limit 1;
  raise exception 'FEL: dubbelrapport tilläts';
exception when unique_violation then raise notice 'OK: dubbelrapport avvisad';
end $$;

\echo '--- 6b. Författaren ser sin egen dolda kommentar ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select case when count(*) = 1 then 'OK: författaren ser sin dolda kommentar'
            else 'FEL: författaren ser ' || count(*) end as r from public.place_comments;
reset role;

\echo '--- 6. Anon ser inte dolda kommentarer ---'
-- Viktigt: nolla JWT-claimen också. Bara "set role anon" räcker inte — claimen
-- från föregående test ligger kvar och auth.uid() skulle fortfarande peka på
-- författaren, som ju SKA se sin egen dolda kommentar.
set local request.jwt.claims = '';
set local role anon;
select case when count(*) = 0 then 'OK: anon ser inga dolda' else 'FEL: anon ser ' || count(*) end as r
  from public.place_comments;
reset role;

\echo '--- 7. Dygnstakt: 30 kommentarer går, den 31:a stoppas ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.place_comments (city, stop_ref, body)
  select 'mjolby','p'||g, 'kommentar '||g from generate_series(1,29) g;
insert into public.place_comments (city, stop_ref, body) values ('mjolby','p30','nummer 30');
do $$ begin
  insert into public.place_comments (city, stop_ref, body) values ('mjolby','p31','nummer 31');
  raise exception 'FEL: takten stoppade inte';
exception when others then
  if position('too many comments' in sqlerrm) > 0 then raise notice 'OK: takten stoppar vid 30';
  else raise; end if;
end $$;
reset role;

\echo '--- 8. public_authors tar med rena kommentatorer ---'
set local request.jwt.claims = '';
set local role anon;
select case when exists (select 1 from public.public_authors where id = '33333333-3333-3333-3333-333333333333')
            then 'OK: kommentator syns i public_authors'
            else 'FEL: kommentator saknas → visas som anonym' end as r;
reset role;

rollback;
