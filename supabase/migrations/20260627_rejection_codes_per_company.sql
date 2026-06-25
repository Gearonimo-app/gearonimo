-- Afkeurcodes worden per keurbedrijf ingesteld (besluit Jos 2026-06-25): elk
-- keurbedrijf krijgt zijn eigen, los instelbare set. Dit corrigeert de eerste
-- opzet, waarin een keurbedrijf de gedeelde platformstandaard ter plekke
-- bewerkte (wat alle bedrijven tegelijk zou raken).
--
-- De platformstandaard (company_id = null) blijft staan als sjabloon/fallback:
-- een nieuw keurbedrijf dat nog geen eigen codes heeft, valt daarop terug
-- (zie fetchRejectionCodes in useInspections.ts) en krijgt bij de eerste
-- opening van het instellingenscherm een eigen kopie geseed.
--
-- Seed hier de bestaande keurbedrijven: geef elk bedrijf zonder eigen codes
-- een eigen kopie van de platformstandaard. Idempotent — een tweede run doet
-- niets, want dan bestaan de eigen codes al.
insert into public.rejection_codes (company_id, code, label, active)
select c.id, rc.code, rc.label, rc.active
from public.inspection_companies c
cross join public.rejection_codes rc
where rc.company_id is null
  and not exists (
    select 1 from public.rejection_codes own
    where own.company_id = c.id
  );
