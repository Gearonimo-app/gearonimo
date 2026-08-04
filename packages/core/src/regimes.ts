/**
 * Inspection regimes: interval in months per product type × country.
 *
 * Twee soorten uitkomst (besluit Jos 2026-08-04):
 *   - een getal  → dit type wordt periodiek gekeurd door een keurbedrijf
 *   - `null`     → dit type wordt níét gekeurd (kleding, geen-PBM, overig)
 *
 * `null` is bewust iets anders dan "0 maanden". Nul zou via `addMonths()`
 * betekenen dat de volgende keuring vandaag is — dus meteen rood. "Nooit
 * keuren" is de afwezigheid van een termijn, geen termijn van niks.
 */
export type ProductType =
  | "ppe"
  | "no_ppe"
  | "rigging"
  | "machine"
  | "clothing"
  | "other";

export type CountryCode = "NL" | "GB";

export interface Regime {
  product_type: ProductType;
  country_code: CountryCode;
  interval_months: number;
  severe_use_interval_months?: number;
}

/**
 * Types zonder keurtermijn (besluit Jos 2026-08-04).
 *
 * - `no_ppe`   — klimsporen, voetklemmen, elastiek om een zaag aan te hangen.
 *                Worden in de praktijk vaak meegekeurd, maar dat is nergens
 *                verplicht. Wie het tóch periodiek wil keuren, zet een
 *                `interval_override_months` op het product of het artikel.
 * - `clothing` — geen enkele fabrikant beschrijft hoe je een zaagbroek keurt,
 *                ook al ís het formeel een PBM. Kleding zit in Gearonimo om
 *                bij te houden wie wat wanneer kreeg, niet om te keuren.
 * - `other`    — de eigen todo-lijst van de klant (brandblusser, EHBO-koffer,
 *                APK). Geen keurbedrijf-regime; de klant vinkt zelf af en
 *                krijgt na 12 maanden een herinnering. Die herinnering hoort
 *                bij de klant-app (`self_checks`), niet hier.
 *
 * Let op de asymmetrie met de fallback in `getRegime()`: een type dat hier
 * NIET in staat en ook geen REGIMES-regel heeft, krijgt 12 maanden. Onbekend
 * betekent dus "voor de zekerheid keuren", nooit "voor de zekerheid nooit
 * keuren" — een typefout mag geen materiaal buiten de keuring laten vallen.
 */
export const NO_INSPECTION_TYPES: readonly ProductType[] = [
  "no_ppe",
  "clothing",
  "other",
];

/**
 * `aerial_platform` is hier weg (besluit Jos 2026-08-04): hoogwerkers zijn een
 * andere doelgroep dan de boom-/klimwereld waar Gearonimo voor is. Er stond
 * geen enkel product in de catalogus op dat type, dus er is niets omgezet.
 *
 * `legal_reference` is weg (besluit Jos 2026-08-04). Het veld stond hier als
 * data en `getLegalReference()` werd in de hele codebase nooit aangeroepen —
 * er heeft dus nooit een wettelijke basis op een certificaat gestaan, ondanks
 * wat DATAMODEL §certificates beweerde. Welke norm een keurbedrijf claimt is
 * aan dat keurbedrijf; daar is de voettekst per bedrijf
 * (`inspection_companies.cert_footer`) voor. Weggehaald in plaats van laten
 * staan, zelfde lijn als `max_age_years` in 2026-07-09: dode velden laten
 * liggen is hoe de catalogus van KlimKeur Pro is volgelopen.
 */
export const REGIMES: Regime[] = [
  {
    product_type: "ppe",
    country_code: "NL",
    interval_months: 12,
  },
  {
    product_type: "ppe",
    country_code: "GB",
    interval_months: 6,
    severe_use_interval_months: 3,
  },
  {
    product_type: "rigging",
    country_code: "NL",
    interval_months: 12,
  },
  {
    // GB/rigging stond tot 2026-08-04 op 6 maanden, geredeneerd vanuit LOLER
    // 1998: "lifting accessories" (stroppen, harpen, blokken) moeten daar elke
    // 6 maanden gekeurd worden. Jos heeft het nagevraagd bij een Britse
    // keurmeester: in de boomverzorging is de praktijk 6 maanden voor PBM en
    // 12 voor rigging. De verklaring is dat rigging daar gebruikt wordt om
    // takken te laten zákken, niet om te hijsen — daarmee is het geen
    // hijsoperatie in de zin van LOLER.
    product_type: "rigging",
    country_code: "GB",
    interval_months: 12,
  },
  {
    product_type: "machine",
    country_code: "NL",
    interval_months: 12,
  },
  {
    product_type: "machine",
    country_code: "GB",
    interval_months: 12,
  },
];

/**
 * Keurtermijn in maanden, of `null` als dit type niet gekeurd wordt.
 *
 * Een onbekend type valt terug op 12 maanden — bewust de strenge kant op,
 * zie de toelichting bij `NO_INSPECTION_TYPES`.
 */
export function getRegime(
  product_type: ProductType,
  country_code: CountryCode,
  severe_use = false
): number | null {
  if (NO_INSPECTION_TYPES.includes(product_type)) return null;

  const regime = REGIMES.find(
    (r) => r.product_type === product_type && r.country_code === country_code
  );
  if (!regime) return 12; // safe fallback
  if (severe_use && regime.severe_use_interval_months) {
    return regime.severe_use_interval_months;
  }
  return regime.interval_months;
}

/** Wordt dit type überhaupt door een keurbedrijf gekeurd? */
export function isInspectedType(product_type: ProductType): boolean {
  return !NO_INSPECTION_TYPES.includes(product_type);
}
