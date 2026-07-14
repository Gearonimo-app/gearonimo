-- De klant-app toont recall_url automatisch op elk artikel van dat product --
-- ook als de keurmeester tijdens een keuring al heeft vastgesteld dat dit
-- specifieke exemplaar niet onder de recall valt, of dat de kwestie is
-- opgelost (zie clearRecallFlag in de inspector-app / articles.recall_cleared_url,
-- migratie 20260728_recall_notice_cleared.sql). Zonder deze aanpassing bleef
-- de rode 🚩 Recall dan onterecht op het klant-dashboard staan -- onnodige
-- paniek (Jos, 2026-07-14). nullif(x, y) geeft null als x = y: zo verdwijnt
-- de link zodra hij overeenkomt met de afgevinkte link, en verschijnt hij
-- vanzelf weer als products.recall_url later een nieuwe (andere) link krijgt.

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
    nullif(
      coalesce(p.recall_url, case when a.free_recall_flag then a.free_recall_url end),
      a.recall_cleared_url
    ) as recall_url,
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
