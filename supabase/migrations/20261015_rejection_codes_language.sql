-- Standaard afkeur- en goedkeuringscodes, opnieuw opgezet volgens LOLER en in
-- de taal van het keurbedrijf (Jos, 2026-10-03).
--
-- Aanleiding: de standaard afkeurcodes bestonden alleen in het Nederlands. Een
-- Engels keurbedrijf kreeg daardoor Nederlandse codes, in de keuring én op het
-- Engelse certificaat ("Leeftijd of label" op 20261003-CLAUDE-TEST-2).
-- Goedkeuringscodes hadden helemaal geen standaard.
--
-- Besluit Jos: "hoe minder codes hoe beter" -- er is altijd een opmerkingenveld
-- en een bedrijf kan zelf codes toevoegen. Vier afkeurcodes en vier
-- goedkeuringscodes, in nl/en/fr/de:
--   Afkeur:  1 versleten/beschadigd buiten de grens van de fabrikant,
--            2 levensduur verlopen of geen leesbaar label (LOLER: identificatie),
--            3 eerst repareren (LOLER Sch.1 §8b), 4 direct gevaarlijk (melding
--            aan de HSE, LOLER reg. 10).
--   Goedkeur: 1 schoongemaakt/gesmeerd, 2 gerepareerd tijdens de keuring
--            (LOLER §8b: details in de opmerking), 3 lichte slijtage,
--            4 gebrek kan gevaarlijk worden -- herstellen/herkeuren vóór de
--            datum (LOLER §8c; datum in "Volgende keuring").
--
-- Hoe:
--   1. Kolom `language` op beide tabellen: taal van een platformstandaard-rij.
--      Eigen codes van een bedrijf laten hem leeg.
--   2. De oude 8 Nederlandse standaardcodes blijven bestaan (oude keuringen
--      verwijzen ernaar) maar krijgen geen taal en worden niet meer
--      uitgedeeld.
--   3. Een nieuw keurbedrijf krijgt bij het aanmaken een eigen kopie van beide
--      sets in de taal van zijn land (trigger). Land → taal:
--      locale_for_country() (20261010), gelijk aan languageForCountry() in
--      packages/core.
--   4. Bestaande bedrijven zonder eigen codes krijgen die nu ook (per tabel).
--      Bedrijven mét eigen codes blijven ongemoeid.
--
-- Idempotent.

alter table public.rejection_codes add column if not exists language text;
alter table public.approval_codes add column if not exists language text;

insert into public.rejection_codes (company_id, code, label, language, active)
select null, v.code, v.label, v.language, true
from (values
  ('nl', 1, 'Versleten of beschadigd buiten de grens van de fabrikant'),
  ('nl', 2, 'Levensduur verlopen of geen leesbaar label'),
  ('nl', 3, 'Eerst repareren, daarna pas gebruiken'),
  ('nl', 4, 'Direct gevaarlijk – uit gebruik genomen'),
  ('en', 1, 'Worn or damaged beyond manufacturer''s limits'),
  ('en', 2, 'Lifespan exceeded or ID marking missing'),
  ('en', 3, 'Repair required before use'),
  ('en', 4, 'Immediate danger – removed from service'),
  ('fr', 1, 'Usé ou endommagé au-delà des limites du fabricant'),
  ('fr', 2, 'Durée de vie dépassée ou marquage illisible'),
  ('fr', 3, 'Réparation nécessaire avant utilisation'),
  ('fr', 4, 'Danger immédiat – retiré du service'),
  ('de', 1, 'Verschlissen oder beschädigt über die Herstellergrenzen hinaus'),
  ('de', 2, 'Lebensdauer überschritten oder Kennzeichnung fehlt'),
  ('de', 3, 'Reparatur vor Gebrauch erforderlich'),
  ('de', 4, 'Unmittelbare Gefahr – außer Betrieb genommen')
) as v(language, code, label)
where not exists (
  select 1 from public.rejection_codes rc
  where rc.company_id is null and rc.language = v.language and rc.code = v.code
);

insert into public.approval_codes (company_id, code, label, language, active)
select null, v.code, v.label, v.language, true
from (values
  ('nl', 1, 'Schoongemaakt en/of gesmeerd'),
  ('nl', 2, 'Gerepareerd – onderdeel vervangen tijdens de keuring'),
  ('nl', 3, 'Lichte slijtage – in de gaten houden'),
  ('nl', 4, 'Gebrek kan gevaarlijk worden – herstellen of herkeuren vóór de datum'),
  ('en', 1, 'Cleaned and/or lubricated'),
  ('en', 2, 'Repaired – part replaced during examination'),
  ('en', 3, 'Minor wear – monitor'),
  ('en', 4, 'Defect could become dangerous – remedy or re-examine by the date shown'),
  ('fr', 1, 'Nettoyé et/ou lubrifié'),
  ('fr', 2, 'Réparé – pièce remplacée lors du contrôle'),
  ('fr', 3, 'Usure légère – à surveiller'),
  ('fr', 4, 'Défaut pouvant devenir dangereux – remédier ou recontrôler avant la date indiquée'),
  ('de', 1, 'Gereinigt und/oder geschmiert'),
  ('de', 2, 'Repariert – Teil bei der Prüfung ersetzt'),
  ('de', 3, 'Leichter Verschleiß – beobachten'),
  ('de', 4, 'Mangel kann gefährlich werden – bis zum angegebenen Datum beheben oder erneut prüfen')
) as v(language, code, label)
where not exists (
  select 1 from public.approval_codes ac
  where ac.company_id is null and ac.language = v.language and ac.code = v.code
);

-- Eigen kopie van beide standaardsets in de taal van het land, per tabel
-- alleen als het bedrijf daar nog niets heeft. Gedeeld door de trigger en de
-- eenmalige aanvulling hieronder.
create or replace function public.seed_company_codes(p_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  lang text;
begin
  select coalesce(locale_for_country(c.country_code), 'nl') into lang
  from inspection_companies c where c.id = p_company_id;
  if lang is null then return; end if;

  insert into rejection_codes (company_id, code, label, active)
  select p_company_id, rc.code, rc.label, rc.active
  from rejection_codes rc
  where rc.company_id is null and rc.language = lang
    and not exists (select 1 from rejection_codes own where own.company_id = p_company_id);

  insert into approval_codes (company_id, code, label, active)
  select p_company_id, ac.code, ac.label, ac.active
  from approval_codes ac
  where ac.company_id is null and ac.language = lang
    and not exists (select 1 from approval_codes own where own.company_id = p_company_id);
end;
$function$;

revoke all on function public.seed_company_codes(uuid) from public;
revoke all on function public.seed_company_codes(uuid) from authenticated;

create or replace function public.inspection_companies_seed_codes()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform seed_company_codes(new.id);
  return new;
end;
$function$;

drop trigger if exists inspection_companies_seed_codes on public.inspection_companies;
create trigger inspection_companies_seed_codes
  after insert on public.inspection_companies
  for each row execute function public.inspection_companies_seed_codes();

-- Eenmalig: bestaande bedrijven (de functie slaat per tabel over wat er al is).
select public.seed_company_codes(c.id) from public.inspection_companies c;
