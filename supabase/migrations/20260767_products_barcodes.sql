-- Streepjescode per product (besluit Jos, 2026-09-24).
--
-- Bij "Artikel toevoegen" in de keurmeester-app de doos scannen, dan staat
-- het product er meteen. Het gaat om de EAN/GTIN van het producttype, niet om
-- het serienummer van het exemplaar.
--
-- Eén tekstkolom met codes gescheiden door een puntkomma, precies zoals in
-- catalog/producten.csv (kolom `barcodes`), bv. per maat een eigen code.
-- De app schrijft altijd de nette vorm weg (formatBarcodes in
-- packages/core/src/catalog.ts: alleen geldige GTIN-8/12/13/14, ontdubbeld).
--
-- Wie mag schrijven: dezelfde als voor de rest van de catalogus (curators en
-- de platform-admin, via de bestaande policies op products). Een gewone
-- keurmeester kan de codes alleen gebruiken, niet toevoegen. Zoeken gebeurt in
-- de app op de al geladen catalogus, dus er is geen index of RPC nodig.
--
-- Geen nieuwe tabel, dus geen extra grant nodig. Idempotent.

alter table public.products add column if not exists barcodes text;

comment on column public.products.barcodes is
  'EAN/GTIN-codes van dit product, gescheiden door ";" (bron: catalog/producten.csv). Niet het serienummer.';
