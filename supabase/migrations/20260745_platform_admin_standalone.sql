-- Platform-admin los van elk keurbedrijf (besluit Jos 2026-07-19):
-- info@gearonimo.net moet alle bedrijven en de catalogus kunnen beheren
-- ZONDER ergens keurmeester te zijn ("als ik het programma verkoop moet
-- admin los van een bedrijf"). Tot nu toe hingen catalogusbeheer
-- (is_catalog_curator -> inspectors-rij) en de app-toegang aan een
-- keurmeester-rij.
--
-- Keuren blijft expliciet NIET mogelijk voor een platform-admin zonder
-- keurmeester-rij: ensure_inspector blijft ongewijzigd de poort naar de
-- keuring-flow.

-- 1. Catalogus: platform-admin is altijd (ook) curator.
create or replace function public.is_catalog_curator()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.inspectors i
    where i.user_id = auth.uid() and i.active and i.can_curate_catalog
  ) or exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

-- 2. De catalogus-wachtrij leest artikelen (suggest_for_catalog) en schrijft
-- de uitkomst terug (koppelen/afwijzen). Die tabellen waren alleen via
-- keurmeester-policies bereikbaar; de platform-admin krijgt lees- en (voor
-- articles) schrijftoegang. DATAMODEL §7 belooft platform_admin sowieso
-- "alles" -- dit is daarvan het eerste stuk dat echt nodig is.
drop policy if exists "articles platform admin select" on public.articles;
create policy "articles platform admin select" on public.articles
  for select to authenticated using (public.is_platform_admin());

drop policy if exists "articles platform admin update" on public.articles;
create policy "articles platform admin update" on public.articles
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "customers platform admin select" on public.customers;
create policy "customers platform admin select" on public.customers
  for select to authenticated using (public.is_platform_admin());
