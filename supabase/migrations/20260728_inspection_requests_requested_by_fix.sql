-- Fix "Keuring aanvragen": klant kreeg
-- 'column "requested_by" of relation "inspection_requests" does not exist'.
-- public.inspection_requests bestond op sommige omgevingen al voordat de
-- requested_by-kolom aan de "create table if not exists" in
-- 20260717_inspection_requests_leadmotor.sql werd toegevoegd -- die
-- create-statement is dan een no-op en voegt de kolom nooit alsnog toe.
-- Idempotent bijwerken i.p.v. de oude migratie aanpassen (die kan elders al
-- gedraaid zijn).
alter table public.inspection_requests
  add column if not exists requested_by uuid references auth.users(id);
