-- Afkeur- en goedkeuringscodes: geen standaardset meer (Jos, 2026-10-03).
--
-- "Elk bedrijf mag zonder goed- of afkeurcodes beginnen. Als een Engels
-- bedrijf aan LOLER wil voldoen, moet hij zelf de juiste codes erin zetten."
-- Aanleiding: de standaard afkeurcodes bestonden alleen in het Nederlands, dus
-- een Engels keurbedrijf kreeg Nederlandse codes, ook op het certificaat
-- ("Leeftijd of label" op 20261003-CLAUDE-TEST-2).
--
-- Tot nu toe viel een bedrijf zonder eigen afkeurcodes terug op de
-- platformstandaard (company_id leeg), en kreeg het een eigen kopie zodra het
-- Instellingen → Afkeurcodes opende. Die terugval en dat kopiëren zijn uit de
-- app gehaald: een nieuw bedrijf begint leeg.
--
-- Bestaande bedrijven blijven zien wat ze nu zien: wie nog geen eigen
-- afkeurcodes heeft (en dus de standaard kreeg), krijgt die nu als eigen
-- kopie. Daarna kan hij ze zelf aanpassen of uitzetten. Voor goedkeurings-
-- codes bestaat geen standaard, daar verandert niets.
--
-- De standaardrijen zelf blijven staan: oude keuringen verwijzen ernaar.
--
-- Idempotent: een tweede keer doet niets, want dan heeft ieder bedrijf codes.

insert into public.rejection_codes (company_id, code, label, active)
select c.id, rc.code, rc.label, rc.active
from public.inspection_companies c
cross join public.rejection_codes rc
where rc.company_id is null
  and not exists (
    select 1 from public.rejection_codes own
    where own.company_id = c.id
  );
