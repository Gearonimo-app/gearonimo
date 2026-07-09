-- Fix (Jos-test 2026-07-09, stap 16 vervolg): "there is no unique or exclusion
-- constraint matching the ON CONFLICT specification" bij het aanmaken van een
-- klant.
--
-- Oorzaak: de trigger link_new_customer_to_company (en accept_inspection_request)
-- koppelt de klant met `insert into customer_links ... on conflict
-- (customer_id, company_id) do nothing`. ON CONFLICT met een kolomlijst vereist
-- een UNIEKE constraint/index op precies die kolommen. 20260624_customer_links
-- declareerde die unique (customer_id, company_id) wel in de CREATE TABLE, maar
-- de tabel bestond in de live-database al -> `create table if not exists` sloeg
-- de kolom-/constraint-definitie over, dus de unieke sleutel ontbrak.
--
-- Hier alsnog toevoegen. Een UNIEKE INDEX voldoet net zo goed voor ON CONFLICT
-- als een table-constraint, en `if not exists` maakt dit veilig om opnieuw te
-- draaien (en overslaan als 20260624 op een verse database wél greep).
--
-- Mochten er onverhoopt dubbele (customer_id, company_id)-rijen staan, dan
-- faalt het aanmaken van de index; daarom eerst veilig ontdubbelen (oudste
-- koppeling wint). Na een testdata-reset is customer_links leeg en doet deze
-- stap niets.
delete from public.customer_links a
using public.customer_links b
where a.customer_id = b.customer_id
  and a.company_id = b.company_id
  and a.ctid > b.ctid;

create unique index if not exists customer_links_customer_id_company_id_key
  on public.customer_links (customer_id, company_id);
