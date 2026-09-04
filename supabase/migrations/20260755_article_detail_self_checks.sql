-- Fix na de eerste test van Jos (2026-08-04): hij voegde een EHBO-tas toe,
-- vinkte die af, en het artikeldetailscherm bleef "Nog niet gekeurd" tonen.
--
-- Oorzaak: bij het bouwen van de materiaal-tegels zijn `my_articles` (de
-- lijst) en `my_customer` uitgebreid, maar `my_article_detail` niet -- dat is
-- een eigen RPC met een eigen kolommenlijst. Het detailscherm wist dus niets
-- van producttype, self_managed of zelfcontroles.
--
-- Meteen ook `purchase_date` op `my_articles`: de statusberekening valt voor
-- "wanneer begint de termijn" terug op de aankoopdatum als er geen
-- ingebruikname-datum is. Een net gekochte EHBO-koffer zonder eerste-gebruik
-- hoorde niet meteen om aandacht te vragen.

-- ─── 1. my_articles(): purchase_date erbij ─────────────────────────────────

drop function if exists public.my_articles();

create or replace function public.my_articles()
returns table (
  id uuid,
  name text,
  brand text,
  category text,
  product_type text,
  self_managed boolean,
  serial_number text,
  assigned_user_name text,
  manual_url text,
  recall_url text,
  last_result text,
  last_inspection_date date,
  next_due date,
  purchase_date date,
  first_use_date date,
  self_checked_at date,
  self_next_due date
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
    a.self_managed,
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
    a.purchase_date,
    a.first_use_date,
    sc.checked_at        as self_checked_at,
    sc.next_due          as self_next_due
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
  left join lateral (
    select s.checked_at, s.next_due
    from public.self_checks s
    where s.article_id = a.id
    order by s.checked_at desc, s.created_at desc
    limit 1
  ) sc on true
  where a.retired = false
    and a.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    );
$$;

grant execute on function public.my_articles() to authenticated;

-- ─── 2. my_article_detail(): dezelfde velden als de lijst ──────────────────
-- Het rijtype wijzigt, dus eerst droppen (create or replace mag dat niet,
-- foutcode 42P13 -- zelfde reden als bij migratie 20260733).

drop function if exists public.my_article_detail(uuid);

create function public.my_article_detail(p_article_id uuid)
returns table (
  id uuid,
  name text,
  brand text,
  material text,
  category text,
  product_type text,
  self_managed boolean,
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
  self_checked_at date,
  self_next_due date,
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
    coalesce(p.material, a.free_material)         as material,
    coalesce(p.category, a.free_category)         as category,
    coalesce(p.product_type, a.free_product_type) as product_type,
    a.self_managed,
    a.serial_number,
    a.assigned_user_name,
    a.manufacture_year,
    a.manufacture_month,
    a.purchase_date,
    a.first_use_date,
    coalesce(p.manual_url, a.free_manual_url)     as manual_url,
    nullif(
      coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end),
      a.recall_cleared_url
    ) as recall_url,
    li.result            as last_result,
    li.inspection_date   as last_inspection_date,
    li.next_due          as next_due,
    sc.checked_at        as self_checked_at,
    sc.next_due          as self_next_due,
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
  left join lateral (
    select s.checked_at, s.next_due
    from public.self_checks s
    where s.article_id = a.id
    order by s.checked_at desc, s.created_at desc
    limit 1
  ) sc on true
  where a.id = p_article_id
    and a.customer_id = (
      select m.customer_id from public.customer_members m
      where m.user_id = auth.uid() and m.active
      order by m.created_at limit 1
    );
$$;

grant execute on function public.my_article_detail(uuid) to authenticated;
