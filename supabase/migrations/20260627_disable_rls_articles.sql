-- Bij een live test verscheen opnieuw "new row violates row-level security
-- policy" bij het toevoegen van een artikel (tabel public.articles). De eerdere
-- migratie 20260626_disable_rls_everywhere.sql had RLS al overal uitgezet, maar
-- migraties draaien maar één keer: wordt RLS daarna weer aangezet (gebeurt
-- makkelijk via de Supabase dashboard-UI, die er bij elke tabel voor
-- waarschuwt), dan komt dat niet automatisch terug op uit.
--
-- Deze migratie herhaalt daarom de generieke sweep, zodat een volgende
-- migratie-deploy RLS opnieuw uitzet op élke public-tabel die het (weer) aan
-- heeft. In deze bouwfase is de aanpak bewust: RLS uit + GRANT aan
-- authenticated (één keurbedrijf, zie BOUWPLAN 2026-06-26). Volledige
-- multi-tenant RLS is een aparte, geteste stap in fase 4.
do $$
declare
  t record;
begin
  for t in
    select relname from pg_class
    where relnamespace = 'public'::regnamespace
      and relkind = 'r'
      and relrowsecurity = true
  loop
    execute format('alter table public.%I disable row level security', t.relname);
  end loop;
end $$;
