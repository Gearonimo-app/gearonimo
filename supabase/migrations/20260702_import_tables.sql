-- Excel/CSV-import (BOUWPLAN §next-excel-import): commit-stap.
--
-- `source` op articles/inspections onderscheidt handmatig ingevoerde data van
-- geïmporteerde historie (geen functioneel verschil in de UI, wel relevant
-- voor latere rapportage/debugging).
--
-- `import_batches` is het juridische anker: het originele bestand wordt
-- ongewijzigd in Storage bewaard (zelfde vertrouwensmodel als certificaten —
-- nooit herrenderen) en elke geïmporteerde inspectie verwijst terug naar zijn
-- batch.
--
-- `import_profiles` slaat de koprij + kolommapping per keurbedrijf op zodat
-- een volgende import met dezelfde lay-out (herkend aan de kolomkoppen,
-- `header_signature`) geen handmatige mapping meer vraagt.

alter table public.articles
  add column if not exists source text not null default 'app';
alter table public.articles
  add constraint articles_source_check check (source in ('app', 'import')) not valid;
alter table public.articles validate constraint articles_source_check;

alter table public.inspections
  add column if not exists source text not null default 'app';
alter table public.inspections
  add constraint inspections_source_check check (source in ('app', 'import')) not valid;
alter table public.inspections validate constraint inspections_source_check;

create table if not exists public.import_batches (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.inspection_companies(id),
  inspector_id     uuid not null references public.inspectors(id),
  original_filename text not null,
  storage_path     text not null,
  sheet_name       text,
  row_count        int not null default 0,
  imported_count   int not null default 0,
  skipped_count    int not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists import_batches_company_id_idx on public.import_batches(company_id);

alter table public.inspections
  add column if not exists import_batch_id uuid references public.import_batches(id);

create table if not exists public.import_profiles (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.inspection_companies(id),
  name             text not null default 'Standaard',
  header_signature text not null,
  header_row_index int not null default 0,
  mapping          jsonb not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists import_profiles_company_id_idx on public.import_profiles(company_id);
create unique index if not exists import_profiles_company_signature_idx
  on public.import_profiles(company_id, header_signature);

grant select, insert, update, delete on public.import_batches to authenticated;
grant select, insert, update, delete on public.import_profiles to authenticated;

-- Privébucket: het originele bestand is bewijsmateriaal, geen publiek
-- certificaat — geen publieke leestoegang nodig (in tegenstelling tot de
-- 'certificates'-bucket).
insert into storage.buckets (id, name, public)
values ('imports', 'imports', false)
on conflict (id) do nothing;

drop policy if exists "imports read by authenticated" on storage.objects;
create policy "imports read by authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'imports');

drop policy if exists "imports upload by authenticated" on storage.objects;
create policy "imports upload by authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'imports');
