-- Vult de echte bedrijfsgegevens en koptekst/voettekst van Safety Green BV in
-- (aangeleverd door Jos) en zet de definitieve afkeurcodes 1-8 die nu in de
-- praktijk gebruikt worden. company_id = null betekent platformstandaard
-- (DATAMODEL §rejection_codes), zodat ze voor alle keurbedrijven gelden.

update public.inspection_companies
set
  name         = 'Safety Green B.V.',
  address      = 'Energieweg 3',
  postal_code  = '6662NS',
  city         = 'Elst (Gld)',
  cert_header  = 'Keuringen worden uitgevoerd door daarvoor opgeleide medewerkers. De uitgevoerde keuring betreft een visuele controle van onderstaande punten van de aangeboden materialen. Safety Green B.V. kan nimmer aansprakelijk worden gesteld voor ongevallen, directe of indirecte schade ten gevolge van verkeerd gebruik van de materialen.',
  cert_footer  = 'Leveringen, opdrachten en offertes geschieden volgens de leveringsvoorwaarden gedeponeerd bij het Handelsregister te Arnhem onder inschrijvingsnr: 10042517'
where name = 'Gearonimo';

insert into public.rejection_codes (company_id, code, label)
select null, v.code, v.label
from (values
  (1, 'Slijtage, opgebruikt'),
  (2, 'Mechanisch beschadigd'),
  (3, 'Brand- of smeltplekken'),
  (4, 'Roest'),
  (5, 'Leeftijd of label'),
  (6, 'Defecte sluiting'),
  (7, 'Modificatie'),
  (8, 'Anders, zie opmerkingen')
) as v(code, label)
where not exists (
  select 1 from public.rejection_codes rc
  where rc.company_id is null and rc.code = v.code
);
