-- Inloggen zonder codes (besluit Jos 2026-09-26, BOUWPLAN "Besluit:
-- klantrollen, eigenaar per artikel, inloggen", stap 2).
--
-- Twee regels:
--   1. Staat je e-mailadres op de lijst Gebruikers van een bedrijf, dan ben
--      je na het inloggen automatisch gekoppeld.
--   2. Sta je nergens op, dan begin je je eigen bedrijf ("Zelf beginnen").
-- De bedrijfscode (customers.invite_code) en join_customer_by_invite
-- vervallen. De kolom blijft staan (geen data weggooien); de functie geeft
-- een duidelijke melding voor een oude, gecachte app-versie.
--
-- Veilig omdat alleen een BEVESTIGD e-mailadres telt (auth.users.
-- email_confirmed_at): de inloglink komt in je eigen mailbox, dus alleen de
-- echte Piet kan op Piets adres inloggen. Een inactieve gebruiker ("uit
-- dienst") wordt niet gekoppeld.
--
-- Vangnet: heeft een bedrijf nog helemaal geen beheerder (keurmeester vergat
-- het vinkje), dan wordt de eerste gebruiker van de lijst die inlogt
-- beheerder -- anders kan niemand bij het bedrijf iets beheren. Dat is
-- alleen iemand die al op de lijst stond, niet zomaar iemand met een code.
--
-- Idempotent. Nog uit te voeren door Jos in de Supabase SQL-editor.

create or replace function public.claim_my_memberships()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_count integer := 0;
  r       record;
begin
  if v_uid is null then
    return 0;
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid
    and u.email_confirmed_at is not null;
  if coalesce(v_email, '') = '' then
    return 0;
  end if;

  -- Alleen rijen die nog aan níemand gekoppeld zijn. Een rij die al bij een
  -- ander account hoort, wordt nooit overgenomen -- ook niet als het
  -- e-mailadres (door een tikfout) overeenkomt. Wordt een account verwijderd
  -- (bv. opnieuw aangemaakt, zie 20260763), dan zet de foreign key user_id
  -- op null en is de rij vanzelf weer te koppelen.
  -- Per bedrijf hoogstens één rij (unique customer_id + user_id): heeft dit
  -- account er al een, dan niets doen; anders de oudste passende rij.
  for r in
    select distinct on (m.customer_id) m.id, m.customer_id
    from public.customer_members m
    where lower(btrim(coalesce(m.email, ''))) = v_email
      and m.active
      and m.user_id is null
      and not exists (
        select 1 from public.customer_members me
        where me.customer_id = m.customer_id and me.user_id = v_uid
      )
    order by m.customer_id, m.created_at
  loop
    update public.customer_members m
      set user_id = v_uid
      where m.id = r.id;
    v_count := v_count + 1;

    if not exists (
      select 1 from public.customer_members a
      where a.customer_id = r.customer_id and a.is_admin and a.active
    ) then
      update public.customer_members m set is_admin = true where m.id = r.id;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.claim_my_memberships() to authenticated;

-- Oude koppelroute: blijft bestaan zodat een gecachte oude app een nette
-- melding krijgt in plaats van "function does not exist".
create or replace function public.join_customer_by_invite(p_code text, p_name text default null)
returns table (customer_id uuid, customer_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Uitnodigingscodes zijn vervallen. Vraag je beheerder om je e-mailadres op de lijst Gebruikers te zetten en log daarmee in.';
end;
$$;
