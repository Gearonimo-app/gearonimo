-- Per-keuringsbedrijf instelbaar standaard keuringsinterval (in maanden) per
-- producttype. De keurmeester wil dat "volgende keuring" standaard op 12
-- maanden staat (en zelf aanpasbaar per artikel), maar dat een bedrijf de
-- standaard per categorie (PPE vs rigging) kan afwijken. Default 12 zodat
-- bestaande bedrijven meteen op 12 maanden staan.
alter table public.inspection_companies
  add column if not exists default_interval_ppe_months int not null default 12;
alter table public.inspection_companies
  add column if not exists default_interval_rigging_months int not null default 12;
