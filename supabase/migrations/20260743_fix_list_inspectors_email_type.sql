-- Bugfix (gevonden door Jos 2026-07-19): platform_admin_list_inspectors gaf
-- "structure of query does not match function result type". Oorzaak:
-- auth.users.email is character varying(255), de functie beloofde text.
-- Cast naar text lost het op; verder identiek aan 20260740.

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
    select i.id, i.name, u.email::text, i.is_admin, i.active, i.can_curate_catalog
    from public.inspectors i
    left join auth.users u on u.id = i.user_id
    where i.company_id = p_company_id
    order by i.name;
end;
$$;

grant execute on function public.platform_admin_list_inspectors(uuid) to authenticated;
