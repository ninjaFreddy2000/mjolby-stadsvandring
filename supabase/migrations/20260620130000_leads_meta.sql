-- ═══════════════════════════════════════════════════════════════════════════
--  leads.meta — fri nyckel/värde-payload per lead
--
--  Olika magneter fångar olika fält: M5 (kommun-whitepaper) vill ha namn,
--  kommun och roll; framtida magneter kan vilja ha annat. I stället för en
--  kolumn per magnet lägger vi en jsonb-påse. Kärnfälten (email, magnet_type,
--  city_slug, consent) förblir egna kolumner för snabb filtrering/index.
--
--  Beror på 20260620120000_leads (skapar tabellen).
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.leads add column if not exists meta jsonb not null default '{}';

comment on column public.leads.meta is 'Magnet-specifika fält, t.ex. {"name","kommun","roll"} för whitepaper-leads.';
