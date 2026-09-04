# Testplan Gearonimo — ronde 3 (opgesteld 2026-08-30)

Vervangt het A-Z-plan van 6 juli. Dat plan begon met een volledige reset, en
was bovendien niet meer uitvoerbaar: `testdata-reset.sql` wist `auth.users`,
waardoor via de cascade ook de platformbeheerder verdween — en fase B ging uit
van auto-provisioning door `ensure_inspector`, die sinds de RLS-ronde juist een
fout gooit. Je zat na stap 3 buitengesloten. Het staat in de git-historie.

**Uitgangspunten:**

1. **Niets gaat eruit.** Geen reset, geen klanten of keurmeesters verwijderen,
   geen accounts opruimen. Je test op de echte database, met je eigen account.
2. **Zo weinig mogelijk werk.** Eén testklant die je zelf aanmaakt, en verder
   kijken en klikken. SQL alleen in fase 0.
3. **Op risico gesorteerd, niet als rondleiding.** De volgorde hieronder is
   bewust: eerst wat alles blokkeert, dan de nieuwste code terwijl je aandacht
   vers is, en als laatste wat je sessie verbreekt.

**Zo werkt het:** doe de stappen op nummer en noteer per stap ✅ of ❌ (met wat
je ziet). Elke stap heeft een **Verwacht:**-regel. Elke fase is een blokje van
±10–15 minuten; je kunt tussen fases stoppen.

- **Pro-app (keurmeester):** https://gearonimo.net
- **Klant-app:** https://gearonimo.net/portal/
- **Supabase:** project `buitfeiclivzzldfdelp` → SQL editor

---

## Waarom deze volgorde

| Fase | Waarom hier |
|---|---|
| 0. Migraties + schone herstart | Zonder dit test je een app die er niet meer is. Je bugmelding van 13 augustus bleek een gecachete versie. |
| 1. Zelfcontroles en materiaalsoorten | Nieuwste code (aug), nog niet volledig gemigreerd, leverde in twee testrondes al vier bugs op. Hoort vooraan, niet achteraan. |
| 2. Keurmeesterkant van dezelfde regel | Kleding en machines mogen niet in de keuringswizard opduiken. Een fout hier is vanuit de klant-app onzichtbaar. |
| 3. Artikelpagina en koppelen | De koppelmarathon is je zwaarste dagelijkse werk, en de opmerkingen-fix van 13 augustus zit hier. |
| 4. Keuring en certificaat | Het hart, maar de rustigste code — al maanden stabiel. |
| 5. Catalogus | Groot, maar los van de rest. |
| 6. Offline | Vergt vliegtuigmodus; onderbreekt de rest. |
| 7. Instellingen | Laagste risico; wachtwoord wijzigen logt je uit, dus helemaal achteraan. |

**Tabbladen** krijgen geen eigen fase meer. Tabbladbugs tonen zich niet in de
strook zelf maar in wat je érin doet, dus er zit een korte smoketest in fase 0
en verder staan er kruisproeven verspreid door fase 1–5 (herkenbaar aan
**⇄ twee tabbladen**).

---

## Fase 0 — Vooraf (±15 min)

### 0a. Migraties uitvoeren

Drie migraties staan nog open. Zonder deze geven een paar schermen een
foutmelding of tonen ze verouderde gegevens. Volledige stap-voor-stap-uitleg
staat in **`MIGRATIES-UITVOEREN.md`** — doe die eerst en kom hier terug.

Kort: Supabase → SQL editor → per bestand de inhoud plakken en **Run**:

1. `20260755_article_detail_self_checks.sql`
2. `20260756_article_detail_performed_by.sql` ← **na 755, niet ervoor**
3. `20260757_products_unique_index.sql`
4. `20260748_platform_admin_set_password.sql` (alleen nodig voor fase 7)

