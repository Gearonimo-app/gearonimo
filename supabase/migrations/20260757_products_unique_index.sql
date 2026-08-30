-- Alleen het slot op dubbele producten — zonder de catalogus te legen.
--
-- Aanleiding (2026-07-31): `20260749_catalog_reset_and_unique.sql` doet drie
-- dingen achter elkaar: (1) alle artikelen loskoppelen van hun product,
-- (2) `delete from products`, (3) een unieke index op merk+naam. Dat was in
-- juli precies de bedoeling — de catalogus stond toen dubbel. Maar sindsdien
-- is de catalogus opnieuw geïmporteerd en heeft Jos honderden artikelen met de
-- hand aan het juiste product gekoppeld. 20260749 opnieuw draaien zou dat
-- allemaal ongedaan maken: technisch draait het foutloos ("idempotent"), maar
-- het wist wel echt werk. Draai dat bestand dus NIET meer.
--
-- Wat er nog wél moet gebeuren is deel 3: het vangnet tegen dubbelen. Dat
-- staat hieronder los, zonder de twee destructieve stappen ervoor. Veilig om
-- meerdere keren te draaien, en veilig om te draaien als 20260749 al eerder
-- volledig is uitgevoerd (dan bestaat de index al en verandert er niets).

do $$
declare
  n int;
begin
  select count(*) into n
  from (
    select 1 from public.products
    group by lower(btrim(brand)), lower(btrim(name))
    having count(*) > 1
  ) d;

  if n > 0 then
    raise notice 'Let op: nog % dubbele merk+naam-combinaties in products. Unieke index NIET aangemaakt — ruim die eerst op.', n;
  else
    create unique index if not exists products_brand_name_uniq
      on public.products (lower(btrim(brand)), lower(btrim(name)));
    raise notice 'Unieke index products_brand_name_uniq staat klaar.';
  end if;
end $$;

-- Controle achteraf (los te draaien):
--   select count(*) as producten from public.products;
--   select count(*) as gekoppelde_artikelen from public.articles where product_id is not null;
--   select indexname from pg_indexes
--    where tablename = 'products' and indexname = 'products_brand_name_uniq';
