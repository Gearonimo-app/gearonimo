-- Klant-app (Jos, 2026-07-13): een artikel toevoegen kon al, maar er was
-- nergens een plek om het terug te vinden of iets aan te passen. Dit voegt
-- een detail-RPC toe (alle velden, ook first_use_date -- nodig voor de
-- EN 365-melding hieronder) en een update-RPC voor de beheerder: gebruiker
-- wisselen en aankoopdatum aanpassen mogen altijd; ingebruiknamedatum blijft
-- eenmalig invulbaar (DATAMODEL, besloten 2026-06-14) -- eenmaal gezet raakt
-- hij hier niet meer aan.

-- 1) my_articles(): first_use_date erbij, nodig om client-side te bepalen of
-- de EN 365-termijn van 12 maanden na ingebruikname is verstreken zonder dat
-- er ooit gekeurd is (packages/core: isFirstInspectionOverdue).
create or replace function public.my_articles()
returns table (
  id uuid,
  name text,
  brand text,
  category text,
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
    a.serial_number,
    a.assigned_user_name,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end) as recall_url,
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

-- 2) Eén artikel in detail -- voor het nieuwe artikelscherm in de klant-app.
create or replace function public.my_article_detail(p_article_id uuid)
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  serial_number text,
  assigned_user_name text,
  manufacture_year int,
  manufacture_month int,
  purchase_date date,
  first_use_date date,
  manual_url text,
  recall_url text,
  last_result text,
  last_inspection_date date,
  next_due date,
  retired boolean
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
    a.serial_number,
    a.assigned_user_name,
    a.manufacture_year,
    a.manufacture_month,
    a.purchase_date,
    a.first_use_date,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end) as recall_url,
    li.result            as last_result,
    li.inspection_date   as last_inspection_date,
    li.next_due          as next_due,
    a.retired
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
  where a.id = p_article_id
    and a.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    );
$$;

grant execute on function public.my_article_detail(uuid) to authenticated;

-- 3) Aanpassen: alleen de beheerder (is_admin), en alleen deze drie velden
-- (Jos, 2026-07-13: "andere dingen moeten ongewijzigd blijven"). Gebruiker en
-- aankoopdatum mogen altijd wijzigen; ingebruiknamedatum alleen zetten als
-- hij nog leeg is -- eenmaal gezet blijft hij staan, ook als er een andere
-- waarde wordt meegegeven (geen foutmelding, gewoon genegeerd: de invoervorm
-- toont het veld dan toch als alleen-lezen).
create or replace function public.update_my_article(
  p_article_id uuid,
  p_assigned_user_name text default null,
  p_purchase_date date default null,
  p_first_use_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_is_admin boolean;
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
    raise exception 'Alleen een beheerder mag materiaal aanpassen.';
  end if;

  update public.articles
  set
    assigned_user_name = nullif(trim(coalesce(p_assigned_user_name, '')), ''),
    purchase_date = p_purchase_date,
    first_use_date = case when first_use_date is null then p_first_use_date else first_use_date end
  where id = p_article_id
    and customer_id = v_customer;

  if not found then
    raise exception 'Artikel niet gevonden.';
  end if;
end;
$$;

grant execute on function public.update_my_article(uuid, text, date, date) to authenticated;