> ⚠️ **`20260749_catalog_reset_and_unique.sql` mag je niet draaien.** Dat
> bestand koppelt élk artikel los van zijn product en maakt de catalogus leeg.
> Migratie 20260757 bevat het enige stukje dat nog nodig was.

### 0b. Schoon herstarten

5. Verwijder de app van je telefoon als hij als PWA op je beginscherm staat, en
   zet hem er opnieuw op via de browser ("Toevoegen aan beginscherm").
   **Verwacht:** het icoon is de groene karabiner met vinkje, scherp, zonder wit
   blok en zonder woordmerk.
6. Start hem en log in.
   **Verwacht:** het opstartscherm toont hetzelfde scherpe logo op wit. Op het
   inlogscherm staat het groene label "Keurder-app · voor keurmeesters".

   *Dit is niet cosmetisch: het garandeert dat je de nieuwste versie test. Zie
   je later iets raars, doe dan eerst een harde herlaad voordat je het meldt.*

### 0c. Tabbladen-smoketest (5 min)

7. Bekijk de strook bovenaan.
   **Verwacht:** een tabbladenstrook met één tabblad ("Hoofdmenu") en een **+**.
8. Open Klanten → een klant. Klik dan op **+**.
   **Verwacht:** het eerste tabblad heet naar die klant; er komt een tweede bij
   op het hoofdmenu, en het eerste blijft bestaan.
9. Wissel heen en weer tussen de twee.
   **Verwacht:** elk tabblad staat nog precies zoals je het verliet.
10. Open er 8 (blijf op **+** klikken).
    **Verwacht:** bij 8 kun je er geen meer bij: "Maximaal 8 tabbladen tegelijk".
    Geen vastloper.
11. Sluit terug naar één tabblad.
    **Verwacht:** bij het laatste is er geen kruisje meer.

### 0d. Testklant aanmaken

12. Klanten → **Klant toevoegen** → naam **ZZ Test 30-08**, verder alleen wat
    verplicht is. Opslaan.
    **Verwacht:** de klant wordt aangemaakt.

---

## Fase 1 — Zelfcontroles en materiaalsoorten (±20 min) ⭐ nieuwste werk

Dit is het nieuwste functiegebied: kleding, machines en overig vallen buiten het
keurbedrijf, en de klant vinkt ze zelf af. Hier verwacht ik de meeste
problemen — neem deze fase het rustigst.

> Je hebt hiervoor de klant-app nodig. Let op: beide apps delen de sessie op
> hetzelfde domein, dus na het inloggen in `/portal/` ben je in de Pro-app
> uitgelogd. Dat is normaal; je logt aan het eind van deze fase weer in.

13. Pro-app → ZZ Test 30-08 → kopieer de **uitnodigingscode**.
14. Open https://gearonimo.net/portal/ en log in met een e-mailadres dat je nog
    niet gebruikt — bijvoorbeeld `josvdhoogen+klanttest@gmail.com` (die mail
    komt gewoon in je eigen postvak). Volg de magic-link.
    **Verwacht:** je landt in de klant-app, niet in de Pro-app, en niet op een
    wit scherm.
15. Koppel met de uitnodigingscode.
    **Verwacht:** je hangt aan ZZ Test 30-08 en bent meteen **beheerder** (eerste
    account).
16. Ga naar Instellingen → **Materiaalsoorten**.
    **Verwacht:** vier soorten — Klimmateriaal, Machines, Kleding, Overig.
    Klimmateriaal staat vast aan ("Staat altijd aan").
17. Zet **Machines**, **Kleding** en **Overig** aan en sla op.
18. Ga naar **Mijn materiaal**.
    **Verwacht:** nu een tegelscherm met vier tegels. (Met maar één soort aan
    zou je meteen de lijst zien — een scherm met één knop is zinloos.)
19. Tegel **Overig** → **+ Toevoegen** → zelf invullen: omschrijving
    `EHBO-koffer`, producttype **Overig**. Opslaan.
    **Verwacht:** het artikel staat onder Overig, met status **Nog niet
    gecontroleerd** (grijs) — niet "Nog niet gekeurd".
