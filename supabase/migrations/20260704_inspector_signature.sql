-- Handtekening van de keurmeester op het certificaat (wens Jos 2026-06-27).
--
-- Elke keurmeester kan in Instellingen → Keurmeesters een handtekening-PNG
-- uploaden. Die wordt bij het afronden van een keuring in het certificaat-PDF
-- ingebed (boven de handtekeninglijn), zodat het certificaat niet meer met de
-- hand ondertekend hoeft te worden.
--
-- Het bestand gaat naar de bestaande publieke `branding`-bucket (zelfde plek
-- als het bedrijfslogo): de handtekening komt sowieso als pixels op het
-- publieke certificaat terecht, dus is geen aparte privébucket nodig en kan de
-- certificaatgenerator hem net als het logo gewoon downloaden.
alter table public.inspectors
  add column if not exists signature_path text;
