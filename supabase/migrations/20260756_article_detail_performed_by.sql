-- "Ik heb een naam ingevuld bij de controle, die hoort hier bij te staan"
-- (Jos 2026-08-04).
--
-- Klopt: add_my_self_check() slaat `performed_by` netjes op, maar
-- my_article_detail gaf alleen `checked_at` en `next_due` terug. De naam kwam
-- dus nergens uit de database vandaan.
--
-- Alleen op het detailscherm, bewust niet in de lijst: daar staat al
-- "afgevinkt op <datum>" achter serienummer en gebruiker, en er nog een naam
-- achter plakken maakt die regel op een telefoon onleesbaar.

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
  self_performed_by text,
  self_checked_by_member text,
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
    -- Wie het volgens de invuller heeft gedaan ("Stihl-dealer Jansen",
    -- "eigen controle") -- vrije tekst, zie DATAMODEL §3.
    sc.performed_by      as self_performed_by,
    -- En wie het in de app vastlegde. Dat is iets anders: de eerste is een
    -- bewering over de buitenwereld, de tweede is het spoor in het systeem.
    sc.member_name       as self_checked_by_member,
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
    select s.checked_at, s.next_due, s.performed_by, m.name as member_name
    from public.self_checks s
    left join public.customer_members m on m.id = s.created_by_member_id
    where s.article_id = a.id
    order by s.checked_at desc, s.created_at desc
    limit 1
  ) sc on true
  where a.id = p_article_id
    and a.customer_id = (
      select m2.customer_id from public.customer_members m2
      where m2.user_id = auth.uid() and m2.active
      order by m2.created_at limit 1
    );
$$;

grant execute on function public.my_article_detail(uuid) to authenticated;
