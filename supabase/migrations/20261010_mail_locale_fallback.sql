-- Taal van de herinneringsmail: terugval op het land van het keurbedrijf
-- (controle internationaal, Jos 2026-10-03).
--
-- Tot nu toe: eigen taalkeuze van de gebruiker (customer_members.locale, gezet
-- zodra hij de klant-app opent), anders de taal van het laatste certificaat,
-- anders Nederlands. Een Engelse klant die de app nooit opende en nog geen
-- certificaat in Gearonimo heeft -- typisch: geïmporteerde klanten, die
-- hebben bewust geen certificaat-rij -- kreeg dus een Nederlandse mail.
--
-- Nu, in deze volgorde:
--   1. eigen taalkeuze van de gebruiker
--   2. taal van het laatste certificaat van de klant
--   3. land van het actief gekoppelde keurbedrijf (customer_links)
--   4. land van het keurbedrijf van de laatste keuring (ook geïmporteerd)
--   5. Nederlands
-- Land → taal: zelfde tabel als certLanguageForCountry() in
-- apps/inspector/src/composables/useCertificate.ts (wijzig je de één, wijzig
-- dan de ander).
--
-- Eén gedeelde functie (customer_mail_locale) voor de beheerders- én de
-- eigenaarsmail, zodat die twee nooit verschillend kiezen. Verder zijn
-- reminder_recipients en reminder_owner_recipients identiek aan 20260925 en
-- 20261001. Idempotent.

create or replace function public.locale_for_country(p_country text)
returns text
language sql
immutable
as $$
  select case
    when p_country is null or btrim(p_country) = '' then null
    when upper(p_country) in ('NL', 'BE') then 'nl'
    when upper(p_country) = 'FR' then 'fr'
    when upper(p_country) in ('DE', 'AT', 'CH') then 'de'
    else 'en'
  end
$$;

create or replace function public.customer_mail_locale(p_customer_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select ce.language
      from public.certificates ce
      join public.inspections i on i.id = ce.inspection_id
      where i.customer_id = p_customer_id
        and ce.language in ('nl', 'en', 'fr', 'de')
      order by ce.issued_at desc
      limit 1
    ),
    (
      select public.locale_for_country(ic.country_code)
      from public.customer_links cl
      join public.inspection_companies ic on ic.id = cl.company_id
      where cl.customer_id = p_customer_id
        and cl.status = 'active'
      order by cl.started_at desc
      limit 1
    ),
    (
      select public.locale_for_country(ic.country_code)
      from public.inspections i
      join public.inspection_companies ic on ic.id = i.company_id
      where i.customer_id = p_customer_id
      order by i.inspection_date desc, i.created_at desc
      limit 1
    ),
    'nl'
  )
$$;

revoke all on function public.customer_mail_locale(uuid) from public;
revoke all on function public.customer_mail_locale(uuid) from authenticated;
grant execute on function public.customer_mail_locale(uuid) to service_role;

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
    coalesce(m.locale, public.customer_mail_locale(m.customer_id)) as locale
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

create or replace function public.reminder_owner_recipients(p_article_ids uuid[])
returns table (
  article_id  uuid,
  customer_id uuid,
  member_id   uuid,
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
    a.id,
    a.customer_id,
    m.id,
    btrim(m.email),
    m.name,
    coalesce(m.locale, public.customer_mail_locale(m.customer_id)) as locale
  from public.articles a
  join public.customer_members m on m.id = a.assigned_member_id
  where a.id = any(p_article_ids)
    and m.customer_id = a.customer_id
    and m.user_id is not null
    and m.active
    and not m.is_admin
    and btrim(coalesce(m.email, '')) <> '';
$$;

revoke all on function public.reminder_owner_recipients(uuid[]) from public;
revoke all on function public.reminder_owner_recipients(uuid[]) from authenticated;
grant execute on function public.reminder_owner_recipients(uuid[]) to service_role;
