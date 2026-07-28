import { describe, it, expect } from "vitest";
import { calcNextDue, isUnlimitedAge, UNLIMITED_AGE_YEARS } from "./nextDue";

describe("calcNextDue", () => {
  it("uses regime interval when no overrides", () => {
    const result = calcNextDue({
      inspection_date: new Date("2026-01-01"),
      country_code: "NL",
      product_type: "ppe",
    });
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0); // January
  });

  it("uses article override over regime", () => {
    const result = calcNextDue({
      inspection_date: new Date("2026-01-01"),
      country_code: "NL",
      product_type: "ppe",
      article_interval_override_months: 6,
    });
    expect(result.getMonth()).toBe(6); // July
  });

  it("caps at end of life from manufacture year", () => {
    const result = calcNextDue({
      inspection_date: new Date("2026-01-01"),
      country_code: "NL",
      product_type: "ppe",
      manufacture_year: 2016,
      max_age_mfr_years: 10,
    });
    // eol = 2026-01, next_due would be 2027-01 → capped at 2026-01
    expect(result <= new Date("2026-06-01")).toBe(true);
  });

  it("clamps month-end instead of overflowing (31 Jan + 6 mo = 31 Jul, 31 Aug + 6 mo = 28 Feb)", () => {
    // Voor de fix werd 31 aug + 6 maanden "3 maart" (setMonth-overloop).
    const a = calcNextDue({
      inspection_date: new Date(2026, 7, 31), // 31 aug 2026, lokale tijd
      country_code: "NL",
      product_type: "ppe",
      article_interval_override_months: 6,
    });
    expect([a.getFullYear(), a.getMonth(), a.getDate()]).toEqual([2027, 1, 28]); // 28 feb 2027

    const b = calcNextDue({
      inspection_date: new Date(2026, 0, 31), // 31 jan 2026
      country_code: "NL",
      product_type: "ppe",
      article_interval_override_months: 6,
    });
    expect([b.getFullYear(), b.getMonth(), b.getDate()]).toEqual([2026, 6, 31]); // 31 jul 2026
  });

  it("999 jaar = onbeperkt: geen afkeurdatum op leeftijd", () => {
    // Bronlijst zet UNL bij metaalwerk; dat wordt 999 zodat het zichtbaar
    // ingevuld is. Dat mag de keurtermijn niet aftoppen (en al helemaal geen
    // afkeurdatum in het jaar 3025 opleveren).
    const d = calcNextDue({
      inspection_date: new Date(2026, 0, 15),
      country_code: "NL",
      product_type: "ppe",
      manufacture_year: 2020,
      max_age_mfr_years: UNLIMITED_AGE_YEARS,
      first_use_date: new Date(2020, 0, 1),
      max_age_use_years: UNLIMITED_AGE_YEARS,
    });
    // Gewone jaarlijkse termijn, niet afgetopt en niet opgerekt.
    expect([d.getFullYear(), d.getMonth()]).toEqual([2027, 0]);
    expect(isUnlimitedAge(999)).toBe(true);
    expect(isUnlimitedAge(10)).toBe(false);
    expect(isUnlimitedAge(null)).toBe(false);
  });
});
