-- customer_members.role is een vrij invulbaar "Functie"-veld (bv. "Magazijnbeheerder"),
-- los van het is_admin-vinkje (toegangsrecht in de klant-app). De app laat dit veld
-- bewust leeg als er geen functie is ingevuld (CustomerMembers.vue: `role: form.value.role.trim() || null`).
-- Geen enkele eerdere migratie zet hier een NOT NULL-constraint op; die staat kennelijk
-- alleen in de live database (schema-drift), en blokkeert het toevoegen van een
-- medewerker zonder ingevulde functie met:
--   null value in column "role" of relation "customer_members" violates not-null constraint
alter table public.customer_members
  alter column role drop not null;