20. Open de EHBO-koffer.
    **Verwacht:** het detailscherm zegt **Laatste controle** / **Volgende
    controle**, niet "Laatste keuring". Er staat een eigen **Afvinken**-knop
    (omlijnd, niet dichtgroen).
21. Klik **Afvinken**, vul bij "Door wie?" een naam in (bijv. `Jos`) en bevestig.
    **Verwacht:** de melding zegt expliciet dat dit géén keuring door een
    keurbedrijf is.
22. **Kijk nu goed — dit is waar het twee keer eerder misging.** Vergelijk
    dezelfde EHBO-koffer op drie plekken:
    - het **detailscherm**: staat de datum én de naam die je invulde er?
    - de **lijst** onder Overig: staat er "afgevinkt op <datum>"?
    - het **dashboard**: is de status niet langer "Nog niet gecontroleerd"?

    **Verwacht:** alle drie kloppen en spreken elkaar niet tegen.
    *Achtergrond: `my_articles`, `my_article_detail` en `my_customer` zijn drie
    aparte databasefuncties met elk hun eigen kolommenlijst, met de hand gelijk
    gehouden. Twee keer eerder was het detailscherm vergeten bij een uitbreiding
    — vandaar juist hier deze drievoudige controle.*
23. Kijk op het detailscherm naar het blok **Controles**.
    **Verwacht:** de laatste vijf controles, datum + wie het deed, nieuwste
    eerst. Vink nog een keer af en controleer dat de lijst meegroeit.
24. **Verwacht:** de **Volgende controle** ligt 12 maanden na vandaag.
25. Voeg onder **Machines** een artikel toe (bijv. `Kettingzaag Stihl`,
    producttype **Machine**).
    **Verwacht:** ook zelf af te vinken, ook 12 maanden.
26. Voeg onder **Kleding** een artikel toe (bijv. `Zaagbroek`, type **Kleding**).
    **Verwacht:** kleding wordt **niet** gekeurd en **niet** afgevinkt — er is
    geen afvinkknop en geen volgende-controledatum. Kleding zit in Gearonimo om
    bij te houden wie wat wanneer kreeg.
27. Ga terug naar **Mijn materiaal** en gebruik de tegels.
    **Verwacht:** elk artikel zit in precies één tegel; de teller "{n} met
    aandacht" klopt.
28. Probeer in Instellingen → Materiaalsoorten **Overig** weer uit te zetten.
    **Verwacht:** dat kan niet zolang er materiaal in zit; de hint legt uit dat
    je dat eerst moet afvoeren.

---

## Fase 2 — De keurmeesterkant van dezelfde regel (±10 min)

Dezelfde regel van de andere kant: wat de klant zelf beheert, mag de keurmeester
niet in zijn keuringswizard tegenkomen. Een fout hier zie je in de klant-app
niet.

29. Log weer in op de Pro-app en open ZZ Test 30-08 → blok **Artikelen**.
    **Verwacht:** de EHBO-koffer, de kettingzaag en de zaagbroek staan hier
    **niet** tussen. Alleen klimmateriaal hoort in de keurmeesterlijst.
30. Start een keuring voor deze klant (Keuringen → Nieuwe keuring starten).
    **Verwacht:** de drie zelfbeheerde artikelen worden niet aangeboden.
31. Zoek in de wizard in het serienummerveld naar `EHBO`.
    **Verwacht:** geen treffer.
32. Ga naar SN zoeken / Recall en zoek op `EHBO` en op `zaagbroek`.
    **Verwacht:** geen treffers — ook hier zijn zelfbeheerde artikelen onzichtbaar.
