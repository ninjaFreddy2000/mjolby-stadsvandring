-- Verifierar RLS, konsensus-motorn och rykte-systemet genom att impersonera
-- riktiga användare via request.jwt.claims (så auth.uid() returnerar rätt id).
-- Körs som superuser via psql; \set ON_ERROR_STOP gör att vilket fel som helst fäller testet.
\set ON_ERROR_STOP on
\set QUIET on
set client_min_messages = warning;

-- ── Hjälpare för att "logga in" som en given användare i en transaktion ──
create or replace function pg_temp.act_as(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', uid::text, 'role','authenticated')::text, true);
end; $$;
create or replace function pg_temp.act_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role','anon')::text, true);
end; $$;
create or replace function pg_temp.reset_role() returns void language plpgsql as $$
begin perform set_config('role','postgres', true); perform set_config('request.jwt.claims','', true); end; $$;

-- ── Seeda fyra användare (auth.users-trigger skapar profiler) ──
\set A '11111111-1111-1111-1111-111111111111'
\set R1 '22222222-2222-2222-2222-222222222222'
\set R2 '33333333-3333-3333-3333-333333333333'
\set ADM '44444444-4444-4444-4444-444444444444'

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
 (:'A',  '00000000-0000-0000-0000-000000000000','authenticated','authenticated','author@test.se',  '{"name":"Författaren"}', now(), now()),
 (:'R1', '00000000-0000-0000-0000-000000000000','authenticated','authenticated','rev1@test.se',    '{"name":"Granskare 1"}', now(), now()),
 (:'R2', '00000000-0000-0000-0000-000000000000','authenticated','authenticated','rev2@test.se',    '{"name":"Granskare 2"}', now(), now()),
 (:'ADM','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@test.se',   '{"name":"Kommunadmin"}', now(), now());

-- Bootstrap (service-kontext, auth.uid()=null): häv cooldown, gör reviewers + admin.
-- Nivåer backas av poäng så de är STABILA under recompute_tier (>=50 p = granskare,
-- >=200 p = ortskannare) — annars degraderas en manuell nivå vid första avräkningen.
update public.profiles set trust_active_at = now() - interval '1 day';
update public.profiles set tier = 'granskare',   reputation = 60  where id = :'R1';
update public.profiles set tier = 'ortskannare', reputation = 210 where id = :'R2';
update public.profiles set is_admin = true where id = :'ADM';

do $$ begin
  assert (select count(*) from public.profiles) = 4, 'should be 4 profiles';
  assert (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Författaren', 'new-user trigger should copy name';
end $$;

-- ════════ TEST 1: en tipsare kan lämna tips; status tvingas pending ════════
begin;
  select pg_temp.act_as(:'A');
  insert into public.tips (id, kind, city, stop_ref, title, status, author_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001','memory','MJOLBY','mjolby-kyrka','Klockan från 1881','published', :'A');
  -- guard ska ha tvingat status=pending och city lowercased trots payload
  do $$ begin
    assert (select status from public.tips where id='aaaaaaaa-0000-0000-0000-000000000001') = 'pending', 'status must be forced to pending';
    assert (select city   from public.tips where id='aaaaaaaa-0000-0000-0000-000000000001') = 'mjolby',  'city must be lowercased';
  end $$;
commit;

-- ════════ TEST 2: en tipsare (vikt 0) får INTE rösta ════════
begin;
  select pg_temp.act_as(:'A');   -- author is plain tipsare here
  do $$ declare ok bool := false; begin
    begin
      insert into public.tip_reviews (tip_id, reviewer_id, vote) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111','approve');
    exception when others then ok := true; end;
    assert ok, 'a tipsare must not be able to vote';
  end $$;
rollback;

-- ════════ TEST 3: man får inte rösta på sitt EGET tips ════════
-- (gör A till granskare tillfälligt och låt hen rösta på sitt eget → ska faila)
begin;
  select pg_temp.reset_role();
  update public.profiles set tier='granskare' where id=:'A';
  select pg_temp.act_as(:'A');
  do $$ declare ok bool := false; begin
    begin insert into public.tip_reviews (tip_id, reviewer_id, vote) values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111','approve');
    exception when others then ok := true; end;
    assert ok, 'must not review own tip';
  end $$;
rollback;   -- ångra tier-ändringen

-- ════════ TEST 4: konsensus — granskare + ortskännare → publicering + rykte ════════
begin;
  select pg_temp.act_as(:'R1');   -- granskare, vikt 1
  insert into public.tip_reviews (tip_id, reviewer_id, vote) values ('aaaaaaaa-0000-0000-0000-000000000001', :'R1','approve');
  select pg_temp.reset_role();
  -- 1 granskare (count 1 < min 2) → fortf. pending oavsett poäng
  do $$ begin assert (select status from public.tips where id='aaaaaaaa-0000-0000-0000-000000000001')='pending', 'one reviewer should not be enough'; end $$;

  select pg_temp.act_as(:'R2');   -- ortskännare, vikt 2 → net 1+2=3, 2 granskare → publish
  insert into public.tip_reviews (tip_id, reviewer_id, vote) values ('aaaaaaaa-0000-0000-0000-000000000001', :'R2','approve');
  select pg_temp.reset_role();
  do $$ begin
    assert (select status from public.tips where id='aaaaaaaa-0000-0000-0000-000000000001')='published', 'net 3 with 2 reviewers → published';
    assert (select reputation from public.profiles where id='11111111-1111-1111-1111-111111111111')=10, 'author should gain +10';
    assert (select published_count from public.profiles where id='11111111-1111-1111-1111-111111111111')=1, 'author published_count +1';
    assert (select reputation from public.profiles where id='22222222-2222-2222-2222-222222222222')=62, 'R1 agreed → 60+2=62';
    assert (select reputation from public.profiles where id='33333333-3333-3333-3333-333333333333')=212, 'R2 agreed → 210+2=212';
  end $$;
commit;

-- ════════ TEST 5: anon ser publicerat men inte pending ════════
begin;
  select pg_temp.act_as(:'A');   -- nytt pending-tips
  insert into public.tips (id, kind, city, stop_ref, title, author_id)
  values ('aaaaaaaa-0000-0000-0000-000000000002','memory','mjolby','mjolby-kyrka','Hemligt utkast', :'A');
  select pg_temp.act_anon();
  do $$ begin
    assert (select count(*) from public.tips where id='aaaaaaaa-0000-0000-0000-000000000001')=1, 'anon sees published';
    assert (select count(*) from public.tips where id='aaaaaaaa-0000-0000-0000-000000000002')=0, 'anon must NOT see pending';
  end $$;
  select pg_temp.reset_role();
rollback;

-- ════════ TEST 6: admin-override flippar rykte korrekt (ingen dubbelräkning) ════════
-- Publicera ett tips via konsensus, låt sedan admin avslå det som spam.
begin;
  select pg_temp.reset_role();
  -- baslinje-rykten
  select pg_temp.act_as(:'A');
  insert into public.tips (id, kind, city, stop_ref, title, author_id)
  values ('aaaaaaaa-0000-0000-0000-000000000003','memory','mjolby','mjolby-kyrka','Tveksam uppgift', :'A');
  select pg_temp.act_as(:'R1');
  insert into public.tip_reviews (tip_id, reviewer_id, vote) values ('aaaaaaaa-0000-0000-0000-000000000003', :'R1','approve');
  select pg_temp.act_as(:'R2');  -- ortskannare vikt 2 → net 1+2=3 → publish
  insert into public.tip_reviews (tip_id, reviewer_id, vote) values ('aaaaaaaa-0000-0000-0000-000000000003', :'R2','approve');
  select pg_temp.reset_role();
  do $$ begin assert (select status from public.tips where id='aaaaaaaa-0000-0000-0000-000000000003')='published', 'consensus publish'; end $$;
commit;

-- snapshot rykte före override
\set qa 'select reputation from public.profiles where id=''11111111-1111-1111-1111-111111111111'''
begin;
  select pg_temp.act_as(:'ADM');
  select public.admin_decide_tip('aaaaaaaa-0000-0000-0000-000000000003','rejected','spam');
  select pg_temp.reset_role();
  do $$ declare rep_a int; begin
    assert (select status from public.tips where id='aaaaaaaa-0000-0000-0000-000000000003')='rejected', 'admin override → rejected';
    -- författaren: hade +10 (test4) +10 (test6 publish) = 20; override drar tillbaka +10 och lägger -5 (spam) → 20-10-5=5
    select reputation into rep_a from public.profiles where id='11111111-1111-1111-1111-111111111111';
    assert rep_a = 5, format('author rep after override should be 5, was %s', rep_a);
    -- audit-logg skrevs
    assert (select count(*) from public.audit_log where action='override_rejected')=1, 'audit row written';
  end $$;
commit;

-- ════════ TEST 7: profil-kolumnskydd — slutanvändare kan ej självbefordra ════════
begin;
  select pg_temp.act_as(:'A');
  do $$ declare ok bool := false; begin
    begin update public.profiles set tier='ortskannare', is_admin=true where id='11111111-1111-1111-1111-111111111111';
    exception when others then ok := true; end;
    assert ok, 'end user must not change protected columns';
  end $$;
  -- men eget display_name SKA gå att ändra
  update public.profiles set display_name='Nytt Namn' where id=:'A';
  select pg_temp.reset_role();
  do $$ begin assert (select display_name from public.profiles where id='11111111-1111-1111-1111-111111111111')='Nytt Namn', 'own display_name editable'; end $$;
commit;

\echo '✅ ALLA TESTER GICK IGENOM'
