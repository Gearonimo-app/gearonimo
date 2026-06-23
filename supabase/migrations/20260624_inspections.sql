-- Keuringen + keuringsitems (DATAMODEL §inspections/§inspection_items) — het
-- hart van fase 2. Eén `inspections`-rij per keurdag bij een klant; één
-- `inspection_items`-rij per beoordeeld artikel, met een snapshot zodat de
-- historie nooit verandert als het artikel later wordt bewerkt.
--
-- certificate_number wordt pas bij afronden gezet (leeg tijdens een concept),
-- vandaar text? in plaats van not null.

create table if not exists public.inspections (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers(id),
  company_id         uuid not null references public.inspection_companies(id),
  inspector_id       uuid not null references public.inspectors(id),
  certificate_number text,
  inspection_date    date not null default current_date,
  location           text,
  examination_type   text not null default 'periodic',
  status             text not null default 'draft',
  completed_at       timestamptz,
  notes              text,
  created_at         timestamptz not null default now()
);

create index if not exists inspections_customer_id_idx on public.inspections(customer_id);
create index if not exists inspections_company_id_idx on public.inspections(company_id);
create index if not exists inspections_status_idx on public.inspections(status);

create table if not exists public.inspection_items (
  id               uuid primary key default gen_random_uuid(),
  inspection_id    uuid not null references public.inspections(id) on delete cascade,
  article_id       uuid not null references public.articles(id),
  article_snapshot jsonb,
  result           text not null default 'not_assessed',
  next_due         date,
  rejection_code_id uuid references public.rejection_codes(id),
  comment          text,
  created_at       timestamptz not null default now()
);

create index if not exists inspection_items_inspection_id_idx on public.inspection_items(inspection_id);
create index if not exists inspection_items_article_id_idx on public.inspection_items(article_id);

grant select, insert, update, delete on public.inspections to authenticated;
grant select, insert, update, delete on public.inspection_items to authenticated;
