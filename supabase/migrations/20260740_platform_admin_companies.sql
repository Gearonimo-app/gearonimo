-- Platform-admin "Bedrijven"-beheer (besluit Jos 2026-07-19).
--
-- Gat gevonden: platform_admin kon geen enkel keurbedrijf aanmaken of
-- zichzelf/iemand anders als beheerder aan een bedrijf koppelen.
-- `inspection_companies` had geen insert-policy; `inspectors insert/update
-- own company` (20260739) vereist al is_company_admin(company_id) -- een
-- kip-ei-probleem voor een nieuw bedrijf zonder beheerder. Opgelost via
-- security-definer-RPC's (zelfde patroon als ensure_inspector/
-- is_platform_admin), geen RLS-policies erbij: alles loopt door de
-- platform_admin-check in de functie zelf, de tabellen blijven op slot voor
-- direct tabelverkeer van een platform_admin die geen keurmeester is.
--
-- Let op, echte grens in het datamodel: `inspectors.user_id` is UNIQUE
-- (20260626) -- één account = één keurbedrijf tegelijk. Jezelf toevoegen
-- aan bedrijf B verplaatst je dus weg van bedrijf A als je daar al stond;
-- er is geen "actief bij meerdere bedrijven tegelijk". Dat is bewust niet
-- meegenomen hier -- zou een company-switcher vereisen, een veel grotere
-- wijziging.

create or replace function public.platform_admin_create_company(
  p_name text,
  p_country_code text default 'NL'
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
  insert into public.inspection_companies (name, country_code)
  values (trim(p_name), coalesce(nullif(trim(p_country_code), ''), 'NL'))
  returning * into result;
  return result;
end;
$$;

grant execute on function public.platform_admin_create_company(text, text) to authenticated;

create or replace function public.platform_admin_list_companies()
returns table (
  id uuid,
  name text,
  country_code text,
  created_at timestamptz,
  inspector_count bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag deze lijst zien.';
  end if;
  return query
    select c.id, c.name, c.country_code, c.created_at,
           count(i.id) filter (where i.active) as inspector_count
    from public.inspection_companies c
    left join public.inspectors i on i.company_id = c.id
    group by c.id
    order by c.name;
end;
$$;

grant execute on function public.platform_admin_list_companies() to authenticated;

create or replace function public.platform_admin_list_inspectors(p_company_id uuid)
returns table (
  id uuid,
  name text,
  email text,
  is_admin boolean,
  active boolean,
  can_curate_catalog boolean
)
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag deze lijst zien.';
  end if;
  return query
    select i.id, i.name, u.email, i.is_admin, i.active, i.can_curate_catalog
    from public.inspectors i
    left join auth.users u on u.id = i.user_id
    where i.company_id = p_company_id
    order by i.name;
end;
$$;

grant execute on function public.platform_admin_list_inspectors(uuid) to authenticated;

-- Koppelt een BESTAAND account (moet al eens ingelogd hebben) als
-- keurmeester/beheerder aan een bedrijf. Bestond er al een inspectors-rij
-- voor dit account (elders of hier), dan wordt die verplaatst/bijgewerkt --
-- de unique constraint op user_id staat geen tweede rij toe (zie kanttekening
-- bovenaan).
create or replace function public.platform_admin_add_inspector(
  p_company_id uuid,
  p_email text,
  p_is_admin boolean default true
)
returns public.inspectors
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id uuid;
  result public.inspectors;
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag keurmeesters aan een bedrijf koppelen.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Geen account gevonden voor dit e-mailadres. Diegene moet eerst één keer inloggen (via magic-link/wachtwoord).';
  end if;

  insert into public.inspectors (user_id, company_id, name, is_admin, active)
  values (v_user_id, p_company_id, (select email from auth.users where id = v_user_id), p_is_admin, true)
  on conflict (user_id) do update
    set company_id = excluded.company_id,
        is_admin = excluded.is_admin,
        active = true
  returning * into result;

  return result;
end;
$$;

grant execute on function public.platform_admin_add_inspector(uuid, text, boolean) to authenticated;

create or replace function public.platform_admin_set_curator(p_inspector_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag de curator-rol toekennen.';
  end if;
  update public.inspectors set can_curate_catalog = p_value where id = p_inspector_id;
end;
$$;

grant execute on function public.platform_admin_set_curator(uuid, boolean) to authenticated;
