-- ═══════════════════════════════════════════════════════════════════════════
--  Reparera tabellrättigheter så schemat går att ÅTERSKAPA
--
--  Upptäckt när routes/place_comments byggdes: en färsk databas byggd ur
--  migrationerna (`supabase db reset`) svarar 401 för anon och authenticated på
--  tips, tip_reviews, profiles, events, feedback m.fl. Produktionsprojektet
--  fungerar — där har rättigheterna satts vid sidan av migrationerna, troligen
--  av Supabase default privileges vid den tidpunkt tabellerna skapades.
--
--  Det betyder att migrationsserien inte kunde reproducera databasen. Bygger man
--  om projektet, sätter upp en stage-miljö eller kör db reset lokalt så är
--  community-delen död utan att något syns i migrationerna.
--
--  RLS är oförändrad och styr fortfarande VILKA RADER man ser. Det här handlar
--  bara om att PostgREST ska släppas in i tabellen alls. Rättigheterna speglar
--  exakt de policies som redan finns.
-- ═══════════════════════════════════════════════════════════════════════════

-- profiles: RLS släpper bara igenom den egna raden (profiles_self_read) och
-- admins. Ingen anon-läsning — publika namn går via vyn public_authors.
grant select, update on public.profiles to authenticated;

-- tips: publicerade tips är öppna för alla (tips_read_published).
grant select                 on public.tips to anon, authenticated;
grant insert, update         on public.tips to authenticated;

-- tip_reviews: bara den som får se tipset ser rösterna (can_see_tip).
grant select, insert, update, delete on public.tip_reviews to authenticated;

-- tip_flags: rapportera och läsa sina egna.
grant select, insert on public.tip_flags to authenticated;

-- events: förstaparts-analytics. Anon SKRIVER (anonyma händelser), admin läser.
grant insert on public.events to anon, authenticated;
grant select on public.events to authenticated;

-- feedback + leads + partner_applications: skickas in av besökare, läses av admin.
grant insert on public.feedback             to anon, authenticated;
grant select on public.feedback             to authenticated;
grant insert on public.leads                to anon, authenticated;
grant insert on public.partner_applications to anon, authenticated;
grant select on public.partner_applications to authenticated;

-- audit_log: bara admin läser, och skrivningen sker enbart via SECURITY
-- DEFINER-funktioner — därför ingen insert-rättighet till någon klientroll.
grant select on public.audit_log to authenticated;

-- Framtida tabeller i public ska ärva samma grundrättigheter, så nästa migration
-- inte behöver komma ihåg det här. RLS är fortfarande det som skyddar raderna.
alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant insert, update, delete on tables to authenticated;
