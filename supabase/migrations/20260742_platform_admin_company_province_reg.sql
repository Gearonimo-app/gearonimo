-- Aanvulling op 20260741 (feedback Jos 2026-07-19): het aanmaakformulier
-- consistent met Certificaat-template -- provincie (relevant voor Canada),
-- KvK-/registratienummer en BTW-nummer erbij. Kolommen bestonden al
-- (20260630_company_address_extra); alleen de RPC-signature groeit.
--
-- Zelfde overload-valkuil als bij 20260741: nieuwe parameters = voor
-- Postgres een andere functie, dus de 7-parameter versie eerst droppen.

drop function if exists public.platform_admin_create_company(text, text, text, text, text, text, text);

create or replace function public.platform_admin_create_company(
  p_name text,
  p_country_code text default 'NL',
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_postal_code text default null,
  p_city text default null,
  p_province text default null,
  p_registration_number text default null,
  p_vat_number text default null
)
returns public.inspection_companies
language plpgsql security definer set search_path = public
as $$
declare
  result public.inspection_companies;
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag een keurbedrijf aanmaken.';
  end if;
  insert into public.inspection_companies
    (name, country_code, email, phone, address, postal_code, city, province, registration_number, vat_number)
  values (
    trim(p_name),
    coalesce(nullif(trim(p_country_code), ''), 'NL'),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_postal_code, '')), ''),
    nullif(trim(coalesce(p_city, '')), ''),
    nullif(trim(coalesce(p_province, '')), ''),
    nullif(trim(coalesce(p_registration_number, '')), ''),
    nullif(trim(coalesce(p_vat_number, '')), '')
  )
  returning * into result;
  return result;
end;
$$;

grant execute on function public.platform_admin_create_company(text, text, text, text, text, text, text, text, text, text) to authenticated;
