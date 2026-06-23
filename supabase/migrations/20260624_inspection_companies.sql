-- Keurbedrijven (DATAMODEL §inspection_companies). Vandaag is er één bedrijf
-- (Jos); de tabel bestaat toch al echt zodat `inspections`/`inspectors` er
-- meteen correct naar kunnen verwijzen, zonder later te moeten herstructureren.
-- country_code bepaalt het regime (NL/GB, zie packages/core/regimes.ts).

create table if not exists public.inspection_companies (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  country_code text not null default 'NL',
  created_at   timestamptz not null default now()
);

-- Eénmalige seed van het enige bedrijf dat vandaag bestaat. `where not exists`
-- maakt dit veilig om opnieuw te draaien zonder dubbele rij.
insert into public.inspection_companies (name, country_code)
select 'Gearonimo', 'NL'
where not exists (select 1 from public.inspection_companies);

grant select, insert, update, delete on public.inspection_companies to authenticated;
