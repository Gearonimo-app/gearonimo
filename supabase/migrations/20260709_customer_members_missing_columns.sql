-- Live gevonden bij het testen van de klant-app (2026-07-02): "column
-- m.email does not exist" bij join_customer_by_invite. De live tabel
-- customer_members bestond al vóór migratie 20260623_customer_members.sql;
-- "create table if not exists" heeft de kolommen van die migratie toen
-- stilletjes overgeslagen. Idempotent bijtrekken naar het schema uit de
-- repo (email wordt ook gebruikt door het medewerkersformulier in de
-- inspector-app en door de e-mail-hereniging in join_customer_by_invite).
alter table public.customer_members
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists notes text,
  add column if not exists role  text;
