-- Klant-app: de beheerder kon nog nergens de eigen bedrijfsgegevens (adres,
-- KvK/BTW, contactpersoon, bedrijfstelefoon/-email) invullen -- dat kon
-- alleen de keurmeester, via het klantformulier in de Pro-app. Vooral sinds
-- de zelf-aanmelden-flow (20260717_inspection_requests_leadmotor.sql) is dat
-- een gat: zo'n klant heeft geen keurmeester die het voor hem invult (Jos,
-- 2026-07-14).
--
-- 1) my_customer() geeft er de bedrijfsvelden bij (return-type wijzigt, dus
--    eerst droppen; de app leest kolommen op naam en blijft dus werken).
drop function if exists public.my_customer();

create or replace function public.my_customer()
returns table (
  customer_id uuid, customer_name text, member_name text, member_id uuid,
  is_admin boolean, invite_code text,
  email text, phone text, contact_person text,
  kvk_number text, vat_number text,
  street text, house_number text, house_number_addition text,
  postal_code text, city text, province text, country text
)
language sql
security definer
set search_path = public
as $$
  select
    c.id, c.name, m.name, m.id, m.is_admin, c.invite_code,
    c.email, c.phone, c.contact_person,
    c.kvk_number, c.vat_number,
    c.street, c.house_number, c.house_number_addition,
    c.postal_code, c.city, c.province, c.country
  from public.customer_members m
  join public.customers c on c.id = m.customer_id
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
$$;

grant execute on function public.my_customer() to authenticated;

-- 2) Wijzigen: alleen de beheerder (zelfde lijn als update_my_article). `name`
--    blijft bewust altijd gezet -- coalesce/nullif zorgt dat een leeg
--    ingestuurd veld de bestaande naam niet wist (dat is elders verplicht/
--    zichtbaar, bv. op certificaten). De rest mag leeg.
create or replace function public.update_my_customer(
  p_name text default null,
  p_email text default null,
  p_phone text default null,
  p_contact_person text default null,
  p_kvk_number text default null,
  p_vat_number text default null,
  p_street text default null,
  p_house_number text default null,
  p_house_number_addition text default null,
  p_postal_code text default null,
  p_city text default null,
  p_province text default null,
  p_country text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer uuid;
  v_is_admin boolean;
begin
  select m.customer_id, m.is_admin into v_customer, v_is_admin
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;

  if v_customer is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;
  if not coalesce(v_is_admin, false) then
    raise exception 'Alleen een beheerder mag bedrijfsgegevens aanpassen.';
  end if;

  update public.customers
  set
    name                   = coalesce(nullif(trim(coalesce(p_name, '')), ''), name),
    email                  = nullif(trim(coalesce(p_email, '')), ''),
    phone                  = nullif(trim(coalesce(p_phone, '')), ''),
    contact_person         = nullif(trim(coalesce(p_contact_person, '')), ''),
    kvk_number             = nullif(trim(coalesce(p_kvk_number, '')), ''),
    vat_number             = nullif(trim(coalesce(p_vat_number, '')), ''),
    street                 = nullif(trim(coalesce(p_street, '')), ''),
    house_number           = nullif(trim(coalesce(p_house_number, '')), ''),
    house_number_addition  = nullif(trim(coalesce(p_house_number_addition, '')), ''),
    postal_code            = nullif(trim(coalesce(p_postal_code, '')), ''),
    city                   = nullif(trim(coalesce(p_city, '')), ''),
    province               = nullif(trim(coalesce(p_province, '')), ''),
    country                = nullif(trim(coalesce(p_country, '')), '')
  where id = v_customer;
end;
$$;

grant execute on function public.update_my_customer(
  text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
