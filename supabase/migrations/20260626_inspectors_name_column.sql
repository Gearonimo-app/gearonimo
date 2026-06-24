-- Fix voor de eerste live test: ensure_inspector() schrijft naar
-- inspectors.name, maar die kolom ontbrak in de echte database (de tabel
-- bestond al voordat 20260624_inspectors.sql de name-kolom toevoegde, en
-- "create table if not exists" voegt geen kolommen toe aan een bestaande
-- tabel). Resultaat: elke "start keuring"-klik faalde stil met
-- 'column "name" of relation "inspectors" does not exist' (42703).

alter table public.inspectors
  add column if not exists name text;
