-- Zelfde euvel als 20260626_fix_inspectors_user_id_fkey, nu op
-- customer_members (live gevonden bij het testen van de klant-app,
-- 2026-07-02): de live tabel had al een user_id-kolom met een FK naar
-- public.users (een losse, lege tabel) i.p.v. auth.users, waardoor
-- join_customer_by_invite elke echte ingelogde gebruiker afwees met
-- 'violates foreign key constraint "customer_members_user_id_fkey"'.
-- Migratie 20260708 declareerde "references auth.users(id)" correct, maar
-- "add column if not exists" slaat een al bestaande kolom -- inclusief haar
-- oude constraint -- stilletjes over.
--
-- on delete set null (geen cascade): wordt een account ooit verwijderd, dan
-- blijft de medewerker-rij met naam/historie bestaan; alleen de koppeling
-- verdwijnt (DATAMODEL: uit dienst => inactief, historie blijft).

alter table public.customer_members
  drop constraint if exists customer_members_user_id_fkey;

alter table public.customer_members
  add constraint customer_members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;
