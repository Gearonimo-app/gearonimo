-- Extra velden voor klanten (klantkaart inspector).
-- Alleen `name` en `email` zijn in de UI verplicht; de rest is vrije invoer.
-- `if not exists` maakt dit veilig om opnieuw te draaien.
--
-- Reeds bestaande kolommen die hergebruikt worden: name, email, phone, city.
-- Tabelrechten zijn al toegekend (zie 20260622_grant_customers.sql); nieuwe
-- kolommen vallen automatisch onder die table-level grants.

alter table public.customers add column if not exists customer_number       text;
alter table public.customers add column if not exists kvk_number            text;
alter table public.customers add column if not exists vat_number            text;
alter table public.customers add column if not exists contact_person        text;
alter table public.customers add column if not exists street                text;
alter table public.customers add column if not exists house_number          text;
alter table public.customers add column if not exists house_number_addition text;
alter table public.customers add column if not exists postal_code           text;
alter table public.customers add column if not exists province              text;
alter table public.customers add column if not exists country               text;
alter table public.customers add column if not exists notes                 text;
