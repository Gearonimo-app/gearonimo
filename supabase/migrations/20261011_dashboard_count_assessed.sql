-- Dashboardteller "binnenkort keuren": alleen beoordeelde regels tellen
-- (controle internationaal, Jos 2026-10-03).
--
-- upcoming_reinspections_count() nam per artikel de laatste regel van een
-- afgeronde keuring, ook als die "niet beoordeeld" was (vergeten op de
-- keurdag, geen volgende keurdatum). Dat artikel viel dan van de teller af,
-- terwijl het juist nog gekeurd moet worden. De klant-app (my_articles) en de
-- herinneringsmail (reminder_due_items) sloegen 'not_assessed' al over; nu
-- doet de teller hetzelfde. Verder identiek aan 20260738. Idempotent.

create or replace function public.upcoming_reinspections_count(days_ahead integer default 30)
returns integer
language sql stable
as $$
  select count(*)::integer
  from (
    select distinct on (ii.article_id)
      ii.next_due
    from public.inspection_items ii
    join public.inspections i on i.id = ii.inspection_id
    join public.articles a on a.id = ii.article_id
    where i.status = 'completed'
      and a.retired = false
      and ii.result in ('passed', 'rejected')
    -- completed_at als tiebreaker bij twee keuringen op dezelfde dag,
    -- gelijk aan my_articles in de klant-app (code review punt 16).
    order by ii.article_id, i.inspection_date desc, i.completed_at desc nulls last
  ) latest
  where latest.next_due is not null
    and latest.next_due >= current_date
    and latest.next_due <= (current_date + days_ahead)
$$;
