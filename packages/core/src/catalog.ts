/**
 * De regels van de catalogus, op één plek.
 *
 * Deze module is de gedeelde bron voor drie plekken die het eerder ieder voor
 * zich deden: het productformulier (welke producttypes bestaan er), de
 * import/export in `CatalogManager.vue` (welke kolommen, wanneer is iets
 * hetzelfde product) en de scripts in `scripts/catalog/` die de bronlijst in
 * de repo bijhouden.
 *
 * Waarom gedeeld: elke regel die hier staat is ooit misgegaan doordat hij op
 * twee plekken net anders stond. De dubbelcheck van de import moet exact de
 * regel van de unieke index uit migratie 20260749 zijn, anders belooft de
 * preview iets anders dan de database afdwingt.
 */

/**
 * De kolommen van de catalogus, in de volgorde waarin ze in de Excel staan.
 * Gelijk aan `COLUMNS` in CatalogManager.vue en aan `ProductFormModel`.
 *
 * `id` staat er bewust bij: bij een import betekent een gevulde `id`
 * "werk deze rij bij", een lege `id` "voeg toe". Daar hangt de hele
 * heen-en-weer-lus met de bronlijst aan.
 */
export const CATALOG_COLUMNS = [
  "id",
  "brand",
  "name",
  "product_type",
  "category",
  "material",
  "standard",
  "manufacturer_code",
  "max_age_use_years",
  "max_age_mfr_years",
  "breaking_strength",
  "working_load_limit",
  "max_user_weight_kg",
  "rope_diameter_min_mm",
  "rope_diameter_max_mm",
  "serial_number_location",
  "interval_override_months",
  "manual_url",
  "product_page_url",
  "recall_url",
  "inspection_notice_url",
  "notes",
] as const;

export type CatalogColumn = (typeof CATALOG_COLUMNS)[number];

/** Rij zoals hij in de bronlijst staat: alles tekst, leeg = niet ingevuld. */
export type CatalogRow = Record<CatalogColumn, string>;

/**
 * De toegestane waarden van `product_type` in de **catalogus**. Dit is het
 * *regime*, niet de categorie: `getRegime()` zoekt hierop en valt bij een
 * onbekende waarde stil terug op 12 maanden. In NL is dat toevallig goed, in
 * GB moet PPE op 6 — daarom is een verkeerde waarde hier stil gevaarlijk en
 * geen schoonheidsfout.
 *
 * Bij de bronlijst-import van 2026-07-27 stond bij 156 van de 2294 rijen een
 * fijne artikeltaxonomie ("Locking Carabiner (Screw-Lock)", "Rigging Plate")
 * in dit veld. Die omschrijving hoort in `category`.
 *
 * Gewijzigd 2026-08-04 (besluit Jos):
 * - `aerial_platform` eruit — andere doelgroep, stond op geen enkel product.
 * - `clothing` erbij — kleding wordt nooit gekeurd, zie `NO_INSPECTION_TYPES`.
 * - `other` eruit: **"overig" is geen catalogusproduct.** Het is de eigen
 *   todo-lijst van de klant (brandblusser, EHBO-koffer, APK) en bestaat
 *   alleen bij een vrij artikel. Een product uit de catalogus kiezen en het
 *   daarna op `other` zetten kan daarmee niet meer — precies de regel die Jos
 *   op 2026-08-04 stelde, hier afgedwongen in plaats van in een los vinkje.
 */
export const PRODUCT_TYPES = [
  "ppe",
  "no_ppe",
  "rigging",
  "machine",
  "clothing",
] as const;

/**
 * De keuzes voor een **vrij artikel** (`articles.product_id` leeg): de
 * catalogustypes plus `other`. Dit is de lijst achter de verplichte dropdown
 * bij vrije invoer (besluit Jos 2026-08-04: "bij vrije invoer moet er een
 * categorie gekozen worden, dropdown om fouten te voorkomen").
 *
 * Hangt een artikel wél aan een catalogusproduct, dan komt het type daarvandaan
 * en is deze lijst niet in beeld.
 */
export const ARTICLE_TYPES = [...PRODUCT_TYPES, "other"] as const;

