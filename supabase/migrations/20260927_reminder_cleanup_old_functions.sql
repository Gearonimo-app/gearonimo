-- Opruimen na herinneringsmail v3 (20260926_reminder_first_and_self_checks.sql):
-- de Edge Function gebruikt nu reminder_due_items. De twee oude functies
-- werden nergens meer aangeroepen. Uitgevoerd door Jos op 2026-09-25.
-- Idempotent.
drop function if exists public.customers_due_for_reminder(integer);
drop function if exists public.reminder_due_articles(integer, integer, integer);
