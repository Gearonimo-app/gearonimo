-- ============================================================================
-- TESTDATA RESET — schone lei voor een A-Z test (Jos, 2026-07-06)
-- ============================================================================
-- Verwijdert ALLE transactionele testdata (klanten, artikelen, keuringen,
-- certificaten, koppelingen, aanvragen, imports, offline-logs, keurmeesters)
-- en alle auth-accounts, zodat je vanaf nul kunt testen.
--
-- BLIJFT BEWUST STAAN (geen testdata, maar fundering):
--   * inspection_companies  — het keurbedrijf Safety Green (incl. listed/coords)
--   * products              — de productcatalogus
--   * rejection_codes       — de afkeurcodes van het bedrijf
--   * inspection_regimes    — de keuringsregimes (indien aanwezig)
--
-- Draai dit in de Supabase SQL-editor (rol: postgres). Alles in één transactie:
-- gaat er iets mis, dan wordt niets gewijzigd.
--
-- LET OP: de laatste stap (delete from auth.users) verwijdert OOK je huidige
-- inlog-account. Dat is de bedoeling ("alle testaccounts weg") — je maakt zo
-- een vers keurmeester-account aan via Authentication -> Add user.
-- ============================================================================

begin;

-- Kinderen eerst (FK-veilige volgorde), daarna de ouders.
delete from public.inspection_requests;
delete from public.inspection_items;
delete from public.certificates;
delete from public.inspections;
delete from public.article_set_members;
delete from public.article_sets;
delete from public.offline_downloads;
delete from public.articles;
delete from public.import_profiles;
delete from public.import_batches;
delete from public.inspector_qualifications;
delete from public.customer_members;
delete from public.customer_links;
delete from public.inspectors;
delete from public.customers;

-- Alle auth-accounts weg (identities/sessions cascaden mee). Hierna zelf een
-- vers keurmeester-account aanmaken via Authentication -> Add user.
delete from auth.users;

commit;

-- Controle (draai los na de commit):
--   select
--     (select count(*) from public.customers)            as customers,
--     (select count(*) from public.articles)             as articles,
--     (select count(*) from public.inspections)          as inspections,
--     (select count(*) from public.inspectors)           as inspectors,
--     (select count(*) from public.inspection_requests)  as requests,
--     (select count(*) from auth.users)                  as users,
--     (select count(*) from public.products)             as products_KEEP,
--     (select count(*) from public.inspection_companies) as companies_KEEP;
