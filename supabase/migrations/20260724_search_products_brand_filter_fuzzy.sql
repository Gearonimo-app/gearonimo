-- search_products: brand_filter was een exacte match (p.brand = brand_filter),
-- ongebruikt door alle huidige aanroepers (allemaal riepen aan met null).
-- De klant-app krijgt nu een "Merk"-veld dat de catalogus-dropdown live
-- filtert terwijl je typt (Jos, 2026-07-13); daarvoor moet het net zo
-- tolerant zijn als de rest van de zoekfunctie (bevat-match), niet exact.

create or replace function public.search_products(q text, brand_filter text default null::text)
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
      similarity(coalesce(p.product_type, ''), coalesce(q, ''))
    ) desc,
    p.brand, p.name
  limit 15;
$function$;
