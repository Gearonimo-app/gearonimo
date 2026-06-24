-- Fix voor de eerste live test: ensure_inspector() schrijft naar
-- inspectors.name, maar die kolom ontbrak in de echte database (de tabel
-- bestond al voordat 20260624_inspectors.sql de name-kolom toevoegde, en
-- "create table if not exists" voegt geen kolommen toe aan een bestaande
-- tabel). Resultaat: elke "start keuring"-klik faalde stil met
-- 'column "name" of relation "inspectors" does not exist' (42703).

alter table public.inspectors
  add column if not exists name text;

-- Zelfde verhaal: de tabel bestond al zonder unique constraint op user_id,
-- waardoor ensure_inspector()'s "on conflict (user_id)" faalt met 42P10
-- ('there is no unique or exclusion constraint matching the ON CONFLICT
-- specification'). Voegt de ontbrekende constraint toe.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.inspectors'::regclass
      and contype = 'u'
      and conkey = (
        select array_agg(attnum) from pg_attribute
        where attrelid = 'public.inspectors'::regclass and attname = 'user_id'
      )
  ) then
    alter table public.inspectors add constraint inspectors_user_id_key unique (user_id);
  end if;
end $$;
