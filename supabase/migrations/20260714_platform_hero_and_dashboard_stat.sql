-- Platform-brede hero-foto op het hoofdmenu (UX-FLOW.md §7) + de
-- "certificaten binnen 30 dagen verlopen"-melding op het dashboard
-- (besluit Jos 2026-07-14: geen vanity-teller, één actionable melding).

-- ─── Helper: platform-admin-check ────────────────────────────────────────
-- platform_admins staat sinds de RLS-ronde (20260713_rls_enable.sql) op
-- slot (RLS aan, geen policies -- "tabel zonder app-gebruik"). Deze
-- security-definer-helper volgt hetzelfde patroon als is_active_inspector()
-- e.d. zodat een policy elders er wél doorheen mag kijken.
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid()
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;

-- ─── platform_settings: singleton-rij met de huidige hero-foto's ────────
-- Los van inspection_companies.settings (per bedrijf) -- dit is platform-
-- breed, crowdsourced en roulerend (klantfoto's, wisselt elk kwartaal).
create table if not exists public.platform_settings (
  id boolean primary key default true,
  hero_photo_mobile_path text,
  hero_photo_desktop_path text,
  updated_at timestamptz not null default now(),
  constraint platform_settings_singleton check (id)
);

alter table public.platform_settings enable row level security;

drop policy if exists "platform_settings read all" on public.platform_settings;
create policy "platform_settings read all" on public.platform_settings
  for select to authenticated using (true);

drop policy if exists "platform_settings write admin" on public.platform_settings;
create policy "platform_settings write admin" on public.platform_settings
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

insert into public.platform_settings (id) values (true)
on conflict (id) do nothing;

-- ─── Dashboardmelding: certificaten/artikelen binnen N dagen verlopen ───
-- Security invoker (standaard): loopt via de bestaande RLS op
-- inspection_items/inspections/articles, dus automatisch gescopeerd op het
-- eigen keurbedrijf van de aanroepende keurmeester. Neemt per artikel
-- alleen de laatst afgeronde keuring mee (een artikel kan meerdere
-- historische inspection_items-rijen hebben).
create or replace function public.upcoming_reinspections_count(days_ahead integer default 30)
returns integer
language sql stable
as $$
  select count(*)::integer
  from (
    select distinct on (ii.article_id)
      ii.next_due
    from public.inspection_items ii
    join public.inspections i on i.id = ii.inspection_id
    join public.articles a on a.id = ii.article_id
    where i.status = 'completed'
      and a.retired = false
    order by ii.article_id, i.inspection_date desc
  ) latest
  where latest.next_due is not null
    and latest.next_due >= current_date
    and latest.next_due <= (current_date + days_ahead)
$$;

grant execute on function public.upcoming_reinspections_count(integer) to authenticated;
