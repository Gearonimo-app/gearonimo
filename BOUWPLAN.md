# Bouwplan Gearonimo

Hoort bij `BLAUWDRUK.md`, `DATAMODEL.md`, `UX-FLOW.md` en
`ONDERZOEK-CERTIFICAATEISEN.md`. Status: vastgesteld 2026-06-12.

---

## Voortgang (bijgewerkt 2026-07-19)

> **Sessie 2026-07-19 — platform-admin en bedrijvenbeheer (fase 4
> vooruitgetrokken):** Gat gedicht dat platform_admin nergens echte
> rechten had. Nieuwe Instellingen-tegel **Bedrijven** (alleen
> platform-admin): keurbedrijven aanmaken (naam, land uit een volledige
> uitgeschreven landenlijst via Intl.DisplayNames — NL/BE/DE/GB/CA
> bovenaan — plus e-mail/telefoon/adres/postcode/plaats/provincie/KvK/BTW),
> eerste beheerder koppelen op e-mailadres (bestaat er nog geen account,
> dan een **uitnodiging via magic-link**), curator-vinkje per keurmeester
> platform-breed, en **bedrijf verwijderen** (alleen zonder
> keuringen/import-historie; het laatste-beheerder-vangnet kreeg daarvoor
> een transactie-lokaal ontsnappingsluik). Daarnaast **platform-admin
> volledig losgekoppeld van keurmeester-zijn** (besluit Jos: platformbeheer
> en keuren gescheiden — info@gearonimo.net beheert, keuren gebeurt straks
> met een eigen jos@safetygreen-account): router laat een platform-admin
> zonder keurmeester-rij door naar /settings, het hoofdmenu toont dan een
> platformbeheerder-melding, is_catalog_curator() geldt ook voor
> platform-admins en de catalogus-wachtrij kreeg platform-admin-policies.
> Migraties 20260740 t/m 20260745, alle door Jos uitgevoerd. NB: de
> keurmeester-rij van info@gearonimo bij Safety Green blijft staan tot
> daar een andere beheerder is (vangnet); daarna op inactief zetten.
>
> **Besluiten Jos (2026-07-19), raken fase 4:** geen DB-naar-DB-migratie
> van de oude klimkeurpro-data nodig — alles staat dubbel op de zaak (incl.
> PDF's), testklanten krijgen gewoon een uitnodigingscode en beginnen leeg
> (bij de eerstvolgende keuring is hun status weer actueel); wie historie
> wil kan per klant via de bestaande Excel/CSV-import. NAS-back-up wacht op
> het aansluiten van de NAS zelf (hardware, actie Jos). Certificaattaal-
> metadata gefixt (NL/BE = nl, rest = en); het PDF zelf is nog
> Nederlandstalig en het VK-regime (6 mnd) is nog niet actief in de wizard
> — beide expliciet fase 5.

## Voortgang (bijgewerkt 2026-07-18)

> **Sessie 2026-07-18 — grote code review + afronding openstaande punten:**
> Diepe review van beide apps, core en alle migraties: 16 punten gevonden,
> 14 gefixt en live (migraties 20260734 t/m 20260739, alle door Jos
> uitgevoerd). Hoogtepunten: stil dataverlies gedicht (keurresultaat-save,
> vastgelopen sync-mutaties), identiteit gewist bij uitloggen,
> datum-verschuivingen gefixt (Excel-import/next_due/offline), storage per
> keurbedrijf afgeschermd, **certificaatnummers uniek** via server-side
> volgnummer (JJJJMMDD-KLANT, -2, -3 ...), verify + PDF lezen uit de
> bevroren article_snapshot, "vorige keuring"-hint slaat not_assessed over
> en sorteert op keurdatum, maandeinde-randgeval in addMonths, rem op
> invite-codes (10/uur), nette melding bij klant-verwijderen met historie.
> Verder: **certificaatnummers zichtbaar + doorzoekbaar** op de
> keuringen-pagina, klantpagina-blokken inklapbaar met nieuw
> **Certificaten-blok** per klant, **rollen en rechten af** (inspectors.
> is_admin server-side afgedwongen: bedrijfsgegevens/certificaat-opmaak,
> afkeurcodes, keurmeesters beheren en klanten verwijderen alleen voor
> beheerders; vangnet-trigger tegen "laatste beheerder weg"; menu verbergt
> beheerder-secties), en **Zoho-SMTP live** (smtppro.zoho.eu:587,
> app-wachtwoord, afzender info@gearonimo.net — getest). Parallel is in een
> andere sessie passkey/vingerafdruk-login aan de klant-app toegevoegd.
> Nog open uit de review: alleen cosmetisch (env-bestand/.gitignore
> tegenstrijdig, migratienamen 20260732+ zijn geen echte datums).

## Voortgang (2026-07-02)

- **GitHub:** github.com/Gearonimo-app/gearonimo · **Supabase:**
  buitfeiclivzzldfdelp.supabase.co (EU).
- **Fase 1 (skelet):** monorepo (packages/core+ui, apps/inspector+customer),
  i18n nl/en, domeinlogica met tests (status/next_due/regimes),
  e-mail+wachtwoord-login werkend in de inspector-app. ✅ grotendeels af.
- **Fase 2 — in uitvoering:** hoofdmenu werkt; **Klanten-lijst + uitgebreid
  klantformulier af** (zie DATAMODEL `customers`); **klantdetailscherm**
  `/customers/:id` af (bekijken/bewerken/verwijderen); **artikelen per klant**
  met catalogus-zoeken (fuzzy `search_products` + merkfilter, toetsenbord-nav)
  en velden gebruiker/ingebruikname/set/opmerkingen (gebruiker+set voorlopig
  vrije tekst — zie DATAMODEL `articles`); **artikeldetailscherm**
  `/articles/:id` af (bekijken/bewerken/afvoeren, geen harde delete); **echte
  sets af** — samengestelde artikelen (bv. een fliplijn van lijn + lijnklem +
  karabiner) groeperen via `article_sets`/`article_set_members`, los van het
  tijdelijke vrije-tekstveld `set_label` op artikelen zelf. **Medewerkers af**
  — eerste slice van `customer_members` (naam, functie, telefoon, e-mail,
  actief/inactief) op de klantkaart, simpeler dan het einddoel uit DATAMODEL
  (nog geen eigen account/uitnodigingscode per medewerker — zie DATAMODEL
  §`customer_members`). **Keuring-wizard af** (het hart van fase 2, zie
  UX-FLOW §9.3-9.5): Start/Hervat-knop op de klantpagina, en de wizard zelf
  in 4 stappen (artikelen kiezen, per artikel goed-/afkeuren met
  vorige-keuring-context en recall/levensduur-vlaggen, overzicht met
  aanpasbare volgende-keuringsdatum, afronden). Hiervoor is meteen de echte
  multi-tenant basis uit DATAMODEL aangelegd — `inspection_companies`,
  `inspectors` (automatisch aangemaakt per gebruiker, geen apart
  beheerscherm nodig), `customer_links` (automatisch gekoppeld, ook voor
  nieuwe klanten) — ook al is er vandaag nog maar één keurbedrijf; dit
  voorkomt dat dit straks alsnog moet worden rechtgetrokken.
  **Certificaat-PDF af (2026-06-24):** bij het afronden van een keuring
  (stap 4) wordt nu automatisch een PDF gegenereerd — kop/voettekst van het
  keurbedrijf (`inspection_companies.cert_header/footer`, nieuwe velden
  address/postal_code/city/email/phone), per artikel goed/afgekeurd met
  SN, afkeurcode/opmerking en "volgende keuring uiterlijk" + wettelijke
  basis (`packages/core` regimes), en een verificatie-QR. De PDF wordt
  **client-side** gebouwd (`pdf-lib` + `qrcode`, geen edge-function-infra
  nodig — dit verandert niets aan de juridische onveranderlijkheid) en
  éénmalig naar de publieke Storage-bucket `certificates` geüpload; een
  `certificates`-record (`number`, `storage_path`, `pdf_hash`, `verify_token`)
  wordt aangemaakt en `inspections.certificate_number` gezet. Scan van de
  QR (of het delen van de link) opent `/verify/:token`, een publieke pagina
  (geen account nodig) die via de nieuwe `verify_certificate`-RPC
  (security definer, beperkte velden) laat zien dat het certificaat echt is
  — zonder de volledige klant-/keuringdata aan anonieme bezoekers te geven.
  Certificaatnummer-formaat volgt Jos' huidige praktijk
  (`JJJJMMDD-KLANTNAAM`). Migratie: `supabase/migrations/20260624_certificates.sql`.
  **Plandocumenten teruggevonden en verplaatst (2026-06-26):** BLAUWDRUK,
  BOUWPLAN, DATAMODEL, UX-FLOW en ONDERZOEK-CERTIFICAATEISEN stonden op een
  branch van de **klimkeur-pro**-repo (verkeerde repo,
  `claude/klimkeurpro-english-translation-bco5ti`) en waren in geen
  sessie-scratchpad meer terug te vinden. Nu gekopieerd naar de root van de
  **gearonimo**-repo en gecommit naar `main`, zodat ze niet nogmaals
  kwijtraken.
  **Keuringstabel-redesign (2026-06-26):** de invoer/zoekvelden bovenaan de
  keuringswizard zijn vervangen door een eigen inline suggestielijst i.p.v.
  de native `<datalist>` (die altijd over de tabel heen viel). Elk veld
  zoekt nu in zijn eigen, afgebakende bron: Artikel/Merk/Categorie in de
  catalogus (Artikel optioneel genauwd door gekozen Merk/Categorie),
  Serienummer alleen in de artikelen die al op déze keuringslijst staan.
  Pijltjestoetsen (↑/↓) lopen door de suggesties, Enter kiest, Escape
  sluit, de lijst scrollt automatisch mee. Verder toegevoegd aan de
  keuringstabel: een **Gebruiker**-kolom (`assigned_user_name`, vooruitlopend
  op de echte `assigned_member_id`-koppeling uit DATAMODEL §3), een
  **handleiding-link** (catalogus: `products.manual_url`; vrij artikel:
  `articles.free_manual_url`, met een knop om die toe te voegen), en een
  **recall-waarschuwing** (catalogus: automatisch uit `products.recall_url`;
  vrij artikel: handmatige toggle via nieuwe kolommen
  `articles.free_recall_flag`/`free_recall_url`). Migratie:
  `supabase/migrations/20260625_free_recall_manual_url.sql` (uitgevoerd in
  Supabase).
  **Echte bedrijfsgegevens + afkeurcodes ingevuld (2026-06-25):** Jos heeft
  de echte naam/adres/kop-/voettekst van Safety Green B.V. en de 8
  afkeurcodes uit de huidige praktijk aangeleverd (1 slijtage/opgebruikt,
  2 mechanisch beschadigd, 3 brand- of smeltplekken, 4 roest, 5 leeftijd of
  label, 6 defecte sluiting, 7 modificatie, 8 anders/zie opmerkingen) — zie
  `supabase/migrations/20260625_company_details_and_rejection_codes.sql`,
  uitgevoerd in Supabase. Afkeurcodes zijn nog **niet** door de gebruiker
  zelf te beheren (geen instellingenscherm); dat staat nog open.
  **Gemerged naar `main` en live (2026-06-25):** de feature-branch is
  fast-forward gemerged naar `main` en gepusht; gearonimo.net (GitHub
  Pages, auto-deploy bij push naar `main`) draait nu met de
  certificaat-functionaliteit. **We staan op het punt van de eerste echte
  test**: Jos gaat een volledige keuring afronden op
  https://gearonimo.net en controleren of het certificaat klopt
  (PDF-inhoud, QR-link naar `/verify/:token`, downloadlink). Resultaat van
  die test nog niet teruggekoppeld — vervolgsessie begint hiermee.
  Bewust nog buiten scope: foto's bij afkeuring. (Het instellingenscherm voor
  afkeurcodes is inmiddels wél gebouwd — zie de Instellingen-tegel hieronder.)
  **SN-zoeken / Recall-tegel af (2026-06-26):** de dode link op het
  hoofdmenu (`/serial-search`) is nu een echte pagina
  (`apps/inspector/src/pages/SerialSearch.vue`) met **twee modi** (schakelaar
  bovenaan), gelijk aan de oude KlimKeur Pro-functie `js/snref.js`:
  - **Serienummer zoeken** — op (een deel van) het serienummer, Jos' primaire
    zoekgedrag op de laatste cijfers (UX-FLOW §4.2), aangevuld met
    merk/omschrijving/categorie (vrije artikelen) en de fuzzy
    `search_products`-cataloguszoeker; resultaten linken naar `/articles/:id`.
    Per treffer: klantnaam, SN en de recall-/keuringsmelding-vlaggen +
    handleiding-link (catalogus: `products.recall_url`/`inspection_notice_url`/
    `manual_url`; vrij artikel: `free_recall_flag`/`free_recall_url`/
    `free_manual_url`) — systeem signaleert, keurmeester beslist (UX-FLOW §1.6).
  - **Recall zoeken** — de terugroepactie-zoeker uit de oude app: vind álle
    artikelen in het klantenbestand die onder een recall vallen, op merk +
    product + fabricagedatum-bereik (vóór jaar/maand én vanaf jaar/maand —
    symmetrisch, dus een echt van–tot-bereik), bv. "Petzl Astro vóór oktober
    2023". Product-match is bevat-match over naam + categorie, zodat "astro"
    ook Astro Int / Astro Bod Fast / Astro mt 2 vindt. Resultatentabel
    (product, merk, SN, fabricage, gebruiker, klant) met **CSV-export** en
    doorklik naar `/articles/:id`. Alle bouwjaar/maand-filtering gebeurt
    client-side (niet server-side) — anders zou Postgres' `lte/gte` de
    artikelen zónder bouwjaar al wegfilteren. Die mogen we bij een recall niet
    stil weglaten: ze worden **getoond en gemarkeerd** ("bouwjaar onbekend —
    zelf controleren", bovenaan gesorteerd, met telling), zodat de keurmeester
    beslist (UX-FLOW §1.6). Merk/product-match is sowieso client-side (merk/naam
    komt zowel uit `products` als uit `free_*`, niet in één query te filteren).
  Geen migratie nodig (alleen leesquery's op bestaande kolommen). De zoekbalk
  bovenaan het hoofdmenu wees naar een niet-bestaande `/search` en stuurt nu
  door naar deze pagina (serienummer-modus). Nog geen multi-tenant scope op
  actieve `customer_links` — bewust gelijk aan de rest van de app zolang RLS
  uit staat en er één keurbedrijf is. Bewust niet (nog) overgenomen uit de
  oude app: de keuringstatus-kolom in de recall-tabel (status is in Gearonimo
  berekend i.p.v. opgeslagen) en de klikbare sorteerkoppen.
  **Live getest en akkoord (2026-06-26):** Jos heeft beide modi op
  gearonimo.net getest — serienummer-zoeken werkt, en recall-zoeken werkt
  zowel mét fabricagedatum-bereik (artikelen in/buiten bereik) als zonder
  (artikelen zonder bouwjaar netjes getoond + gemarkeerd). Tegel is af; de
  feature-branch is naar `main` gemerged (live).
  Nog te bouwen: UI-opmaak/styling-pas, plus de **Instellingen-tegel** (de
  laatste grote tegel — zie UX-FLOW §7.5/§9.1) en kleinere afwerking
  (keuringen-overzicht is een eerste opzet).
  **Instellingen-tegel gestart — onderdeel 1: afkeurcodes-beheer
  (2026-06-25):** de laatste dode link op het hoofdmenu (`/settings`) is nu
  een echte pagina (`apps/inspector/src/pages/Settings.vue`), opgezet als hub
  met meerdere onderdelen (UX-FLOW §7.5/§9.1). Eerste onderdeel af:
  **Afkeurcodes beheren** (`components/RejectionCodes.vue`) — toevoegen,
  wijzigen en aan-/uitzetten (inline toggle) van de codes uit
  `rejection_codes`; voedt rechtstreeks de afkeur-keuze in de keuring-wizard
  (`fetchRejectionCodes` in `useInspections.ts`).
  **Afkeurcodes zijn per keurbedrijf instelbaar (besluit Jos 2026-06-25):**
  elk keurbedrijf beheert zijn eigen, losse set (`company_id` = bedrijf);
  wijzigingen van het ene bedrijf raken een ander bedrijf nooit. De 8
  platformstandaard-codes (`company_id` leeg) blijven alleen als
  sjabloon/fallback: een bedrijf zonder eigen codes valt daarop terug, en bij
  de eerste opening van het instellingenscherm wordt automatisch een eigen
  kopie geseed. Bestaande keurbedrijven worden door de migratie
  `supabase/migrations/20260627_rejection_codes_per_company.sql` (idempotent)
  van een eigen kopie voorzien. In de UI is er daardoor geen platform/eigen-
  onderscheid meer: alle getoonde codes zijn van het bedrijf zelf, vrij te
  bewerken/verwijderen. (Dit corrigeert de eerste opzet, waarin de gedeelde
  platformcodes ter plekke werden bewerkt — fout, want dat zou alle bedrijven
  tegelijk raken.) De twee overige onderdelen (certificaat-kop/voettekst,
  keurmeesters + kwalificaties) staan als "Binnenkort" in de hub en zijn de
  volgende deelstappen. **Let op voor onderdeel 2 (Jos 2026-06-25):** de
  certificaat-kop/voettekst-standaard wordt óók **per keurbedrijf** instelbaar,
  *niet* "per land/regime" zoals UX-FLOW §7.5 nu nog schrijft — dat punt is
  hiermee overruled. i18n nl+en toegevoegd onder `settings`.
  **Instellingen onderdeel 2: certificaat-template + opmaak-wizard
  (2026-06-25):** de certificaat-PDF is herbouwd tot een echte layout-engine
  (`useCertificate.ts`), met een opmaak-wizard onder Instellingen →
  Certificaat-template (`components/CertificateSettings.vue`). Per keurbedrijf
  instelbaar (besluit Jos: per keurbedrijf, niet per land): bedrijfsgegevens
  (naam/adres/contact), kop-/voettekst (met knop "standaardtekst invoegen" —
  één generieke juridische tekst, géén per-land-bibliotheek), **logo-upload**
  (Storage-bucket `branding`) met **grootte-slider, uitlijning en
  links/rechts-nudge**, plaats van de bedrijfsgegevens, accentkleur, en
  **afdrukstand** (staand/liggend/automatisch). Alles met **live PDF-preview**
  die meebeweegt (client-side gerenderd met dezelfde generator + fictieve
  voorbeelddata). De generator zelf: echte tabel met automatisch passende
  kolombreedtes + tekstafbreking, automatische oriëntatie (liggend zodra de
  tabel te breed wordt), herhaalde kolomkop per pagina, **handtekening/QR/
  voetblok dat bij elkaar onderaan blijft** (lost de "wees-handtekening op
  pagina 2" op), en paginanummers ("Pagina X van N"). De opmaak is een sjabloon
  voor **nieuwe** certificaten; al uitgegeven PDF's blijven onveranderd. Nieuwe
  velden `inspection_companies.logo_path` + `cert_layout` (jsonb) en de
  publieke `branding`-bucket: migratie
  `supabase/migrations/20260628_certificate_branding.sql`. Headless getest
  (staand/liggend/meerdere pagina's gerenderd en visueel gecontroleerd);
  live-test door Jos volgt. i18n nl+en onder `settings.certificate`.
  **Instellingen onderdeel 3: keurmeesters + kwalificaties (2026-06-26):** de
  laatste "Binnenkort" in de hub is af — Instellingen → Keurmeesters
  (`components/InspectorsSettings.vue`). Lijst van keurmeesters van het bedrijf
  (badges admin/geen-account/inactief), toevoegen/bewerken (naam, beheerder,
  actief), en per keurmeester een **kwalificatielijst** (naam, nummer, geldig-
  tot met verlopen/verloopt-binnenkort-markering) met **upload én bekijken van
  kwalificatiebewijzen** (PDF/foto). Schemawijziging
  `20260629_inspector_qualifications.sql`: `inspectors.user_id` nullable
  gemaakt (een admin kan een keurmeester + certificaten vastleggen vóór die
  zelf inlogt; account-koppeling later), `is_admin` toegevoegd, de
  `inspector_qualifications`-tabel aangelegd, en een **private** Storage-bucket
  `qualifications` (gevoelige documenten — niet publiek zoals logo/certificaat;
  toegang via signed URLs). Harde delete van een keurmeester alleen voor
  account-loze records; anders op inactief. Hiermee zijn alle drie de
  onderdelen van de Instellingen-tegel af. Bewust nog buiten scope:
  account-invite/koppeling voor keurmeesters, en kwalificaties tonen aan
  klanten / op het certificaat. i18n nl+en onder `settings.inspectors`.
  **Certificaat-kop verfijnd + extra velden (2026-06-26, na live-test Jos):**
  bedrijfs- én certificaatgegevens staan nu als twee kolommen bovenaan en
  flankeren een gecentreerd logo (i.p.v. eronder). Extra sliders: logo
  verticaal (`logoOffsetY`) en gegevens verticaal (`headerOffsetY`). Nieuwe
  optionele bedrijfsvelden `province`/`registration_number`/`vat_number`
  (migratie `20260630_company_address_extra.sql`), alleen getoond als ingevuld
  (provincie bv. voor Canada). Gearonimo-merk op het certificaat: een groen
  "g"-monogram in het midden van de verificatie-QR (QR nu op error-correctie
  `H` zodat dat de scanbaarheid niet breekt) + "geverifieerd met gearonimo".
  Een echt Gearonimo-logo-bestand kan later het monogram vervangen.
  **Echt Gearonimo-logo + branded QR (2026-06-26):** Jos leverde het
  Gearonimo-merk (karabijnhaak die een G vormt met een vinkje); het zit nu in
  het midden van de verificatie-QR (branded QR, error-correctie H, scanbaarheid
  geverifieerd met een echte decoder). QR-grootte gelijkgetrokken met de groene
  "geverifieerd"-regel eronder, en bij bedrijf-links wordt het certificaatblok
  netjes rechts uitgelijnd. Logo inline als base64 (`composables/gearonimoMark.ts`).
  **Certificaat: configureerbare kolommen (2026-06-26):** de tabel is opgebouwd
  uit losse kolommen; vast = Status/Merk/Artikel/Bouwjaar/Serienummer, optioneel
  (aan/uit in de wizard) = Categorie/Norm/MBS/Gebruiker/Volgende keuring/
  Afkeurcode-opmerking (zo kan "norm i.p.v. categorie" of "MBS erbij"). Een kolom
  verschijnt alleen als hij aan staat én er data voor is. `cert_layout.columns`
  (jsonb, geen migratie). Norm = `products.standard`, MBS =
  `products.breaking_strength`.
  **Keuring-flow-polish na live-test (2026-06-26):** recall-vlag bij vrij
  artikel niet langer dubbel (alleen-lezen vlag enkel voor catalogus, vrije
  artikelen alleen de toggle); **Tab = Enter** bij materiaal-invoer (bevestig
  suggestie + naar volgend veld); **wachtlijst-vinkje "naar catalogus"** nu ook
  in de keuring-wizard bij een vrij artikel; **home-knop (🏠)** in de kopbalk
  van keuring-wizard, klant-, artikel- en setdetail.
  **Norm/MBS bij vrije artikelen (2026-06-26):** als een keurbedrijf de Norm-/
  MBS-kolom heeft aangezet, verschijnen die invoervelden nu ook bij vrije
  invoer (keuring-wizard + klantartikelformulier); opgeslagen in
  `articles.free_norm`/`free_mbs` (migratie `20260701_articles_free_norm_mbs.sql`),
  certificaat valt voor vrije artikelen op die velden terug. Zichtbaarheid via
  `fetchFreeInputFields` (leest `cert_layout.columns`).

  ### Volgende grote stap — Excel/CSV-import (onboarding-motor) {#next-excel-import}
  **Besloten met Jos 2026-06-26.** De catalogus bevat al veel echte producten;
  wat nog ontbreekt (en wat KlimKeur Pro wél had) is **import van bestaande
  Excel-certificaten/keuringen** zodat een keurbedrijf met historie kan
  overstappen zonder vanaf nul te beginnen. Dit is de algemene onboarding-tool
  voor **nieuwe keurbedrijven** (BLAUWDRUK §9), los van de directe
  DB-naar-DB-migratie van Safety Green's eigen oude Supabase (DATAMODEL §8).
  **Kernprobleem:** elk keurbedrijf heeft een andere kolomindeling/taal/
  datumnotatie. **Aanpak (de "truc"): een begeleide mapping-wizard in 3 lagen:**
  1. **Auto-herkenning** — lees de kopregel en match kolommen tegen
     Gearonimo-velden via een meertalig synoniemen-woordenboek + fuzzy matching
     (merk/brand/fabrikant→brand, serienr/SN/serial→serial_number,
     keurdatum/datum→inspection_date, goed-afgekeurd/OK-NOK→result, …).
  2. **Controle + live preview** — per kolom een dropdown (auto-gok
     voor-ingevuld), voorvertoning van de eerste ~10 rijen, en een
     droogloop-validatie (ontbrekende verplichte velden, onleesbare datums,
     dubbele serienummers) vóór commit.
  3. **Opgeslagen import-profiel per bedrijf** (`import_profiles`: company_id +
     mapping + bestandshandtekening) zodat een volgende import met dezelfde
     lay-out één klik is. Dít maakt "elk bedrijf andere kolommen" schaalbaar.

  **Ontwerpkeuzes voor de bouwsessie:**
  - **Granulariteit detecteren/vragen:** één bestand = één keuring (kop +
    artikelrijen) vs. platte lijst van meerdere keuringen.
  - **Historische certificaten = juridisch anker:** her-render een oude keuring
    NIET als nieuw PDF (bestond toen niet); bewaar het **originele bestand**
    (PDF/Excel) in Storage als bewijs en vul de **data** in het systeem,
    gemarkeerd `source='import'`/historisch (voor historie +
    volgende-keuringberekening).
  - **Dedup/idempotentie:** ontdubbelen op (klant + serienummer); keuze
    overslaan/bijwerken/toch toevoegen.
  - **Techniek:** client-side parsen met SheetJS (`xlsx`); `.xlsx` + `.csv`;
    gevoelige data pas na mapping naar de DB.
  - **Nieuwe tabellen (concept):** `import_profiles`, `import_batches`
    (originele bestand-ref + telling), markering `source` op
    articles/inspections.
  > Status: ontworpen, nog te bouwen. Begin een nieuwe chat hiermee (zie de
  > prompt die Jos bewaart). Catalogus-import van Safety Green-producten is
  > minder urgent geworden (catalogus al goed gevuld).

  **Aanpassing met Jos (2026-06-26): geen fuzzy matching.** Jos' bezwaar:
  elk keurbedrijf doet dit maar één keer, en kolomkoppen beginnen niet altijd
  bovenaan (bij Safety Green bv. pas rij 14; een andere keurmeester gebruikt
  een tabel in Word/Excel met eigen lay-out). Een synoniemenwoordenboek +
  fuzzy-matchlogica is dan overbodige complexiteit. **Nieuwe aanpak: de
  gebruiker wijst zelf de koprij en kolommen aan.** Laag 1 (auto-herkenning)
  is hierdoor vervallen; laag 2 is uitgebreid met een koprij-picker:
  1. **Koprij aanwijzen** — de gebruiker klikt in een rauwe voorvertoning
     (eerste ~25 rijen) op de rij met de kolomkoppen; lost het "rij 14"-
     probleem op zonder enige detectie. Startwaarde: de rij met de meeste
     niet-lege cellen in de eerste 30 rijen (`guessHeaderRow`), puur een
     snelkoppeling, niet bindend.
  2. **Kolommen koppelen** — per kolom een dropdown met Gearonimo-velden,
     voor-ingevuld via een lichte substring-hint (`guessMapping`, géén
     fuzzy/typo-matching) als die kolomkop een duidelijke aanwijzing geeft
     (bv. "serienr" → serienummer); de gebruiker corrigeert altijd zelf.
     Live voorvertoning van de eerste 3 waarden per kolom tijdens het kiezen.
  3. **Droogloop-validatie + preview** — vóór commit: ontbrekende verplichte
     velden, lege verplichte cellen per rij, dubbele serienummers binnen het
     bestand, onleesbare datums; voorvertoning van de eerste 10 gemapte rijen.
  4. **Opgeslagen import-profiel per bedrijf** blijft het einddoel (nog te
     bouwen) zodat een volgende import met dezelfde lay-out één klik is.

  **Geïmplementeerd (2026-06-26), volledige eerste versie incl. commit:**
  nieuwe Instellingen-tegel "Excel/CSV-import"
  (`apps/inspector/src/components/ImportWizard.vue`, `useImportMapping.ts`,
  `useImportCommit.ts`) in 5 stappen: (1) bestand kiezen (`.xlsx`/`.xls`/`.csv`
  via SheetJS/`xlsx`, client-side, tabblad-keuze bij meerdere sheets) — herkent
  hier al een eerder opgeslagen profiel op kolomkop-handtekening en vult
  koprij+mapping automatisch in; (2) koprij aanklikken in de rauwe
  voorvertoning; (3) per kolom een dropdown (Klant/Artikel/Keuring-groepen)
  met substring-hint-prefill + voorbeeldwaarden; (4) droogloop-validatie +
  preview van de eerste 10 rijen, met keuzes "dubbel serienummer overslaan"
  en "dit profiel onthouden"; (5) **importeren** — schrijft per rij een
  klant (find-or-create op naam, case-insensitive), artikel (dedup op
  klant+serienummer, `source='import'`) en keuring (rijen met dezelfde
  klant+datum komen in dezelfde `inspections`-rij, zoals een echte keurdag;
  status meteen `completed`, `source='import'`) plus `inspection_items`.
  **Geen nieuw certificaat-PDF** voor historische keuringen — in plaats
  daarvan gaat het originele bestand ongewijzigd naar de nieuwe private
  Storage-bucket `imports` als juridisch anker, gekoppeld via een
  `import_batches`-rij (`inspections.import_batch_id`). Bij "dit profiel
  onthouden" wordt de koprij+mapping opgeslagen in `import_profiles`
  (uniek per bedrijf + kolomkop-handtekening, upsert) zodat een volgende
  import met dezelfde lay-out automatisch wordt herkend. Nieuwe migratie:
  `supabase/migrations/20260702_import_tables.sql` (`import_batches`,
  `import_profiles`, `source`-kolom op articles/inspections, bucket
  `imports`) — **nog door Jos uit te voeren in Supabase**. RLS uit, grant
  `authenticated`, zelfde patroon als de rest. Niet gebouwd: "update"-keuze
  bij een dubbel serienummer (nu alleen skip/toch-toevoegen), en koppeling
  aan afkeurcodes uit `rejection_codes` (afkeurtekst blijft vrije tekst in
  `comment`).

  **RLS-advies aan Jos (2026-06-26):** RLS blijft bewust UIT tijdens de bouw
  (er is nog maar één keurbedrijf, dus geen risico op data-inzage door
  derden). Het aanzetten gebeurt als één aparte, geteste beveiligingsronde
  vlak vóór er andere keurbedrijven/echte klanten bijkomen (zie fase 4 + de
  RLS-let-op onderaan deze sectie). Niet er tussendoor.

  ### Na het laatste bouwplan-bijwerken — polish + eerste live-test (26–27 juni)
  > Administratieve inhaalslag: de hieronder beschreven ~21 commits stonden nog
  > niet in dit bouwplan ("we hielden niet netjes bij waar we waren"). Niets is
  > losgeraakt — de branch staat gelijk met `main` (alles live). Op volgorde:

  **Excel/CSV-import afgemaakt + gepolijst (2026-06-26):** bovenop de eerste
  versie zijn de praktijkgevallen van Jos' eigen bestanden opgelost: **vaste
  klantnaam** voor bestanden zonder klantkolom, **vaste keuringsdatum** voor
  bestanden zonder datumkolom, **keuringsdatum optioneel** gemaakt, en
  **Categorie + Materiaal** toegevoegd aan de kolommapping. Een import **zonder
  keuringsdatum** maakt nu een **open concept-keuring** aan i.p.v. een afgeronde
  — de keurmeester kiest bij Starten zelf welke artikelen mee gaan. RLS
  expliciet uit op `import_batches`/`import_profiles`.
  **Keuring-flow herstructurering (2026-06-27):** keuringen-navigatie en
  klant-aanmaak-flow herzien; artikelen toevoegen op de **klantpagina** gebruikt
  nu dezelfde typeahead-flow als de keuring-wizard; de per-artikel
  checkbox-dialoog bij hervatten is vervangen door een simpele **"alles / alleen
  nieuw"**-keuze; bij het **hervatten van een open concept-keuring** kun je
  alsnog extra klant-artikelen bijpakken; **match-to-catalogus** voor een vrij
  (import-)artikel handmatig vanuit de wizard. Verder: verwijderde/afgevoerde
  artikelen blijven niet in beeld, recall-vlag weg bij vrije artikelen, en het
  certificaat sluit niet-beoordeelde artikelen uit; geen ❌ meer voor een
  niet-beoordeelde vórige keuring.
  **Eerste live-test van het certificaat — bug gevonden en gefixt
  (2026-06-27):** bij **"Afronden"** faalde de upload van de certificaat-PDF met
  *"new row violates row-level security policy"* (403 op de `certificates`
  Storage-bucket). Oorzaak: op de live database stonden naast de migratie-policies
  nog oude/handmatig via het dashboard aangemaakte policies op `storage.objects`
  die de upload blokkeerden. Opgelost door **álle** policies op `storage.objects`
  te resetten naar een schone, toestemmende bouwfase-set (ingelogde keurders
  mogen alles; publieke buckets `certificates`/`branding` ook anoniem leesbaar;
  privébuckets `imports`/`qualifications` alleen ingelogd). Idem voor het
  toevoegen van een **artikel** (`articles` had via de dashboard-UI per ongeluk
  weer RLS aan): generieke RLS-uit-sweep herhaald. Certificaat-opmaak na de test
  bijgesteld: **vinkje/kruisje** i.p.v. tekst, kolomvolgorde, serienummer op één
  regel, en **Bouwjaar** als uitschakelbare kolom. Levensduur-waarschuwing nu
  alleen naast het bouwjaar.
  **Code-review-opschoning (2026-06-27):** gedeelde logica naar de packages
  getrokken — `useAuth` naar `packages/core`, `useFieldSuggest` naar
  `packages/ui`, plus `errors.ts` (gecentraliseerde `errorMessage`), per-package
  `tsconfig.json` en een `tsconfig.base.json`. Robuustere certificaatflow en
  betere types.

  **⚠️ Migraties die in Supabase uitgevoerd moeten zijn (controleren!):** sinds
  de vorige bouwplan-stand zijn deze migraties bijgekomen. Ze zijn allemaal
  **idempotent** (veilig om opnieuw te draaien), dus bij twijfel gewoon (nog
  eens) uitvoeren in de SQL-editor:
  `20260627_disable_rls_articles`, `20260627_rejection_codes_per_company`,
  `20260628_certificate_branding`, `20260629_inspector_qualifications`,
  `20260630_company_address_extra`, `20260701_articles_free_norm_mbs`,
  `20260702_import_tables`, `20260703_certificates_storage_update_policy`,
  `20260703_reset_storage_policies`. Zonder de laatste twee faalt "Afronden"
  (certificaat-upload) live nog steeds; zonder `20260702` werkt de import niet.

  **Catalogus-wachtlijst-vinkje verplaatst (2026-06-27):** het vinkje "aanbieden
  voor de productendatabase" bij een vrij artikel stond in de keuring-wizard bij
  de invoervelden (vóór toevoegen). Het staat nu **per rij, rechts in de
  keuringstabel** (📚-icoon in de actiekolom, naast de prullenbak), zodat de
  keurmeester het artikel eerst toevoegt en pas daarna rustig markeert; opgeslagen
  per artikel op `articles.suggest_for_catalog` (geen migratie). Hetzelfde geldt
  nu voor het **klant-artikelformulier** (`CustomerArticles.vue`): het vinkje is
  daar weg bij de invoervelden en zit als 📚-toggle per rij in de artikellijst
  (alleen bij vrije artikelen). De échte
  goedkeurings-/curatorflow voor de wachtlijst (catalogus-wachtrij + god-rol)
  bouwen we bewust niet nu: die hoort in **fase 4** (besluit Jos 2026-06-27 —
  "volg het bouwplan"). Het vinkje verzamelt tot dan alleen de markeringen.

  **Handtekening keurmeester op het certificaat (2026-06-27):** elke keurmeester
  kan in **Instellingen → Keurmeesters** een handtekening uploaden (PNG/JPG, met
  preview, vervangen en verwijderen). Bij het afronden van een keuring wordt die
  handtekening in het certificaat-PDF ingebed, **boven de bestaande
  handtekeninglijn** (proportioneel geschaald; geen handtekening = lege lijn om
  met de hand te tekenen, zoals voorheen). Opgeslagen als `inspectors.signature_path`
  (migratie `supabase/migrations/20260704_inspector_signature.sql` — **nog door
  Jos in Supabase uit te voeren**, idempotent) met het bestand in de bestaande
  publieke `branding`-bucket (de handtekening komt sowieso op het publieke
  certificaat). De bedrijfsbrede certificaat-preview onder Instellingen toont de
  handtekening niet (die is per keurmeester, niet per bedrijf).

  > Detailvelden staan in **DATAMODEL.md**, niet in dit bouwplan: het bouwplan
  > is de fasering, het datamodel is de veldenbron.

  ### Offline-first (2026-06-30, op een feature-branch, nog niet naar `main`) {#offline-first}
  > Gestart op verzoek van Jos, met vooraf een gesprek over privacy/diefstal-
  > risico van lokaal opgeslagen klant-/bibliotheekdata (zie ontwerpkeuzes
  > hieronder). Branch: `claude/gearonimo-offline-first-phase2-2w9xpo`.

  **Ontwerpkeuzes (akkoord Jos 2026-06-30), afwijkend/aanvullend op
  BLAUWDRUK §8.1:**
  - **"Download per klant" i.p.v. automatisch alles syncen.** De keurmeester
    kiest expliciet welke klanten offline beschikbaar zijn (Netflix-
    downloads-model), met een snelkeuze "Vandaag" (klanten met een open
    concept-keuring) en "Deze week" (klanten met een keuringsitem dat binnen
    14 dagen vervalt — bewust een ruwe suggestie, geen vervanging van de
    next_due-berekening). Een download bevat alleen die klant, zijn
    artikelen en de catalogusproducten die daarbij horen — niet de hele
    klanten-/productendatabase (dataminimalisatie/AVG + beperkt het
    "bibliotheek gestolen"-risico bij verlies van een toestel).
  - **Lokale versleuteling: AES-256-GCM (Web Crypto API) + lokale PIN.** De
    sleutel wordt met PBKDF2 afgeleid van een PIN die de keurmeester zelf
    instelt (los van zijn inlogwachtwoord) en nooit opgeslagen — alleen een
    salt + check-waarde staan onversleuteld lokaal om een foute PIN te
    herkennen. Bewuste, met Jos gedeelde beperking: wie zowel het toestel als
    de PIN heeft, kan bij de data (zoals bij elke offline-app). PIN-reset kan
    alleen online (forceert een Supabase Auth-roundtrip) en wist alle lokale
    offline-data onherroepelijk (oude sleutel is weg) — expliciet een laatste
    redmiddel, geen "wachtwoord vergeten"-gemaksknop.
  - **Forensisch watermerk i.p.v. cryptografisch onvervalsbaar HMAC.** Geen
    edge-function-infrastructuur beschikbaar (zelfde pragmatische keuze als
    de client-side certificaat-PDF), dus geen geheime server-sleutel om een
    HMAC mee te ondertekenen. In plaats daarvan: elke download zet een rij
    in een nieuwe server-side logtabel `offline_downloads` (keurbedrijf,
    keurmeester, klant, tijdstip) — niet door de keurmeester zelf te
    vervalsen, en blijft bestaan ook als de lokale kopie verwijderd/gelekt
    is. Geen kopieerbeveiliging, wel een audit-spoor.
  - **Opruimen losgekoppeld van uploaden.** Uploaden van mutaties blijft
    altijd eager zodra er verbinding is (werkt prima met schommelend wifi).
    Een download wordt pas automatisch verwijderd als er geen openstaande
    mutaties meer zijn én een tijdje geen activiteit was — een korte
    wifi-flits trekt dus niet meteen de download weg terwijl de keurmeester
    nog met die klant bezig is. Nooit automatisch verwijderen van
    niet-gesynchroniseerde data; na 14 dagen alleen een waarschuwing +
    handmatige verwijderknop (slice 4).
  - **Nieuw product tijdens een offline keuring:** geen brede catalogus-
    download nodig — valt terug op het bestaande "vrij artikel"-mechanisme
    (`free_*`-velden), zoals nu al voor onbekende producten gebeurt.

  **Slice 1 — PWA + offline app-shell (af, 2026-06-30):** `vite-plugin-pwa`
  toegevoegd aan `apps/inspector`; service worker precachet de hele
  app-shell zodat de app ook zonder netwerk opent, met navigatie-fallback
  naar `index.html` voor elke route (zelfde idee als de bestaande
  404→index.html-truc van GitHub Pages, nu voor de service worker). Eerste
  manifest-icoon hergebruikt het bestaande Gearonimo-merk
  (`composables/gearonimoMark.ts`). Geverifieerd met een headless
  Playwright-run (production build + `vite preview`, browsercontext echt
  offline gezet): app-shell laadt en navigeert offline.

  **Slice 2 — Download-per-klant + versleutelde cache + watermerk (af,
  2026-06-30):** nieuwe offline-laag in `packages/core/src/offline/`
  (`db.ts` met `idb`, `crypto.ts`, `pinSession.ts`, `cache.ts`,
  `download.ts`) + nieuwe app-laag `apps/inspector/src/composables/useOffline.ts`
  en pagina `pages/OfflineDownloads.vue` (tegel "Offline downloads" op het
  hoofdmenu, route `/offline`) met PIN-dialoog
  (`components/OfflinePinDialog.vue`). Migratie
  `supabase/migrations/20260705_offline_downloads.sql` (**nog door Jos in
  Supabase uit te voeren**) voor het watermerk-logboek. Unit-tests voor de
  crypto-laag (round-trip, foute PIN, unieke IV per versleuteling) en de
  cache-laag (versleuteld-op-schijf-check, per-klant isolatie, product-
  opruiming) — `packages/core` test-suite groen. i18n nl/en onder `offline.*`.
  Lezen-uit-cache-koppeling in de bestaande klant-/keuringsschermen en de
  mutatiewachtrij/sync-engine volgen in slices 3-4.

  **Slice 3 — Offline schrijven via mutatiewachtrij (af, 2026-06-30):**
  mutatiewachtrij (`packages/core/src/offline/mutationQueue.ts`) en een
  lokale keuringscache (`inspectionCache.ts`) toegevoegd, plus twee nieuwe
  IndexedDB-stores (`inspections`, `inspectionItems`). Conflictstrategie
  zoals besloten: insert-mutaties zijn losse wachtrij-rijen, herhaalde
  update-mutaties op hetzelfde record (zelfde tabel + id) worden
  samengevoegd tot één openstaande mutatie i.p.v. een mutatie per
  toetsaanslag (last-write-wins, in volgorde af te spelen door de
  sync-engine van slice 4).

  `apps/inspector/src/composables/useInspections.ts` is omgebouwd tot een
  online/offline-dispatcher: elke functie (`ensureInspector`,
  `fetchArticleScope`, `startInspectionWithArticles`, `findDraftInspection`,
  `addArticlesToInspection`, `findPreviousResult`, `fetchRejectionCodes`,
  `fetchFreeInputFields`) controleert de verbindingsstatus en valt offline
  terug op de lokale cache/wachtrij — de online-tak is **ongewijzigd**
  overgenomen uit de bestaande, werkende code. Hierdoor hoefden
  `CustomerDetail.vue` en `InspectionNew.vue` (Start/Hervat-knop) niet
  aangepast te worden: zij roepen dezelfde functies aan als voorheen.
  Keuring-id's en item-id's worden offline client-side gegenereerd
  (`crypto.randomUUID()`) i.p.v. door de server; de certificaatnummering
  (`JJJJMMDD-KLANTNAAM`, geen volgnummer) loopt hier niet doorheen en heeft
  dus geen botsingsrisico.

  In `InspectionWizard.vue` (het daadwerkelijke invullen) is een aparte
  `loadOffline()`-tak toegevoegd naast de bestaande `load()` — bewust een
  los pad i.p.v. de bestaande, beproefde online-query's te doorspekken met
  if/else, zodat de online-code onaangeroerd blijft. Dekt het kernscenario
  (een al gedownloade keuring offline hervatten/invullen: resultaat,
  afkeurcode, opmerking, volgende-keuringsdatum); `saveRow()` schrijft
  offline naar de lokale cache + wachtrij i.p.v. rechtstreeks naar Supabase.
  **Bewust nog niet offline meegenomen** (blijven online-only, falen
  netjes met een netwerkfout i.p.v. de app te laten crashen): een nieuw vrij
  artikel toevoegen tijdens de keuring, artikelgegevens corrigeren
  (`saveArticle`), een artikel afvoeren/verwijderen (`retireArticle`), de
  handleiding-link bewerken, en afronden/certificaat genereren (`finish()` —
  hoort bij slice 5, certificaatupload kan sowieso niet zonder netwerk).
  Reden voor deze afbakening: `InspectionWizard.vue` is een groot,
  intensief stuk UI (zoek-suggesties, SN-zoeken, catalogus-matching) dat
  niet live tegen een echte Supabase-sessie te testen was in deze sessie;
  de kernhandeling (resultaten invullen) is voorzichtig en additief
  toegevoegd, de rest blijft ongemoeid tot een volgende sessie met
  Jos' akkoord/test hierop verder bouwt.

  Nieuwe unit-tests: mutatiewachtrij (coalescing van herhaalde updates,
  geen samenvoeging na het starten van sync, telling per klant) en
  keuringscache (round-trip, draft-opzoeken, patch-merge, lokale
  "vorige keuring"-hint, verzamelen van lokaal beoordeelde artikel-id's) —
  `packages/core` test-suite groen (29 tests). `vue-tsc`- en
  productiebuild van `apps/inspector` slagen.

  **Slice 4 — Sync-engine + opruimlogica (af, 2026-06-30):**
  `packages/core/src/offline/syncEngine.ts` speelt de hele mutatiewachtrij
  sequentieel af zodra er verbinding is (nooit parallel: een keuring-insert
  moet vóór de inserts van zijn eigen keuringsitems landen, de
  FK-afhankelijkheid die de wachtrij-volgorde al garandeert). Inserts gaan
  via `upsert` op de client-gegenereerde id (idempotent bij een afgebroken
  eerdere poging); updates via `update().eq()`, met de match-kolom uit de
  payload gehaald. Een mislukte mutatie wordt `failed` gezet (blijft in de
  wachtrij voor een volgende poging, met foutmelding) zonder de rest van de
  wachtrij — andere klanten — te blokkeren.

  **Opruimen, zoals besloten met Jos (2026-06-30):** losgekoppeld van
  uploaden. Een download wordt pas automatisch verwijderd
  (`cleanupSyncedDownloads`) als die klant **geen openstaande mutaties meer
  heeft** én **minimaal 4 uur niet actief gebruikt is** (`lastActivityAt`,
  bijgewerkt bij starten/hervatten/invullen van een keuring) — een korte
  wifi-flits halverwege de dag trekt zo niet de download weg terwijl de
  keurmeester nog bezig is. Nooit data verwijderen die nog niet
  gesynchroniseerd is: na 14 dagen zonder sync toont de downloadlijst een
  waarschuwing (`isDownloadStale`) met alleen een **handmatige**
  verwijderknop. Handmatig verwijderen is zelf ook beveiligd: `removeDownload`
  weigert (tenzij `force`) als er nog openstaande mutaties voor die klant
  zijn, zodat de "verwijder download"-knop in de UI nooit per ongeluk
  niet-gesynchroniseerd werk weggooit.

  **UI:** `apps/inspector/src/composables/useOffline.ts` houdt
  `pendingTotal` (som van openstaande mutaties), `syncing` en
  `lastSyncSummary`/`lastSyncError` bij, en triggert automatisch
  `syncAll()` zodra de browser `online` wordt (`useOnline`). Nieuwe globale
  `components/SyncStatusBar.vue` (in `App.vue`, dus op elk scherm
  zichtbaar) toont een vaste balk onderaan zodra er iets te melden is
  (offline, of nog wijzigingen in de wachtrij) met een **"Nu
  synchroniseren"-knop** (voor 's avonds thuis). De downloadlijst
  (`OfflineDownloads.vue`) toont per klant het aantal openstaande mutaties
  en de 14-dagen-waarschuwing.

  Nieuwe unit-tests voor `syncEngine.ts` (volgorde, upsert/update-onderscheid,
  falen+doorgaan-met-andere-klant, "gesynchroniseerd op"-markering, opruimen
  na inactiviteit, **niet** opruimen bij recente activiteit) met een
  gemockte Supabase-client (geen echte backend nodig) — `packages/core`
  test-suite groen (40 tests). `vue-tsc` en productiebuild van
  `apps/inspector` slagen; offline-app-shell-smoketest (Playwright,
  productiebuild + browser echt offline) blijft foutloos met de nieuwe
  syncbalk erin. Terloops gefixt: ontbrekende favicon (404 in de
  browserconsole, losstaand defect, geen regressie).

  **Slice 5 — Certificaat-flow afgestemd op offline (af, 2026-06-30,
  laatste slice van deze ronde):**

  - **Certificaatnummering geverifieerd** (gevraagd in de oorspronkelijke
    opdracht): `useCertificate.ts` bouwt het nummer als
    `JJJJMMDD-KLANTNAAM` (datum + klantnaam), **geen oplopend volgnummer**.
    Vooraf-reservering van nummers (zoals BLAUWDRUK §8.1 vanuit een
    sequentieel scenario noemt) is met dit schema dus niet nodig —
    toegelicht met een code-comment op de plek zelf, zodat dit niet
    opnieuw uitgezocht hoeft te worden.
  - **PDF blijft client-side, upload + record uitgesteld tot sync** (de
    geaccepteerde consequentie uit BLAUWDRUK §8.1): `finish()` in
    `InspectionWizard.vue` krijgt een offline-tak die **geen**
    certificaat probeert te genereren (dat heeft sowieso een
    Storage-upload nodig) maar de keuring lokaal markeert met een nieuwe,
    **lokale-only** status `pending_completion` (bestaat nooit in de
    database, alleen in de cache — zie `inspectionCache.ts`). Dit houdt
    "Hervat" op de klantpagina correct (een afgeronde-maar-niet-gesynchroniseerde
    keuring hoort niet meer als concept aangeboden te worden) zonder al
    "completed" te beweren vóórdat het certificaat er echt is. De wizard
    toont in dat geval een duidelijke "wacht op synchronisatie"-melding
    i.p.v. de downloadlink.
  - **Nieuwe app-laag `composables/useOfflineSync.ts`**:
    `completePendingInspections()` wordt ná elke generieke sync-ronde
    aangeroepen (`useOffline.ts` → `runSync()`, dus zowel bij automatische
    reconnect-sync als de handmatige knop) en genereert dan alsnog het
    certificaat via de **ongewijzigde**, bestaande `generateCertificate()`
    — er is nu wél weer netwerk, dus die kan gewoon zijn normale werk doen
    — en zet de keuring pas dáárna echt op `completed`. Mislukt dit
    (bv. nog geen verbinding voor de Storage-upload), dan blijft de
    keuring op `pending_completion` staan voor een volgende synchronisatie.
    Bewust een app-laag-functie, niet in `packages/core`: de PDF-generator
    (`pdf-lib`) hoort bij de app, niet bij de generieke offline-kern.
  - **Bundle-grootte-regressie gevonden en gefixt tijdens het bouwen:**
    `useOffline.ts` wordt al bij het opstarten geladen (de globale
    `SyncStatusBar`); een statische import van `useOfflineSync.ts` trok
    daardoor `pdf-lib` (~470 kB) mee de hoofdbundel in (911 kB i.p.v. de
    eerdere ~440 kB). Opgelost met een dynamische `import()` binnen
    `runSync()`, zodat `pdf-lib` pas geladen wordt op het moment dat er
    daadwerkelijk gesynchroniseerd wordt — niet als onderdeel van de
    offline-app-shell zelf (zie slice 1: die moet juist licht blijven).
  - **Edge case afgedicht:** her-downloaden van een klant met een lokaal
    nog niet gesynchroniseerde `pending_completion`-keuring overschreef
    eerst per ongeluk die lokale status met de (nog steeds "draft")
    serverversie — `downloadCustomer` in `download.ts` slaat die
    overschrijving nu over als de lokale keuring al `pending_completion` is.
  - Nieuwe unit-tests voor `markInspectionPendingCompletion`/
    `listInspectionsPendingCompletion` (status-overgang, uitsluiting uit
    "hervatbaar concept", verzamelen van keuringen die nog op een
    certificaat wachten) — `packages/core` test-suite groen (42 tests,
    49 met `packages/ui` erbij). `vue-tsc` en productiebuild van
    `apps/inspector` slagen; offline-app-shell-smoketest blijft foutloos.

  **Hiermee zijn alle 5 geplande slices van offline-first af** (zie de
  ontwerpkeuzes bovenaan deze sectie). **Bewust nog niet meegenomen in
  deze ronde** (gedocumenteerd bij slice 3, blijven online-only): nieuw
  vrij artikel toevoegen tijdens een offline keuring, artikelgegevens
  corrigeren/afvoeren vanuit de wizard, de handleiding-link bewerken, en
  het volledig offline doorzoeken van de globale catalogus (buiten wat
  voor de gedownloade klant is meegenomen). **Nog te doen vóór dit naar
  `main` kan:** de migratie `20260705_offline_downloads.sql` door Jos
  laten uitvoeren in Supabase, en een echte test op een toestel (incl.
  vliegtuigstand) — zie de samenvatting die bij het afronden van deze
  sessie is meegegeven.

  **Hardening-ronde na code review (2026-07-01, n.a.v. de live test van
  Jos, screenshots klantdetail + wizard):** volledige review van het
  offline-hoofdstuk hierboven plus alle offline-code; de gevonden punten
  zijn direct gefixt. Branch van deze ronde:
  `claude/offline-mode-code-review-g6haan`.

  - **Drie dataverlies-scenario's in de sync/opruimlaag gedicht** (de
    belangrijkste vondsten, alle drie met unit-tests):
    1. een update op een rij die nooit geland was (insert eerder in de
       keten gefaald) "slaagde" met 0 geraakte rijen en verdween stil uit
       de wachtrij — telt nu als fout en blijft staan;
    2. de opruimlogica kon een offline afgeronde keuring
       (`pending_completion`) wegtrekken vóórdat het certificaat bestond
       (die status telt niet als mutatie, en resultaten invullen/afronden
       registreerde geen activiteit voor de 4-uur-regel) — cleanup én
       `removeDownload` weigeren nu zolang zo'n keuring er staat, en
       `saveRow`/`finish` tellen als activiteit;
    3. `completePendingInspections` genereerde het certificaat ook als er
       nog gefaalde mutaties voor die klant openstonden (certificaat over
       onvolledige serverdata) — wacht nu tot de wachtrij leeg is.
    Plus: na een gefaalde mutatie slaat de sync de rest van diezelfde
    klant die ronde over (het comment beloofde dat al, de code deed het
    niet).
  - **Medewerkers en sets mee in de download** (de "TypeError: Failed to
    fetch" van de screenshots): IndexedDB-versie 2 met twee nieuwe stores;
    klantdetail, setslijst en setdetail lezen offline uit de cache,
    bewerken blijft online-only met verborgen knoppen. Her-downloads
    ruimen nu ook server-side verwijderde artikelen/leden/sets lokaal op
    (alleen bij een lege wachtrij, zodat offline aangemaakt werk nooit
    sneuvelt).
  - **Stille fouten in de wizard weg:** `saveArticle` (serienummer/
    bouwjaar/gebruiker/ingebruikname in de keurtabel) werkt nu ook offline
    via cache + wachtrij (faalde eerst volledig stil, wijziging weg na
    herladen); afvoeren/handleiding/catalogus-match blijven online-only
    maar zeggen dat netjes. De "Geen artikelen gevonden"-verwarring uit de
    tweede screenshot is een eigen tekst geworden ("geen match — vul aan
    en klik + Toevoegen"): de zoekvelden filteren de tabel, dat was geen
    bug maar zag eruit als één.
  - **Ontgrendelen vanaf elk scherm:** de PIN-dialoog zat alleen op de
    pagina Offline downloads; wie de app offline heropende zag overal
    "vergrendeld"-fouten zonder uitweg. De sync-statusbalk heeft nu een
    ontgrendelknop, de offline-schermen herladen na het ontgrendelen
    vanzelf (bewust geen pagina-reload: de sleutel leeft alleen in het
    geheugen), en offline afgeronde keuringen die op hun certificaat
    wachten tellen sleutelloos mee in de balk. Ontgrendelen triggert
    (online) meteen een sync, zodat zo'n certificaat niet tot een
    toevallige volgende sync blijft hangen.
  - **Artikeldetail offline leesbaar** (laatste doodlopende klik vanuit de
    artikellijst) en de "vorige keuring"-hints laden offline in één
    decryptie-ronde i.p.v. O(n²) (merkbaar op een tablet bij grote sets).
  - **Bekende, geaccepteerde beperking (bewust zo gelaten):** de
    payloads in de mutatiewachtrij staan onversleuteld in IndexedDB
    (inclusief resultaten/serienummers uit `article_snapshot`). Versleutelen
    zou betekenen dat synchroniseren een ontgrendelde PIN-sessie vereist,
    terwijl de wachtrij juist ook vergrendeld moet kunnen uploaden (eager
    sync bij reconnect). De wachtrij is normaal kort(stondig); de
    AES-GCM-laag beschermt de langlevende cache. Expliciet hier vastgelegd
    zodat dit niet als vergeten gat wordt aangezien.
  - `packages/core`-tests: 52 groen (was 42). `vue-tsc` + productiebuild
    slagen; hoofdbundel blijft ~440 kB (pdf-lib blijft lazy); offline-
    app-shell-smoketest (Playwright, productiebuild + browser echt
    offline) opnieuw gedraaid en groen.
- **Live:** de inspector-app draait op **https://gearonimo.net** (GitHub
  Pages; auto-deploy bij elke push naar `main`, zie
  `.github/workflows/deploy.yml`). De repo is daarvoor **openbaar** gemaakt.
- **Beveiliging (bijgewerkt 2026-07-02):** RLS staat sinds slice 3.2 **AAN**
  op alle public-tabellen (migratie `20260713_rls_enable.sql`, zie fase 3
  hieronder). De eerdere bouwfase-situatie (RLS uit + brede GRANTs aan
  `authenticated`) is daarmee afgesloten. Noodrem: `supabase/rls-rollback.sql`
  zet alles in één keer terug als er midden op een keurdag iets blokkeert.
- **Passkey-login (vingerafdruk/Face ID) in de klant-app (2026-07-16):** Jos
  wilde af van de magic-link-per-mail bij elke login. Supabase Auth heeft
  sinds eind mei 2026 native (bèta) passkey/WebAuthn-ondersteuning; dat is nu
  aangesloten in plaats van een eigen WebAuthn-implementatie. `useAuth.ts`
  (packages/core) kreeg `registerPasskey`/`signInWithPasskey`/`listPasskeys`/
  `deletePasskey` + capability-checks (`passkeySupported`,
  `platformAuthenticatorAvailable`). Flow: na de **eerste** magic-link-login
  op een toestel toont het dashboard automatisch een aanbod
  (`PasskeyPrompt.vue`, besloten met Jos: automatisch i.p.v. verstopt in
  Instellingen) om vingerafdruk/Face ID te activeren voor dát toestel; bij
  "Ja" wordt een passkey geregistreerd en onthoudt de app dit lokaal
  (`localStorage`, per toestel — dat is ook precies wat een platform-passkey
  is). Volgende keer toont het loginscherm dan een
  "Log in met vingerafdruk/Face ID"-knop vóór het mailformulier (die blijft
  altijd als terugvaloptie staan). Beheer van gekoppelde toestellen
  (toevoegen/verwijderen) staat in Instellingen → Beveiliging.
  **Bèta-kanttekening**: Supabase's passkey-API kan nog wijzigen; **Jos moet
  zelf** de Relying Party (naam, domein, toegestane origins) instellen in het
  Supabase Dashboard onder Authentication → Passkeys voordat dit in productie
  werkt — zonder die configuratie geeft `registerPasskey`/`signInWithPasskey`
  een fout. Geen migratie nodig (Supabase beheert de passkey-tabellen zelf).
  Nieuw icoon `fingerprint` toegevoegd aan het gedeelde `GIcon`
  (packages/ui), zelfde dun+rond-stijl, visueel gecheckt met headless
  Chromium vóór gebruik.

Uitgangspunten:

- **Elke fase eindigt met iets dat Jos kan vasthouden en testen.** Geen
  maanden bouwen in het donker.
- **De huidige apps blijven onaangeraakt draaien** tot GearCert zich in de
  praktijk bewezen heeft (schaduwdraaien, zie fase 2).
- **Veiligheidskritische rekenregels eerst en met tests**: next_due,
  statusberekening, regimes — daar mag nooit een fout in sluipen.
- Rolverdeling: Claude bouwt; Jos test, levert productkennis (catalogus,
  afkeurcodes, certificaatteksten) en regelt accounts/registraties.

---

## Fase 0 — Zakelijke fundering (acties Jos, ±een dagdeel)

Privé en zakelijk gescheiden vanaf dag één (besluit Jos 2026-06-12):

1. ~~**Domeinen registreren**~~ — uitgevoerd: **gearonimo.net** geregistreerd
   (bij Porkbun) en in gebruik als live-adres. (Oorspronkelijk plan noemde
   .io/.app/.nl/.eu; uiteindelijk .net gekozen.)
2. ~~**Zakelijk e-mailadres**~~ — uitgevoerd: **info@gearonimo.net** (via Zoho
   Mail). (Oorspronkelijk plan noemde jos@gearonimo.app/.nl.)
3. ~~**GitHub-organisatie**~~ — uitgevoerd: org **Gearonimo-app**.
4. ~~**Supabase-account**, nieuw project in EU-regio~~ — uitgevoerd:
   project buitfeiclivzzldfdelp (EU).
5. ~~Merkcheck~~ gedaan (TMview: alleen beëindigd Mattel-merk klasse 28 —
   geen blokkade). Nog doen: **naam checken in App Store en Play Store**.
6. *Pas later nodig:* Stripe-account (fase 5), Apple Developer $99/jaar en
   Google Play $25 eenmalig (fase 5), EU-merkregistratie ~€850, klasse 9 +
   42 (bij lancering).

## Fase 1 — Skelet en kern (±2–3 bouwsessies)

- Monorepo opzetten (packages/core, packages/ui, apps/inspector,
  apps/customer) met automatische bouw/test-pijplijn op GitHub.
- Databaseschema als migraties (rechtstreeks uit `DATAMODEL.md`), RLS-regels
  per rol, seed met de keuringsregime-tabel (NL/VK-defaults uit het
  onderzoek).
- Vertaalskelet nl + en-GB; domeinlogica (next_due, statusberekening,
  regime-resolutie) **met unit-tests**.
- Inloggen + rollen werkend in beide apps (web).
- **Testbaar resultaat:** Jos kan inloggen in twee lege maar echte apps.

## Fase 2 — De keurmeester-flow, het hart (±4–6 bouwsessies)

- Klanten, artikelen, winkel-catalogus (eenmalige import van de huidige
  producten-tabel van Safety Green als startcatalogus).
- Keuring-wizard volgens `UX-FLOW.md`: Start/Hervat-contextknop, artikelen
  klaargezet uit vorige keuring, SN-suffix-zoeken, tik-flow,
  afrondscherm met aantallen, recall-vlag.
- **Offline:** lokale opslag op het toestel + sync-laag (route 1),
  automatische upload bij verbinding + handmatige sync-knop.
- **Certificaat-PDF server-side** met hash + verificatie-QR, archivering in
  Storage; verificatiepagina (scan → echt record).
- **Mijlpaal — schaduwdraaien:** Jos doet één echte keurdag volledig in
  GearCert náást de huidige werkwijze en vergelijkt: sneller? niets gemist?
  certificaat goed? Pas door naar fase 3 als dit klopt.

## Fase 3 — De klant-app (±2–3 bouwsessies)

> **Slice 3.1 gebouwd (2026-07-02, branch
> `claude/offline-mode-code-review-g6haan`):** de klant-app leeft op
> **gearonimo.net/klant/** (zelfde Pages-deploy, hash-router; de
> inspector-service-worker heeft een denylist voor /klant zodat hij daar
> niet zijn eigen shell serveert). Magic-link-login (wachtwoordloos, zoals
> besloten 2026-06-14), koppelen via **uitnodigingscode** per klantbedrijf
> (`customers.invite_code`, zichtbaar + kopieerbaar op het klantdetail in
> de inspector-app), dashboard **"ben ik in orde"** (stoplicht + tellers,
> statuslogica = de geteste `calcStatus` uit packages/core; afgekeurd bij
> laatste keuring telt als actie-nodig), artikellijst met status/
> handleiding/recall/volgende-keuringsdatum, en **certificaten downloaden**.
>
> **Vertrouwensmodel:** RLS staat nog uit, dus de klant-app leest álles via
> security-definer-RPC's die zelf op `auth.uid()` scopen (`my_customer`,
> `my_articles`, `my_certificates`, `join_customer_by_invite`) — geen
> directe tabel-toegang nodig. `ensure_inspector` is dichtgetimmerd:
> klant-accounts worden niet langer automatisch keurmeester als ze de
> inspector-app openen. **Maar let op:** zolang de brede GRANTs aan
> `authenticated` bestaan kan een technisch onderlegde klant nog steeds
> rechtstreeks de REST-API bevragen. **Daarom: nog géén uitnodigingscodes
> aan echte klanten geven vóór de RLS-ronde** — die is nu de eerstvolgende
> geplande slice (3.2).
>
> **Acties Jos vóór het testen:**
> 1. Migratie `supabase/migrations/20260708_customer_app_join_and_reads.sql`
>    uitvoeren in Supabase (idempotent).
> 2. In Supabase → Authentication → URL Configuration:
>    `https://gearonimo.net/klant/*` toevoegen aan **Redirect URLs**
>    (anders landt de magic-link op de inspector-app).
> 3. Testen: /klant/ openen, inloggen met een e-mailadres, koppelen met de
>    uitnodigingscode van een testklant (staat op het klantdetail in de
>    inspector-app), dashboard controleren.
>
> **Live getest door Jos (nacht 1→2 juli): werkt end-to-end** (login,
> koppelen, dashboard, certificaat-downloads). Onderweg gevonden en gefixt:
> live miste `customer_members.email` e.a. kolommen én de user_id-FK wees
> naar public.users i.p.v. auth.users (migraties 20260709/20260710 —
> hetzelfde "tabel was ouder dan de migratie"-patroon als eerder bij
> inspectors; zie de schema-diff hieronder bij slice 3.2). Direct daarna
> op verzoek van Jos gebouwd: **afvoeren door de klant** (elk eigen
> artikel, met reden — vervangen/verloren/gestolen; migraties
> 20260711/20260712, RPC `retire_my_article`), subtiel prullenbakje +
> ✓/✗-statuschips, en in de **wizard-SN-zoeker** blijven afgevoerde
> artikelen vindbaar ("Afgevoerd (reden)", laatste keuringsresultaat
> erbij, klik = weer in gebruik nemen + toevoegen aan de keuring).
>
> **Slice 3.2 — RLS-ronde (volgende):** de database echt op slot nu er
> externe accounts bestaan. Plan:
> 1. **Schema-diff live ↔ repo-migraties** (introspectie-dump door Jos,
>    diff door Claude) zodat alle "tabel ouder dan migratie"-verrassingen
>    in één keer boven water komen vóór er policies op gebouwd worden.
> 2. `customer_links`-backfill (elke klant gekoppeld aan het keurbedrijf)
>    — de policies scopen inspectors via die tabel.
> 3. RLS aan op alle tabellen: inspectors zien/schrijven alles van hun
>    eigen keurbedrijf (via `customer_links`); klant-accounts hebben géén
>    directe tabel-toegang (alles loopt al via security-definer-RPC's);
>    `products` leesbaar voor alle ingelogden (catalogus).
> 4. `ensure_inspector` stopt met auto-provisioning: bestaande
>    keurmeesters blijven werken, nieuwe komen er alleen via het
>    beheerscherm/een uitnodiging (het huidige gedrag maakt elk
>    zelf-geregistreerd account keurmeester — onhoudbaar met een publieke
>    klant-login).
> 5. Pas daarna: uitnodigingscodes naar echte klanten.
>
> **Slice 3.2 gebouwd + live getest (2026-07-02):** de RLS-migratie
> (`supabase/migrations/20260713_rls_enable.sql`) is gebouwd op de
> introspectie-dump van Jos — niet op aannames — en draait live. Kern:
> RLS aan op alle public-tabellen; keurmeesters (actieve `inspectors`-rij)
> zien/bewerken alles van hun eigen bedrijf via `customer_links` (met
> definer-helpers tegen policy-recursie); klant-accounts hebben géén
> directe tabel-toegang (alles via de security-definer-RPC's); catalogus
> leesbaar voor ingelogden; TRUNCATE/REFERENCES/TRIGGER ingetrokken;
> Storage schrijven alleen nog voor keurmeesters (een klant-account kon
> eerst certificaat-PDF's overschrijven); `ensure_inspector` provisioneert
> niet langer elk nieuw account tot keurmeester. De schema-diff bracht ook
> drie losse live-gebreken boven water die meteen zijn rechtgezet
> (`customer_members.user_id` onterecht NOT NULL; ontbrekende
> DELETE-grants op `articles` en `certificates`). Noodrem:
> `supabase/rls-rollback.sql` (bewust géén migratie) zet alles in één keer
> terug. Jos' testronde leverde nog vier fixes/wensen op, alle gebouwd:
> uitlogknop + duidelijke klant-account-melding in de Pro-app (de sessie
> wordt sinds de klant-app op hetzelfde domein gedeeld), router-guard die
> op de sessie-load wacht (hoofdmenu verscheen eerst zonder login), het
> witte scherm na de magic-link (auth-tokens in de URL-hash botsten met de
> hash-router), en in de wizard het Gebruiker-veld in de toevoegrij +
> certificaat-PDF's die echt als download in de Downloads-map landen.
> Daarmee is stap 5 vrijgegeven: **uitnodigingscodes kunnen naar echte
> klanten** (actie Jos, het fase-3-mijlpaalmoment).
>
> **Slice 3.3 gebouwd (2026-07-02): klantbedrijf-admin.** De twee
> resterende fase-3-bouwblokken voor de klant-app, volledig via nieuwe
> security-definer-RPC's (klant-accounts houden géén directe tabel-toegang;
> migratie `supabase/migrations/20260714_customer_admin.sql` — **nog door
> Jos uit te voeren in Supabase**, idempotent):
> - **Medewerkers beheren** (pagina `/medewerkers` in de klant-app, link in
>   de kopbalk): lijst met badges (beheerder/inactief/nog geen account),
>   toevoegen/bewerken (naam, functie, telefoon, e-mail, actief). Beheer is
>   voorbehouden aan **beheerders**: nieuwe boolean
>   `customer_members.is_admin` (zelfde patroon als `inspectors.is_admin`;
>   dit overrulet het `role='manager'`-idee uit DATAMODEL — `role` is in de
>   praktijk al vrije tekst voor de functie). Het **eerste account dat met
>   de uitnodigingscode koppelt wordt automatisch beheerder** (backfill
>   regelt dit ook voor bestaande koppelingen), en de keurmeester kan de
>   beheerder aanwijzen via een nieuw vinkje in het medewerkersscherm van
>   de inspector-app. Vergrendel-vangnet: je kunt jezelf niet inactief of
>   niet-beheerder maken. De beheerder ziet op de medewerkers-pagina ook de
>   **uitnodigingscode** van het bedrijf (kopieerbaar) met uitleg — collega
>   koppelt zelf, e-mail-hereniging plakt account en medewerker-rij aan
>   elkaar. Lijst is leesbaar voor elk actief lid (zichtbaarheid per
>   bedrijf, DATAMODEL-besluit 2026-06-14); alleen bewerken is
>   beheerder-werk.
> - **Artikelen toevoegen door de klant** ("+ Toevoegen" bij Materiaal op
>   het dashboard, mag elk actief lid — zelfde lijn als afvoeren): zoeken
>   in de catalogus via de bestaande fuzzy `search_products` (werkt voor
>   klant-accounts dankzij de products-leespolicy uit 20260713), of vrije
>   invoer als het product er niet tussen staat — die gaat dan automatisch
>   de **catalogus-wachtrij** in (`suggest_for_catalog`, "onbekend product
>   → wachtrij" uit het faseplan). Velden: serienummer, gebruiker,
>   bouwjaar/-maand, in-gebruik-sinds. Nieuwe artikelen krijgen
>   `source='customer'` (check-constraint verruimd) zodat de keurmeester
>   ziet waar het vandaan komt.
> Beide apps bouwen groen (vue-tsc + vite), 54 core-tests groen. Nog te
> doen: live-test door Jos (migratie uitvoeren → medewerker toevoegen,
> collega laten koppelen, artikel toevoegen mét en zónder catalogusmatch).
> Migratie 20260714 is door Jos uitgevoerd (2026-07-03) en de slice is naar
> `main` gemerged (live).
>
> **URL's naar het Engels (2026-07-03, op verzoek Jos):** de klant-app is
> verhuisd van `gearonimo.net/klant/` naar **`gearonimo.net/portal/`** —
> conform de afspraak "code/naamgeving in het Engels" (BLAUWDRUK §3), en
> `portal` i.p.v. `customer` omdat dat één letter scheelt met `/customers`
> (klantbeheer in de Pro-app) en een typfout dan in de verkeerde app landt.
> Hash-routes mee hernoemd: `#/koppelen` → `#/join`, `#/medewerkers` →
> `#/members`. Oude paden blijven werken: `/klant/` krijgt bij de deploy een
> doorverwijspagina die de `#`-hash behoudt (dus ook oude magic-links landen
> goed), en de oude hash-routes zijn router-redirects. In dezelfde ronde
> `/inspection/new` → `/inspections/new` (enkelvoud/meervoud-consistentie in
> de Pro-app, met redirect). Alle overige paden waren al Engels
> (gecontroleerd overzicht: /customers, /articles, /sets, /inspections,
> /serial-search, /settings, /import, /offline, /verify).
> **Actie Jos:** in Supabase → Authentication → URL Configuration
> `https://gearonimo.net/portal/*` toevoegen aan de Redirect URLs (en
> `/klant/*` mag daarna weg). **Gedaan (2026-07-03).**
>
> **Rollenoverzicht opgesteld + catalogus-curator-rol gebouwd (2026-07-03,
> vooruitgetrokken uit fase 4).** Op verzoek van Jos eerst een audit van
> alle rollen in de code (niet uit het geheugen): keurmeester (klanten +
> keuringen) en klant-admin/end-user waren al volledig gebouwd en
> afgedwongen; **keurbedrijf-admin** (`inspectors.is_admin`) bleek alleen
> een kolom + badge zonder enige afdwinging — elke keurmeester kon al
> alles. **Besluit Jos: dat mag zo blijven** (bedrijfsadmin en keurmeester
> gelijk; afkeurcodes/certificaat-template zijn al per keurbedrijf
> ingesteld, niet per keurmeester — dat klopte dus al). De vijfde rol,
> **"keurmeester die brondata aanvult"**, bleek niet te bestaan: RLS liet
> niemand in `products` schrijven (bewust, sinds de RLS-ronde). Besluit
> Jos: een **aparte curator-rol** — hij vertrouwt niet elke keurmeester om
> de catalogus zelf compleet/correct in te vullen, dus alleen een paar door
> hem aangewezen keurmeesters mogen rechtstreeks schrijven; de rest kan
> alleen een artikel op de wachtrij zetten (het bestaande
> `suggest_for_catalog`-vinkje) zodat Jos controleert vóór het de
> bibliotheek in gaat — plus zelf makkelijk in Excel kunnen bijwerken.
>
> Gebouwd (migratie `supabase/migrations/20260715_catalog_curator.sql` —
> **nog door Jos uit te voeren in Supabase**, idempotent): nieuwe
> `inspectors.can_curate_catalog` (losstaand van `is_admin`; de oudste
> inspector — vrijwel zeker Jos — wordt als enige automatisch curator via
> backfill), RLS-schrijfbeleid op `products` voor curators
> (`is_catalog_curator()`-helper). Nieuwe Instellingen-tegel **Catalogus**
> (alleen zichtbaar voor een curator) met twee onderdelen:
> - **Wachtrij** (`CatalogQueue.vue`) — alle `suggest_for_catalog`-artikelen,
>   per stuk voorgevuld met de vrije velden (merk/omschrijving/
>   categorie/materiaal/norm/MBS): curator vult de rest aan (type, leeftijds-
>   termijnen, handleiding-/recall-/veiligheidsbulletin-links) en maakt er
>   een echt `products`-record van (artikel wordt gekoppeld, vrije velden
>   blijven staan — onschadelijk, overal wint het gekoppelde product al via
>   coalesce), of wijst af (vinkje uit, geen product).
> - **Catalogus** (`CatalogManager.vue`) — volledige productenlijst met
>   zoeken, handmatig toevoegen/bewerken, **Excel-export** (`.xlsx`, alle
>   kolommen) en **Excel-import** met dryrun-preview (nieuw/bijgewerkt/
>   overgeslagen-met-reden vóór commit; matcht op `id`, ontbrekend `id` =
>   nieuw product) — zodat Jos de catalogus ook gewoon in Excel kan
>   bijwerken en terug importeren.
> Gedeeld veldenformulier `ProductForm.vue` (+ `productForm.ts` voor de
> types/defaults, buiten `<script setup>` omdat dat geen losse
> runtime-exports mag hebben) voorkomt dat wachtrij en catalogusbeheer twee
> keer dezelfde ~15 velden definiëren. Beide apps bouwen groen (vue-tsc +
> vite), 54 core-tests groen. Migratie door Jos uitgevoerd (2026-07-05).
>
> **Catalogus-aanmelding: van kaal vinkje naar ingevuld voorstel
> (2026-07-05, besluit Jos).** Het "aanbieden voor de catalogus" was een kaal
> boolean-vinkje (📚 per rij in `CustomerArticles.vue` en `InspectionWizard.vue`):
> de keurmeester zette het aan en liet merk/type/categorie/materiaal/norm/
> leeftijdstermijnen/MBS/handleiding-/recall-/veiligheidsbulletin-links volledig
> aan de curator over. Jos wil dat wie iets voorstelt zelf zijn best doet die
> velden in te vullen. Omgebouwd: het 📚-icoon is nu een **knop** die een
> **productformulier** opent (hergebruik van het bestaande `ProductForm.vue` via
> de nieuwe wrapper `CatalogSuggestDialog.vue`), voorgevuld met wat de
> keurmeester al in de vrije velden typte; pas na invullen + verzenden komt de
> aanmelding op de wachtrij. Brand + naam zijn verplicht (uit `ProductForm`);
> de rest presenteert het formulier, zodat de curator vooral controleert.
>
> **Schema:** de ingevulde velden gaan NIET meteen een `products`-rij in (die is
> leesbaar voor elke ingelogde zodra hij bestaat, RLS-leesbeleid 20260713 — een
> niet-goedgekeurd voorstel hoort nog niet in de echte catalogus). In plaats
> daarvan een nieuwe jsonb-kolom `articles.catalog_suggestion` naast het
> bestaande `suggest_for_catalog`-vinkje (migratie
> `supabase/migrations/20260716_catalog_suggestion.sql` — **nog door Jos in
> Supabase uit te voeren**, idempotent). Geen apart RLS-/grant-werk nodig: de
> eigenaar-keurmeester mag de articles-rij van zijn klant al muteren
> (`articles inspector all` + grant update uit 20260713; RLS is rij-, niet
> kolomgebaseerd). `CatalogQueue.vue` prefilled nu uit `catalog_suggestion`
> (i.p.v. alleen de schamele vrije velden) en valt daarop terug voor oudere/
> klant-app-aanmeldingen zonder voorstel; accepteren/afwijzen wist het
> voorstel weer. i18n nl+en onder `catalogSuggest`. Beide apps bouwen groen
> (vue-tsc + vite), 54 core-tests groen. Nog te doen: migratie uitvoeren +
> live-test door Jos (aanmelden vanuit klantpagina én keuring-wizard, curator
> ziet het voorgevulde voorstel in de wachtrij).
>
> **Klant-account kon toch alle Pro-app-schermen openen (bug, gevonden door
> Jos 2026-07-05).** Bij het testen bleek: een klant-account dat op
> gearonimo.net (i.p.v. /portal/) inlogt zag na de "dit is geen
> keurmeester-account"-melding gewoon het volledige tegelmenu ernaast staan
> — Klanten, Keuringen, Instellingen (incl. de Excel-import) waren allemaal
> aan te klikken. RLS blokkeerde al écht lezen/schrijven (leeg/geweigerd,
> geen datalek), maar de schermen zelf hoorden niet bereikbaar te zijn.
> Gefixt: het hoofdmenu verbergt de zoekbalk + tegels volledig zodra het
> account geen keurmeester is (`apps/inspector/src/pages/Home.vue`), én de
> router zelf controleert dit nu ook (`ensureInspector()` in
> `router.beforeEach`) zodat een directe URL of de terug-knop niet meer
> alsnog bij `/customers`, `/settings`, `/import` etc. uitkomt — alleen het
> hoofdmenu (met de melding + link naar `/portal/`) blijft toegankelijk.
>
> **"Wachtwoord vergeten" toegevoegd aan de Pro-app (2026-07-05, op verzoek
> Jos).** Er was geen enkele weg terug als je het wachtwoord van een
> keurmeester-account kwijt was — geen zelfregistratie, dus ook geen
> "wachtwoord vergeten"-link. Nu: een link op het inlogscherm stuurt via
> `resetPasswordForEmail` (nieuw in `useAuth`, `packages/core`) een
> reset-mail; die landt op de nieuwe pagina
> `apps/inspector/src/pages/ResetPassword.vue` (route `/reset-password`,
> bewust buiten de keurmeester-gate) waar een nieuw wachtwoord ingesteld
> wordt via `updatePassword`. **Actie Jos:** `https://gearonimo.net/reset-password`
> toevoegen aan Supabase → Authentication → Redirect URLs (zelfde plek als
> `/portal/*`), anders landt de reset-link niet goed.
>
> **Afgesproken met Jos: volgende sessie alle test-accounts opschonen.**
> Te veel losse e-mails/wachtwoorden uit eerdere test-rondes, overzicht
> kwijt. Plan: alle bestaande auth-accounts verwijderen (Supabase →
> Authentication → Users) en vervangen door één vast, opgeschreven setje —
> één per rol, zodat elke rol apart en herhaalbaar te testen is:
> 1. **Keurmeester** (gewoon account, `is_admin=false`, `can_curate_catalog=false`)
> 2. **Keurbedrijf-admin/keurmeester** (`is_admin=true`) — bewust geen apart
>    rechtenniveau (besluit Jos 2026-07-03), dus dit test-account bevestigt
>    vooral dat het vinkje zichtbaar is, niet dat er iets afwijkt
> 3. **Catalogus-curator** (`can_curate_catalog=true`) — ziet de
>    Catalogus-tegel in Instellingen
> 4. **Klant-admin** (eerste account dat met een uitnodigingscode koppelt,
>    `customer_members.is_admin=true`) — ziet Medewerkers in `/portal/`
> 5. **Klant end-user** (koppelt met dezelfde code, geen beheerrechten)
> Nieuwe accounts via **Add user** in Supabase (Auto Confirm User aan,
> zelf een wachtwoord kiezen) voor de keurmeester-rollen; klant-rollen
> loggen zelf in via de magic-link op `/portal/` en koppelen met de
> uitnodigingscode van een testklant.
>
> **Keuring aanvragen / de leadmotor gebouwd (2026-07-05, laatste openstaande
> stuk van fase 3).** Tot nu toe kon een klant zich alleen via een
> uitnodigingscode koppelen. Nu ook het bredere onboardingpad uit BLAUWDRUK §7
> / DATAMODEL §5 (`inspection_requests`). **Ontwerpbesluiten met Jos
> (gespard, niet uit de code):**
> - **Gearonimo is puur het platform/de matchmaker — géén keurbedrijf-rij die
>   klanten "bezit".** Dat zou het platform tot concurrent van zijn eigen
>   keurbedrijven maken (Jos keurt zelf bij Safety Green). Een zelf-aangemelde
>   klant staat daarom **op zichzelf, zonder koppeling**, tot hij zelf een
>   keurbedrijf kiest. Dashboard toont dan "nog niet gekeurd — vraag een
>   keuring aan" (geen rood alarm, BLAUWDRUK §7).
> - **Ontdekking = wereldkaart** (Leaflet/OpenStreetMap, geen API-sleutel) met
>   alle keurbedrijven die `listed=true` hebben, **plus naam-zoeken** (vindt
>   ook niet-gelijste bedrijven, BLAUWDRUK §7.3). **Geen landfilter** — een
>   NL-bedrijf mag Belgische klanten, buitenlanders in NL moeten hier terecht
>   kunnen (Jos); de klant kiest zelf op de kaart waar hij naartoe wil.
> - **Overstap = één keurbedrijf tegelijk** (`source='switch'`): bij
>   goedkeuring wordt de nieuwe koppeling actief en andere actieve koppelingen
>   beëindigd. **De historie reist mee met de klant**: het actueel gekoppelde
>   keurbedrijf mag de vólledige keuringshistorie/certificaten van die klant
>   inzien (alleen-lezen), ook wat een vórig keurbedrijf uitvoerde — klant is
>   eigenaar van de data (nieuwe SELECT-policies naast de bestaande
>   company-scope; bewerken blijft van het uitvoerende bedrijf, afgeronde
>   keuringen zijn sowieso onveranderlijk).
>
> **Ook opgeruimd:** de tijdelijke hack uit de een-bedrijf-fase — een trigger
> die élke nieuwe klant aan "het oudste bedrijf" koppelde — is herzien: een
> door een keurmeester aangemaakte klant koppelt nu aan *diens eigen* bedrijf;
> een zelf-aangemelde klant krijgt géén automatische koppeling.
>
> **Gebouwd (migratie `supabase/migrations/20260717_inspection_requests_leadmotor.sql`
> — nog door Jos in Supabase uit te voeren, idempotent):** `inspection_requests`
> + `inspection_companies.listed/latitude/longitude`; security-definer-RPC's
> `self_register_customer`, `list/search_inspection_companies`,
> `request_inspection`, `my_inspection_requests`, `withdraw_inspection_request`,
> `my_link_status` (klant-app) en `company_inspection_requests`,
> `accept/decline_inspection_request`, `set_company_listing`,
> `my_company_listing` (Pro-app). Safety Green is meteen `listed=true` gezet met
> de coördinaten van Elst (Gld) zodat het aanvraagpad te testen is (uit te
> zetten via Instellingen → Vindbaarheid).
> - **Klant-app:** startkeuze `Start.vue` (uitnodigingscode óf zelf beginnen),
>   `Request.vue` (wereldkaart + naam-zoeken + aanvraag + status/intrekken),
>   dashboard-banner voor een niet-gekoppelde klant / lopende aanvraag. Nieuwe
>   dep `leaflet` (lazy in de Request-chunk).
> - **Pro-app:** tegel **Aanvragen** (met badge) + `Requests.vue`
>   (goedkeuren/afwijzen), en Instellingen → **Vindbaarheid**
>   (`CompanyListing.vue`: listed-schakelaar + locatie).
> i18n nl+en. vue-tsc + vite (beide apps) + 54 core-tests groen. **Actie Jos:**
> migratie 20260717 uitvoeren; daarna testen: zelf-aanmelden → materiaal
> invoeren → keuring aanvragen (kaart/naam) → in de Pro-app goedkeuren →
> koppeling actief + historie zichtbaar.
>
> **Migraties uitgevoerd (2026-07-06):** Jos heeft `20260716_catalog_suggestion.sql`
> én `20260717_inspection_requests_leadmotor.sql` in Supabase gedraaid (beide
> "Success"). Safety Green staat daarmee live `listed=true` met de coördinaten
> van Elst. TAAK 1 (catalogus-aanmelding) en TAAK 2 (leadmotor) zijn hiermee
> volledig live op gearonimo.net.
>
> **A-Z testplan opgesteld (2026-07-06): `TESTPLAN.md` + `supabase/testdata-reset.sql`.**
> Op verzoek van Jos een volledige, stap-voor-stap doorloop (100 stappen, fases
> A–Q) vanaf een schone lei: testdata wissen → keurmeester aanmaken →
> bedrijfsinstellingen → klant + artikelen → catalogus-aanmelding →
> keuring+certificaat → SN/recall → sets → curator-wachtrij → Excel-import →
> klant-app (uitnodigingscode én zelf-aanmelden/leadmotor) → aanvraag
> goedkeuren → rollen-afscherming → wachtwoord-reset → offline → (optioneel)
> overstap met historie-meereizen. Elke stap heeft een "Verwacht:"-regel zodat
> Jos per stap ✅/❌ kan terugkoppelen. `testdata-reset.sql` wist de
> transactionele data + auth-accounts maar behoudt catalogus/bedrijf/afkeurcodes.
>
> **Styling-/opmaakronde (2026-07-14/15, met Jos live meetestend).** De
> UI-opmaak-pas die al langer open stond (en UX-FLOW §7's crowdsourced
> hero-foto) is gebouwd, plus onderweg gevonden bugs:
> - **Platform-hero-foto**: sfeerfoto op het hoofdmenu van beide apps én als
>   gedimde kopstrook op alle subpagina's. Instelbaar door de platform-admin
>   via Instellingen → Hero-foto: één bronfoto, drie crops
>   (mobiel/desktop/kopstrook) met inzoomen/uitlijnen en een
>   donkering-schuif, live voorbeeld; oude bestanden worden bij opslaan
>   opgeruimd. Nieuwe singleton-tabel `platform_settings` +
>   `is_platform_admin()`; opslag in de bestaande `branding`-bucket
>   (migraties `20260714`, `20260730` t/m `20260732` — alle door Jos
>   uitgevoerd). Onderweg gefixt: `platform_admins.user_id`-FK wees naar
>   `public.users` i.p.v. `auth.users` (derde keer dit patroon), en de tabel
>   miste een grant ("permission denied").
> - **Hoofdmenu's herbouwd**: glas-tegels (één stijl i.p.v. regenboogkleuren)
>   over de foto; Pro-app desktop = statkaart links ("N artikelen te
>   herkeuren binnen 30 dagen", nieuwe RPC `upcoming_reinspections_count`,
>   bewust géén "alles op orde"-tekst en geen vanity-tellers) + 2×3-tegels
>   rechts; zoekbalk van het hoofdmenu weg (dubbelop met de tegels).
> - **Gedeelde koppen**: de 12 losse, uit de pas gelopen paginakoppen van de
>   Pro-app vervangen door één `AppHeader` (terug+home links, titel midden,
>   actie-slot rechts); klant-app-pagina's Members/Request alsnog aan de
>   gedeelde `PageHeader`. De hero-kopstrook zit ín die componenten.
> - **Lijn-iconen i.p.v. emoji**: gedeeld `GIcon`-component
>   (`packages/ui`), stijl dun+rond, gekozen door Jos via een
>   preview-artifact; gereedschapskist voor "Mijn materiaal".
> - **Systeem-sans** als lettertype (er stond helemaal geen font-family —
>   alles viel terug op Times New Roman); bewust geen webfont
>   (offline-first + AVG).
> - **Twee ernstige bugs gevonden en gefixt**: (1) supabase-js-deadlock —
>   een query bínnen de `onAuthStateChange`-callback blokkeerde de hele
>   klant-app op "Laden..." (fix: `setTimeout` buiten de callback-tick;
>   boot headless geverifieerd); (2) verouderde PWA-chunks na een deploy
>   lieten tegel-kliks stil falen (fix: `router.onError` + eenmalige
>   reload, beide apps).
> - **`CLAUDE.md` toegevoegd** met de werkafspraken/landmijnen uit deze
>   ronde, zodat volgende sessies ze automatisch meekrijgen.

- Dashboard "ben ik in orde", artikelen + historie, certificaten downloaden,
  handleiding-links.
- Keuring aanvragen: uitnodigingscode/QR, openbare lijst met
  "open voor nieuwe klanten"-schakelaar, naam-zoeken (leadmotor,
  blauwdruk §7).
- Klantbedrijf-admin: medewerkers beheren, artikelen toevoegen
  (catalogus-autocomplete; onbekend product → wachtrij).
- **Mijlpaal:** één echte klant van Safety Green als pilotgebruiker.

## Fase 4 — Migratie en overstap Safety Green (±2 bouwsessies)

> **Herzien 2026-07-19 (besluit Jos):** het DB-naar-DB-migratiescript is
> **geschrapt** — alle oude data staat dubbel op de zaak (incl. PDF's).
> Testklanten krijgen een uitnodigingscode en beginnen leeg; historie kan
> desgewenst per klant via de bestaande Excel/CSV-import. De
> catalogus-wachtrij + god-rol zijn al actief (2026-07-03/19, incl.
> platform-admin los van een keurbedrijf en de Bedrijven-tegel).

- ~~Migratiescript oude Supabase → nieuw schema~~ — geschrapt, zie boven.
- ~~Catalogus-wachtrij + god-rol actief~~ — af (2026-07-03/19).
- NAS-back-up ingeregeld (blauwdruk §8) — **wacht op het aansluiten van de
  NAS (hardware, actie Jos)**.
- Overstap in de praktijk: jos@safetygreen-account aanmaken als beheerder
  bij Safety Green, info@gearonimo daar op inactief; testklanten uitnodigen.
- **De oude apps blijven als noodrem beschikbaar** (alleen-lezen).

## Fase 5 — Commercieel en de stores (±3–4 bouwsessies)

> **Herzien 2026-07-19 (besluit Jos):** de app blijft voorlopig (±het
> eerste jaar) **gratis voor iedereen** en is **op uitnodiging** tijdens
> een uitgebreide testfase. Stripe schuift daarmee naar achteren; de
> En-GB-vertaling + het activeren van het VK-regime worden juist naar
> voren gehaald als eerstvolgende fase-5-werk.

- Stripe: abonnement per keurmeester + metered tikken met staffel
  (blauwdruk §7) — **uitgesteld, zie hierboven**.
- Capacitor-builds; store-registraties (App Store / Play Store) voor beide
  apps; marketing-/aanmeldsite op gearcert.com.
- En-GB vertaling afronden + VK-regime activeren; kwalificatie-uploads
  zichtbaar voor klanten.
- **Mijlpaal: lancering** — eerst NL, daarna VK.

## Daarna (bewust buiten het plan)

- Duitsland (DE-vertaling + elektronisch zegel op PDF), VS.
- CSV-import met fuzzy-matching voor nieuwe keurbedrijven (zie BLAUWDRUK §9).
- Keuringsplanner als optionele module.
- B2B-rapportages, NEN 3140-meetwaarden.

## Ritme en doorlooptijd

Totaal ±13–18 bouwsessies. Het tempo bepaalt Jos: elke fase eindigt met
testwerk voor hem, en pas na zijn akkoord gaat de volgende fase open. Bij
een ritme van 2–3 sessies per week is fase 2 (schaduwdraaien) binnen een
maand bereikbaar.