/** Velden die een heel getal moeten zijn (of leeg). */
const INT_FIELDS = [
  "max_age_use_years",
  "max_age_mfr_years",
  "interval_override_months",
] as const satisfies readonly CatalogColumn[];

/** Velden die een getal met decimalen mogen zijn (of leeg). */
const NUMERIC_FIELDS = [
  "rope_diameter_min_mm",
  "rope_diameter_max_mm",
] as const satisfies readonly CatalogColumn[];

/** Velden die een link moeten bevatten (of leeg). */
const URL_FIELDS = [
  "manual_url",
  "product_page_url",
  "recall_url",
  "inspection_notice_url",
] as const satisfies readonly CatalogColumn[];

/**
 * 999 = bewust geen leeftijdsgrens (besluit Jos 2026-07-28: leeg leest als
 * "nog opzoeken", 999 als "bewust onbeperkt"). Zie `UNLIMITED_AGE_YEARS` in
 * nextDue.ts — daar zit de rekenkant, hier alleen de controlekant.
 */
const UNLIMITED_AGE = 999;

/**
 * EN-normen die per definitie een persoonlijk beschermingsmiddel betreffen:
 * ze gaan over iets dat een persoon draagt, of dat een persoon opvangt.
 *
 * Draagt een product zo'n norm, dan kán het geen `no_ppe` zijn. Die combinatie
 * is geen smaakkwestie maar een tegenspraak, en een stille: `no_ppe` staat niet
 * in `REGIMES`, dus `getRegime()` valt terug op 12 maanden — in NL toevallig
 * gelijk aan PBM, in GB fout, want daar moet PBM op 6.
 *
 * Aanleiding (Jos, 2026-08-04): hij zag dat de EDELRID TREEREX II als `no_ppe`
 * stond terwijl het een klimgordel is, en vroeg terecht wat er nog meer niet
 * klopte. Antwoord: 27 producten, allemaal gordels of touwklemmen van
 * Teufelberger, STEIN en EDELRID. Zonder deze regel was dat alleen met het oog
 * te vinden.
 *
 * Bewust niet in deze lijst: EN 795 (ankervoorzieningen) en EN 12278
 * (katrollen). Die zitten legitiem zowel bij PBM als bij rigging, dus daar zou
 * de regel vals alarm geven.
 */
const PPE_NORMEN: readonly (readonly [RegExp, string])[] = [
  [/\bEN\s?361\b/i, "EN 361 (harnasgordel)"],
  [/\bEN\s?358\b/i, "EN 358 (werkpositionering)"],
  [/\bEN\s?813\b/i, "EN 813 (zitgordel)"],
  [/\bEN\s?1497\b/i, "EN 1497 (reddingsgordel)"],
  [/\bEN\s?12277\b/i, "EN 12277 (klimgordel)"],
  [/\bEN\s?354\b/i, "EN 354 (vanglijn)"],
  [/\bEN\s?355\b/i, "EN 355 (valdemper)"],
  [/\bEN\s?360\b/i, "EN 360 (valstopapparaat)"],
  [/\bEN\s?353\b/i, "EN 353 (meelopende valbeveiliging)"],
  [/\bEN\s?341\b/i, "EN 341 (afdaalapparaat)"],
  [/\bEN\s?12841\b/i, "EN 12841 (touwtoegang)"],
  [/\bEN\s?567\b/i, "EN 567 (touwklem)"],
  [/\bEN\s?397\b/i, "EN 397 (industriehelm)"],
  [/\bEN\s?12492\b/i, "EN 12492 (bergsporthelm)"],
  [/\bEN\s?1891\b/i, "EN 1891 (semi-statisch touw)"],
  [/\bEN\s?892\b/i, "EN 892 (dynamisch touw)"],
  [/\bEN\s?566\b/i, "EN 566 (bandlus)"],
  [/\bEN\s?564\b/i, "EN 564 (hulptouw)"],
  [/\bEN\s?362\b/i, "EN 362 (verbindingselement)"],
  [/\bEN\s?12275\b/i, "EN 12275 (karabiner)"],
];

