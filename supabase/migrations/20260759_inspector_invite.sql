-- Uitnodig-knop voor keurmeesters zonder eigen account (Jos, 2026-09-08).
-- Tot nu toe kon een beheerder wel een keurmeester-rij aanmaken zonder
-- account, maar er was geen manier om die te koppelen aan een echt
-- inlogaccount buiten handwerk in het Supabase-dashboard om.
--
-- Zelfde patroon als de klant-app-uitnodiging (20260708/20260738): een korte
-- code op de rij, en een publieke claim-RPC die het ingelogde account eraan
-- koppelt. Hergebruikt het bestaande pogingen-logboek (invite_attempts) voor
-- dezelfde rem op raden -- dat is generiek genoeg (alleen user_id +
-- attempted_at) om voor beide uitnodigingsstromen te dienen.

-- 1. Uitnodigingscode per keurmeester-rij.
alter table public.inspectors
  add column if not exists invite_code text;

update public.inspectors
  set invite_code = upper(substr(md5(gen_random_uuid()::text), 1, 8))
  where invite_code is null;

alter table public.inspectors
  alter column invite_code set default upper(substr(md5(gen_random_uuid()::text), 1, 8));

alter table public.inspectors
  alter column invite_code set not null;

create unique index if not exists inspectors_invite_code_key
  on public.inspectors (invite_code);

-- 2. De code zelf NIET via de gewone rij-select laten meelezen: de
--    bestaande "inspectors read own company"-policy laat elke collega bij
--    het keurbedrijf alle kolommen van elkaars rij lezen (net als is_admin/
--    active vandaag al), maar bij een code betekent lezen = kunnen claimen.
--    Zonder deze afscherming zou een gewone (niet-beheerder) keurmeester de
--    nog niet geclaimde code van bijvoorbeeld een beheerder-rij kunnen
--    aflezen en die zelf claimen. Alleen ophalen via deze beheerder-only RPC.
create or replace function public.get_inspector_invite_code(p_inspector_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select i.invite_code
  from public.inspectors i
  where i.id = p_inspector_id
    and public.is_company_admin(i.company_id);
$$;

grant execute on function public.get_inspector_invite_code(uuid) to authenticated;

-- 3. Claim-RPC: koppelt het ingelogde account aan de keurmeester-rij die bij
--    de code hoort (moet nog niet geclaimd en actief zijn).
create or replace function public.join_inspector_by_invite(p_code text, p_name text default null)
returns table (inspector_id uuid, company_id uuid, company_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inspector public.inspectors%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Niet ingelogd.';
  end if;

  if exists (select 1 from public.inspectors i where i.user_id = auth.uid()) then
    raise exception 'Dit account is al aan een keurmeester gekoppeld.';
  end if;

  -- Zelfde rem op raden als bij de klant-uitnodiging (20260738): max 10
  -- mislukte pogingen per account per uur.
  if (select count(*) from public.invite_attempts a
      where a.user_id = auth.uid()
        and a.attempted_at > now() - interval '1 hour') >= 10 then
    raise exception 'Te veel mislukte pogingen. Probeer het over een uur opnieuw.';
  end if;

  select * into v_inspector
  from public.inspectors i
  where upper(i.invite_code) = upper(trim(p_code))
    and i.user_id is null
    and i.active;
  if not found then
    insert into public.invite_attempts (user_id) values (auth.uid());
    delete from public.invite_attempts where attempted_at < now() - interval '1 day';
    raise exception 'Onbekende of al gebruikte uitnodigingscode.';
  end if;

  update public.inspectors i
    set user_id = auth.uid(),
        name    = coalesce(nullif(trim(p_name), ''), i.name)
    where i.id = v_inspector.id;

  return query
    select v_inspector.id, v_inspector.company_id, c.name
    from public.inspection_companies c
    where c.id = v_inspector.company_id;
end;
$$;

grant execute on function public.join_inspector_by_invite(text, text) to authenticated;
