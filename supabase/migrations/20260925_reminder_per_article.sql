-- Herinneringsmail v2 (besloten met Jos, 2026-09-25). Vervangt de regel
-- "max 1 mail per 30 dagen per klant" uit 20260921_customer_reminder_mail.sql.
--
-- Probleem met v1: keuring A verloopt 25 nov, keuring B 30 nov. Op 26 okt
-- ging er een mail over A (B viel nog buiten de 30 dagen), daarna 30 dagen
-- stilte -- B werd pas op 25 nov genoemd, 5 dagen van tevoren. En de mail
-- noemde alleen een aantal, geen datums.
--
-- Nieuwe regels:
--  1. Een mail gaat uit zodra een artikel binnen 30 dagen verloopt dat nog
--     NIET eerder in een mail genoemd is ("trigger").
--  2. In die mail komen alle nog niet genoemde artikelen die binnen 60 dagen
--     verlopen ("bundel") -- zo zitten A en B samen in de mail van 26 okt.
--  3. Per artikel + verloopdatum wordt onthouden dat het genoemd is
--     (customer_reminder_items). Elk artikel komt dus één keer langs; na een
--     nieuwe keuring (nieuwe verloopdatum) telt het weer als nieuw.
--  4. Alleen bijna-verlopen keuringen: wat al over datum is, komt niet in de
--     mail (besluit Jos).
--  5. Vangnet tegen spam: hooguit één geslaagde mail per 7 dagen per klant.
--     Met de 60-dagenbundel betekent dat hooguit een paar dagen later bericht,
--     nooit minder dan ~23 dagen van tevoren.
--
-- Plus: taal van de mail. De taalkeuze stond alleen in de browser
-- (localStorage); nu slaat de klant-app hem ook op bij de gebruiker
-- (customer_members.locale). Nog nooit ingelogd sinds deze wijziging? Dan de
-- taal van het laatste certificaat van dat bedrijf, anders Nederlands.
--
-- Idempotent.

-- ─── Taalvoorkeur per klantgebruiker ────────────────────────────────────────
alter table public.customer_members
  add column if not exists locale text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'customer_members_locale_check'
  ) then
    alter table public.customer_members
      add constraint customer_members_locale_check
      check (locale is null or locale in ('nl', 'en', 'fr', 'de'));
  end if;
end $$;

-- De klant-app roept dit aan na inloggen en bij elke taalwissel. Security
-- definer + alleen de eigen rijen (user_id = auth.uid()): een gewone
-- medewerker mag zijn eigen taal zetten zonder beheerdersrechten op
-- customer_members. Geen sessie of geen koppeling -> doet niets.
create or replace function public.set_my_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_locale is null or p_locale not in ('nl', 'en', 'fr', 'de') then
    return;
  end if;
  update public.customer_members
     set locale = p_locale
   where user_id = auth.uid()
     and locale is distinct from p_locale;
end;
$$;

revoke all on function public.set_my_locale(text) from public;
grant execute on function public.set_my_locale(text) to authenticated;

-- ─── Welke artikelen zijn al genoemd ─────────────────────────────────────────
-- Eén rij per (klant, artikel, verloopdatum) die in een geslaagde mail stond.
-- Zelfde toegangsmodel als customer_reminder_log: alleen de Edge Function
-- (service-role) komt erbij.
create table if not exists public.customer_reminder_items (
  customer_id uuid not null references public.customers(id) on delete cascade,
  article_id  uuid not null references public.articles(id) on delete cascade,
  next_due    date not null,
  notified_at timestamptz not null default now(),
  primary key (customer_id, article_id, next_due)
);

alter table public.customer_reminder_items enable row level security;
revoke all on public.customer_reminder_items from anon, authenticated;
grant select, insert on public.customer_reminder_items to service_role;
grant select, insert on public.customer_reminder_log to service_role;

-- ─── Welke artikelen moeten in de mail? ──────────────────────────────────────
-- Eén rij per artikel. "Laatste keuring per artikel" net als my_articles
-- (20260762): de laatste afgeronde keuring met uitslag passed/rejected --
-- zodat de datum in de mail dezelfde is als die de klant in het portaal ziet.
create or replace function public.reminder_due_articles(
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
  inspection_id   uuid,
  inspection_date date,
  next_due        date
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    select
      a.id as article_id,
      a.customer_id,
      coalesce(p.name, a.free_description) as article_name,
      a.serial_number,
      li.inspection_id,
      li.inspection_date,
      li.next_due
    from public.articles a
    left join public.products p on p.id = a.product_id
    join lateral (
      select ii.next_due, i.id as inspection_id, i.inspection_date
      from public.inspection_items ii
      join public.inspections i on i.id = ii.inspection_id
      where ii.article_id = a.id
        and i.status = 'completed'
        and ii.result in ('passed', 'rejected')
      order by i.inspection_date desc, i.completed_at desc nulls last
      limit 1
    ) li on true
    where a.retired = false
  ),
  open_items as (
    -- Bijna verlopen (niet al over datum) en nog niet eerder genoemd.
    select l.*
    from latest l
    where l.next_due is not null
      and l.next_due >= current_date
      and l.next_due <= current_date + p_bundle_days
      and not exists (
        select 1 from public.customer_reminder_items r
        where r.customer_id = l.customer_id
          and r.article_id = l.article_id
          and r.next_due = l.next_due
      )
  ),
  triggered as (
    select distinct o.customer_id
    from open_items o
    where o.next_due <= current_date + p_trigger_days
      and not exists (
        select 1 from public.customer_reminder_log g
        where g.customer_id = o.customer_id
          and g.status = 'sent'
          and g.sent_at > now() - make_interval(days => p_cooldown_days)
      )
  )
  select
    o.customer_id,
    c.name as customer_name,
    o.article_id,
    o.article_name,
    o.serial_number,
    o.inspection_id,
    o.inspection_date,
    o.next_due
  from open_items o
  join triggered t on t.customer_id = o.customer_id
  join public.customers c on c.id = o.customer_id
  order by o.customer_id, o.next_due, o.inspection_date, o.article_name;
$$;

revoke all on function public.reminder_due_articles(integer, integer, integer) from public;
revoke all on function public.reminder_due_articles(integer, integer, integer) from authenticated;
grant execute on function public.reminder_due_articles(integer, integer, integer) to service_role;

-- ─── Naar wie, en in welke taal? ─────────────────────────────────────────────
-- Actieve beheerders met een e-mailadres. Taal: eigen voorkeur, anders de
-- taal van het laatste certificaat van dat bedrijf, anders Nederlands.
create or replace function public.reminder_recipients(p_customer_ids uuid[])
returns table (
  customer_id uuid,
  email       text,
  name        text,
  locale      text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.customer_id,
    m.email,
    m.name,
    coalesce(
      m.locale,
      (
        select ce.language
        from public.certificates ce
        join public.inspections i on i.id = ce.inspection_id
        where i.customer_id = m.customer_id
          and ce.language in ('nl', 'en', 'fr', 'de')
        order by ce.issued_at desc
        limit 1
      ),
      'nl'
    ) as locale
  from public.customer_members m
  where m.customer_id = any(p_customer_ids)
    and m.is_admin
    and m.active
    and m.email is not null
    and m.email <> '';
$$;

revoke all on function public.reminder_recipients(uuid[]) from public;
revoke all on function public.reminder_recipients(uuid[]) from authenticated;
grant execute on function public.reminder_recipients(uuid[]) to service_role;

-- De oude functie wordt niet meer gebruikt door de Edge Function.
drop function if exists public.customers_due_for_reminder(integer);
