-- ═══════════════════════════════════════════════════════════════════════════
--  routes — testsvit
--
--  Kör mot en lokal Supabase (supabase start; supabase db reset):
--    docker exec -i supabase_db_stadsvandring psql -U postgres -d postgres \
--      -q -f - < supabase/tests/routes_test.sql
--
--  Allt sker i en transaktion som rullas tillbaka.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

alter table public.profiles disable trigger trg_profiles_protect;
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
values
 ('11111111-1111-1111-1111-111111111111','a@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated'),
 ('22222222-2222-2222-2222-222222222222','b@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated');
update public.profiles set trust_active_at = now() - interval '1 day';

\echo '--- 1. En rutt måste ha minst 2 stopp ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin
  insert into public.routes (city, title, stops) values ('mjolby','Ensam','["a"]'::jsonb);
  raise exception 'FEL: en rutt med ett stopp tilläts';
exception when check_violation then raise notice 'OK: minst 2 stopp krävs';
end $$;

\echo '--- 2. Klienten kan inte ljuga om författare, hidden eller walk_count ---'
insert into public.routes (author_id, city, title, mode, stops, hidden, walk_count)
  values ('22222222-2222-2222-2222-222222222222','MJOLBY','Löprunda genom kvarnbyn','run',
          '["mjolby-kyrka","svartan","stora-torget"]'::jsonb, true, 999);
reset role;
select case when author_id = '11111111-1111-1111-1111-111111111111'
             and city = 'mjolby' and hidden = false and walk_count = 0
            then 'OK: vakten satte författare, stad, hidden och räknare'
            else 'FEL: klientens värden slank igenom' end as r
  from public.routes limit 1;

\echo '--- 3. Författaren får redigera texten men inte avdölja eller byta ägare ---'
select id as rid from public.routes limit 1 \gset
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.routes set title = 'Löprunda genom kvarnbyn (5 km)',
                         author_id = '22222222-2222-2222-2222-222222222222',
                         walk_count = 500
  where id = :'rid';
reset role;
select case when title like '%5 km%' and author_id = '11111111-1111-1111-1111-111111111111' and walk_count = 0
            then 'OK: titel ändrad, ägare och räknare låsta'
            else 'FEL: ' || title || ' / ' || author_id::text || ' / ' || walk_count end as r
  from public.routes where id = :'rid';

\echo '--- 4. walk_count räknar distinkta vandrare, inte antal rundor ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.route_walks (route_id, seconds, stops_done) values (:'rid', 1520, 3);
insert into public.route_walks (route_id, seconds, stops_done) values (:'rid', 1410, 3);
reset role;
select case when walk_count = 1 then 'OK: två rundor av samma person = 1 vandrare'
            else 'FEL: walk_count=' || walk_count end as r from public.routes where id = :'rid';
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.route_walks (route_id, seconds, stops_done) values (:'rid', 1800, 3);
reset role;
select case when walk_count = 2 then 'OK: en till vandrare ger 2'
            else 'FEL: walk_count=' || walk_count end as r from public.routes where id = :'rid';

\echo '--- 5. Privat rutt syns inte för andra, men för ägaren ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.routes set is_public = false where id = :'rid';
select case when count(*) = 1 then 'OK: ägaren ser sin privata rutt' else 'FEL: ägaren ser ' || count(*) end as r
  from public.routes where id = :'rid';
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select case when count(*) = 0 then 'OK: någon annan ser den inte' else 'FEL: annan ser ' || count(*) end as r
  from public.routes where id = :'rid';
set local request.jwt.claims = '';
set local role anon;
select case when count(*) = 0 then 'OK: anon ser den inte' else 'FEL: anon ser ' || count(*) end as r
  from public.routes where id = :'rid';
reset role;

\echo '--- 6. Publik rutt är öppen för utloggade (delad länk ska funka utan konto) ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.routes set is_public = true where id = :'rid';
reset role;
set local request.jwt.claims = '';
set local role anon;
select case when count(*) = 1 then 'OK: anon kan öppna en delad rutt' else 'FEL: anon ser ' || count(*) end as r
  from public.routes where id = :'rid';
reset role;

\echo '--- 7. public_authors tar med den som bara gjort en rutt ---'
set local request.jwt.claims = '';
set local role anon;
select case when exists (select 1 from public.public_authors where id = '11111111-1111-1111-1111-111111111111')
            then 'OK: ruttmakaren syns i public_authors'
            else 'FEL: ruttmakaren saknas → visas som anonym' end as r;
reset role;

\echo '--- 8. Dygnstakt: 20 rutter går, den 21:a stoppas ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.routes (city, title, stops)
  select 'mjolby', 'Rutt '||g, '["a","b"]'::jsonb from generate_series(1,20) g;
do $$ begin
  insert into public.routes (city, title, stops) values ('mjolby','Nummer 21','["a","b"]'::jsonb);
  raise exception 'FEL: takten stoppade inte';
exception when others then
  if position('too many routes' in sqlerrm) > 0 then raise notice 'OK: takten stoppar vid 20';
  else raise; end if;
end $$;
reset role;

rollback;
