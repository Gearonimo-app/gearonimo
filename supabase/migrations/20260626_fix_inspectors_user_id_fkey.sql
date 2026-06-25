-- inspectors_user_id_fkey verwees abusievelijk naar public.users (een losse
-- tabel) in plaats van naar auth.users, waardoor elke echte ingelogde
-- gebruiker (die wel in auth.users staat, maar niet in public.users) werd
-- afgewezen met 'violates foreign key constraint "inspectors_user_id_fkey"'.
-- 20260624_inspectors.sql declareerde "references auth.users(id)" correct,
-- maar de tabel bestond al met de verkeerde constraint voordat die migratie
-- liep (zelfde patroon als de ontbrekende name-kolom/unique constraint).

alter table public.inspectors
  drop constraint if exists inspectors_user_id_fkey;

alter table public.inspectors
  add constraint inspectors_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
