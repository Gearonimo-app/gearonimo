-- Klant-app "+ Toevoegen" (Jos, 2026-07-13): het merkveld wordt een
-- selectlijst i.p.v. vrije tekst, zodat je een merk kunt kiezen en dan door
-- de hele catalogus van dat merk kunt bladeren ("soms is een naam niet
-- duidelijk en weet je het pas als je hem ziet") -- de vrije-invoerknop
-- ("Zelf invullen") blijft ernaast bestaan voor onbekende producten.
-- Daarnaast: aankoopdatum als apart veld bij het toevoegen (naast de
-- bestaande ingebruiknamedatum), zoals de Pro-app die al kent
-- (CustomerArticles.vue).

-- 1) search_products: limit_count toegevoegd zodat "bladeren binnen een
-- merk" (geen naam-zoekterm) meer dan de standaard 15 resultaten mag tonen.
-- Bestaande aanroepers (Pro-app SerialSearch, klant-app zonder limit_count)
-- blijven ongewijzigd op 15.
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
  limit greatest(1, least(coalesce(limit_count, 15), 60));
$function$;

-- 2) Merken-lijst voor de selectlijst. Gewone (niet-definer) SQL-functie:
-- valt onder dezelfde products-leespolicy als search_products, dus werkt
-- ook voor klant-accounts.
create or replace function public.list_product_brands()
returns table(brand text)
language sql
stable
as $function$
  select distinct p.brand
  from products p
  where p.brand is not null and trim(p.brand) <> ''
  order by 1;
$function$;

grant execute on function public.list_product_brands() to authenticated;

-- 3) add_my_article: aankoopdatum erbij, zelfde plek in de rij als
-- ingebruiknamedatum. Bestaand gedrag (geen p_purchase_date meegeven) blijft
-- werken, want nieuw parameter met default.
create or replace function public.add_my_article(
  p_product_id uuid default null,
  p_free_brand text default null,
  p_free_category text default null,
  p_free_description text default null,
  p_serial_number text default null,
  p_assigned_user_name text default null,
  p_manufacture_year int default null,
  p_manufacture_month int default null,
  p_first_use_date date default null,
  p_purchase_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_id       uuid;
begin
  select m.customer_id into v_customer
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;

  if p_product_id is not null then
    if not exists (select 1 from public.products p where p.id = p_product_id) then
      raise exception 'Onbekend catalogusproduct.';
    end if;
  elsif nullif(trim(coalesce(p_free_description, '')), '') is null then
    raise exception 'Kies een product uit de catalogus of vul een omschrijving in.';
  end if;

  insert into public.articles (
    customer_id, product_id,
    free_brand, free_category, free_description,
    serial_number, assigned_user_name,
    manufacture_year, manufacture_month, first_use_date, purchase_date,
    suggest_for_catalog, source, retired
  )
  values (
    v_customer,
    p_product_id,
    case when p_product_id is null then nullif(trim(coalesce(p_free_brand, '')), '') end,
    case when p_product_id is null then nullif(trim(coalesce(p_free_category, '')), '') end,
    case when p_product_id is null then nullif(trim(coalesce(p_free_description, '')), '') end,
    nullif(trim(coalesce(p_serial_number, '')), ''),
    nullif(trim(coalesce(p_assigned_user_name, '')), ''),
    p_manufacture_year,
    p_manufacture_month,
    p_first_use_date,
    p_purchase_date,
    (p_product_id is null),
    'customer',
    false
  )
  returning id into v_id;
  return v_id;
end;
$$;
