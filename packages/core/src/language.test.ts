import { describe, expect, it } from "vitest";
import { languageForCountry } from "./language";

describe("languageForCountry", () => {
  it("volgt het land van het keurbedrijf", () => {
    expect(languageForCountry("NL")).toBe("nl");
    expect(languageForCountry("BE")).toBe("nl");
    expect(languageForCountry("FR")).toBe("fr");
    expect(languageForCountry("AT")).toBe("de");
    expect(languageForCountry("GB")).toBe("en");
    expect(languageForCountry("IE")).toBe("en");
  });
  it("geen land = Nederlands (oude bedrijven)", () => {
    expect(languageForCountry(null)).toBe("nl");
    expect(languageForCountry(undefined)).toBe("nl");
  });
});
