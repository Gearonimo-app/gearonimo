-- Standaard afkeurcodes in de taal van het keurbedrijf (Jos, 2026-10-03).
--
-- Gevonden bij de voorbereiding van de Engelse demovideo: de platform-
-- standaard (company_id leeg) bestond alleen in het Nederlands. Een Engels
-- keurbedrijf kreeg daardoor Nederlandse afkeurcodes, in de keuring én op het
-- Engelse certificaat ("Leeftijd of label" op 20261003-CLAUDE-TEST-2).
--
-- Nu:
--   1. rejection_codes.language: de taal van een platformstandaard-rij
--      (nl/en/fr/de). Eigen codes van een bedrijf laten dit leeg.
--   2. De bestaande Nederlandse standaard krijgt language = 'nl'; daarnaast
--      dezelfde 8 codes in het Engels, Frans en Duits.
--   3. Een nieuw keurbedrijf krijgt bij het aanmaken meteen een eigen kopie in
--      de taal van zijn land (trigger). Land → taal: locale_for_country()
--      (20261010), zelfde tabel als certLanguageForCountry() in de app.
--   4. Bestaande keurbedrijven zónder eigen codes krijgen die nu ook.
-- Bedrijven die al eigen codes hebben, blijven ongemoeid: die codes kunnen
-- bewerkt zijn en hangen aan bestaande keuringen.
--
-- Idempotent.

alter table public.rejection_codes add column if not exists language text;

update public.rejection_codes
   set language = 'nl'
 where company_id is null
   and language is null;

insert into public.rejection_codes (company_id, code, label, language, active)
select null, v.code, v.label, v.language, true
from (values
  ('en', 1, 'Worn, end of life'),
  ('en', 2, 'Mechanical damage'),
  ('en', 3, 'Burn or melt marks'),
  ('en', 4, 'Corrosion'),
  ('en', 5, 'Age limit or ID label'),
  ('en', 6, 'Faulty gate or locking mechanism'),
  ('en', 7, 'Modified'),
  ('en', 8, 'Other, see comments'),
  ('fr', 1, 'Usure, en fin de vie'),
  ('fr', 2, 'Dommage mécanique'),
  ('fr', 3, 'Traces de brûlure ou de fusion'),
  ('fr', 4, 'Corrosion'),
  ('fr', 5, 'Âge limite ou marquage'),
  ('fr', 6, 'Fermeture ou verrouillage défectueux'),
  ('fr', 7, 'Modifié'),
  ('fr', 8, 'Autre, voir commentaires'),
  ('de', 1, 'Verschleiß, aufgebraucht'),
  ('de', 2, 'Mechanisch beschädigt'),
  ('de', 3, 'Brand- oder Schmelzstellen'),
  ('de', 4, 'Korrosion'),
  ('de', 5, 'Altersgrenze oder Kennzeichnung'),
  ('de', 6, 'Defekter Verschluss oder Verriegelung'),
  ('de', 7, 'Verändert'),
  ('de', 8, 'Sonstiges, siehe Bemerkungen')
) as v(language, code, label)
where not exists (
  select 1 from public.rejection_codes rc
  where rc.company_id is null
    and rc.language = v.language
    and rc.code = v.code
);

-- Eigen kopie van de standaard in de taal van het land, als het bedrijf nog
-- geen eigen codes heeft. Gedeeld door de trigger en de eenmalige aanvulling.
create or replace function public.seed_company_rejection_codes(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into rejection_codes (company_id, code, label, active)
  select c.id, rc.code, rc.label, rc.active
  from inspection_companies c
  join rejection_codes rc
    on rc.company_id is null
   and rc.language = coalesce(locale_for_country(c.country_code), 'nl')
  where c.id = p_company_id
    and not exists (
      select 1 from rejection_codes own where own.company_id = c.id
    );
end;
$function$;

revoke all on function public.seed_company_rejection_codes(uuid) from public;
revoke all on function public.seed_company_rejection_codes(uuid) from authenticated;

create or replace function public.inspection_companies_seed_rejection_codes()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform seed_company_rejection_codes(new.id);
  return new;
end;
$function$;

drop trigger if exists inspection_companies_seed_rejection_codes on public.inspection_companies;
create trigger inspection_companies_seed_rejection_codes
  after insert on public.inspection_companies
  for each row execute function public.inspection_companies_seed_rejection_codes();

-- Eenmalig: bestaande bedrijven zonder eigen codes.
select public.seed_company_rejection_codes(c.id)
from public.inspection_companies c
where not exists (
  select 1 from public.rejection_codes own where own.company_id = c.id
);
