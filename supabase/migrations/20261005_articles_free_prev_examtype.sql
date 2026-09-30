-- Vangnet-velden voor twee nieuwe (uitvinkbare) certificaatkolommen:
-- "Vorige keuring" en "Type keuring" (LOLER Schedule 1 §4/§6/§7). Zelfde
-- patroon als free_working_load_limit (migratie 20261004): vrije invoer
-- wint altijd als die is ingevuld, ook als de auto-berekende waarde (uit
-- de keuringsgeschiedenis resp. het interval-regime) er al is. Zie
-- useCertificate.ts.
--
-- free_previous_inspection_date is een vangnet voor een artikel dat hier
-- voor het eerst gekeurd wordt en dus geen eerdere keuring in Gearonimo
-- heeft staan, terwijl het buiten de app om wél eerder gekeurd is.
-- free_exam_type is voor een afwijkende keuring (bv. "na een val",
-- Reg. 6(2)) -- vanuit dit programma is het anders vrijwel altijd een
-- periodieke keuring.

alter table public.articles
  add column if not exists free_previous_inspection_date date,
  add column if not exists free_exam_type text;
