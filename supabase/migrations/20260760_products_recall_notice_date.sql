-- Datum van het recall-bericht/de inspection notice zélf, naast de al
-- bestaande recall_url/inspection_notice_url (DATAMODEL §products).
-- Aanleiding (Jos, 2026-09-09): een jonge gordel kreeg dezelfde inspection-
-- notice-vlag te zien als een oude, zonder enig aanknopingspunt om in te
-- schatten of de melding hem nog raakt. Geen automatische serienummer-/
-- bouwjaarfilter (bewuste keuze sinds 2026-06-12, zie recall_url) - deze
-- datum maakt het oordeel wel snel te vellen naast het bouwjaar dat al in de
-- keuringstabel staat. `if not exists` maakt dit veilig om opnieuw te draaien.

alter table public.products add column if not exists recall_date            date;
alter table public.products add column if not exists inspection_notice_date date;
