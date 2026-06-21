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

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function calcNextDue(input: NextDueInput): Date {
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

  // 1. Determine interval
  const interval_months =
    article_interval_override_months ??
    product_interval_override_months ??
    getRegime(product_type, country_code, severe_use);

  // 2. Next due from inspection date
  let next_due = addMonths(inspection_date, interval_months);

  // 3. Cap: manufacture date + max age from manufacturer
  if (manufacture_year != null && max_age_mfr_years != null) {
    const mfr_month = manufacture_month ?? 1;
    const eol_mfr = new Date(
      manufacture_year + max_age_mfr_years,
      mfr_month - 1,
      1
    );
    if (eol_mfr < next_due) next_due = eol_mfr;
  }

  // 4. Cap: first use date + max age from first use
  if (first_use_date != null && max_age_use_years != null) {
    const eol_use = addMonths(first_use_date, max_age_use_years * 12);
    if (eol_use < next_due) next_due = eol_use;
  }

  return next_due;
}
