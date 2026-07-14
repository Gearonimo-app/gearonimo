-- "permission denied for table platform_settings" bij het opslaan van de
-- hero-foto: de tabel had wel RLS-policies (20260714) maar geen table-level
-- GRANT aan authenticated. In dit project staat RLS aan én is een expliciete
-- grant nodig (zelfde patroon als alle andere app-tabellen) -- RLS beperkt
-- welke rijen, de grant geeft überhaupt toegang tot de tabel.
-- De RLS-policies bepalen nog steeds dat alleen een platform-admin mag
-- schrijven; lezen mag elke ingelogde keurmeester (voor de hero-foto op het
-- hoofdmenu).

grant select, insert, update on public.platform_settings to authenticated;
