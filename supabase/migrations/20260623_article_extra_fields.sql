-- Extra artikelvelden voor het toevoegformulier (fase 2).
-- first_use_date en notes staan al in 20260623_articles.sql; hier idempotent
-- herhaald voor het geval de tabel uit een eerdere sessie stamt.
-- assigned_user_name en set_label zijn TIJDELIJKE vrije-tekstvelden:
--   - gebruiker: DATAMODEL koppelt dit eigenlijk via assigned_member_id ->
--     customer_members (komt met de klant-app/onboarding, latere fase).
--   - set_label: DATAMODEL heeft hiervoor een echte article_sets-tabel; voorlopig
--     groeperen we artikelen met dezelfde vrije setnaam.

alter table public.articles add column if not exists first_use_date      date;
alter table public.articles add column if not exists notes               text;
alter table public.articles add column if not exists assigned_user_name  text;
alter table public.articles add column if not exists set_label           text;
