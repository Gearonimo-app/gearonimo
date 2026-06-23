-- Koppeling klant ↔ keurbedrijf (DATAMODEL §customer_links). Toegang tot
-- klantdata loopt straks via een actieve link, niet rechtstreeks via
-- customer_id — ook als er vandaag nog maar één keurbedrijf is.
--
-- Backfill: alle bestaande klanten kregen tot nu toe geen koppeling (de tabel
-- bestond nog niet); zet ze hier in één keer actief bij het enige bedrijf
-- zodat ze meteen zichtbaar blijven. `where not exists` maakt dit veilig om
-- opnieuw te draaien.

create table if not exists public.customer_links (
  id                   uuid primary key default gen_random_uuid(),
  customer_id          uuid not null references public.customers(id) on delete cascade,
  company_id           uuid not null references public.inspection_companies(id),
  customer_number      text,
  scope_product_types  text[],
  status               text not null default 'active',
  started_at           timestamptz not null default now(),
  ended_at             timestamptz,
  unique (customer_id, company_id)
);

create index if not exists customer_links_customer_id_idx on public.customer_links(customer_id);
create index if not exists customer_links_company_id_idx on public.customer_links(company_id);

insert into public.customer_links (customer_id, company_id, status)
select c.id, ic.id, 'active'
from public.customers c
cross join (select id from public.inspection_companies order by created_at limit 1) ic
where not exists (
  select 1 from public.customer_links cl where cl.customer_id = c.id
);

grant select, insert, update, delete on public.customer_links to authenticated;

-- Nieuwe klanten (via het bestaande klantformulier, dat niets van bedrijven
-- weet) krijgen automatisch een actieve link naar het enige bedrijf. Zodra
-- er een tweede bedrijf bijkomt, vervangt een echt koppelscherm dit.
create or replace function public.link_new_customer_to_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.customer_links (customer_id, company_id, status)
  select new.id, ic.id, 'active'
  from public.inspection_companies ic
  order by ic.created_at limit 1;
  return new;
end;
$function$;

drop trigger if exists customers_link_to_company on public.customers;
create trigger customers_link_to_company
  after insert on public.customers
  for each row execute function public.link_new_customer_to_company();
