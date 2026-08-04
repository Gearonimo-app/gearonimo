/**
 * Calculate the next inspection due date for an article.
 *
 * Resolution order (earliest wins):
 *   1. article-level interval override
 *   2. product-level interval override
 *   3. regime (product_type × country)
 *
 * Also caps at end-of-life:
 *   - manufacture_year + max_age_mfr_years
 *   - first_use_date  + max_age_use_years
 *
 * Geeft `null` terug als er geen keurtermijn is (kleding, geen-PBM, overig —
 * zie `NO_INSPECTION_TYPES` in `regimes.ts`). Zo'n artikel heeft geen volgende
 * keuring en krijgt dus ook geen stoplichtstatus.
 */

import { getRegime, ProductType, CountryCode } from "./regimes";

export interface NextDueInput {
  inspection_date: Date;
  country_code: CountryCode;
  product_type: ProductType;
  severe_use?: boolean;
  // overrides (months) — article beats product beats regime
  article_interval_override_months?: number | null;
  product_interval_override_months?: number | null;
  // end-of-life
  manufacture_year?: number | null;
  manufacture_month?: number | null;
  max_age_mfr_years?: number | null;
  first_use_date?: Date | null;
  max_age_use_years?: number | null;
}

/**
 * Waarde waarmee "onbeperkte levensduur" in de catalogus wordt vastgelegd.
 *
 * Besluit Jos 2026-07-28: de bronlijst zet `UNL` bij metaalwerk zonder
 * leeftijdsgrens. Dat leeg laten zou kloppen (geen grens = geen afkeurdatum),
 * maar leeg is niet te onderscheiden van "nog opzoeken". Daarom 999: zichtbaar
 * ingevuld, en door `isUnlimitedAge` behandeld als géén grens.
 */
export const UNLIMITED_AGE_YEARS = 999;

/**
 * Geldt hier "geen leeftijdsgrens"? Ruim genomen (≥ 900), zodat een 9999 of
 * 998 dat iemand intypt niet stilletjes een afkeurdatum in het jaar 3025
 * oplevert.
 */
export function isUnlimitedAge(years?: number | null): boolean {
  return years != null && years >= 900;
}

export function addMonths(date: Date, months: number): Date {
  // Code review 2026-07-18, punt 10: setMonth() loopt over bij maandeindes
  // (31 jan + 1 maand werd 3 maart, 31 aug + 6 maanden werd 3 maart). Voor
  // een keurtermijn moet dat de LAATSTE dag van de doelmaand worden (28 feb),
  // nooit doorschieten naar de maand erna. Daarom: eerst naar dag 1, maanden
  // optellen, dan de dag vastklemmen op wat de doelmaand aankan.
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const daysInTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, daysInTargetMonth));
  return d;
}

export function calcNextDue(input: NextDueInput): Date | null {
  const {
    inspection_date,
    country_code,
    product_type,
    severe_use = false,
    article_interval_override_months,
    product_interval_override_months,
    manufacture_year,
    manufacture_month,
    max_age_mfr_years,
    first_use_date,
    max_age_use_years,
  } = input;

  // 1. Determine interval. `null` uit getRegime = dit type wordt niet gekeurd
  // (kleding, geen-PBM, overig). Een expliciete override op artikel of product
  // wint daar wél van: dat is iemand die bewust zegt "dit ding wil ik tóch elke
  // X maanden zien" — bijvoorbeeld de Stein-afdaalapparaten waar de fabrikant
  // zelf 6 maanden voorschrijft.
  const interval_months =
    article_interval_override_months ??
    product_interval_override_months ??
    getRegime(product_type, country_code, severe_use);

  // 2. Geen termijn = geen volgende keuring. Bewust vóór de levensduur-caps:
  // een zaagbroek die niet gekeurd wordt, krijgt ook geen keurdatum omdat hij
  // toevallig een maximale gebruiksduur heeft staan.
  if (interval_months == null) return null;

  // 3. Next due from inspection date
  let next_due = addMonths(inspection_date, interval_months);

  // 4. Cap: manufacture date + max age from manufacturer
  if (manufacture_year != null && max_age_mfr_years != null && !isUnlimitedAge(max_age_mfr_years)) {
    const mfr_month = manufacture_month ?? 1;
    const eol_mfr = new Date(
      manufacture_year + max_age_mfr_years,
      mfr_month - 1,
      1
    );
    if (eol_mfr < next_due) next_due = eol_mfr;
  }

  // 5. Cap: first use date + max age from first use
  if (first_use_date != null && max_age_use_years != null && !isUnlimitedAge(max_age_use_years)) {
    const eol_use = addMonths(first_use_date, max_age_use_years * 12);
    if (eol_use < next_due) next_due = eol_use;
  }

  return next_due;
}
