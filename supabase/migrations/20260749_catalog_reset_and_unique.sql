-- Catalogus opnieuw opbouwen + dubbele producten voortaan onmogelijk maken.
--
-- Aanleiding (Jos, 2026-07-28): de bronlijst-import is meer dan één keer
-- uitgevoerd, waardoor de catalogus op ~5699 producten stond in plaats van
-- ~2294 — vrijwel alles in dubbele paren. Besluit Jos: niet per stuk opruimen,
-- maar de hele catalogus leeg en opnieuw importeren ("er gaat geen echte data
-- verloren, die staat elders ook").
--
-- Idempotent: opnieuw draaien kan altijd.
--
-- ⚠ Draai deel 1 + 2 vóór de nieuwe import, deel 3 erna.

-- ── 1. Artikelen loskoppelen ────────────────────────────────────────────────
-- `articles.product_id` heeft een FK naar products zonder ON DELETE, dus een
-- lege `delete from products` zou botweg falen. Belangrijker: bij het koppelen
-- ("bedoelt u") worden de vrije velden geleegd, dus een artikel zou zonder
-- merk/omschrijving achterblijven. Daarom eerst merk/naam/categorie van het
-- product terugschrijven als vrije tekst, en dan pas ontkoppelen. Het artikel
-- blijft zo leesbaar en is na de import opnieuw te koppelen.
update public.articles a
set
  free_brand       = coalesce(nullif(btrim(a.free_brand), ''), p.brand),
  free_description = coalesce(nullif(btrim(a.free_description), ''), p.name),
  free_category    = coalesce(nullif(btrim(a.free_category), ''), p.category),
  product_id       = null
from public.products p
where a.product_id = p.id;

-- ── 2. Catalogus leegmaken ──────────────────────────────────────────────────
delete from public.products;

-- ── 3. Dubbele producten voortaan blokkeren ─────────────────────────────────
-- Slot op databaseniveau: dezelfde combinatie merk + naam kan er geen tweede
-- keer in, ongeacht hoofdletters of spaties eromheen. De import controleert het
-- óók zelf (en slaat bestaande rijen netjes over), maar dit is het vangnet dat
-- niet te omzeilen is.
--
-- Veilig: zijn er (nog) dubbelen, dan wordt de index niet aangemaakt en volgt
-- een melding in plaats van een harde fout.
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
    raise notice 'Let op: nog % dubbele merk+naam-combinaties in products. Unieke index NIET aangemaakt — ruim eerst op.', n;
  else
    create unique index if not exists products_brand_name_uniq
      on public.products (lower(btrim(brand)), lower(btrim(name)));
    raise notice 'Unieke index products_brand_name_uniq staat klaar.';
  end if;
end $$;
