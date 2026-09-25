-- Reparatie op 20260921_customer_reminder_mail.sql: die migratie deed
-- `revoke all ... from public` op customers_due_for_reminder om te voorkomen
-- dat gewone gebruikers (authenticated) er zomaar bij konden. Maar het
-- REVOKE FROM PUBLIC haalt ook de impliciete toegang weg die service_role
-- via PUBLIC had -- en er stond geen aparte GRANT voor service_role
-- tegenover. Gevolg: de Edge Function (die met de service-role-sleutel
-- aanroept) kreeg "permission denied for function
-- customers_due_for_reminder". Idempotent.
grant execute on function public.customers_due_for_reminder(integer) to service_role;
