-- Bedrijf verwijderen door de platform-admin (wens Jos 2026-07-19).
--
-- Harde grens: een bedrijf met keuringen (of geimporteerde historie in
-- import_batches) is NIET verwijderbaar -- certificaten/keuringen zijn
-- juridisch onveranderlijke historie. Dit is dus bedoeld voor test- en
-- vergis-bedrijven, niet voor het opruimen van een echt actief bedrijf.
--
-- Tabellen zonder on delete cascade worden hier expliciet opgeruimd
-- (rejection_codes, inspectors, customer_links, import_profiles);
-- offline_downloads / inspection_requests / certificate_sequences hebben
-- al cascade (zie 20260705/20260717/20260735). Klantbedrijven zelf blijven
-- bestaan -- alleen de koppeling verdwijnt.

-- Het vangnet "laatste actieve beheerder kan nooit weg" (20260739) zou het
-- verwijderen van de inspectors-rijen blokkeren. Bij het verwijderen van
-- het HELE bedrijf is dat vangnet zinloos (er blijft geen bedrijf over om
-- beheerderloos te zijn), dus de trigger krijgt een transactie-lokaal
-- ontsnappingsluik dat alleen platform_admin_delete_company zet.

create or replace function public.inspectors_guard_last_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Ontsnappingsluik: gezet (transactie-lokaal) door
  -- platform_admin_delete_company vlak voor het opruimen van de rijen.
  if current_setting('gearonimo.deleting_company', true) = coalesce(old.company_id::text, '') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  -- Alleen relevant als er een actieve beheerder verdwijnt of degradeert.
  if tg_op = 'DELETE' or (old.is_admin and old.active
      and (not new.is_admin or not new.active or new.company_id is distinct from old.company_id)) then
    if old.is_admin and old.active and not exists (
      select 1 from public.inspectors i
      where i.company_id = old.company_id
        and i.id <> old.id
        and i.active
        and i.is_admin
    ) then
      raise exception 'Dit is de laatste beheerder van dit keurbedrijf. Maak eerst een andere keurmeester beheerder.';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.platform_admin_delete_company(p_company_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Alleen platform-admin mag een keurbedrijf verwijderen.';
  end if;

  if exists (select 1 from public.inspections where company_id = p_company_id) then
    raise exception 'Dit bedrijf heeft keuringen in de historie en kan niet verwijderd worden. Zet het bedrijf desnoods stil door de keurmeesters op inactief te zetten.';
  end if;

  if exists (select 1 from public.import_batches where company_id = p_company_id) then
    raise exception 'Dit bedrijf heeft geïmporteerde historie (import-bestanden als juridisch anker) en kan niet verwijderd worden.';
  end if;

  -- Ontsnappingsluik voor de laatste-beheerder-trigger, alleen binnen deze
  -- transactie geldig (derde argument true = transactie-lokaal).
  perform set_config('gearonimo.deleting_company', p_company_id::text, true);

  delete from public.rejection_codes where company_id = p_company_id;
  delete from public.inspectors      where company_id = p_company_id;
  delete from public.customer_links  where company_id = p_company_id;
  delete from public.import_profiles where company_id = p_company_id;
  delete from public.inspection_companies where id = p_company_id;
end;
$$;

grant execute on function public.platform_admin_delete_company(uuid) to authenticated;
