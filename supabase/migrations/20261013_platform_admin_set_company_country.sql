-- Land van een keurbedrijf wijzigen (live test 2026-10-03).
--
-- Het land (inspection_companies.country_code) bepaalt de taal van het
-- certificaat en van de herinneringsmail, en de wettelijke keurtermijnen
-- (GB: PBM 6 maanden). Het was alleen bij het aanmaken te kiezen: Testbedrijf
-- stond op Nederland en kon in de app niet naar Engeland. Alleen de
-- platformbeheerder mag dit, net als aanmaken (platform_admin_create_company).
--
-- Bestaande certificaten veranderen niet (die zijn vastgelegd); het nieuwe
-- land geldt voor keuringen die daarna worden afgerond.
--
-- Idempotent.

create or replace function public.platform_admin_set_company_country(p_company_id uuid, p_country_code text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag het land van een keurbedrijf wijzigen.';
  end if;
  if p_country_code is null or p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Ongeldige landcode.';
  end if;
  update public.inspection_companies
     set country_code = p_country_code
   where id = p_company_id;
  if not found then
    raise exception 'Keurbedrijf niet gevonden.';
  end if;
end;
$function$;

revoke all on function public.platform_admin_set_company_country(uuid, text) from public;
grant execute on function public.platform_admin_set_company_country(uuid, text) to authenticated;