/** Welke PBM-normen noemt dit product? Leeg = geen. */
export function ppeNormenIn(standard: string): string[] {
  return PPE_NORMEN.filter(([re]) => re.test(standard)).map(([, naam]) => naam);
}

/**
 * Sleutel waarop "hetzelfde product" wordt herkend: merk + naam, zonder
 * hoofdletter- of spatieverschillen.
 *
 * Exact de regel van de unieke index `products_brand_name_uniq`
 * (migratie 20260749): `lower(btrim(brand)), lower(btrim(name))`. Wijkt deze
 * functie daarvan af, dan meldt de import "klaar" waar de database weigert.
 *
 * Het scheidingsteken is `\0`: dat kan in productdata niet voorkomen, dus
 * merk "AB" + naam "C" botst niet met merk "A" + naam "BC". De database
 * indexeert twee losse kolommen en heeft dat probleem niet; in JavaScript
 * plakken we ze aan elkaar en is een scheiding dus nodig.
 *
 * Bewust als escape geschreven en niet als losse byte in het bestand: stond
 * hier een echte NUL-byte, dan telt git het bestand als binair en haalt de
 * eerste de beste tekstbewerking hem er stilletjes uit — waarmee de
 * dubbelcheck ongemerkt van regel verandert.
 */
export function productKey(brand: string, name: string): string {
  return `${brand.trim().toLowerCase()}\0${name.trim().toLowerCase()}`;
}

export interface CatalogIssue {
  /** Rijnummer zoals in Excel: 1 = koprij, dus de eerste product staat op 2. */
  line: number;
  column?: CatalogColumn;
  message: string;
  /** Het product waar het om gaat, voor herkenbaarheid in de melding. */
  product: string;
}

export interface CatalogReport {
  /** Blokkerend: hiermee mag de lijst niet naar Gearonimo. */
  errors: CatalogIssue[];
  /** Niet blokkerend, wel het nakijken waard. */
  warnings: CatalogIssue[];
  rowCount: number;
  /** Aantal rijen met een `id` (worden bij import bijgewerkt). */
  withId: number;
  /** Aantal rijen zonder `id` (worden bij import toegevoegd). */
  withoutId: number;
}

function label(row: Partial<CatalogRow>): string {
  const brand = (row.brand ?? "").trim();
  const name = (row.name ?? "").trim();
  return [brand, name].filter(Boolean).join(" ") || "(naamloos)";
}

/**
 * Controleer de bronlijst op de fouten die in de praktijk data hebben gekost.
 *
 * Bewust streng op de dingen die stil misgaan (een producttype dat het regime
 * niet herkent, een getalveld met tekst erin dat bij import stil `null` wordt)
 * en bewust ruim op de dingen die legitiem rommelig zijn
 * (`max_user_weight_kg` mag "130-150" zijn — besluit 2026-07-27).
 */
