-- Twee ontbrekende Schedule 1-velden (LOLER 1998) voor het GB-certificaat,
-- gevonden bij het narekenen van Jos' Grok-lijst tegen de wet (2026-07-19):
-- 1. "ernstige defecten / onmiddellijk gevaar" (Category 1 -> HSE) had geen
--    vastlegpunt -- alleen goed/afgekeurd + vrije opmerking.
-- 2. SWL (safe working load) op vrije (niet-catalogus) artikelen kon niet
--    los van MBS ingevuld worden -- alleen `free_mbs` bestond
--    (20260701_articles_free_norm_mbs.sql), geen SWL-equivalent.
-- `inspections.location` en `inspections.examination_type` bestonden al
-- sinds 20260624_inspections.sql maar werden nergens ingevuld/getoond --
-- dat is een UI/certificaat-fix, geen schemawijziging.

alter table public.inspection_items
  add column if not exists immediate_danger boolean not null default false;

alter table public.articles
  add column if not exists free_working_load_limit text;