33. **Let hier op iets dat mogelijk misgaat:** voeg ín de keuringswizard een
    nieuw artikel toe waarvan het producttype **Machine** of **Overig** is.
    **Verwacht (onzeker):** een zinnige uitkomst. Wat er precies hoort te
    gebeuren is nog niet vastgesteld — het artikel wordt bij het opslaan
    automatisch zelfbeheerd, terwijl de wizard zelfbeheerde artikelen juist
    wegfiltert. Ziet dit er raar uit (het verdwijnt meteen, of het blijft staan
    maar is later onvindbaar), meld dan precies wat je ziet. Dit is een open
    vraag, geen bekende bug.

---

## Fase 3 — Artikelpagina, koppelen en opmerkingen (±20 min)

34. Voeg bij ZZ Test 30-08 drie klimartikelen toe: één **uit de catalogus**
    (zoek `petzl`, serienummer `TEST-001`), en twee **vrije artikelen** —
    `Distel Alu kort` (`TEST-002`) en `Fallsafe FS242-L-XL` (`TEST-003`).
35. Open `TEST-002`.
    **Verwacht:** blok **Koppel aan catalogusproduct**, met de **Originele
    omschrijving** als vaste referentie en een voorgevuld zoekveld.
36. Bekijk de suggesties.
    **Verwacht:** ondanks dat "kort" in geen enkele catalogusnaam voorkomt, komen
    er Distel Alu-producten naar boven.
37. Typ `petzl seq`, daarna `242`, daarna een zoekterm met één tikfout
    (bijv. `pezl`).
    **Verwacht:** alle drie geven resultaat. Bij `242` komt het FALL SAFE-product
    naar boven op zijn artikelcode, mét die code in de suggestieregel.
38. Kies een product.
    **Verwacht:** het blok heet nu **Gekoppeld catalogusproduct**, met **Ander
    product kiezen** en **Ontkoppelen**.
39. Klik **Ander product kiezen** en kies een ander.
    **Verwacht:** de koppeling wijzigt. (Een misklik was vroeger definitief.)
40. Klik **Ontkoppelen**.
    **Verwacht:** weer een vrij artikel, met merk en omschrijving terug als vrije
    tekst — geen artikel zonder omschrijving.
41. **De fix van 13 augustus.** Typ iets in het **Opmerkingen**-blok en klik
    **zonder op te slaan** meteen op **Volgende →**.
    **Verwacht:** je opmerking is bewaard, niet stilletjes verdwenen. Ga terug en
    controleer dat de tekst er staat.
42. Doe hetzelfde met **Volgend vrij artikel** en met de terugknop.
    **Verwacht:** ook daar blijft de opmerking behouden.
43. Klik **Volgende →** en **← Vorige**.
    **Verwacht:** een teller als "2 / 3", en écht het nieuwe artikel — niet het
    oude met een nieuw nummertje.
44. **⇄ twee tabbladen:** open hetzelfde artikel in een tweede tabblad en klik in
    het eerste door naar een ander artikel.
    **Verwacht:** het tweede tabblad blijft op zijn eigen artikel staan.
45. **⇄ twee tabbladen:** houd ZZ Test 30-08 open in tabblad A. Voeg in tabblad B
    een artikel toe aan diezelfde klant. Ga terug naar A.
    **Verwacht:** het nieuwe artikel staat in de lijst van tabblad A. *(Dit is
    nieuw gebouwd — de blokken verversen zichzelf nu bij terugkeer.)*

---

## Fase 4 — Keuring en certificaat (±15 min)

46. Keuringen → **Nieuwe keuring starten** → ZZ Test 30-08 → **Alles**.
47. Artikel 1 op **Goed**, artikel 2 op **Afgekeurd** met code en opmerking,
    artikel 3 open laten.
    **Verwacht:** de tellers lopen mee ("1 goed · 1 afgekeurd · 1 nog te doen").
48. Zoek in het zoekveld op `003`.
    **Verwacht:** het juiste artikel wordt gevonden.
49. **Afronden →**.
    **Verwacht:** melding dat 1 artikel niet gekeurd is en niet op het
    certificaat komt. Bevestig.
