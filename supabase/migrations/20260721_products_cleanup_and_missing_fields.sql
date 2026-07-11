-- Besluit Jos (2026-07-09): max_age_years ("Max. leeftijd (jaar)") bleek dode
-- data -- de next_due-berekening (packages/core/nextDue.ts) gebruikt alleen
-- max_age_mfr_years (vanaf bouwjaar) en max_age_use_years (vanaf
-- ingebruikname); max_age_years werd nergens gelezen. Voor altijd verwijderen,
-- niet alleen uit de UI verstoppen -- geen dode kolommen laten rondslingeren
-- (dezelfde reden waarom klimkeurpro hier ooit last van had).
alter table public.products drop column if exists max_age_years;

-- Resterende DATAMODEL-kolommen (§products, v6 "vanuit brondata CSV") die nog
-- niet in het catalogusformulier zaten en -- net als rope_diameter_*/
-- product_page_url in de vorige migratie -- ook niet als migratie bestonden
-- (rechtstreeks via CSV-import in de live database gezet). Compleet maken
-- zodat het formulier alle kolommen kan invullen.
alter table public.products add column if not exists manufacturer_code    text;
alter table public.products add column if not exists working_load_limit  text;
alter table public.products add column if not exists max_user_weight_kg  int;
alter table public.products add column if not exists serial_number_location text;
