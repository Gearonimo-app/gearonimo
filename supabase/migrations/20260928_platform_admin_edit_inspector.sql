-- Platform-admin kon op het "Bedrijven"-scherm alleen de curator-rol
-- aan-/uitzetten (20260740_platform_admin_companies.sql). Jos wil bedrijven
-- ook kunnen helpen met hun keurmeesters zelf (naam, beheerder, actief) --
-- niet alleen via het bedrijf zijn eigen Instellingen -> Keurmeesters, waar
-- Jos als platform-admin geen toegang tot heeft tenzij hij zelf bij dat
-- bedrijf hoort. Zelfde beveiligingspatroon als de rest van
-- 20260740_platform_admin_companies.sql: security-definer-RPC met een
-- expliciete is_platform_admin()-check, geen RLS-policy nodig.
create or replace function public.platform_admin_update_inspector(
  p_inspector_id uuid,
  p_name text,
  p_is_admin boolean,
  p_active boolean
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag een keurmeester zo aanpassen.';
  end if;
  update public.inspectors
  set name = nullif(trim(p_name), ''),
      is_admin = p_is_admin,
      active = p_active
  where id = p_inspector_id;
end;
$$;

grant execute on function public.platform_admin_update_inspector(uuid, text, boolean, boolean) to authenticated;
