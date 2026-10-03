import { describe, expect, it } from "vitest";
import { formatDate, monthName } from "./date";

// Datumnorm per land (Jos, 2026-10-02): "en" mag nooit de Amerikaanse
// volgorde (maand eerst) opleveren.
describe("formatDate", () => {
  const d = "2027-04-02";
  it("Engels = Britse norm, dag eerst", () => {
    expect(formatDate(d, "en")).toBe("2 April 2027");
    expect(formatDate(d, "en", { day: "2-digit", month: "2-digit", year: "numeric" })).toBe("02/04/2027");
  });
  it("Nederlands, Duits en Frans", () => {
    expect(formatDate(d, "nl")).toBe("2 april 2027");
    expect(formatDate(d, "de")).toBe("2. April 2027");
    expect(formatDate(d, "fr")).toBe("2 avril 2027");
  });
  it("een code mét regio blijft staan", () => {
    expect(formatDate(d, "en-GB")).toBe("2 April 2027");
  });
});

describe("monthName", () => {
  it("in de app-taal, nooit vast Nederlands", () => {
    expect([3, 5, 10].map((m) => monthName(m, "en"))).toEqual(["Mar", "May", "Oct"]);
    expect([3, 5, 10].map((m) => monthName(m, "nl"))).toEqual(["mrt", "mei", "okt"]);
    expect(monthName(3, "en", "long")).toBe("March");
  });
});
