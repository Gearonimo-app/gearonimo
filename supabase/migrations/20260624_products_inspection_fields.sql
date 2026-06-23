-- Productvelden die de keuring-wizard nodig heeft voor de next_due-berekening
-- (packages/core/nextDue.ts) en de recall/inspection-notice-vlag (DATAMODEL
-- §products). `if not exists` maakt dit veilig om opnieuw te draaien, ook al
-- bestaan sommige kolommen mogelijk al uit fase 1.

alter table public.products add column if not exists category               text;
alter table public.products add column if not exists material               text;
alter table public.products add column if not exists standard               text;
alter table public.products add column if not exists max_age_years          int;
alter table public.products add column if not exists max_age_use_years      int;
alter table public.products add column if not exists max_age_mfr_years      int;
alter table public.products add column if not exists interval_override_months int;
alter table public.products add column if not exists recall_url             text;
alter table public.products add column if not exists inspection_notice_url  text;
alter table public.products add column if not exists notes                 text;
