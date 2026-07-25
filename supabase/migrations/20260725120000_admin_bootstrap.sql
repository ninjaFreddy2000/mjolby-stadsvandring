-- ── Admin-bootstrap: gör Fredriks konton till admin ─────────────────────────
-- profiles.is_admin defaultar till false och är en SKYDDAD kolumn (protect-
-- triggern tillåter bara ändring i service-role/SQL-kontext där auth.uid() är
-- null — dvs migrationer/seed, inte via REST-API:t). Här sätter vi admin för
-- Fredriks två adresser: (1) retroaktivt för redan skapade profiler och (2)
-- framåt via handle_new_user så nya inloggningar med dessa adresser blir admin
-- automatiskt. Idempotent — säker att köra om.

-- Central lista över admin-adresser (utöka här vid behov).
create or replace function public.is_admin_email(p_email text)
returns boolean language sql immutable set search_path = '' as $$
  select lower(coalesce(p_email, '')) in (
    'fredrick.lundberg@gmail.com',
    'svenskaspokkartan@gmail.com'
  );
$$;

-- 1) Retroaktivt: befintliga konton med dessa adresser blir admin.
update public.profiles p
   set is_admin = true
  from auth.users u
 where u.id = p.id
   and public.is_admin_email(u.email)
   and p.is_admin is distinct from true;

-- 2) Framåt: nya signups med dessa adresser får is_admin direkt vid skapandet.
--    (Samma funktion som on_auth_user_created redan pekar på — bara utökad.)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, is_admin)
  values (new.id,
          coalesce(nullif(new.raw_user_meta_data->>'full_name', ''),
                   nullif(new.raw_user_meta_data->>'name', ''),
                   split_part(new.email, '@', 1),
                   'Tipsare'),
          public.is_admin_email(new.email));
  return new;
end; $$;