50. Bekijk de voorgestelde volgende keuringsdatum en rond af.
    **Verwacht:** ±12 maanden vooruit, aanpasbaar. Daarna "Certificaat
    gegenereerd en gearchiveerd".
51. Download het certificaat.
    **Verwacht:** PDF met logo, certificaatnummer, de gekeurde artikelen en het
    afgekeurde artikel mét code. Het niet-gekeurde artikel staat er **niet** op.
52. Scan de QR-code (of open de verify-link).
    **Verwacht:** "Echt certificaat" met nummer, klant, datum, keurmeester-naam
    en artikelen. Géén tabbladenstrook op deze pagina.
53. **⇄ twee tabbladen — de kruisproef die het vaakst misging.** Had je ZZ Test
    30-08 in een ander tabblad openstaan? Ga daarheen.
    **Verwacht:** het blok **Certificaten** toont het nieuwe certificaat, en de
    pagina biedt niet nog steeds "Hervat keuring" aan. *(Nieuw gebouwd.)*
54. Keuringen → zoek op het certificaatnummer.
    **Verwacht:** de keuring wordt gevonden.
55. Open een **geïmporteerde** keuring van een echte klant, als je die hebt.
    **Verwacht:** géén "Certificaat gegenereerd", maar "Geïmporteerd uit een oud
    certificaat…". Bij die klant staat terecht "Certificaten (0)".

---

## Fase 5 — Catalogus (±15 min, alleen als curator)

56. Instellingen → **Catalogus** → tab **Catalogus**.
    **Verwacht:** de volledige lijst; het aantal klopt met wat je in fase 0 zag
    (zie `MIGRATIES-UITVOEREN.md`, stap 8) — niet 1000.
57. Zoek op `petzl seq`, een artikelcode (`M33A`) en een categorie.
    **Verwacht:** alle drie geven resultaat.
58. Open een product.
    **Verwacht:** in elk veld een voorbeeld, **Producttype** is een keuzelijst
    (inclusief Kleding), en bij de levensduur staat "999 = onbeperkte
    levensduur. Leeg = nog niet opgezocht."
59. Zoek een product met 999.
    **Verwacht:** geen afkeurdatum en geen levensduurwaarschuwing — nergens een
    jaartal als 3025.
60. **Product toevoegen** → merk `ZZ TEST`, naam `Testkarabiner` → opslaan.
61. Probeer nóg een product met exact hetzelfde merk en dezelfde naam.
    **Verwacht:** een **nette Nederlandse melding** dat dit product er al is, met
    de tip om het bestaande aan te passen of een eigen naam te geven. *Zie je
    hier Engelse databasetaal ("duplicate key value violates..."), dan is dat een
    ❌ — dat is net gerepareerd.*
62. Open `ZZ TEST Testkarabiner` → **Kopiëren naar nieuw product** → andere naam
    → opslaan.
    **Verwacht:** velden overgenomen, product aangemaakt.
63. Verwijder beide ZZ TEST-producten via **Product verwijderen**.
    **Verwacht:** rood bevestigingsblok met "staat nergens in gebruik". Weg.
64. **Exporteren naar Excel**.
    **Verwacht:** alle producten en alle kolommen — niet afgekapt op 1000.
65. **Importeren uit Excel** met het bestand dat je net exporteerde.
    **Verwacht:** de preview meldt dat vrijwel alles al bestond (overgeslagen) en
    0 nieuw. Bevestig → er komt niets dubbel bij.
66. Tab **Wachtrij**: meld vanaf een vrij artikel iets aan voor de catalogus
    (knop **Toevoegen aan productendatabase** op de artikelpagina).
    **Verwacht:** de wachtrij toont je aanmelding **met de velden die je
    invulde** — niet kaal.
