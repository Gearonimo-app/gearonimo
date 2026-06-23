-- Afkeurcodes (DATAMODEL §rejection_codes). company_id leeg = platformstandaard,
-- gevuld = eigen code van een keurbedrijf. Nog geen seed met de echte
-- inhoudelijke codes 1–8 (die moet Jos aanleveren uit de huidige praktijk) —
-- tot die er zijn blijft de afkeur-opmerking in de wizard vrije tekst.

create table if not exists public.rejection_codes (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid references public.inspection_companies(id),
  code       int not null,
  label_key  text,
  label      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists rejection_codes_company_id_idx on public.rejection_codes(company_id);

grant select, insert, update, delete on public.rejection_codes to authenticated;
