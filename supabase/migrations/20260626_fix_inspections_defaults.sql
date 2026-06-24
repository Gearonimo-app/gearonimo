-- Vervolg op de schema-afdrijving (zie 20260626_fix_inspectors_user_id_fkey.sql):
-- de inspections-tabel in productie bestond al voordat 20260624_inspections.sql
-- liep, dus de not-null kolommen kregen nooit hun default. De app-insert in
-- startOrResumeInspection() zet alleen customer_id/company_id/inspector_id en
-- vertrouwt voor de rest op deze defaults. Zonder default kreeg je:
-- 'null value in column "inspection_date" of relation "inspections" violates
-- not-null constraint'. Idempotent: alter column set default is veilig
-- ongeacht de huidige staat.

alter table public.inspections alter column inspection_date  set default current_date;
alter table public.inspections alter column status           set default 'draft';
alter table public.inspections alter column examination_type set default 'periodic';
alter table public.inspections alter column created_at        set default now();
