-- Fix (Jos-test 2026-07-09): het catalogusformulier miste "touwdiameters" en
-- "link productpagina fabrikant" (ProductForm.vue). DATAMODEL.md (v6,
-- 2026-06-19) noemt rope_diameter_min_mm/rope_diameter_max_mm/product_page_url
-- als kolommen "vanuit brondata CSV", maar er bestond hiervoor geen migratie --
-- ze zijn destijds kennelijk rechtstreeks via een CSV-import in de live
-- database gezet, buiten de migratiegeschiedenis om (zelfde soort schema-drift
-- als eerder bij customer_links). Hier alsnog vastgelegd zodat elke omgeving
-- (ook een verse) deze kolommen heeft. Idempotent.

alter table public.products add column if not exists rope_diameter_min_mm numeric;
alter table public.products add column if not exists rope_diameter_max_mm numeric;
alter table public.products add column if not exists product_page_url     text;
