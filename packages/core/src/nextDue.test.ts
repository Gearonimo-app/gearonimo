import { describe, it, expect } from "vitest";
import { calcNextDue } from "./nextDue";

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
});
