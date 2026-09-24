-- Fix bij het samenvoegen van de vergeten branch van 16 sept. (2026-09-24):
-- correct_inspection() (20260917_completed_inspection_immutable.sql) maakt de
-- gecorrigeerde keuring aan met source = 'correction', maar
-- inspections_source_check (20260702_import_tables.sql) staat alleen 'app' en
-- 'import' toe. Live geverifieerd door Jos (2026-09-24): de check is nog
-- ('app', 'import'). Zonder deze migratie faalt elke "Corrigeer keuring" met
-- een check-violation.
--
-- Idempotent: drop + opnieuw aanmaken, zelfde patroon als
-- articles_source_check in 20260714_customer_admin.sql.

alter table public.inspections drop constraint if exists inspections_source_check;
alter table public.inspections
  add constraint inspections_source_check
  check (source in ('app', 'import', 'correction')) not valid;
alter table public.inspections validate constraint inspections_source_check;
