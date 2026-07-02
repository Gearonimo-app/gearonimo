-- Klant-app: afgekeurd materiaal kunnen afvoeren na vervanging (vraag Jos
-- 2026-07-02: "wat als de klant een nieuwe friction saver koopt -- dan
-- blijft de oude afgekeurd om actie roepen"). Zelfde mechanisme als de
-- keurmeester-app: retired = true (uit het scherm en uit volgende
-- keuringen; historie en certificaten blijven in de database).
--
-- Bewust beperkt tot artikelen waarvan de LAATSTE afgeronde keuring
-- 'rejected' was: afgekeurd materiaal moet sowieso weg, dus dat mag de
-- klant zelf bevestigen. Goedgekeurd/nog-niet-gekeurd materiaal afvoeren
-- blijft aan de keurmeester -- anders kan een klant per ongeluk actief
-- materiaal uit de keurlijsten laten verdwijnen.

alter table public.articles
  add column if not exists retired_at timestamptz;

create or replace function public.retire_my_article(p_article_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_last_result text;
begin
  select m.customer_id into v_customer
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;

  if not exists (
    select 1 from public.articles a
    where a.id = p_article_id and a.customer_id = v_customer and a.retired = false
  ) then
    raise exception 'Artikel niet gevonden bij jouw bedrijf.';
  end if;

  select ii.result into v_last_result
  from public.inspection_items ii
  join public.inspections i on i.id = ii.inspection_id
  where ii.article_id = p_article_id
    and i.status = 'completed'
    and ii.result in ('passed', 'rejected')
  order by i.inspection_date desc, i.completed_at desc nulls last
  limit 1;

  if v_last_result is distinct from 'rejected' then
    raise exception 'Alleen afgekeurd materiaal kan hier afgevoerd worden -- neem voor ander materiaal contact op met je keurmeester.';
  end if;

  update public.articles
  set retired = true, retired_at = now()
  where id = p_article_id;
end;
$$;

grant execute on function public.retire_my_article(uuid) to authenticated;
