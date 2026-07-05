-- Catalogus-aanmelding: van kaal vinkje naar ingevuld voorstel
-- (besluit Jos 2026-07-05). Tot nu toe zette de keurmeester alleen
-- `articles.suggest_for_catalog` aan en liet de curator alle productvelden
-- (merk/type/categorie/materiaal/norm/leeftijdstermijnen/MBS/handleiding-/
-- recall-/veiligheidsbulletin-links) zelf uitzoeken. Nu vult de keurmeester
-- die velden zelf in een productformulier in; we bewaren ze hier.
--
-- Bewust GEEN `products`-rij voor een voorstel: `products` is leesbaar voor
-- elke ingelogde gebruiker zodra de rij bestaat (leesbeleid uit
-- 20260713_rls_enable.sql), dus een nog niet goedgekeurd voorstel hoort nog
-- niet in de echte catalogus te staan. De curator maakt er pas in
-- CatalogQueue.vue een echt product van; tot dan blijft het voorstel een
-- jsonb-blob op het artikel zelf, naast het bestaande `suggest_for_catalog`.
--
-- Schrijfrechten: de eigenaar-keurmeester mag de articles-rij van zijn eigen
-- klant al muteren (`articles inspector all`-policy + grant update, uit
-- 20260713); RLS is rij- en niet kolomgebaseerd, dus voor deze extra kolom is
-- geen apart beleid nodig. Idempotent.

alter table public.articles
  add column if not exists catalog_suggestion jsonb;

comment on column public.articles.catalog_suggestion is
  'Door de aanmeldende keurmeester ingevulde productvelden (ProductFormModel) '
  'voor de catalogus-wachtrij; los van het suggest_for_catalog-vinkje. '
  'NULL = geen of ingetrokken voorstel. CatalogQueue.vue prefilled hiermee.';
