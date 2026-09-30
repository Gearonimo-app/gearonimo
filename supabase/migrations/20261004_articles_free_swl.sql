-- SWL (veilige werklast) ook invulbaar als vrije invoer (Jos, 2026-09-30:
-- "vrije invoer altijd mogelijk houden"). Anders dan free_norm/free_mbs --
-- die alleen tellen zolang er géén catalogusproduct gekoppeld is -- blijft
-- dit veld ook bij een gekoppeld product zichtbaar en bewerkbaar: het vult
-- zich vanzelf met de WLL uit de catalogus (products.working_load_limit),
-- maar de keurmeester mag dat altijd overschrijven. Zie useCertificate.ts
-- (free_working_load_limit gaat vóór products.working_load_limit) en de
-- invoervelden in CustomerArticles.vue / InspectionWizard.vue.

alter table public.articles
  add column if not exists free_working_load_limit text;
