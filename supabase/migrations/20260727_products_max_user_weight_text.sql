-- Besluit Jos (2026-07-27) n.a.v. de bronlijst-import (2294 producten):
-- max_user_weight_kg was `int` en liet de hele import klappen op
-- "invalid input syntax for type integer: 190.5" -- 117 Miller H700-harnassen
-- hebben een rating van 420 lbs = 190,5 kg.
--
-- Afronden naar 190 zou de fout wegpoetsen maar niet oplossen: het maximale
-- gebruikersgewicht is niet altijd één geheel getal. Jos: "soms is een
-- gebruikersgewicht afhankelijk van een touwdiameter, dit klopt dus gewoon" --
-- de bronlijst bevat legitiem '130-150' (bereik) en
-- '100 (bij EN 12841/B, 10.5-13mm touw)' (voorwaardelijke rating).
--
-- Daarom text, net als de andere specificatievelden breaking_strength en
-- working_load_limit die om dezelfde reden al text zijn. Er wordt nergens op
-- dit veld gerekend of gesorteerd -- het wordt alleen ingevuld en getoond.
--
-- Idempotent: alleen omzetten als de kolom nog geen text is.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'products'
      and column_name  = 'max_user_weight_kg'
      and data_type   <> 'text'
  ) then
    alter table public.products
      alter column max_user_weight_kg type text
      using max_user_weight_kg::text;
  end if;
end $$;
