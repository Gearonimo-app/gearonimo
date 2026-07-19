-- SN-referentie beheerbaar door de curator (wens Jos 2026-07-19, direct na
-- de eerste statische versie): de merkenlijst van het spiekbriefje gaat van
-- code (apps/inspector/src/data/snReference.ts) naar een platformbrede
-- tabel, zelfde eigendomsmodel als de productcatalogus -- iedereen die
-- ingelogd is leest, alleen curators/platform-admin schrijven
-- (is_catalog_curator, sinds 20260745 incl. platform-admin).

create table if not exists public.sn_reference (
  id         uuid primary key default gen_random_uuid(),
  brand      text not null,
  example    text,
  format     text,
  note       text,
  link       text,
  created_at timestamptz not null default now()
);

alter table public.sn_reference enable row level security;

drop policy if exists "sn_reference read" on public.sn_reference;
create policy "sn_reference read" on public.sn_reference
  for select to authenticated using (true);

drop policy if exists "sn_reference curator insert" on public.sn_reference;
create policy "sn_reference curator insert" on public.sn_reference
  for insert to authenticated with check (public.is_catalog_curator());

drop policy if exists "sn_reference curator update" on public.sn_reference;
create policy "sn_reference curator update" on public.sn_reference
  for update to authenticated
  using (public.is_catalog_curator())
  with check (public.is_catalog_curator());

drop policy if exists "sn_reference curator delete" on public.sn_reference;
create policy "sn_reference curator delete" on public.sn_reference
  for delete to authenticated using (public.is_catalog_curator());

-- RLS alleen is niet genoeg (landmijn): ook grants.
grant select, insert, update, delete on public.sn_reference to authenticated;

-- Eenmalige seed met de lijst uit klimkeurpro; draait alleen op een lege
-- tabel zodat latere curator-bewerkingen nooit overschreven worden.
insert into public.sn_reference (brand, example, format, link)
select * from (values
  ('ART', '21,1601001', 'xxYYxx xxx', null),
  ('CT-Climbing', '2211-122-22', 'xxxx-DDD-YY', null),
  ('DMM', '210321234E', 'YYDDDxxxx#', 'https://dmmwales.com/pages/dmm-product-markings-and-packaging'),
  ('Edelrid', 'verschilt', 'MMYY-xx-xxx-xxxx', null),
  ('FallSave', '121844', 'MM/YYYY', null),
  ('ISC', '22/45654/1234', 'YY/xxxxx/xxx', 'https://www.iscwales.com/News/Blog/New-Serial-Numbering-Implementation/'),
  ('Kask', '21,1234567.1234', 'YY.xxxxxxx.xxxx', null),
  ('Kask', '21,1234,5678', 'YY.xxxx.xxxx', null),
  ('Kong', '456218 22 6543', 'xxxxxxYYxxxx', null),
  ('Kong connectors', '123456 2206 1234', 'xxxxxxMMYYxxxx', null),
  ('Miller by Honeywell', '23/20 123415678/005', 'WWYYxxxxxx', null),
  ('Petzl', '18E45654123', 'YYMxxxxxx', null),
  ('Petzl pre-2016', '12122AV6543', 'YYDDDxxxxxx', null),
  ('RockExotica', '22123A001', 'YYDDDaxxx', null),
  ('Simond', '010622', 'xxMMYY', 'https://www.simond.com/user-guide-connectors-quickdraw-straps#80f2999d-56a1-4258-a3d1-289397b08731'),
  ('Taz', 'S01 220629 0001', 'xxxYYMMDDxxxx', null),
  ('Tractel', 'DEM202000001', 'bij f: YY/MM', null),
  ('TreeRunner / LACD', 'productiejaar = laatste 2 cijfers van het lotnummer', 'xxxxYY', null),
  ('XSPlatforms', 'verschilt', '', null)
) as seed(brand, example, format, link)
where not exists (select 1 from public.sn_reference);
