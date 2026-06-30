-- Server-side audit log voor offline-downloads van klantgegevens (besproken
-- met Jos 2026-06-30, privacy/diefstal-overweging bij offline-first): elke
-- keer dat een keurmeester een klant offline beschikbaar maakt op zijn
-- toestel, komt hier een rij bij. Dit is het forensische spoor ("welke
-- keurmeester had welke klant wanneer lokaal staan") -- onafhankelijk van wat
-- er op het toestel zelf gebeurt, dus ook nog te raadplegen als een lokale
-- kopie verwijderd, overschreven of gelekt is. Geen edge-function-infra nodig
-- (zelfde pragmatische keuze als de client-side certificaat-PDF): de
-- watermerk-id wordt hier server-side aangemaakt en is dus niet door de
-- keurmeester zelf te vervalsen, ook al staat RLS uit.
create table if not exists public.offline_downloads (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.inspection_companies(id) on delete cascade,
  inspector_id uuid not null references public.inspectors(id) on delete cascade,
  customer_id  uuid not null references public.customers(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create index if not exists offline_downloads_customer_id_idx on public.offline_downloads(customer_id);
create index if not exists offline_downloads_inspector_id_idx on public.offline_downloads(inspector_id);

-- Zelfde tijdelijke opzet als de rest van het schema: RLS uit, grant aan authenticated.
grant select, insert on public.offline_downloads to authenticated;
