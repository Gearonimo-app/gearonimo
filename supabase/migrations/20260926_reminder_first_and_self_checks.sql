-- Herinneringsmail v3 (besloten met Jos, 2026-09-25): naast de herkeuringen
-- ook twee groepen die tot nu toe buiten de mail vielen:
--
--  1. "first_inspection" -- artikel nog nooit gekeurd (klant heeft het zelf
--     toegevoegd), wél een ingebruiknamedatum. Eerste keuring nodig op
--     ingebruikname + 12 maanden. Zelfde regel als de klant-app
--     (customerArticleStatus -> isFirstInspectionOverdue, EN 365).
--     Alleen types die gekeurd worden en niet self_managed zijn.
--  2. "self_check" -- de eigen afvinklijst (brandblusser, kettingzaag:
--     self_managed + type other/machine, zie selfCheckIntervalMonths in
--     packages/core/src/domains.ts). Datum = next_due van de laatste
--     afvinking; nog nooit afgevinkt -> ingebruikname (anders aankoop) +
--     12 maanden. Afgevinkt zonder vervolgdatum = klaar, geen herinnering
--     (zelfde als de app).
--
-- Verder dezelfde regels als v2 (20260925_reminder_per_article.sql): trigger
-- 30 dagen, bundel 60 dagen, niets wat al over datum is, elk artikel per
-- datum één keer (customer_reminder_items), max. 1 mail per 7 dagen.
--
-- Nieuwe functienaam i.p.v. reminder_due_articles aanpassen: het rijtype
-- verandert (kolom `kind`), en zo blijft de huidige Edge Function werken tot
-- de nieuwe code gedeployed is. reminder_due_articles en
-- customers_due_for_reminder kunnen daarna opgeruimd worden.
-- Idempotent.

create or replace function public.reminder_due_items(
  p_trigger_days integer default 30,
  p_bundle_days  integer default 60,
  p_cooldown_days integer default 7
)
returns table (
  customer_id     uuid,
  customer_name   text,
  article_id      uuid,
  article_name    text,
  serial_number   text,
  kind            text,  -- 'inspection' | 'first_inspection' | 'self_check'
  inspection_id   uuid,  -- alleen bij 'inspection'
  inspection_date date,  -- alleen bij 'inspection'
  next_due        date
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      a.id as article_id,
      a.customer_id,
      coalesce(p.name, a.free_description) as article_name,
      a.serial_number,
      coalesce(nullif(trim(coalesce(p.product_type, a.free_product_type)), ''), 'ppe') as product_type,
      a.self_managed,
      a.first_use_date,
      a.purchase_date,
      li.inspection_id,
      li.inspection_date,
      li.next_due as inspection_next_due,
      sc.checked_at as self_checked_at,
      sc.next_due as self_next_due
    from public.articles a
    left join public.products p on p.id = a.product_id
    -- Laatste keuring: zelfde als my_articles (20260762).
    left join lateral (
      select ii.next_due, i.id as inspection_id, i.inspection_date
      from public.inspection_items ii
      join public.inspections i on i.id = ii.inspection_id
      where ii.article_id = a.id
        and i.status = 'completed'
        and ii.result in ('passed', 'rejected')
      order by i.inspection_date desc, i.completed_at desc nulls last
      limit 1
    ) li on true
    -- Laatste eigen afvinking: zelfde als my_articles.
    left join lateral (
      select s.checked_at, s.next_due
      from public.self_checks s
      where s.article_id = a.id
      order by s.checked_at desc, s.created_at desc
      limit 1
    ) sc on true
    where a.retired = false
  ),
  classified as (
    -- Eigen afvinklijst
    select b.*, 'self_check'::text as kind,
      case
        when b.self_checked_at is not null then b.self_next_due
        else (coalesce(b.first_use_date, b.purchase_date) + interval '12 months')::date
      end as due
    from base b
    where b.self_managed and b.product_type in ('other', 'machine')
    union all
    -- Gekeurd door een keurbedrijf
    select b.*, 'inspection'::text, b.inspection_next_due
    from base b
    where not (b.self_managed and b.product_type in ('other', 'machine'))
      and b.inspection_id is not null
    union all
    -- Nog nooit gekeurd, wel in gebruik genomen
    select b.*, 'first_inspection'::text,
      (b.first_use_date + interval '12 months')::date
    from base b
    where not b.self_managed
      and b.product_type not in ('no_ppe', 'clothing', 'other')
      and b.inspection_id is null
      and b.first_use_date is not null
  ),
  open_items as (
    -- Bijna aan de beurt (niet al over datum) en nog niet eerder genoemd.
    select c.*
    from classified c
    where c.due is not null
      and c.due >= current_date
      and c.due <= current_date + p_bundle_days
      and not exists (
        select 1 from public.customer_reminder_items r
        where r.customer_id = c.customer_id
          and r.article_id = c.article_id
          and r.next_due = c.due
      )
  ),
  triggered as (
    select distinct o.customer_id
    from open_items o
    where o.due <= current_date + p_trigger_days
      and not exists (
        select 1 from public.customer_reminder_log g
        where g.customer_id = o.customer_id
          and g.status = 'sent'
          and g.sent_at > now() - make_interval(days => p_cooldown_days)
      )
  )
  select
    o.customer_id,
    cu.name as customer_name,
    o.article_id,
    o.article_name,
    o.serial_number,
    o.kind,
    case when o.kind = 'inspection' then o.inspection_id end,
    case when o.kind = 'inspection' then o.inspection_date end,
    o.due as next_due
  from open_items o
  join triggered t on t.customer_id = o.customer_id
  join public.customers cu on cu.id = o.customer_id
  order by o.customer_id, o.due, o.kind, o.article_name;
$$;

revoke all on function public.reminder_due_items(integer, integer, integer) from public;
revoke all on function public.reminder_due_items(integer, integer, integer) from authenticated;
grant execute on function public.reminder_due_items(integer, integer, integer) to service_role;
