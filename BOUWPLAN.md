# Bouwplan Gearonimo

Hoort bij `BLAUWDRUK.md`, `DATAMODEL.md`, `UX-FLOW.md` en
`ONDERZOEK-CERTIFICAATEISEN.md`. Status: vastgesteld 2026-06-12.

---

## Voortgang (bijgewerkt 2026-06-27)

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
- **Live:** de inspector-app draait op **https://gearonimo.net** (GitHub
  Pages; auto-deploy bij elke push naar `main`, zie
  `.github/workflows/deploy.yml`). De repo is daarvoor **openbaar** gemaakt.
- **Let op — beveiliging:** RLS staat momenteel **UIT** op `customers`
  (tijdelijk, voor testen); tabelrechten zijn toegekend aan de rol
  `authenticated`. RLS moet later aan, met scope op `customer_id` (zie
  BLAUWDRUK). Dit was ook de "permission denied" die deze sessie is opgelost:
  een GRANT-kwestie, geen sessie-/RLS-probleem.

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

- Dashboard "ben ik in orde", artikelen + historie, certificaten downloaden,
  handleiding-links.
- Keuring aanvragen: uitnodigingscode/QR, openbare lijst met
  "open voor nieuwe klanten"-schakelaar, naam-zoeken (leadmotor,
  blauwdruk §7).
- Klantbedrijf-admin: medewerkers beheren, artikelen toevoegen
  (catalogus-autocomplete; onbekend product → wachtrij).
- **Mijlpaal:** één echte klant van Safety Green als pilotgebruiker.

## Fase 4 — Migratie en overstap Safety Green (±2 bouwsessies)

- Migratiescript: huidige Supabase-data (klanten, producten, keuringen,
  keuring_items, klant-accounts) → nieuw schema; artikelen afleiden door
  groeperen op klant + serienummer (DATAMODEL §8).
- Proefmigratie + controle door Jos (kloppen aantallen, historie,
  certificaatnummers?); daarna definitieve overstap.
- Catalogus-wachtrij + god-rol actief; NAS-back-up ingeregeld
  (blauwdruk §8).
- **De oude apps blijven als noodrem beschikbaar** (alleen-lezen).

## Fase 5 — Commercieel en de stores (±3–4 bouwsessies)

- Stripe: abonnement per keurmeester + metered tikken met staffel
  (blauwdruk §7).
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
