-- Code review 2026-07-18, punten 12 en 16.
--
-- Punt 12: join_customer_by_invite had geen limiet op raad-pogingen. Elk
-- ingelogd account kon in theorie onbeperkt uitnodigingscodes proberen.
-- Nu: maximaal 10 MISLUKTE pogingen per account per uur; daarna een uur
-- wachten. Gelukte joins tellen niet mee, dus een typfoutje kan geen kwaad.
--
-- Punt 16: upcoming_reinspections_count koos bij twee afgeronde keuringen op
-- dezelfde dag willekeurig welke "de laatste" was; de klant-app (my_articles)
-- gebruikt completed_at als tiebreaker. Nu telt het dashboard hetzelfde.
-- Idempotent.

-- ─── Punt 12: pogingen-logboek ──────────────────────────────────────────────

create table if not exists public.invite_attempts (
  user_id uuid not null,
  attempted_at timestamptz not null default now()
);

create index if not exists invite_attempts_user_time
  on public.invite_attempts (user_id, attempted_at);

-- Niemand mag hier rechtstreeks bij: alleen de join-functie (definer).
alter table public.invite_attempts enable row level security;
revoke all on public.invite_attempts from anon, authenticated;

create or replace function public.join_customer_by_invite(p_code text, p_name text default null)
returns table (customer_id uuid, customer_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_email    text := coalesce(auth.jwt() ->> 'email', '');
  v_member   uuid;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd.';
  end if;

  -- Rem op raden (code review 2026-07-18, punt 12): max 10 mislukte
  -- pogingen per uur per account.
  if (select count(*) from public.invite_attempts a
      where a.user_id = auth.uid()
        and a.attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'Te veel mislukte pogingen. Probeer het over een uur opnieuw.';
  end if;

  select * into v_customer
  from public.customers c
  where upper(c.invite_code) = upper(trim(p_code));
  if not found then
    -- Mislukte poging vastleggen; en het logboek klein houden.
    insert into public.invite_attempts (user_id) values (auth.uid());
    delete from public.invite_attempts where attempted_at < now() - interval '1 day';
    raise exception 'Onbekende uitnodigingscode.';
  end if;

  select m.id into v_member
  from public.customer_members m
  where m.customer_id = v_customer.id and m.user_id = auth.uid();

  if v_member is null then
    select m.id into v_member
    from public.customer_members m
    where m.customer_id = v_customer.id
      and m.user_id is null
      and lower(coalesce(m.email, '')) = lower(v_email)
      and v_email <> ''
    limit 1;

    if v_member is not null then
      update public.customer_members m
        set user_id = auth.uid(),
            active  = true,
            name    = coalesce(nullif(trim(p_name), ''), m.name)
        where m.id = v_member;
    else
      insert into public.customer_members (customer_id, user_id, name, email, active)
      values (
        v_customer.id,
        auth.uid(),
        coalesce(nullif(trim(p_name), ''), split_part(v_email, '@', 1), 'Medewerker'),
        nullif(v_email, ''),
        true
      )
      returning id into v_member;
    end if;
  end if;

  -- Eerste beheerder van dit klantbedrijf.
  if not exists (
    select 1 from public.customer_members m
    where m.customer_id = v_customer.id and m.is_admin
  ) then
    update public.customer_members m set is_admin = true where m.id = v_member;
  end if;

  return query select v_customer.id, v_customer.name;
end;
$$;

-- ─── Punt 16: dashboard telt met dezelfde tiebreaker als de klant-app ───────

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
    -- completed_at als tiebreaker bij twee keuringen op dezelfde dag,
    -- gelijk aan my_articles in de klant-app (code review punt 16).
    order by ii.article_id, i.inspection_date desc, i.completed_at desc nulls last
  ) latest
  where latest.next_due is not null
    and latest.next_due >= current_date
    and latest.next_due <= (current_date + days_ahead)
$$;
