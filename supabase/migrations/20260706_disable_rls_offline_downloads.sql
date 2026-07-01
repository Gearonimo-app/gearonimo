-- offline_downloads bleek RLS aan te hebben staan (zelfde patroon als eerder
-- bij articles/customers, zie 20260626_disable_rls_everywhere.sql en
-- 20260627_disable_rls_articles.sql) -- geblokkeerd tijdens live testen door
-- Jos: "new row violates row-level security policy for table
-- offline_downloads" (403 bij het downloaden van een klant). Zelfde
-- tijdelijke opzet als de rest van het schema: RLS uit, grant blijft staan.
alter table public.offline_downloads disable row level security;
grant select, insert on public.offline_downloads to authenticated;
