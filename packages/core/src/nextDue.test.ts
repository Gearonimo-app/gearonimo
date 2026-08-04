import { describe, it, expect } from "vitest";
import { calcNextDue, isUnlimitedAge, UNLIMITED_AGE_YEARS } from "./nextDue";

/**
 * `calcNextDue` geeft sinds 2026-08-04 `Date | null` terug (null = dit type
 * wordt niet gekeurd). De bestaande tests gaan allemaal over types die wél
 * gekeurd worden; dit helpertje houdt ze leesbaar zonder overal `!` te zetten.
 */
function due(result: Date | null): Date {
  expect(result).not.toBeNull();
  return result as Date;
}

describe("calcNextDue", () => {
  it("uses regime interval when no overrides", () => {
    const result = due(
      calcNextDue({
        inspection_date: new Date("2026-01-01"),
        country_code: "NL",
        product_type: "ppe",
      })
    );
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0); // January
  });

  it("uses article override over regime", () => {
    const result = due(
      calcNextDue({
        inspection_date: new Date("2026-01-01"),
        country_code: "NL",
        product_type: "ppe",
        article_interval_override_months: 6,
      })
    );
    expect(result.getMonth()).toBe(6); // July
  });

  it("caps at end of life from manufacture year", () => {
    const result = due(
      calcNextDue({
        inspection_date: new Date("2026-01-01"),
        country_code: "NL",
        product_type: "ppe",
        manufacture_year: 2016,
        max_age_mfr_years: 10,
      })
    );
    // eol = 2026-01, next_due would be 2027-01 → capped at 2026-01
    expect(result <= new Date("2026-06-01")).toBe(true);
  });

  it("clamps month-end instead of overflowing (31 Jan + 6 mo = 31 Jul, 31 Aug + 6 mo = 28 Feb)", () => {
    // Voor de fix werd 31 aug + 6 maanden "3 maart" (setMonth-overloop).
    const a = due(
      calcNextDue({
        inspection_date: new Date(2026, 7, 31), // 31 aug 2026, lokale tijd
        country_code: "NL",
        product_type: "ppe",
        article_interval_override_months: 6,
      })
    );
    expect([a.getFullYear(), a.getMonth(), a.getDate()]).toEqual([2027, 1, 28]); // 28 feb 2027

    const b = due(
      calcNextDue({
        inspection_date: new Date(2026, 0, 31), // 31 jan 2026
        country_code: "NL",
        product_type: "ppe",
        article_interval_override_months: 6,
      })
    );
    expect([b.getFullYear(), b.getMonth(), b.getDate()]).toEqual([2026, 6, 31]); // 31 jul 2026
  });

  it("999 jaar = onbeperkt: geen afkeurdatum op leeftijd", () => {
    // Bronlijst zet UNL bij metaalwerk; dat wordt 999 zodat het zichtbaar
    // ingevuld is. Dat mag de keurtermijn niet aftoppen (en al helemaal geen
    // afkeurdatum in het jaar 3025 opleveren).
    const d = due(
      calcNextDue({
        inspection_date: new Date(2026, 0, 15),
        country_code: "NL",
        product_type: "ppe",
        manufacture_year: 2020,
        max_age_mfr_years: UNLIMITED_AGE_YEARS,
        first_use_date: new Date(2020, 0, 1),
        max_age_use_years: UNLIMITED_AGE_YEARS,
      })
    );
    // Gewone jaarlijkse termijn, niet afgetopt en niet opgerekt.
    expect([d.getFullYear(), d.getMonth()]).toEqual([2027, 0]);
    expect(isUnlimitedAge(999)).toBe(true);
    expect(isUnlimitedAge(10)).toBe(false);
    expect(isUnlimitedAge(null)).toBe(false);
  });

  // ─── Types zonder keurtermijn (besluit Jos 2026-08-04) ────────────────────

  it.each(["clothing", "no_ppe", "other"] as const)(
    "%s krijgt geen volgende keuring",
    (product_type) => {
      expect(
        calcNextDue({
          inspection_date: new Date(2026, 0, 1),
          country_code: "NL",
          product_type,
        })
      ).toBeNull();
    }
  );

  it("kleding met een maximale gebruiksduur krijgt nog steeds geen keurdatum", () => {
    // De levensduur-caps mogen niet stiekem tóch een datum opleveren voor iets
    // dat helemaal niet gekeurd wordt.
    expect(
      calcNextDue({
        inspection_date: new Date(2026, 0, 1),
        country_code: "NL",
        product_type: "clothing",
        manufacture_year: 2020,
        max_age_mfr_years: 5,
        first_use_date: new Date(2021, 0, 1),
        max_age_use_years: 3,
      })
    ).toBeNull();
  });

  it("een expliciete override wint wel van 'nooit keuren'", () => {
    // Stein schrijft voor sommige afdaalapparaten zelf 6 maanden voor; wie dat
    // op het product of het artikel zet, moet die termijn ook krijgen.
    const d = due(
      calcNextDue({
        inspection_date: new Date(2026, 0, 1),
        country_code: "NL",
        product_type: "no_ppe",
        product_interval_override_months: 6,
      })
    );
    expect([d.getFullYear(), d.getMonth()]).toEqual([2026, 6]); // juli 2026
  });

  it("GB: PBM op 6 maanden, rigging op 12", () => {
    // Rigging/GB stond tot 2026-08-04 op 6 (LOLER-lezing). Britse praktijk in
    // de boomverzorging is 12 — zie de toelichting in regimes.ts.
    const ppe = due(
      calcNextDue({
        inspection_date: new Date(2026, 0, 1),
        country_code: "GB",
        product_type: "ppe",
      })
    );
    expect([ppe.getFullYear(), ppe.getMonth()]).toEqual([2026, 6]); // juli 2026

    const rigging = due(
      calcNextDue({
        inspection_date: new Date(2026, 0, 1),
        country_code: "GB",
        product_type: "rigging",
      })
    );
    expect([rigging.getFullYear(), rigging.getMonth()]).toEqual([2027, 0]); // jan 2027
  });
});
