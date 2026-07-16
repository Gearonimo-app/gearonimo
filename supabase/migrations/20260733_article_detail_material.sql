-- Materiaal ontbrak in het artikeldetail van de klant-app (Jos, 2026-07-15).
-- brand kwam al mee (coalesce(p.brand, a.free_brand)) maar werd alleen in de
-- paginatitel gebruikt, niet in het lijstje -- dat is een front-end-fix.
-- material stond nergens in de RPC; erbij via hetzelfde catalogus/vrij-
-- artikel-coalesce-patroon (products.material / articles.free_material,
-- DATAMODEL §2/§3).
--
-- Een extra kolom in de returns table wijzigt het rijtype van de functie --
-- "create or replace" mag dat niet (42P13), eerst droppen.

drop function if exists public.my_article_detail(uuid);

create function public.my_article_detail(p_article_id uuid)
returns table (
  id uuid,
  name text,
  brand text,
  material text,
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
    coalesce(p.material, a.free_material)         as material,
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
