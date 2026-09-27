-- Herinneringsmail ook naar de eigenaar van de spullen (besluit Jos
-- 2026-09-26, BOUWPLAN "Besluit: klantrollen, eigenaar per artikel,
-- inloggen", stap 4).
--
-- Beheerders krijgen zoals nu álles (reminder_recipients, ongewijzigd).
-- Nieuw: een gebruiker MET account krijgt een mail met alleen zijn eigen
-- spullen (articles.assigned_member_id, sinds 20260928). Zonder account
-- ("Voorraad", Jan die geen app wil) geen mail -- die spullen staan al in de
-- mail van de beheerder. Is de eigenaar zelf beheerder, dan krijgt hij alleen
-- de beheerdersmail (geen dubbele).
--
-- Welke artikelen "aan de beurt" zijn blijft in reminder_due_items; deze
-- functie zegt alleen per artikel wie de eigenaar-ontvanger is. Taal: zelfde
-- volgorde als reminder_recipients (eigen voorkeur, anders de taal van het
-- laatste certificaat, anders nl).
--
-- Idempotent. Nog uit te voeren door Jos in de Supabase SQL-editor, en
-- daarna de Edge Function send-reinspection-reminders opnieuw deployen.

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
