-- Code review 2026-07-18, punt 9: save_my_member was fragiel. p_is_admin had
-- default false en p_active default true -- riep toekomstige code de functie
-- aan zonder die parameters (bv. alleen een telefoonnummer bijwerken), dan
-- werd een beheerder STIL gedegradeerd of een inactief lid stil geactiveerd.
--
-- Nieuwe regel: bij een UPDATE betekent een weggelaten/null-waarde "laat
-- staan zoals het is". Bij een INSERT blijven de oude standaarden gelden
-- (actief, geen beheerder). De app geeft de velden vandaag altijd expliciet
-- mee, dus gedrag verandert nu niet -- dit voorkomt een toekomstige bug.
-- Idempotent.

create or replace function public.save_my_member(
  p_name text,
  p_role text default null,
  p_phone text default null,
  p_email text default null,
  p_active boolean default null,
  p_is_admin boolean default null,
  p_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me       public.customer_members%rowtype;
  v_target   public.customer_members%rowtype;
  v_id       uuid;
  v_new_active   boolean;
  v_new_is_admin boolean;
begin
  select m.* into v_me
  from public.customer_members m
  where m.user_id = auth.uid() and m.active
  order by m.created_at
  limit 1;
  if v_me.id is null then
    raise exception 'Geen klantkoppeling voor dit account.';
  end if;
  if not v_me.is_admin then
    raise exception 'Alleen een beheerder kan medewerkers beheren.';
  end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then
    raise exception 'Naam is verplicht.';
  end if;

  if p_id is null then
    -- Nieuw lid: oude standaarden (actief, geen beheerder).
    insert into public.customer_members (customer_id, name, role, phone, email, active, is_admin)
    values (
      v_me.customer_id,
      trim(p_name),
      nullif(trim(coalesce(p_role, '')), ''),
      nullif(trim(coalesce(p_phone, '')), ''),
      nullif(trim(coalesce(p_email, '')), ''),
      coalesce(p_active, true),
      coalesce(p_is_admin, false)
    )
    returning id into v_id;
    return v_id;
  end if;

  select m.* into v_target
  from public.customer_members m
  where m.id = p_id and m.customer_id = v_me.customer_id;
  if v_target.id is null then
    raise exception 'Medewerker niet gevonden bij jouw bedrijf.';
  end if;

  -- Weggelaten veld = huidige waarde behouden (de kern van deze fix).
  v_new_active   := coalesce(p_active, v_target.active);
  v_new_is_admin := coalesce(p_is_admin, v_target.is_admin);

  if v_target.id = v_me.id and (not v_new_active or not v_new_is_admin) then
    raise exception 'Je kunt jezelf niet inactief of niet-beheerder maken.';
  end if;

  update public.customer_members
  set name     = trim(p_name),
      role     = nullif(trim(coalesce(p_role, '')), ''),
      phone    = nullif(trim(coalesce(p_phone, '')), ''),
      email    = nullif(trim(coalesce(p_email, '')), ''),
      active   = v_new_active,
      is_admin = v_new_is_admin
  where id = v_target.id;
  return v_target.id;
end;
$$;
