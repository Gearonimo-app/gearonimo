-- Eerste live test liep meteen vast op "new row violates row-level security
-- policy for table articles". Bleek breder: alle 22 tabellen in public
-- hadden RLS aanstaan (waarschijnlijk per ongeluk aangezet via de Supabase
-- dashboard-UI, die daar bij elke nieuwe tabel voor waarschuwt), zonder dat
-- er ergens policies bestonden. Dat blokkeert gewoon alles, want zonder
-- policy is een rij voor niemand zichtbaar/schrijfbaar — terwijl de hele
-- aanpak in deze fase RLS uit + GRANT aan authenticated is (zie bv.
-- 20260622_grant_customers.sql).
--
-- Zet RLS uit op alle bestaande public-tabellen, generiek zodat dit ook
-- tabellen pakt die niet met naam genoemd worden.
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
