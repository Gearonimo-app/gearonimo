-- Zelfde probleem als 20260728_inspection_requests_requested_by_fix.sql,
-- nu met de volgende ontbrekende kolom: 'column "handled_by" of relation
-- "inspection_requests" does not exist' bij het openen van Keuring-aanvragen
-- (company_inspection_requests()). public.inspection_requests bestond op de
-- live omgeving kennelijk met een ouder/kleiner kolommenschema dan wat in
-- 20260717_inspection_requests_leadmotor.sql staat -- "create table if not
-- exists" is dan een no-op en voegt ontbrekende kolommen nooit alsnog toe.
-- Alle kolommen uit die create-statement hier defensief herhalen (idempotent)
-- om verdere kolom-voor-kolom fouten in één keer te voorkomen.
alter table public.inspection_requests
  add column if not exists source     text not null default 'name_search',
  add column if not exists message    text,
  add column if not exists status     text not null default 'pending',
  add column if not exists requested_by uuid references auth.users(id),
  add column if not exists handled_by   uuid references auth.users(id),
  add column if not exists handled_at   timestamptz;
