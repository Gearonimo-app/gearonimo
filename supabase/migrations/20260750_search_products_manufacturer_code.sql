-- search_products: ook op de artikelcode van de fabrikant zoeken.
--
-- Aanleiding (Jos, 2026-07-28): op oude certificaten staat vaak alléén de code
-- ("Fallsafe FS242-L-XL"), terwijl het product in de catalogus "FALL SAFE LITE
-- HARNESS L/XL" heet. Zoeken op "242" leverde niets op, want merk/naam/type/
-- categorie bevatten die code niet.
--
-- De "bedoelt u"-koppeling in de keurder-app zoekt client-side en is al
-- aangepast; deze functie bedient de klant-app (artikel toevoegen) en het
-- SN-zoeken. Zelfde handtekening, dus create or replace volstaat en bestaande
-- aanroepers veranderen niet. Idempotent.
create or replace function public.search_products(
  q text,
  brand_filter text default null::text,
  limit_count integer default 15
)
returns table(id uuid, brand text, name text, product_type text)
language sql
stable
as $function$
  select p.id, p.brand, p.name, p.product_type
  from products p
  where
    (brand_filter is null or trim(brand_filter) = '' or p.brand ilike '%' || trim(brand_filter) || '%')
    and (
      q is null or trim(q) = ''
      or not exists (
        select 1
        from unnest(string_to_array(trim(q), ' ')) as word
        where word <> ''
          and not (
            p.brand ilike '%' || word || '%'
            or p.name ilike '%' || word || '%'
            or p.product_type ilike '%' || word || '%'
            or p.category ilike '%' || word || '%'
            or p.manufacturer_code ilike '%' || word || '%'
            or similarity(coalesce(p.brand, ''), word) > 0.3
            or similarity(coalesce(p.name, ''), word) > 0.3
            or similarity(coalesce(p.product_type, ''), word) > 0.3
          )
      )
    )
  order by
    greatest(
      similarity(coalesce(p.brand, ''), coalesce(q, '')),
      similarity(coalesce(p.name, ''), coalesce(q, '')),
      similarity(coalesce(p.product_type, ''), coalesce(q, '')),
      -- Een treffer op de exacte code hoort bovenaan: wie een code intypt,
      -- bedoelt precies dat product.
      similarity(coalesce(p.manufacturer_code, ''), coalesce(q, ''))
    ) desc,
    p.brand, p.name
  limit greatest(1, least(coalesce(limit_count, 15), 60));
$function$;
