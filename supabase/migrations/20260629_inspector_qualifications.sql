-- Keurmeesters + kwalificaties beheren (Instellingen-tegel onderdeel 3,
-- DATAMODEL §1, UX-FLOW §7.5). Het keurbedrijf-admin kan eigen keurmeesters
-- vastleggen en hun kwalificatiebewijzen (Sachkundenachweis, IPAF,
-- fabrikantencertificaten) uploaden.

-- 1) inspectors.user_id mag leeg zijn: een admin legt een keurmeester +
--    certificaten vast vóórdat die persoon ooit zelf inlogt. De koppeling met
--    een echt account (invite/claim) komt in een latere fase. De unique
--    constraint blijft staan; Postgres staat meerdere NULLs toe, dus
--    account-loze keurmeesters botsen niet, en ensure_inspector()'s
--    `on conflict (user_id)` blijft werken voor echte accounts.
alter table public.inspectors alter column user_id drop not null;

-- 2) is_admin: keurbedrijf-admin (beheert keurmeesters/klanten/instellingen).
--    DATAMODEL §inspectors. De bestaande (auto-geprovisioneerde) keurmeester
--    is vandaag de facto admin; wordt hieronder op true gezet als er nog geen
--    enkele admin is, zodat het beheerscherm niet meteen "geen admin" toont.
alter table public.inspectors
  add column if not exists is_admin boolean not null default false;

update public.inspectors
set is_admin = true
where id = (select id from public.inspectors order by created_at limit 1)
  and not exists (select 1 from public.inspectors where is_admin);

-- 3) Kwalificatiebewijzen per keurmeester (DATAMODEL §inspector_qualifications).
create table if not exists public.inspector_qualifications (
  id           uuid primary key default gen_random_uuid(),
  inspector_id uuid not null references public.inspectors(id) on delete cascade,
  name         text not null,
  number       text,
  valid_until  date,
  storage_path text,
  created_at   timestamptz not null default now()
);

create index if not exists inspector_qualifications_inspector_id_idx
  on public.inspector_qualifications(inspector_id);

grant select, insert, update, delete on public.inspector_qualifications to authenticated;

-- 4) Private bucket voor de kwalificatiebewijzen. Anders dan het logo/het
--    certificaat zijn dit gevoelige documenten — dus NIET publiek. Toegang
--    loopt via signed URLs; alleen ingelogde gebruikers mogen lezen/schrijven.
insert into storage.buckets (id, name, public)
values ('qualifications', 'qualifications', false)
on conflict (id) do nothing;

drop policy if exists "qualifications select by authenticated" on storage.objects;
drop policy if exists "qualifications insert by authenticated" on storage.objects;
drop policy if exists "qualifications delete by authenticated" on storage.objects;

create policy "qualifications select by authenticated"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'qualifications');

create policy "qualifications insert by authenticated"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'qualifications');

create policy "qualifications delete by authenticated"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'qualifications');
