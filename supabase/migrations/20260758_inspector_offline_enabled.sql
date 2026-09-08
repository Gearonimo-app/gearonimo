-- Offline-download-knop nog niet in gebruik (internet is bij alle
-- keurmeesters altijd aanwezig, besluit Jos 2026-09-08). Verbergen voor
-- iedereen, met de mogelijkheid om 'm later per keurmeester weer aan te
-- zetten zodra dat wél nodig is -- geen alles-of-niets-schakelaar.
--
-- Geen nieuwe policies nodig: "inspectors update own company" (20260739)
-- laat de beheerder al élke kolom van een collega wijzigen, en
-- ensure_inspector() (20260713) geeft met `select *` de hele rij terug --
-- deze kolom komt dus vanzelf mee naar de frontend.

alter table public.inspectors
  add column if not exists offline_enabled boolean not null default false;
