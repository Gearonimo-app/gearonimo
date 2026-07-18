-- Rollen en rechten voor keurmeesters (besluit Jos 2026-07-18).
--
-- inspectors.is_admin bestond al (20260629) maar werd nergens in de database
-- gecontroleerd -- het vinkje was pure versiering. Elke actieve keurmeester
-- kon collega's beheren (en zichzelf admin maken), bedrijfsgegevens en
-- certificaat-opmaak wijzigen, afkeurcodes aanpassen en klanten verwijderen.
--
-- Vanaf nu alleen voor de beheerder(s) van het keurbedrijf:
--   1. bedrijfsgegevens + certificaat-opmaak (inspection_companies, incl.
--      cert_layout)
--   2. afkeurcodes schrijven (lezen blijft voor iedereen)
--   3. keurmeesters beheren
--   4. klanten verwijderen
-- Keuren en klanten/artikelen beheren blijft voor elke actieve keurmeester.
--
-- Plus een vangnet-trigger: een bedrijf kan nooit zonder actieve beheerder
-- komen te zitten (zelfde principe als de klant-app: "je kunt jezelf niet
-- niet-beheerder maken", maar dan waterdicht voor álle paden). Idempotent.

-- ─── Hulpfunctie ────────────────────────────────────────────────────────────

create or replace function public.is_company_admin(p_company_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.inspectors i
    where i.user_id = auth.uid()
      and i.active
      and i.is_admin
      and i.company_id = p_company_id
  );
$$;

grant execute on function public.is_company_admin(uuid) to authenticated;

-- ─── 1. Bedrijfsgegevens + certificaat-opmaak ───────────────────────────────

drop policy if exists "inspection_companies inspector update" on public.inspection_companies;
create policy "inspection_companies inspector update" on public.inspection_companies
  for update to authenticated
  using (public.is_company_admin(id))
  with check (public.is_company_admin(id));

-- ─── 2. Afkeurcodes: schrijven alleen beheerder ─────────────────────────────

drop policy if exists "rejection_codes inspector insert" on public.rejection_codes;
drop policy if exists "rejection_codes inspector update" on public.rejection_codes;
drop policy if exists "rejection_codes inspector delete" on public.rejection_codes;
create policy "rejection_codes inspector insert" on public.rejection_codes
  for insert to authenticated
  with check (public.is_company_admin(company_id));
create policy "rejection_codes inspector update" on public.rejection_codes
  for update to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));
create policy "rejection_codes inspector delete" on public.rejection_codes
  for delete to authenticated
  using (public.is_company_admin(company_id));

-- ─── 3. Keurmeesters beheren: alleen beheerder ──────────────────────────────

drop policy if exists "inspectors insert own company" on public.inspectors;
drop policy if exists "inspectors update own company" on public.inspectors;
drop policy if exists "inspectors delete accountless" on public.inspectors;
create policy "inspectors insert own company" on public.inspectors
  for insert to authenticated
  with check (public.is_company_admin(company_id));
create policy "inspectors update own company" on public.inspectors
  for update to authenticated
  using (public.is_company_admin(company_id))
  with check (public.is_company_admin(company_id));
-- Verwijderen blijft beperkt tot account-loze registraties (een keurmeester
-- mét account gaat op inactief), en nu ook alleen door een beheerder.
create policy "inspectors delete accountless" on public.inspectors
  for delete to authenticated
  using (public.is_company_admin(company_id) and user_id is null);

-- ─── Vangnet: nooit nul actieve beheerders per bedrijf ──────────────────────

create or replace function public.inspectors_guard_last_admin()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
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

drop trigger if exists inspectors_guard_last_admin on public.inspectors;
create trigger inspectors_guard_last_admin
  before update or delete on public.inspectors
  for each row execute function public.inspectors_guard_last_admin();

-- ─── 4. Klanten verwijderen: alleen beheerder ───────────────────────────────
-- De oude "for all"-policy dekte lezen/wijzigen/verwijderen in één keer;
-- die splitsen we zodat alleen delete strenger wordt.

drop policy if exists "customers inspector read write" on public.customers;
drop policy if exists "customers inspector select" on public.customers;
drop policy if exists "customers inspector update" on public.customers;
drop policy if exists "customers inspector delete" on public.customers;
create policy "customers inspector select" on public.customers
  for select to authenticated
  using (id in (select public.inspector_customer_ids()));
create policy "customers inspector update" on public.customers
  for update to authenticated
  using (id in (select public.inspector_customer_ids()))
  with check (id in (select public.inspector_customer_ids()));
create policy "customers inspector delete" on public.customers
  for delete to authenticated
  using (exists (
    select 1 from public.customer_links cl
    where cl.customer_id = customers.id
      and public.is_company_admin(cl.company_id)
  ));
-- (De aparte insert-policy "customers inspector insert" uit 20260713 blijft
-- ongewijzigd bestaan: elke actieve keurmeester mag klanten aanmaken.)
