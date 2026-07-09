-- Fix (Jos-test 2026-07-09, stap 16): "new row violates row-level security
-- policy for table customers" bij het aanmaken van een klant in de Pro-app.
--
-- Oorzaak: het klantformulier deed een RECHTSTREEKSE `insert into customers`
-- (useCustomers.createCustomer). Sinds de RLS-ronde (20260713) staat er een
-- insert-policy `with check (is_active_inspector())` op customers, maar een
-- rechtstreekse insert blijft kwetsbaar voor drift in de live-policies (de
-- fout die Jos ziet betekent dat die insert-check daar niet greep). Elke
-- ANDERE klant-schrijfactie in deze app loopt al bewust via een security
-- definer-RPC die RLS omzeilt en zelf autoriseert (save_my_member,
-- add_my_article, self_register_customer, ...). Klant aanmaken was de enige
-- uitzondering; die trekken we hier recht.
--
-- create_customer(): security definer, autoriseert op "actieve keurmeester"
-- (net als de insert-policy), en geeft bij een klant-account een duidelijke
-- NL-melding i.p.v. de rauwe RLS-fout. De bestaande AFTER-INSERT-trigger
-- link_new_customer_to_company koppelt de nieuwe klant automatisch aan het
-- bedrijf van de keurmeester (die trigger leest auth.uid(), wat in een
-- definer-functie gewoon de ingelogde gebruiker blijft).

create or replace function public.create_customer(
  p_name                  text,
  p_email                 text default null,
  p_customer_number       text default null,
  p_kvk_number            text default null,
  p_vat_number            text default null,
  p_contact_person        text default null,
  p_phone                 text default null,
  p_street                text default null,
  p_house_number          text default null,
  p_house_number_addition text default null,
  p_postal_code           text default null,
  p_city                  text default null,
  p_province              text default null,
  p_country               text default null,
  p_notes                 text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_active_inspector() then
    raise exception 'Alleen een keurmeester kan een klant aanmaken.';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Naam is verplicht.';
  end if;

  insert into public.customers (
    name, email, customer_number, kvk_number, vat_number, contact_person,
    phone, street, house_number, house_number_addition, postal_code,
    city, province, country, notes
  )
  values (
    trim(p_name),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_customer_number, '')), ''),
    nullif(trim(coalesce(p_kvk_number, '')), ''),
    nullif(trim(coalesce(p_vat_number, '')), ''),
    nullif(trim(coalesce(p_contact_person, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_street, '')), ''),
    nullif(trim(coalesce(p_house_number, '')), ''),
    nullif(trim(coalesce(p_house_number_addition, '')), ''),
    nullif(trim(coalesce(p_postal_code, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_province, '')), ''),
    nullif(trim(coalesce(p_country, '')), ''),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_customer(
  text, text, text, text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
