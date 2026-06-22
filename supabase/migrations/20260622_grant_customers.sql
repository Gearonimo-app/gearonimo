-- Fix: "permission denied for table customers"
--
-- Oorzaak: RLS uitzetten verwijdert alleen de rij-filter, het kent de rol
-- `authenticated` (of `anon`) GEEN tabelrechten toe. De fout
-- `permission denied for table customers` (SQLSTATE 42501) is altijd een
-- GRANT-probleem op rolniveau, nooit een RLS-probleem. (RLS-blokkades geven
-- een lege resultaatset terug, geen permission-denied fout.)
--
-- Controleer de huidige grants:
--   select grantee, privilege_type
--   from information_schema.role_table_grants
--   where table_name = 'customers';

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.customers to authenticated;

-- Zet onderstaande regel aan als anonieme (uitgelogde) gebruikers ook moeten
-- kunnen lezen. Standaard uit: de inspector vereist een ingelogde sessie.
-- grant select on public.customers to anon;
