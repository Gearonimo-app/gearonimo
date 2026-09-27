-- De bedrijfsinstelling "standaard keuringsinterval" (20260626) stond altijd
-- op een waarde (not null default 12), voor elk bedrijf, ook Engelse. Daardoor
-- kwam het Engelse wettelijke regime (getRegime() in packages/core/regimes.ts:
-- LOLER/PUWER, PBM elke 6 maanden) in InspectionWizard.vue nooit aan bod --
-- de bedrijfsinstelling ging altijd voor, en die was nooit leeg.
--
-- Bovendien was er nergens een schermpje om deze instelling zelf te wijzigen;
-- de kolom kon dus alleen via losse SQL een andere waarde dan 12 krijgen.
-- Elke bestaande rij staat daarom vrijwel zeker nog op de ongewijzigde
-- standaard.
--
-- Besluit Jos (2026-09-27): per bedrijf instelbaar, standaard leeg (dan geldt
-- automatisch het wettelijke regime van het land -- 12 maanden voor NL, en
-- voor GB 6 maanden PBM / 12 maanden hijsmateriaal). Een bedrijf dat het
-- anders wil, vult zelf een aantal maanden in via Instellingen -> Certificaat.
--
-- Nullable i.p.v. "not null default 12": alleen een bewust ingevulde waarde
-- overschrijft het wettelijke regime. Bestaande rijen die nog op de
-- ongewijzigde 12 staan (vrijwel alle) gaan terug naar leeg/automatisch --
-- voor NL-bedrijven verandert dat feitelijk niets (regime is daar ook 12),
-- voor GB-bedrijven repareert dat precies deze bug. Idempotent.
alter table public.inspection_companies
  alter column default_interval_ppe_months drop not null,
  alter column default_interval_ppe_months drop default;
alter table public.inspection_companies
  alter column default_interval_rigging_months drop not null,
  alter column default_interval_rigging_months drop default;

update public.inspection_companies
  set default_interval_ppe_months = null
  where default_interval_ppe_months = 12;
update public.inspection_companies
  set default_interval_rigging_months = null
  where default_interval_rigging_months = 12;
