-- Opruimen na het besluit klantrollen/inloggen (Jos 2026-09-26: "haal
-- end_user weg, en als er dode code is achtergebleven ook opruimen").
--
-- 1. customer_members.role = 'end_user' weg. Dat was geen functie die
--    iemand typte, maar de standaardwaarde die de live database invulde bij
--    de oude code-koppeling (schema-controle 2026-09-26). In de app is role
--    de vrije "Functie"; die hoort dan leeg te zijn. De standaardwaarde gaat
--    er ook af, zodat het niet opnieuw gebeurt.
-- 2. De klant-uitnodigingscode is sinds 20260929 vervallen (inloggen op
--    e-mailadres). Weg: de oude koppelfunctie join_customer_by_invite, de
--    kolom customers.invite_code met zijn index, en invite_code in
--    my_customer() (de app leest hem nergens meer).
--    NIET weg: de uitnodigingscode voor keurmeesters (inspectors.invite_code,
--    join_inspector_by_invite) en invite_attempts -- die horen bij een andere
--    stroom en zijn nog in gebruik.
--
-- Idempotent. Nog uit te voeren door Jos in de Supabase SQL-editor.

-- ─── 1. end_user ────────────────────────────────────────────────────────────
update public.customer_members
set role = null
where role = 'end_user';

alter table public.customer_members
  alter column role drop default;

-- ─── 2a. my_customer() zonder invite_code ───────────────────────────────────
-- Rijtype wijzigt, dus eerst droppen (create or replace mag dat niet). De
-- app leest de kolommen op naam.
drop function if exists public.my_customer();
create function public.my_customer()
returns table (
  customer_id uuid, customer_name text, member_name text, member_id uuid,
  is_admin boolean,
  email text, phone text, contact_person text,
  kvk_number text, vat_number text,
  street text, house_number text, house_number_addition text,
  postal_code text, city text, province text, country text,
  enabled_domains text[]
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.name, m.name, m.id, m.is_admin,
    c.email, c.phone, c.contact_person,
    c.kvk_number, c.vat_number,
    c.street, c.house_number, c.house_number_addition,
    c.postal_code, c.city, c.province, c.country,
    coalesce(c.enabled_domains, '{climbing}')
  from public.customer_members m
  join public.customers c on c.id = m.customer_id
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
$$;

grant execute on function public.my_customer() to authenticated;

-- ─── 2b. Oude koppelfunctie en de code zelf ─────────────────────────────────
drop function if exists public.join_customer_by_invite(text, text);

drop index if exists public.customers_invite_code_key;
alter table public.customers
  drop column if exists invite_code;
