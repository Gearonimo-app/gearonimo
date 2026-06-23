-- Artikelen: het materiaal/bezit van de klant (DATAMODEL §3).
-- Eerste slice: "vrije artikelen" (product_id leeg, nog geen catalogus-koppeling).
-- Volledige kolomset alvast aangemaakt zodat latere stappen niet hoeven te migreren.
-- FK's naar nog niet-bestaande tabellen (products, customer_members) bewust als
-- gewone uuid-kolommen zonder constraint; worden later aangescherpt.

create table if not exists public.articles (
  id                       uuid primary key default gen_random_uuid(),
  customer_id              uuid not null references public.customers(id) on delete cascade,
  product_id               uuid,
  free_description         text,
  free_brand               text,
  free_material            text,
  free_manufacturer_code   text,
  free_manual_url          text,
  serial_number            text,
  manufacture_year         int,
  manufacture_month        int,
  purchase_date            date,
  first_use_date           date,
  assigned_member_id       uuid,
  interval_override_months int,
  severe_use               boolean not null default false,
  notes                    text,
  retired                  boolean not null default false,
  retired_at               timestamptz,
  suggest_for_catalog      boolean not null default false,
  self_managed             boolean not null default false,
  created_at               timestamptz not null default now()
);

create index if not exists articles_customer_id_idx on public.articles(customer_id);

-- Zelfde tijdelijke opzet als customers: RLS uit, tabelrechten voor authenticated.
grant select, insert, update, delete on public.articles to authenticated;
