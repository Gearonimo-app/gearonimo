-- Bedrijfsgegevens meteen bij aanmaken (besluit Jos 2026-07-19, feedback op
-- 20260740): een kaal naam+landcode-formulier was te mager. Logo/huiskleur/
-- kop-voettekst blijven bewust WEG uit dit formulier -- die horen al bij
-- Instellingen -> Certificaat-template (CertificateSettings.vue, met
-- upload-flow die een bestaand company_id nodig heeft) en regelt het bedrijf
-- zelf zodra er een beheerder gekoppeld is.
--
-- Signature wijzigt (nieuwe optionele parameters aan het eind) -- Postgres
-- identificeert een functie op naam + argumenttypes, dus dit is voor
-- Postgres een ANDERE functie dan de 2-parameter versie uit 20260740. Eerst
-- de oude expliciet droppen zodat er geen dubbele overload blijft hangen.

drop function if exists public.platform_admin_create_company(text, text);

create or replace function public.platform_admin_create_company(
  p_name text,
  p_country_code text default 'NL',
  p_email text default null,
  p_phone text default null,
  p_address text default null,
  p_postal_code text default null,
  p_city text default null
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
  insert into public.inspection_companies (name, country_code, email, phone, address, postal_code, city)
  values (
    trim(p_name),
    coalesce(nullif(trim(p_country_code), ''), 'NL'),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_postal_code, '')), ''),
    nullif(trim(coalesce(p_city, '')), '')
  )
  returning * into result;
  return result;
end;
$$;

grant execute on function public.platform_admin_create_company(text, text, text, text, text, text, text) to authenticated;
