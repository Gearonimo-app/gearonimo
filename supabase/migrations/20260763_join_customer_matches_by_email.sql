-- join_customer_by_invite matchte een teruggekomen gebruiker alleen op een
-- exacte user_id-match, en anders op e-mail maar UITSLUITEND bij een nog
-- nooit gekoppelde rij (user_id is null). Zodra een rij één keer gekoppeld
-- is, telt e-mail daarna niet meer mee. Besproken met Jos (2026-09-14): dat
-- is fragieler dan het hoort te zijn -- een e-mailadres dat je zelf via
-- magic link/passkey hebt geverifieerd, mag altijd meetellen, niet alleen
-- de allereerste keer.
--
-- Deze migratie laat de e-mailmatch ook een al-gekoppelde rij vinden en
-- bindt die dan om naar het huidige account (user_id wordt bijgewerkt).
-- Dat dekt bijvoorbeeld: iemand die zijn account opnieuw heeft moeten
-- aanmaken, of wisselt van magic link naar passkey. Wél nog steeds eerst de
-- exacte user_id-match, dus een al lopende koppeling wordt nooit onnodig
-- aangeraakt.
--
-- Idempotent (create or replace).

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

  if v_member is null and v_email <> '' then
    -- E-mailmatch: mag nu ook een al eerder gekoppelde rij vinden (niet
    -- meer beperkt tot user_id is null) -- zie migratie-commentaar hierboven.
    -- Bij een (zeldzame) dubbele e-mail bij dezelfde klant heeft de nog
    -- ongekoppelde rij voorrang, anders de meest recente.
    select m.id into v_member
    from public.customer_members m
    where m.customer_id = v_customer.id
      and lower(coalesce(m.email, '')) = lower(v_email)
    order by (m.user_id is null) desc, m.created_at desc
    limit 1;

    if v_member is not null then
      update public.customer_members m
        set user_id = auth.uid(),
            active  = true,
            name    = coalesce(nullif(trim(p_name), ''), m.name)
        where m.id = v_member;
    end if;
  end if;

  if v_member is null then
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
