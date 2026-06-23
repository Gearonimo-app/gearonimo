create table if not exists public.article_sets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id),
  name text not null,
  notes text,
  created_by_member_id uuid,
  created_by_inspector_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.article_set_members (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.article_sets(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  role text,
  unique (set_id, article_id)
);

create index if not exists article_sets_customer_id_idx on public.article_sets(customer_id);
create index if not exists article_set_members_set_id_idx on public.article_set_members(set_id);
create index if not exists article_set_members_article_id_idx on public.article_set_members(article_id);

grant select, insert, update, delete on public.article_sets to authenticated;
grant select, insert, update, delete on public.article_set_members to authenticated;
