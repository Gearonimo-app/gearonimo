-- Maandelijkse herinneringsmail aan klanten (besloten met Jos, 2026-09-21):
-- "wat is er bijna aan herkeuring toe" (binnen 30 dagen), naar de
-- beheerder(s) van het klantbedrijf (customer_members.is_admin), max. 1x
-- per maand per klant. Verzending zelf gebeurt in een Edge Function
-- (supabase/functions/send-reinspection-reminders) via Zoho ZeptoMail; deze
-- migratie legt alleen de databasekant vast: wie is aan de beurt, en een log
-- om dat te onthouden.
--
-- Bewust dagelijks aanroepen (zie cron hieronder) i.p.v. één keer per maand:
-- als de dagelijkse run een keer faalt (Edge Function down, ZeptoMail-
-- storing) probeert de volgende dag het gewoon opnieuw, in plaats van dat een
-- klant die maand overslaat. De "max 1x per maand"-regel zit daarom niet in
-- het schema, maar in de query hieronder (30 dagen cooldown per klant).
-- Idempotent.

-- ─── Logboek: wie kreeg wanneer een herinnering ─────────────────────────────
-- Zelfde opzet als invite_attempts (20260738): niemand mag hier rechtstreeks
-- bij, alleen de Edge Function (met de service-role-sleutel, die altijd om
-- RLS heen gaat).
create table if not exists public.customer_reminder_log (
  id                  uuid primary key default gen_random_uuid(),
  customer_id         uuid not null references public.customers(id) on delete cascade,
  sent_at             timestamptz not null default now(),
  due_count           integer not null,
  recipient_email     text not null,
  status              text not null default 'sent',
  provider_message_id text
);

create index if not exists customer_reminder_log_customer_id_idx
  on public.customer_reminder_log (customer_id, sent_at desc);

alter table public.customer_reminder_log enable row level security;
revoke all on public.customer_reminder_log from anon, authenticated;

-- ─── Wie is er aan de beurt? ─────────────────────────────────────────────────
-- Security definer + expliciet NIET aan authenticated gegrant: dit levert
-- beheerder-e-mailadressen dwars door alle klantbedrijven heen, dus mag
-- alleen de service-role (de Edge Function) dit aanroepen.
--
-- Zelfde "laatste keuring per artikel telt"-logica als
-- upcoming_reinspections_count (20260714) / my_articles (20260762), maar dan
-- gegroepeerd per klant i.p.v. gescopeerd op de ingelogde keurmeester.
create or replace function public.customers_due_for_reminder(p_days_ahead integer default 30)
returns table (
  customer_id uuid,
  customer_name text,
  admin_email text,
  admin_name text,
  due_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  with latest as (
    select distinct on (ii.article_id)
      ii.article_id, a.customer_id, ii.next_due
    from public.inspection_items ii
    join public.inspections i on i.id = ii.inspection_id
    join public.articles a on a.id = ii.article_id
    where i.status = 'completed'
      and a.retired = false
    order by ii.article_id, i.inspection_date desc, i.completed_at desc nulls last
  ),
  due as (
    select customer_id, count(*)::integer as due_count
    from latest
    where next_due is not null
      and next_due >= current_date
      and next_due <= (current_date + p_days_ahead)
    group by customer_id
  )
  select
    c.id   as customer_id,
    c.name as customer_name,
    m.email as admin_email,
    m.name  as admin_name,
    d.due_count
  from due d
  join public.customers c on c.id = d.customer_id
  join public.customer_members m
    on m.customer_id = c.id
    and m.is_admin
    and m.active
    and m.email is not null
    and m.email <> ''
  -- Alleen een geslaagde verzending ('sent') telt voor de cooldown: een
  -- mislukte poging (ZeptoMail-storing, tijdelijk kapot adres) mag de
  -- volgende nacht gewoon opnieuw geprobeerd worden, anders slaat een klant
  -- door één foutieve nacht een hele maand over.
  where not exists (
    select 1 from public.customer_reminder_log l
    where l.customer_id = c.id
      and l.status = 'sent'
      and l.sent_at > now() - interval '30 days'
  );
$$;

revoke all on function public.customers_due_for_reminder(integer) from public;
revoke all on function public.customers_due_for_reminder(integer) from authenticated;

-- ─── Dagelijkse cron: roept de Edge Function aan ────────────────────────────
-- Vereist de extensies pg_cron en pg_net (staan bij Supabase standaard klaar,
-- in de meeste projecten al aan; zie de instructies bij deze migratie als
-- "extension does not exist").
--
-- De service-role-sleutel staat NIET in dit bestand (dat zou een geheim in
-- git zetten) -- die zet Jos eenmalig apart in Supabase Vault, zie de
-- meegeleverde instructies. Deze cron leest 'm daar vandaan.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-reinspection-reminders-daily') then
    perform cron.unschedule('send-reinspection-reminders-daily');
  end if;
end $$;

select cron.schedule(
  'send-reinspection-reminders-daily',
  '0 6 * * *',  -- elke dag 06:00 UTC (07:00/08:00 NL-tijd, winter/zomer)
  $$
  select net.http_post(
    url := 'https://buitfeiclivzzldfdelp.supabase.co/functions/v1/send-reinspection-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
