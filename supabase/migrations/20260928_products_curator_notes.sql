-- Interne verantwoordingsnotities voor curators, los van `notes` (besluit
-- Jos, 2026-09-28).
--
-- `notes` staat sinds 2026-08-01 in beeld bij de keurmeester tijdens de
-- keuring, maar raakte in de praktijk gevuld met lange bronvermeldingen
-- (citaten uit handleidingen, checksum-controles, "verzoek Jos"-context) --
-- precies de reden dat het op 2026-09-04 achter een klik verdween. Jos wil
-- die verantwoording bewaren (waardevol om na te trekken) maar niet meer op
-- het scherm van de keurmeester: die moet er korte, praktische aanwijzingen
-- in kunnen kwijt in plaats daarvan (bv. "Mfr onbeperkt; vóór mei 2018
-- 11,5mm lijn i.p.v. 11mm").
--
-- Geen migratie van bestaande data nodig: de verhuizing van de huidige
-- `notes`-inhoud naar `curator_notes` gebeurt op het niveau van
-- catalog/producten.csv (de bronlijst) en komt vanzelf mee met de
-- eerstvolgende volledige Excel-export/import, net als elke andere
-- catalogusaanpassing.
--
-- Wie mag schrijven: zelfde als voor de rest van de catalogus (curators en
-- platform-admin). Een keurmeester krijgt dit veld niet te zien in de
-- keuring-UI. Geen nieuwe tabel, dus geen extra grant nodig. Idempotent.

alter table public.products add column if not exists curator_notes text;

comment on column public.products.curator_notes is
  'Interne verantwoording voor curators (bronvermelding, citaten, checksum-controles). Nooit aan de keurmeester getoond -- zie `notes` daarvoor.';
