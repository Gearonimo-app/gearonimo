import { describe, it, expect } from "vitest";
import {
  MATERIAL_DOMAINS,
  DOMAIN_PRODUCT_TYPES,
  domainForType,
  normalizeDomains,
  domainHasInspections,
  typeIsInspected,
  typeIsSelfManaged,
  inspectorVisibleArticles,
} from "./domains";
import { PRODUCT_TYPES, ARTICLE_TYPES } from "./catalog";

describe("domainForType", () => {
  it.each([
    ["ppe", "climbing"],
    ["no_ppe", "climbing"],
    ["rigging", "climbing"],
    ["machine", "machines"],
    ["clothing", "clothing"],
    ["other", "other"],
  ] as const)("%s → %s", (type, domain) => {
    expect(domainForType(type)).toBe(domain);
  });

  it("leeg of onbekend telt als klimmateriaal", () => {
    // Vrije artikelen van vóór 2026-08-04 hebben geen type; alles wat er toen
    // stond was klimmateriaal. Zelfde afspraak als domain_for_type() in SQL.
    expect(domainForType(null)).toBe("climbing");
    expect(domainForType(undefined)).toBe("climbing");
    expect(domainForType("")).toBe("climbing");
    expect(domainForType("   ")).toBe("climbing");
    expect(domainForType("aerial_platform")).toBe("climbing");
  });
});

describe("de indeling dekt alles", () => {
  it("elk artikeltype zit in precies één tegel", () => {
    for (const type of ARTICLE_TYPES) {
      const hits = MATERIAL_DOMAINS.filter((d) =>
        DOMAIN_PRODUCT_TYPES[d].includes(type)
      );
      expect(hits, `${type} hoort in precies één tegel`).toHaveLength(1);
    }
  });

  it("elke tegel bevat alleen bestaande types", () => {
    for (const domain of MATERIAL_DOMAINS) {
      for (const type of DOMAIN_PRODUCT_TYPES[domain]) {
        expect(ARTICLE_TYPES as readonly string[]).toContain(type);
      }
    }
  });

  it("catalogustypes zijn de artikeltypes minus 'other'", () => {
    // "Overig" is de eigen todo-lijst van de klant en mag nooit uit de
    // catalogus komen (besluit Jos 2026-08-04).
    expect([...ARTICLE_TYPES].filter((t) => t !== "other")).toEqual([
      ...PRODUCT_TYPES,
    ]);
    expect(PRODUCT_TYPES as readonly string[]).not.toContain("other");
  });
});

describe("normalizeDomains", () => {
  it("klimmateriaal staat er altijd bij", () => {
    expect(normalizeDomains([])).toEqual(["climbing"]);
    expect(normalizeDomains(null)).toEqual(["climbing"]);
    expect(normalizeDomains(["clothing"])).toEqual(["climbing", "clothing"]);
  });

  it("gooit onbekende waarden weg en ontdubbelt", () => {
    expect(normalizeDomains(["clothing", "clothing", "zwembad"])).toEqual([
      "climbing",
      "clothing",
    ]);
  });

  it("houdt een vaste volgorde aan, niet die van de invoer", () => {
    expect(normalizeDomains(["other", "machines", "climbing"])).toEqual([
      "climbing",
      "machines",
      "other",
    ]);
  });
});

describe("buiten het keurbedrijf", () => {
  it.each(["clothing", "machine", "other"] as const)(
    "%s valt buiten het keurbedrijf",
    (t) => {
      expect(typeIsSelfManaged(t)).toBe(true);
    }
  );

  it("no_ppe blijft zichtbaar voor de keurmeester", () => {
    // Klimsporen en voetklemmen worden in de praktijk vaak meegekeurd, ook al
    // is er geen keurplicht. Ze mogen dus niet uit de keurmeester-app vallen.
    expect(typeIsSelfManaged("no_ppe")).toBe(false);
    expect(typeIsInspected("no_ppe")).toBe(false);
  });

  it.each(["ppe", "rigging"] as const)("%s blijft gewoon keurwerk", (t) => {
    expect(typeIsSelfManaged(t)).toBe(false);
  });

  it("leeg telt als ppe, dus niet self managed", () => {
    expect(typeIsSelfManaged(null)).toBe(false);
    expect(typeIsSelfManaged("")).toBe(false);
  });

  it("inspectorVisibleArticles zet precies één filter en geeft de query terug", () => {
    const calls: [string, unknown][] = [];
    const fake = {
      eq(column: string, value: unknown) {
        calls.push([column, value]);
        return this;
      },
    };
    expect(inspectorVisibleArticles(fake)).toBe(fake);
    expect(calls).toEqual([["self_managed", false]]);
  });
});

describe("keuring per tegel", () => {
  it("alleen klimmateriaal en machines worden gekeurd", () => {
    expect(domainHasInspections("climbing")).toBe(true);
    expect(domainHasInspections("machines")).toBe(true);
    expect(domainHasInspections("clothing")).toBe(false);
    expect(domainHasInspections("other")).toBe(false);
  });

  it("typeIsInspected: leeg telt als ppe, dus wél gekeurd", () => {
    expect(typeIsInspected("ppe")).toBe(true);
    expect(typeIsInspected("rigging")).toBe(true);
    expect(typeIsInspected("machine")).toBe(true);
    expect(typeIsInspected("no_ppe")).toBe(false);
    expect(typeIsInspected("clothing")).toBe(false);
    expect(typeIsInspected("other")).toBe(false);
    expect(typeIsInspected(null)).toBe(true);
    expect(typeIsInspected("")).toBe(true);
  });
});
