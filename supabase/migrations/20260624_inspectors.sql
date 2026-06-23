-- Keurmeesters (DATAMODEL §inspectors). Elke ingelogde gebruiker van de
-- inspector-app is een keurmeester bij het (vandaag: enige) keurbedrijf.
--
-- `ensure_inspector()` provisioneert automatisch een rij voor de ingelogde
-- gebruiker bij de eerste keer dat de app erom vraagt — er is nog geen
-- "keurmeesters beheren"-scherm (komt bij de instellingen-tegel), dus zonder
-- deze functie zou niemand ooit een inspectors-rij krijgen.

create table if not exists public.inspectors (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users(id) on delete cascade,
  company_id uuid not null references public.inspection_companies(id),
  name       text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

grant select, insert, update, delete on public.inspectors to authenticated;

create or replace function public.ensure_inspector()
returns public.inspectors
language plpgsql
security definer
set search_path = public
as $function$
declare
  result public.inspectors;
  first_company_id uuid;
begin
  select id into first_company_id from public.inspection_companies order by created_at limit 1;

  insert into public.inspectors (user_id, company_id, name)
  values (auth.uid(), first_company_id, (select email from auth.users where id = auth.uid()))
  on conflict (user_id) do nothing;

  select * into result from public.inspectors where user_id = auth.uid();
  return result;
end;
$function$;

grant execute on function public.ensure_inspector() to authenticated;
