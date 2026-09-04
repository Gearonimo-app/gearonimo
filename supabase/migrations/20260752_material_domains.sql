-- Materiaal-tegels in de klant-app (ontwerpbesluit Jos 2026-08-04, volledig
-- uitgeschreven in UX-FLOW.md §9.6).
--
-- Vier tegels onder "Mijn materiaal": Klimmateriaal (ppe/no_ppe/rigging),
-- Machines (machine), Kleding (clothing), Overig (other).
--
-- De architectuurregel: een tegel is een WEERGAVE, geen eigenschap van een
-- artikel. Er komt dus géén tegel-kolom op articles. Wat een artikel is,
-- volgt uit zijn producttype; welke tegels een klant gebruikt, staat in
-- customers.enabled_domains. Zo kunnen die twee het nooit oneens zijn.

-- ─── 1. Welke tegels gebruikt deze klant ────────────────────────────────────
-- Startwaarde {climbing} voor iedereen: alles wat er vandaag staat is
-- klimmateriaal (bevestigd door Jos 2026-08-04). Een klant zet de rest zelf
-- aan in de instellingen.

alter table public.customers
  add column if not exists enabled_domains text[] not null default '{climbing}';

-- ─── 2. Het type van een VRIJ artikel ───────────────────────────────────────
-- product_type staat op products; een vrij artikel (product_id leeg) had tot nu
-- alleen free_category als vrije tekst. Sinds de tegels is de tegel zelf de
-- typekeuze: voeg je toe vanuit Kleding, dan is dit 'clothing'.
--
-- Bewust NIET gebackfilld en bewust nullable: een bestaand vrij artikel is van
-- vóór de splitsing en we weten niet of het ppe of no_ppe was. `null` betekent
-- dus "onbekend, van voor 2026-08-04" en wordt overal als klimmateriaal/ppe
-- behandeld -- precies wat er vandaag al gebeurt (de keuring-wizard viel voor
-- een typeloos artikel al terug op 'ppe'). Nul gedragsverandering.

alter table public.articles
  add column if not exists free_product_type text;

-- ─── 3. Type → tegel, als database-waarheid ─────────────────────────────────
-- LET OP: deze afbeelding staat ook in packages/core/src/domains.ts, want de
-- UI heeft hem nodig en SQL kan geen TypeScript importeren. Dat is bewuste
-- duplicatie van vijf regels; wijzig je er één, wijzig dan de ander. De
-- controle "een tegel met inhoud kan niet uit" MOET serverside gebeuren,
-- vandaar dat de database hier de autoriteit is.

create or replace function public.domain_for_type(p_type text)
returns text
language sql
immutable
set search_path = public
as $$
  select case coalesce(nullif(trim(p_type), ''), 'ppe')
    when 'machine'  then 'machines'
    when 'clothing' then 'clothing'
    when 'other'    then 'other'
    else 'climbing'   -- ppe, no_ppe, rigging én onbekend/leeg
  end;
$$;

-- ─── 4. my_customer() geeft enabled_domains terug ───────────────────────────
-- Return-type wijzigt, dus eerst droppen. De app leest kolommen op naam en
-- blijft dus werken (zelfde patroon als 20260714 en 20260729).

drop function if exists public.my_customer();

