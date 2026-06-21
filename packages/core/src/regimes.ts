/**
 * Inspection regimes: interval in months per product type × country.
 * Add a new row to support a new country or product type.
 */
export type ProductType =
  | "ppe"
  | "rigging"
  | "aerial_platform"
  | "machine"
  | "other";

export type CountryCode = "NL" | "GB";

export interface Regime {
  product_type: ProductType;
  country_code: CountryCode;
  interval_months: number;
  severe_use_interval_months?: number;
  legal_reference: string;
}

export const REGIMES: Regime[] = [
  {
    product_type: "ppe",
    country_code: "NL",
    interval_months: 12,
    legal_reference: "Arbobesluit art. 7.4a",
  },
  {
    product_type: "ppe",
    country_code: "GB",
    interval_months: 6,
    severe_use_interval_months: 3,
    legal_reference: "LOLER 1998 / PUWER 1998",
  },
  {
    product_type: "rigging",
    country_code: "NL",
    interval_months: 12,
    legal_reference: "Arbobesluit art. 7.4a",
  },
  {
    product_type: "rigging",
    country_code: "GB",
    interval_months: 6,
    legal_reference: "LOLER 1998",
  },
  {
    product_type: "machine",
    country_code: "NL",
    interval_months: 12,
    legal_reference: "NEN 3140",
  },
  {
    product_type: "machine",
    country_code: "GB",
    interval_months: 12,
    legal_reference: "PUWER 1998",
  },
  {
    product_type: "aerial_platform",
    country_code: "NL",
    interval_months: 12,
    legal_reference: "Arbobesluit / TCVT",
  },
  {
    product_type: "aerial_platform",
    country_code: "GB",
    interval_months: 6,
    legal_reference: "LOLER 1998",
  },
];

export function getRegime(
  product_type: ProductType,
  country_code: CountryCode,
  severe_use = false
): number {
  const regime = REGIMES.find(
    (r) => r.product_type === product_type && r.country_code === country_code
  );
  if (!regime) return 12; // safe fallback
  if (severe_use && regime.severe_use_interval_months) {
    return regime.severe_use_interval_months;
  }
  return regime.interval_months;
}
