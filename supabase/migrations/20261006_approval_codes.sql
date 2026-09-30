-- Goedkeuringscodes (Jos, 2026-09-30, sparren over LOLER-rapportage): zelfde
-- opzet als afkeurcodes (migratie 20260624_rejection_codes.sql /
-- 20260627_rejection_codes_per_company.sql, RLS in 20260713_rls_enable.sql),
-- maar voor een góedgekeurd artikel -- bv. "goed, let op verhoogde slijtage"
-- of "goed tot [datum aangepast]". Niets selecteren blijft precies zoals nu:
-- geen code, gewoon de vrije opmerking.

create table if not exists public.approval_codes (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.inspection_companies(id),
  code       int not null,
  label      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists approval_codes_company_id_idx on public.approval_codes(company_id);

grant select, insert, update, delete on public.approval_codes to authenticated;

-- Lezen: eigen bedrijf + de platformstandaard (company_id is null).
-- Schrijven: alleen eigen bedrijf. Zelfde patroon als rejection_codes.
alter table public.approval_codes enable row level security;
drop policy if exists "approval_codes inspector read" on public.approval_codes;
drop policy if exists "approval_codes inspector insert" on public.approval_codes;
drop policy if exists "approval_codes inspector update" on public.approval_codes;
drop policy if exists "approval_codes inspector delete" on public.approval_codes;
create policy "approval_codes inspector read" on public.approval_codes
  for select to authenticated
  using (company_id is null or company_id in (select public.inspector_company_ids()));
create policy "approval_codes inspector insert" on public.approval_codes
  for insert to authenticated
  with check (company_id in (select public.inspector_company_ids()));
create policy "approval_codes inspector update" on public.approval_codes
  for update to authenticated
  using (company_id in (select public.inspector_company_ids()))
  with check (company_id in (select public.inspector_company_ids()));
create policy "approval_codes inspector delete" on public.approval_codes
  for delete to authenticated
  using (company_id in (select public.inspector_company_ids()));

-- Bestaande keurbedrijven elk een eigen startpunt geven, zelfde redenering
-- als bij de afkeurcodes: er is geen platformstandaard-inhoud om te seeden
-- (Jos levert de eigen codes zelf aan via Instellingen), dus dit is hier een
-- no-op totdat er ooit een platformstandaard (company_id null) bijkomt --
-- maar staat klaar zodra dat wél gebeurt.
insert into public.approval_codes (company_id, code, label, active)
select c.id, ac.code, ac.label, ac.active
from public.inspection_companies c
cross join public.approval_codes ac
where ac.company_id is null
  and not exists (
    select 1 from public.approval_codes own
    where own.company_id = c.id
  );

alter table public.inspection_items
  add column if not exists approval_code_id uuid references public.approval_codes(id);