create or replace function public.my_customer()
returns table (
  customer_id uuid, customer_name text, member_name text, member_id uuid,
  is_admin boolean, invite_code text,
  email text, phone text, contact_person text,
  kvk_number text, vat_number text,
  street text, house_number text, house_number_addition text,
  postal_code text, city text, province text, country text,
  enabled_domains text[]
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.name, m.name, m.id, m.is_admin, c.invite_code,
    c.email, c.phone, c.contact_person,
    c.kvk_number, c.vat_number,
    c.street, c.house_number, c.house_number_addition,
    c.postal_code, c.city, c.province, c.country,
    coalesce(c.enabled_domains, '{climbing}')
  from public.customer_members m
  join public.customers c on c.id = m.customer_id
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
$$;

grant execute on function public.my_customer() to authenticated;

-- ─── 5. my_articles() geeft het producttype terug ───────────────────────────
-- Nodig om de lijst per tegel te kunnen filteren en om op de artikelregel te
-- kunnen tonen dat iets ppe/no_ppe/rigging is (besluit Jos: gewoon laten zien,
-- het verklaart waarom een klimspoor geen keurdatum heeft).

drop function if exists public.my_articles();

create or replace function public.my_articles()
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  product_type text,
  serial_number text,
  assigned_user_name text,
  manual_url text,
  recall_url text,
  last_result text,
  last_inspection_date date,
  next_due date,
  first_use_date date
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    coalesce(p.name, a.free_description)          as name,
    coalesce(p.brand, a.free_brand)               as brand,
    coalesce(p.category, a.free_category)         as category,
    coalesce(p.product_type, a.free_product_type) as product_type,
    a.serial_number,
    a.assigned_user_name,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    nullif(
      coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end),
      a.recall_cleared_url
    ) as recall_url,
    li.result            as last_result,
    li.inspection_date   as last_inspection_date,
    li.next_due          as next_due,
    a.first_use_date
  from public.articles a
  left join public.products p on p.id = a.product_id
  left join lateral (
    select ii.result, ii.next_due, i.inspection_date
    from public.inspection_items ii
    join public.inspections i on i.id = ii.inspection_id
    where ii.article_id = a.id
      and i.status = 'completed'
      and ii.result in ('passed', 'rejected')
    order by i.inspection_date desc, i.completed_at desc nulls last
    limit 1
  ) li on true
  where a.retired = false
    and a.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    );
$$;

grant execute on function public.my_articles() to authenticated;

