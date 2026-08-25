-- ═══════════════════════════════════════════════════════════════════════════
--  Bidragsroller — testsvit
--
--  Kör mot en lokal Supabase (supabase start; supabase db reset):
--    docker exec -i supabase_db_stadsvandring psql -U postgres -d postgres \
--      -q -f - < supabase/tests/contributor_roles_test.sql
--
--  Kärnfrågan sviten ställer: går det att TA SIG behörighet i stället för att
--  förtjäna den? Allt sker i en transaktion som rullas tillbaka.
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
begin;

alter table public.profiles disable trigger trg_profiles_protect;
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data, aud, role)
values
 ('11111111-1111-1111-1111-111111111111','flit@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated'),
 ('22222222-2222-2222-2222-222222222222','annan@test.se','x',now(),now(),now(),'{}','{}','authenticated','authenticated');
update public.profiles set trust_active_at = now() - interval '1 day';
alter table public.profiles enable trigger trg_profiles_protect;

\echo '--- 1. Avsikt och presentation är användarens egna att sätta ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.profiles
   set intent = 'contribute',
       bio = 'Uppvuxen i Mjölby, fotograferar kvarnbyn sedan 90-talet och vill att det ska finnas kvar.',
       home_city = 'mjolby'
 where id = '11111111-1111-1111-1111-111111111111';
select case when intent = 'contribute' and length(bio) > 40 and home_city = 'mjolby'
            then 'OK: avsikt, bio och hemstad sparade'
            else 'FEL: sparades inte' end as r
  from public.profiles where id = '11111111-1111-1111-1111-111111111111';

\echo '--- 2. Att välja "bidra" ger INGEN behörighet ---'
select case when public.is_city_moderator('mjolby') = false
            then 'OK: intent ger inte moderatorskap'
            else 'FEL: valet gav behörighet' end as r;

\echo '--- 3. Man kan inte utnämna sig själv ---'
do $$ begin
  insert into public.city_moderators (profile_id, city)
  values ('11111111-1111-1111-1111-111111111111','mjolby');
  raise exception 'FEL: självutnämning tilläts';
exception when insufficient_privilege then raise notice 'OK: RLS stoppar självutnämning';
end $$;
reset role;
-- Viktigt: nolla claimen också. Bara "reset role" räcker inte — auth.uid() skulle
-- fortfarande peka på användaren, och tips-vakten vägrar då sätta status.
set local request.jwt.claims = '';

\echo '--- 4. Behörighet växer fram ur publicerade bidrag ---'
-- Tips läggs in SOM ANVÄNDAREN (insert-vakten kräver en aktiv medlem) och
-- publiceras sedan av systemet, precis som konsensusmotorn gör.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.tips (kind, city, stop_ref, title, body)
  select 'memory','mjolby','plats-'||g,'Minne '||g,'text' from generate_series(1,4) g;
reset role; set local request.jwt.claims = '';
update public.tips set status = 'published'
 where author_id = '11111111-1111-1111-1111-111111111111';
select case when public.is_city_moderator('mjolby','11111111-1111-1111-1111-111111111111') = false
            then 'OK: 4 bidrag räcker inte'
            else 'FEL: fick behörighet för tidigt' end as r;

-- Det femte tippar över tröskeln.
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.tips (kind, city, stop_ref, title, body) values ('memory','mjolby','plats-5','Minne 5','text');
reset role; set local request.jwt.claims = '';
update public.tips set status = 'published' where status = 'pending'
   and author_id = '11111111-1111-1111-1111-111111111111';
select case when public.is_city_moderator('mjolby','11111111-1111-1111-1111-111111111111')
            then 'OK: 5 bidrag ger moderatorskap i Mjölby'
            else 'FEL: fick inte behörighet vid tröskeln' end as r;

\echo '--- 5. Behörigheten gäller BARA den staden ---'
select case when public.is_city_moderator('goteborg','11111111-1111-1111-1111-111111111111') = false
            then 'OK: ingen makt i Göteborg'
            else 'FEL: behörigheten läckte till annan stad' end as r;

\echo '--- 6. Utan presentation, ingen behörighet ---'
alter table public.profiles disable trigger trg_profiles_protect;
update public.profiles set bio = null where id = '22222222-2222-2222-2222-222222222222';
alter table public.profiles enable trigger trg_profiles_protect;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.tips (kind, city, stop_ref, title, body)
  select 'memory','mjolby','b-'||g,'Bidrag '||g,'text' from generate_series(1,5) g;
reset role; set local request.jwt.claims = '';
update public.tips set status = 'published'
 where author_id = '22222222-2222-2222-2222-222222222222';
select case when public.is_city_moderator('mjolby','22222222-2222-2222-2222-222222222222') = false
            then 'OK: 5 bidrag utan presentation ger inget'
            else 'FEL: behörighet utan att stå för något' end as r;

\echo '--- 7. Presentationen räknas retroaktivt ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update public.profiles set bio = 'Bibliotekarie i Mjölby, gräver i lokalhistoria på fritiden och rättar gärna årtal.'
 where id = '22222222-2222-2222-2222-222222222222';
reset role;
set local request.jwt.claims = '';
select case when public.is_city_moderator('mjolby','22222222-2222-2222-2222-222222222222')
            then 'OK: bio i efterhand ger behörigheten direkt'
            else 'FEL: fick vänta på nästa publicering' end as r;

\echo '--- 8. Moderatorns döljning FASTNAR (vaktens fälla) ---'
-- Kommentaren skrivs av användaren själv; insert-vakten kräver aktiv medlem.
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.place_comments (city, stop_ref, body)
  values ('mjolby','mjolby-kyrka','olämplig text');
reset role; set local request.jwt.claims = '';
select id as cid from public.place_comments limit 1 \gset
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.place_comments set hidden = true where id = :'cid';
reset role;
set local request.jwt.claims = '';
select case when hidden and hidden_by_admin
            then 'OK: moderatorn dolde, och beslutet är märkt'
            else 'FEL: hidden=' || hidden::text || ' by_admin=' || hidden_by_admin::text end as r
  from public.place_comments where id = :'cid';

\echo '--- 9. Någon utan mandat kan INTE dölja ---'
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.place_comments (city, stop_ref, body) values ('goteborg','x','text i göteborg');
reset role; set local request.jwt.claims = '';
select id as gid from public.place_comments where city = 'goteborg' \gset
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
update public.place_comments set hidden = true where id = :'gid';
reset role;
set local request.jwt.claims = '';
select case when not hidden then 'OK: döljning i fel stad slog inte igenom'
            else 'FEL: dolde i en stad hen inte modererar' end as r
  from public.place_comments where id = :'gid';

\echo '--- 10. Presentationen syns i public_authors ---'
set local request.jwt.claims = '';
set local role anon;
select case when exists (select 1 from public.public_authors
                          where id = '11111111-1111-1111-1111-111111111111' and bio is not null)
            then 'OK: bio läsbar via public_authors'
            else 'FEL: bio syns inte' end as r;
reset role;

rollback;
