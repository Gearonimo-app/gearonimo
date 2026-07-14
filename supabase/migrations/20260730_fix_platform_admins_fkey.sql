-- Zelfde euvel als 20260626_fix_inspectors_user_id_fkey en
-- 20260710_fix_customer_members_user_id_fkey, nu op platform_admins (live
-- gevonden 2026-07-14 bij het toevoegen van de eerste platform-admin): de
-- live tabel heeft user_id met een FK naar public.users (een losse, lege
-- tabel) i.p.v. auth.users. Daardoor faalt "insert into platform_admins
-- (user_id) select id from auth.users ..." met
-- 'violates foreign key constraint "platform_admins_user_id_fkey"', en zou
-- is_platform_admin() (die pa.user_id = auth.uid() vergelijkt) hoe dan ook
-- nooit matchen zolang user_id een public.users-id zou moeten zijn.
--
-- Na deze fix wijst user_id rechtstreeks naar auth.users (net als
-- inspectors.user_id en customer_members.user_id), waardoor de insert werkt
-- en is_platform_admin() klopt.

alter table public.platform_admins
  drop constraint if exists platform_admins_user_id_fkey;

alter table public.platform_admins
  add constraint platform_admins_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete cascade;