-- ─── 6. Tegels aan/uit zetten ───────────────────────────────────────────────
-- Alleen de beheerder (Jos 2026-08-04: "niet iedereen hoeft hem te kunnen
-- zien"), en de veiligheidsregel staat hier -- niet alleen in de UI:
-- EEN TEGEL MET INHOUD KAN NIET UIT. Daarmee bestaat "onzichtbaar materiaal
-- met een verlopende keuring" niet.

create or replace function public.set_my_enabled_domains(p_domains text[])
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_is_admin boolean;
  v_clean    text[];
  v_removed  text;
  v_count    int;
begin
  select m.customer_id, m.is_admin into v_customer, v_is_admin
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;
  if not coalesce(v_is_admin, false) then
    raise exception 'Alleen een beheerder kan de materiaalsoorten wijzigen.';
  end if;

  -- Alleen bekende waarden, ontdubbeld. Klimmateriaal staat er altijd in: dat
  -- is de basis van de app en uitzetten zou een lege startpagina geven.
  select array_agg(distinct d order by d) into v_clean
  from unnest(coalesce(p_domains, '{}')) as d
  where d in ('climbing', 'machines', 'clothing', 'other');

  v_clean := coalesce(v_clean, '{}') || case
    when 'climbing' = any(coalesce(v_clean, '{}')) then '{}'::text[]
    else '{climbing}'::text[]
  end;

  -- Een tegel die verdwijnt mag geen materiaal meer bevatten.
  foreach v_removed in array coalesce(
    (select array_agg(d) from unnest(coalesce(
       (select enabled_domains from public.customers where id = v_customer), '{}'
     )) as d where not (d = any(v_clean))),
    '{}'::text[]
  )
  loop
    select count(*) into v_count
    from public.articles a
    left join public.products p on p.id = a.product_id
    where a.customer_id = v_customer
      and a.retired = false
      and public.domain_for_type(coalesce(p.product_type, a.free_product_type)) = v_removed;

    if v_count > 0 then
      raise exception 'Deze materiaalsoort bevat nog % artikel(en); voer die eerst af.', v_count;
    end if;
  end loop;

  update public.customers set enabled_domains = v_clean where id = v_customer;
  return v_clean;
end;
$$;

grant execute on function public.set_my_enabled_domains(text[]) to authenticated;

-- ─── 7. add_my_article kent het type van een vrij artikel ───────────────────
-- De tegel ís de dropdown: toevoegen vanuit Kleding levert 'clothing'.
--
-- p_free_product_type mag bewust leeg blijven. Een PWA houdt oude pagina's in
-- de cache (zie CLAUDE.md); een client van vóór deze deploy roept de functie
-- zonder dit argument aan en moet gewoon blijven werken. Leeg = onbekend =
-- klimmateriaal, zoals overal in deze migratie.

-- Eerst de oude 10-argument-versie weg. `create or replace` met een extra
-- parameter maakt een OVERLOAD, geen vervanging -- dan bestaan er twee
-- functies naast elkaar en wordt een aanroep met de oude argumenten
-- dubbelzinnig. Zelfde les als bij retire_my_article (migratie 20260712).
drop function if exists public.add_my_article(uuid, text, text, text, text, text, int, int, date, date);

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
  p_purchase_date date default null,
  p_free_product_type text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_id       uuid;
  v_type     text;
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

  -- Alleen bij een vrij artikel; een catalogusproduct draagt zijn eigen type.
  v_type := case
    when p_product_id is not null then null
    else nullif(trim(coalesce(p_free_product_type, '')), '')
  end;
  if v_type is not null and v_type not in ('ppe', 'no_ppe', 'rigging', 'machine', 'clothing', 'other') then
    raise exception 'Onbekend producttype: %', v_type;
  end if;

  insert into public.articles (
    customer_id, product_id,
    free_brand, free_category, free_description, free_product_type,
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
    v_type,
    nullif(trim(coalesce(p_serial_number, '')), ''),
    nullif(trim(coalesce(p_assigned_user_name, '')), ''),
    p_manufacture_year,
    p_manufacture_month,
    p_first_use_date,
    p_purchase_date,
    -- "Overig" is de eigen todo-lijst van de klant (EHBO-koffer, brandblusser)
    -- en hoort bewust NIET in de catalogus-wachtrij: daar krijg je nooit een
    -- kloppende catalogus van (besluit Jos 2026-08-04).
    (p_product_id is null and coalesce(v_type, '') <> 'other'),
    'customer',
    false
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.add_my_article(uuid, text, text, text, text, text, int, int, date, date, text) to authenticated;

-- ─── 8. Catalogus zoeken binnen één tegel ───────────────────────────────────
-- Eén catalogus, per tegel een gefilterd venster (besluit Jos 2026-08-04:
-- geen aparte kledingcatalogus). Extra parameter mét default, zodat de
-- keurmeester-app -- die zonder filter zoekt -- ongemoeid blijft.

-- Ook hier eerst de oude 3-argument-versie weg, anders staan er twee
-- overloads en wordt de aanroep vanuit de keurmeester-app dubbelzinnig.
drop function if exists public.search_products(text, text, integer);

-- Let op: dit is het volledige lichaam van 20260750 (fuzzy zoeken via
-- similarity/pg_trgm, sortering op de beste treffer, cap op 60) met ALLEEN het
-- typefilter erbij. Bewust géén `set search_path` toegevoegd: `similarity()`
-- komt uit pg_trgm en hoeft niet in `public` te staan.
create or replace function public.search_products(
  q text,
  brand_filter text default null::text,
  limit_count integer default 15,
  type_filter text[] default null::text[]
)
returns table(id uuid, brand text, name text, product_type text)
language sql
stable
as $function$
  select p.id, p.brand, p.name, p.product_type
  from products p
  where
    (brand_filter is null or trim(brand_filter) = '' or p.brand ilike '%' || trim(brand_filter) || '%')
    -- Nieuw: zoeken binnen één tegel. Een product zonder type telt als
    -- klimmateriaal, zelfde afspraak als domain_for_type() hierboven.
    and (
      type_filter is null
      or cardinality(type_filter) = 0
      or coalesce(nullif(trim(p.product_type), ''), 'ppe') = any(type_filter)
    )
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

grant execute on function public.search_products(text, text, integer, text[]) to authenticated;
grant execute on function public.search_products(text, text, integer, text[]) to anon;
