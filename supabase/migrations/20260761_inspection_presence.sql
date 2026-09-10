-- "Wie is hier nog bezig" bij een gedeelde keuring (Jos, 2026-09-10): bij een
-- grote klant werken soms 2-4 keurmeesters tegelijk in dezelfde openstaande
-- keuring, elk aan hun eigen sets. Het risico zit niet in tegelijk bewerken
-- (ze raken elkaars rijen niet aan), maar in te vroeg op "Afronden" klikken
-- terwijl een collega nog een set aan het toevoegen is -- die komt dan wel
-- in de database te staan, maar nooit op het certificaat.
--
-- Bewust GEEN live-verbinding (Supabase Realtime): dat is nieuwe, kwetsbare
-- techniek voor deze app en levert hier weinig op t.o.v. de complexiteit --
-- besluit Jos 2026-09-10. Elke open keuring schrijft simpelweg af en toe een
-- tijdstempel weg ("ik ben hier nog"); bij Afronden wordt dat één keer
-- opgevraagd. Sets van collega's zie je met de nieuwe ververs-knop.

create table if not exists public.inspection_presence (
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  inspector_id  uuid not null references public.inspectors(id) on delete cascade,
  last_seen     timestamptz not null default now(),
  primary key (inspection_id, inspector_id)
);

create index if not exists inspection_presence_inspection_idx
  on public.inspection_presence (inspection_id);

alter table public.inspection_presence enable row level security;

-- Lezen: elke actieve keurmeester van hetzelfde keurbedrijf als de keuring
-- (zelfde patroon als de bestaande inspector_company_ids()-checks elders).
drop policy if exists "inspection_presence read own company" on public.inspection_presence;
create policy "inspection_presence read own company" on public.inspection_presence
  for select to authenticated
  using (exists (
    select 1 from public.inspections i
    where i.id = inspection_presence.inspection_id
      and i.company_id in (select public.inspector_company_ids())
  ));

-- Schrijven: alleen je eigen aanwezigheid, nooit die van een collega.
drop policy if exists "inspection_presence upsert own" on public.inspection_presence;
create policy "inspection_presence upsert own" on public.inspection_presence
  for insert to authenticated
  with check (
    inspector_id in (select id from public.inspectors where user_id = auth.uid())
  );

drop policy if exists "inspection_presence update own" on public.inspection_presence;
create policy "inspection_presence update own" on public.inspection_presence
  for update to authenticated
  using (inspector_id in (select id from public.inspectors where user_id = auth.uid()))
  with check (inspector_id in (select id from public.inspectors where user_id = auth.uid()));

grant select, insert, update on public.inspection_presence to authenticated;
