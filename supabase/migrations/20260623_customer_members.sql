-- Medewerkers van een klant (DATAMODEL: customer_members).
-- Nodig voor "artikelen per gebruiker" (articles.assigned_member_id, later) en om
-- vast te leggen wie een set heeft aangemaakt (article_sets.created_by_member_id).
-- Zelfde tijdelijke opzet als customers/articles: RLS uit, tabelrechten voor authenticated.

create table if not exists public.customer_members (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name        text not null,
  role        text,
  phone       text,
  email       text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists customer_members_customer_id_idx on public.customer_members(customer_id);

grant select, insert, update, delete on public.customer_members to authenticated;
