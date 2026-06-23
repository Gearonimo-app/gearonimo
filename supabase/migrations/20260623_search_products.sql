-- Herstel van de fuzzy/typo-tolerante productzoekfunctie (eerder alleen in de DB,
-- nooit in de repo — vandaar dat hij "kwijt" leek). Nu vastgelegd als migratie.
-- Gebruikt pg_trgm voor similarity-matching op merk/naam/producttype.

create extension if not exists pg_trgm;

create or replace function public.search_products(q text, brand_filter text default null::text)
returns table(id uuid, brand text, name text, product_type text)
language sql
stable
as $function$
  select p.id, p.brand, p.name, p.product_type
  from products p
  where
    (brand_filter is null or p.brand = brand_filter)
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

grant execute on function public.search_products(text, text) to authenticated;

-- FK zodat PostgREST artikelen aan producten kan koppelen
-- (de embed `product:products(...)` in de artikelenlijst). Veilig/herhaalbaar.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'articles')
     and not exists (select 1 from pg_constraint where conname = 'articles_product_id_fkey')
  then
    alter table public.articles
      add constraint articles_product_id_fkey
      foreign key (product_id) references public.products(id);
  end if;
end $$;
