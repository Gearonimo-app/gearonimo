-- Code review 2026-07-18, punt 6: het certificaatnummer (datum + klantnaam)
-- was niet uniek -- twee keuringen bij dezelfde klant op één dag kregen
-- hetzelfde nummer. Gekozen oplossing (Jos, 18-07-2026): een volgnummer.
-- Eerste certificaat van de dag houdt het kale nummer (20260718-BOOMWERK),
-- het tweede wordt 20260718-BOOMWERK-2, enzovoort.
--
-- Dit kan server-side zonder offline-probleem: het certificaat wordt ALTIJD
-- online gegenereerd (de PDF-upload naar Storage heeft sowieso netwerk nodig;
-- offline keuringen krijgen hun certificaat pas bij het synchroniseren).
--
-- Race-vrij via een tellertabel met een atomaire upsert: twee gelijktijdige
-- aanroepen voor dezelfde (company, base) krijgen gegarandeerd verschillende
-- volgnummers. Historische nummers passen we bewust NIET aan: die staan al op
-- uitgegeven PDF's; we voorkomen alleen nieuwe duplicaten. Idempotent.

create table if not exists public.certificate_number_counters (
  company_id uuid not null references public.inspection_companies(id) on delete cascade,
  base text not null,
  last_n integer not null,
  primary key (company_id, base)
);

-- Niemand mag hier rechtstreeks bij: alleen de allocate-functie (definer).
alter table public.certificate_number_counters enable row level security;
revoke all on public.certificate_number_counters from anon, authenticated;

-- Teller vooraf vullen met de bestaande certificaten, zodat een nieuw
-- certificaat met dezelfde base niet opnieuw op "1" (kaal nummer) uitkomt.
-- Bestaande nummers zijn altijd kale bases (het oude schema kende geen
-- suffix), dus groeperen op het nummer zelf volstaat.
insert into public.certificate_number_counters (company_id, base, last_n)
select i.company_id, c.number, count(*)::integer
from public.certificates c
join public.inspections i on i.id = c.inspection_id
group by i.company_id, c.number
on conflict (company_id, base) do nothing;

-- Geeft het volgende vrije certificaatnummer voor dit keurbedrijf terug.
-- n=1 -> kale base (zelfde uiterlijk als alle bestaande certificaten),
-- n>=2 -> base-2, base-3, ... De upsert is atomair: gelijktijdige aanroepen
-- serialiseren op de rij-lock en krijgen elk een eigen n.
create or replace function public.allocate_certificate_number(
  p_company_id uuid,
  p_base text
) returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_n integer;
begin
  if p_company_id not in (select public.inspector_company_ids()) then
    raise exception 'Geen actieve keurmeester bij dit keurbedrijf.';
  end if;
  if p_base is null or length(trim(p_base)) = 0 then
    raise exception 'Lege base voor certificaatnummer.';
  end if;

  insert into public.certificate_number_counters (company_id, base, last_n)
  values (p_company_id, p_base, 1)
  on conflict (company_id, base)
  do update set last_n = certificate_number_counters.last_n + 1
  returning last_n into v_n;

  if v_n = 1 then
    return p_base;
  end if;
  return p_base || '-' || v_n;
end;
$$;

grant execute on function public.allocate_certificate_number(uuid, text) to authenticated;