export function validateCatalog(rows: Partial<CatalogRow>[]): CatalogReport {
  const errors: CatalogIssue[] = [];
  const warnings: CatalogIssue[] = [];
  const seen = new Map<string, number>();
  const seenIds = new Map<string, number>();
  let withId = 0;

  rows.forEach((row, i) => {
    const line = i + 2; // rij 1 is de koprij
    const product = label(row);
    const add = (
      list: CatalogIssue[],
      message: string,
      column?: CatalogColumn
    ) => list.push({ line, column, message, product });

    const brand = (row.brand ?? "").trim();
    const name = (row.name ?? "").trim();

    // --- Verplicht: zonder merk én naam is er geen product en geen sleutel ---
    if (!brand) add(errors, "merk ontbreekt", "brand");
    if (!name) add(errors, "omschrijving ontbreekt", "name");

    // --- Dubbelen: dezelfde regel als de unieke index in de database --------
    if (brand && name) {
      const key = productKey(brand, name);
      const first = seen.get(key);
      if (first !== undefined) {
        add(
          errors,
          `staat al op regel ${first} (merk + omschrijving zijn gelijk, afgezien van hoofdletters en spaties)`
        );
      } else {
        seen.set(key, line);
      }
    }

    // --- id: leeg = toevoegen, gevuld = bijwerken --------------------------
    const id = (row.id ?? "").trim();
    if (id) {
      withId++;
      const first = seenIds.get(id);
      if (first !== undefined) {
        add(errors, `dezelfde id staat ook op regel ${first}`, "id");
      } else {
        seenIds.set(id, line);
      }
    }

    // --- product_type is het regime ----------------------------------------
    const type = (row.product_type ?? "").trim();
    if (!type) {
      add(
        warnings,
        "geen producttype — het keurregime valt dan terug op 12 maanden, ook in GB waar PBM op 6 moet",
        "product_type"
      );
    } else if (!(PRODUCT_TYPES as readonly string[]).includes(type)) {
      add(
        errors,
        `"${type}" is geen producttype maar een categorie — toegestaan: ${PRODUCT_TYPES.join(", ")}. Zet de omschrijving in de kolom category`,
        "product_type"
      );
    }

    // --- Tegenspraak: no_ppe met een PBM-norm ------------------------------
    if (type === "no_ppe") {
      const normen = ppeNormenIn(row.standard ?? "");
      if (normen.length > 0) {
        add(
          errors,
          `staat als no_ppe maar draagt ${normen.join(" + ")} — dat is per definitie een persoonlijk beschermingsmiddel. Het keurregime valt nu terug op 12 maanden, ook in GB waar PBM op 6 moet`,
          "product_type"
        );
      }
    }

    // --- Getalvelden: stil `null` worden is hoe data verdwijnt -------------
    for (const field of INT_FIELDS) {
      const raw = (row[field] ?? "").trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        add(errors, `"${raw}" is geen getal`, field);
      } else if (!Number.isInteger(n)) {
        add(errors, `"${raw}" moet een heel getal zijn`, field);
      } else if (n < 0) {
        add(errors, `"${raw}" kan niet negatief zijn`, field);
      }
    }

    for (const field of NUMERIC_FIELDS) {
      const raw = (row[field] ?? "").trim();
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        add(errors, `"${raw}" is geen getal`, field);
      } else if (n <= 0) {
        add(errors, `"${raw}" moet groter dan 0 zijn`, field);
      }
    }

    // Let op de lege-tekst-val: `Number("")` is 0, niet NaN. Zonder de check
    // op een lege cel geldt een product met alleen een minimum (12 mm) als
    // "minimum groter dan maximum", omdat het lege maximum als 0 telt.
    const minRaw = (row.rope_diameter_min_mm ?? "").trim();
    const maxRaw = (row.rope_diameter_max_mm ?? "").trim();
    const min = Number(minRaw);
    const max = Number(maxRaw);
    if (minRaw && maxRaw && Number.isFinite(min) && Number.isFinite(max) && min > max) {
      add(
        errors,
        `minimale touwdiameter (${min}) is groter dan de maximale (${max})`,
        "rope_diameter_min_mm"
      );
    }

    // --- Levensduur: 999 is de afgesproken code voor onbeperkt -------------
    for (const field of ["max_age_use_years", "max_age_mfr_years"] as const) {
      const n = Number((row[field] ?? "").trim());
      if (Number.isFinite(n) && n > 100 && n !== UNLIMITED_AGE) {
        add(
          warnings,
          `${n} jaar is ongebruikelijk — bedoel je ${UNLIMITED_AGE} (onbeperkte levensduur)?`,
          field
        );
      }
    }

    // --- Links -------------------------------------------------------------
    for (const field of URL_FIELDS) {
      const raw = (row[field] ?? "").trim();
      if (!raw) continue;
      if (!/^https?:\/\/\S+$/i.test(raw)) {
        add(warnings, `"${raw}" ziet er niet uit als een link`, field);
      }
    }

    // --- Bewuste uitzondering, geen bulkdata -------------------------------
    if ((row.interval_override_months ?? "").trim()) {
      add(
        warnings,
        "interval_override_months ingevuld — dit hoort een bewuste uitzondering per product te zijn, niet iets uit een bronlijst (besluit 2026-07-27)",
        "interval_override_months"
      );
    }
  });

  return {
    errors,
    warnings,
    rowCount: rows.length,
    withId,
    withoutId: rows.length - withId,
  };
}
