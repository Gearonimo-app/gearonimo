-- Code review 2026-09-15/16, twee kritieke bevindingen in de RLS-laag.
--
-- 1) inspector_customer_ids() keek niet naar customer_links.status. Een
--    keurbedrijf dat een klant kwijtraakt (overstap naar een ander bedrijf
--    zet de oude link op status='ended', de rij blijft bestaan) hield zo
--    voor altijd volledige lees/schrijf/verwijder-toegang tot die klant --
--    inclusief het kunnen verwijderen van de klant, wat cascadeert naar
--    diens artikelen bij het NIEUWE bedrijf. Dit was ook precies de
--    verkeerde kant om te falen bij de "linked read"-policies uit
--    20260717 (inspections/inspection_items/certificates): die zijn
--    bedoeld voor "het actueel (actief) gekoppelde keurbedrijf mag de
--    volledige historie inzien", niet voor een ex-keurbedrijf.
--
--    Eén centrale fix in plaats van elke policy los aan te passen (zie
--    CLAUDE.md, "eén gedeelde bron boven herhaling"): de functie zelf
--    filtert nu op status='active'. Dat verhelpt in één keer alle
--    policies op customers/customer_members/articles/article_sets/
--    article_set_members, get_or_create_article_set, én de drie
--    "linked read"-policies (die precies zo bedoeld waren).
--
--    Eigen uitgevoerde keuringen/certificaten van een ex-klant blijven
--    gewoon leesbaar voor het uitvoerende bedrijf -- dat loopt via
--    inspector_company_ids() (company_id op de keuring zelf), niet via
--    deze functie, en is dus niet geraakt.
--
--    "customers inspector delete" (20260739) checkte customer_links
--    rechtstreeks, zonder de functie te gebruiken en zonder status-check
--    -- apart hersteld hieronder.
--
-- 2) self_managed=true artikelen (kleding/machines/overig, DATAMODEL §7:
--    "voor geen enkel keurbedrijf zichtbaar") waren alleen client-side
--    (packages/core/src/domains.ts) buiten beeld gehouden. Met directe
--    tabel-toegang (inspecteurs hebben, i.t.t. klant-accounts, geen
--    security-definer-RPC-laag ertussen) was dit gewoon leesbaar en
--    bewerkbaar. Nu ook in de database afgedwongen.

create or replace function public.inspector_customer_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select cl.customer_id
  from public.customer_links cl
  join public.inspectors i on i.company_id = cl.company_id
  where i.user_id = auth.uid() and i.active and cl.status = 'active';
$$;

drop policy if exists "customers inspector delete" on public.customers;
create policy "customers inspector delete" on public.customers
  for delete to authenticated
  using (exists (
    select 1 from public.customer_links cl
    where cl.customer_id = customers.id
      and cl.status = 'active'
      and public.is_company_admin(cl.company_id)
  ));

drop policy if exists "articles inspector all" on public.articles;
create policy "articles inspector all" on public.articles
  for all to authenticated
  using (customer_id in (select public.inspector_customer_ids()) and self_managed = false)
  with check (customer_id in (select public.inspector_customer_ids()) and self_managed = false);
