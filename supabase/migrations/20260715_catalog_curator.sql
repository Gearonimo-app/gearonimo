-- Fase 3/4 vooruitgetrokken (besluit Jos 2026-07-03): een aparte
-- catalogus-curator-rol. Jos vertrouwt niet elke keurmeester om de
-- productcatalogus zelf compleet en correct in te vullen; alleen wie hij
-- aanwijst mag rechtstreeks schrijven. Andere keurmeesters kunnen (al) een
-- vrij artikel markeren met `suggest_for_catalog` -- dat blijft de
-- wachtrij waaruit een curator een echt catalogusproduct maakt.
--
-- Losstaand van `inspectors.is_admin` (keurbedrijf-instellingen/keurmeesters
-- beheren, besluit Jos: mag gelijk blijven aan een gewone keurmeester,
-- geen aparte afscherming nodig): dit is puur "wie mag de catalogus
-- schrijven", een kleinere, expliciet aangewezen groep.

alter table public.inspectors
  add column if not exists can_curate_catalog boolean not null default false;

-- Backfill: de oudste (eerste) inspector -- vrijwel zeker Jos zelf -- is
-- meteen curator, zodat er na deze migratie niemand buitengesloten wordt.
update public.inspectors i
set can_curate_catalog = true
where i.id = (select id from public.inspectors order by created_at limit 1)
  and not exists (select 1 from public.inspectors where can_curate_catalog);

create or replace function public.is_catalog_curator()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.inspectors i
    where i.user_id = auth.uid() and i.active and i.can_curate_catalog
  );
$$;

grant execute on function public.is_catalog_curator() to authenticated;

-- products: leesbeleid bestond al (20260713); hier het schrijfbeleid erbij.
-- Verwijderen bewust niet toegestaan -- een product dat al aan artikelen
-- hangt zou daar stil door de FK geblokkeerd worden, maar liever expliciet
-- geen delete-knop in de UI dan een verwarrende foutmelding.
drop policy if exists "products curator write" on public.products;
create policy "products curator write" on public.products
  for insert to authenticated with check (public.is_catalog_curator());

drop policy if exists "products curator update" on public.products;
create policy "products curator update" on public.products
  for update to authenticated
  using (public.is_catalog_curator())
  with check (public.is_catalog_curator());

grant insert, update on public.products to authenticated;