67. **⇄ twee tabbladen:** open de wachtrij in twee tabbladen, accepteer een
    aanmelding in tabblad B, ga naar A.
    **Verwacht:** het item is ook in A verdwenen. *(Nieuw gebouwd. Zonder dit zou
    nog een keer accepteren botsen op de nieuwe unieke index.)*
68. Ruim het aangemaakte product op via **Product verwijderen**.
    **Verwacht:** de waarschuwing meldt nu dat het **1 keer gebruikt** wordt en
    dat het artikel blijft bestaan met merk en naam als vrije tekst.

---

## Fase 6 — Offline (±10 min, op de telefoon)

69. **Offline downloads** → download ZZ Test 30-08.
    **Verwacht:** pincode-vraag, daarna "gedownload" met tijdstip.
70. Vliegtuigmodus aan, app openen, naar ZZ Test 30-08.
    **Verwacht:** klant, artikelen, sets en medewerkers zichtbaar na ontgrendelen
    met de pin; geen kale foutmelding.
71. Start een keuring, zet twee artikelen op Goed, rond af.
    **Verwacht:** "Keuring afgerond, offline opgeslagen…" en onderin een syncbalk
    met "nog niet gesynchroniseerd".
72. Vliegtuigmodus uit, wachten (of sync-knop).
    **Verwacht:** de syncbalk loopt leeg en het certificaat staat er echt bij de
    klant.

---

## Fase 7 — Instellingen (±10 min, als laatste)

73. **Afkeurcodes**: voeg een code toe, zet er één op inactief.
    **Verwacht:** de nieuwe komt terug in de keuring, de inactieve niet.
74. **Certificaat-template**: wijzig de voettekst.
    **Verwacht:** het voorbeeld verandert mee.
75. **Keurmeesters**: zet bij je eigen kwalificatie **Zichtbaar bij verificatie**
    aan.
    **Verwacht:** op de verify-pagina uit stap 52 staan nu je kwalificaties met
    "Bekijk bewijs →". Uitzetten haalt ze weg.
76. **Vindbaarheid**: controleer de schakelaar en de locatie.
    **Verwacht:** Safety Green staat op de kaart met Elst.
77. **Bedrijven** (alleen met het platformaccount `info@gearonimo.net`): probeer
    **Wachtwoord instellen** bij een keurmeester.
    **Verwacht:** dit werkt — dat is migratie 20260748 uit fase 0. Test daarna
    met dat wachtwoord inloggen.
78. **Wachtwoord**: wijzig je eigen wachtwoord en log opnieuw in.
    **Verwacht:** inloggen met het nieuwe wachtwoord werkt.
79. Log uit, klik **Wachtwoord vergeten**.
    **Verwacht:** een reset-mail die op de reset-pagina landt (niet in de
    klant-app).

---

## Na de test

- **ZZ Test 30-08 mag blijven staan.** Verwijderen lukt niet meer nu er een
  keuring en certificaat aan hangen — dat is opzet, en je krijgt er een nette
  melding over.
- **Het klant-testaccount** (`+klanttest`) mag ook blijven; het hangt alleen aan
  de testklant.
- **Terugkoppelen:** geef per fase door welke stapnummers ❌ waren en wat je zag.
  Wat ✅ is hoef je niet te melden.

---

## Wat dit plan bewust niet test

- **Meer dan 1000 artikelen bij één klant.** De offline-download haalt artikelen
  en producten nog zonder paginering op (`packages/core/src/offline/download.ts`)
  en kapt daar stil af. Met een testklant van een handvol artikelen kom je er
  niet aan; vertrouw offline nog niet bij een klant met een heel groot bestand.
  Dit staat nog open.
- **Overstap tussen keurbedrijven** — vergt een tweede keurbedrijf.
- **De leadmotor** (zelf aanmelden, keuring aanvragen via de kaart) — die is in
  juli getest en sindsdien niet gewijzigd.
- **Stripe, app stores, Engelse vertaling** — bewust uitgesteld naar fase 5 van
  het bouwplan.
