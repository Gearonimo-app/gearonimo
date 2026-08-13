import { describe, it, expect } from "vitest";
import {
  productKey,
  validateCatalog,
  CATALOG_COLUMNS,
  PRODUCT_TYPES,
  type CatalogRow,
} from "./catalog";

/** Een geldige rij, waar elke test alleen het interessante veld van wijzigt. */
function row(overrides: Partial<CatalogRow> = {}): Partial<CatalogRow> {
  return {
    id: "",
    brand: "Petzl",
    name: "Avao Bod",
    product_type: "ppe",
    ...overrides,
  };
}

describe("productKey", () => {
  it("negeert hoofdletters en spaties, net als de unieke index", () => {
    expect(productKey("  Petzl ", "AVAO BOD")).toBe(
      productKey("petzl", "avao bod")
    );
  });

  it("houdt merk en naam gescheiden", () => {
    // Zonder scheidingsteken zouden deze twee dezelfde sleutel krijgen,
    // terwijl de database ze als twee verschillende producten ziet.
    expect(productKey("AB", "C")).not.toBe(productKey("A", "BC"));
  });

  it("bevat geen losse NUL-byte in de bron maar wel in de uitkomst", () => {
    expect(productKey("a", "b")).toContain("\0");
  });
});

describe("validateCatalog", () => {
  it("keurt een schone lijst goed", () => {
    const report = validateCatalog([row(), row({ name: "Croll L" })]);
    expect(report.errors).toEqual([]);
    expect(report.rowCount).toBe(2);
  });

  it("wijst dubbelen aan met het regelnummer van de eerste", () => {
    const report = validateCatalog([row(), row({ brand: " PETZL " })]);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].line).toBe(3);
    expect(report.errors[0].message).toContain("regel 2");
  });

  it("eist merk en omschrijving", () => {
    const report = validateCatalog([row({ brand: "", name: "" })]);
    expect(report.errors.map((e) => e.column)).toEqual(["brand", "name"]);
  });

  it("weigert een categorie in het producttype-veld", () => {
    // Dit is de stille GB-bug: een onbekende waarde valt terug op 12 maanden,
    // terwijl PBM daar op 6 moet.
    const report = validateCatalog([
      row({ product_type: "Locking Carabiner (Screw-Lock)" }),
    ]);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].column).toBe("product_type");
    expect(report.errors[0].message).toContain("category");
  });

  it("staat elk producttype uit de lijst toe", () => {
    const rows = PRODUCT_TYPES.map((t, i) =>
      row({ product_type: t, name: `Product ${i}` })
    );
    expect(validateCatalog(rows).errors).toEqual([]);
  });

  it("waarschuwt bij een leeg producttype", () => {
    const report = validateCatalog([row({ product_type: "" })]);
    expect(report.errors).toEqual([]);
    expect(report.warnings[0].column).toBe("product_type");
  });

  it("weigert tekst in een getalveld in plaats van het stil te laten verdwijnen", () => {
    // Bij import wordt hier `null` van gemaakt zonder melding; dat is precies
    // hoe ingevulde data ongemerkt weglekt.
    const report = validateCatalog([row({ max_age_use_years: "tien" })]);
    expect(report.errors[0].column).toBe("max_age_use_years");
  });

  it("weigert een gebroken getal waar een heel getal hoort", () => {
    const report = validateCatalog([row({ max_age_mfr_years: "10,5" })]);
    expect(report.errors).toHaveLength(1);
  });

  it("laat max_user_weight_kg bewust vrij", () => {
    // Besluit 2026-07-27: '130-150' en '100 (bij EN 12841/B)' zijn geldig.
    const report = validateCatalog([
      row({ max_user_weight_kg: "100 (bij EN 12841/B, 10.5-13mm touw)" }),
    ]);
    expect(report.errors).toEqual([]);
  });

  it("accepteert 999 als onbeperkte levensduur maar niet 150", () => {
    expect(validateCatalog([row({ max_age_use_years: "999" })]).warnings).toEqual(
      []
    );
    expect(
      validateCatalog([row({ max_age_use_years: "150" })]).warnings
    ).toHaveLength(1);
  });

  it("ziet een omgekeerd touwdiameterbereik", () => {
    const report = validateCatalog([
      row({ rope_diameter_min_mm: "13", rope_diameter_max_mm: "10.5" }),
    ]);
    expect(report.errors[0].message).toContain("groter dan de maximale");
  });

  it("valt niet over een minimum zonder maximum", () => {
    // `Number("")` is 0, niet NaN: zonder aparte check op de lege cel gold
    // EDELRID OMBILIX ADJUST (min 12, geen max) als omgekeerd bereik.
    const report = validateCatalog([row({ rope_diameter_min_mm: "12" })]);
    expect(report.errors).toEqual([]);
  });

  it("telt rijen met en zonder id, want dat bepaalt bijwerken of toevoegen", () => {
    const report = validateCatalog([
      row({ id: "abc" }),
      row({ name: "Croll L" }),
    ]);
    expect(report.withId).toBe(1);
    expect(report.withoutId).toBe(1);
  });

  it("weigert dezelfde id op twee regels", () => {
    const report = validateCatalog([
      row({ id: "abc" }),
      row({ id: "abc", name: "Croll L" }),
    ]);
    expect(report.errors[0].column).toBe("id");
  });

  it("waarschuwt bij een link die geen link is", () => {
    const report = validateCatalog([row({ manual_url: "zie website" })]);
    expect(report.warnings[0].column).toBe("manual_url");
  });

  it("houdt de kolomvolgorde van de Excel vast", () => {
    // De import leest op kolomnaam, maar de volgorde bepaalt hoe leesbaar de
    // Excel voor Jos is: id, merk en naam horen vooraan.
    expect(CATALOG_COLUMNS.slice(0, 3)).toEqual(["id", "brand", "name"]);
  });
});

describe("no_ppe met een PBM-norm", () => {
  // Melding Jos 2026-08-04: hij zag dat de EDELRID TREEREX II als no_ppe stond
  // terwijl het een klimgordel is, en vroeg wat er nog meer niet klopte. Het
  // bleken er 27. Deze regel maakt die combinatie voortaan onmogelijk.
  it("weigert een gordel die als no_ppe staat", () => {
    const report = validateCatalog([
      row({
        brand: "EDELRID",
        name: "TREEREX II",
        product_type: "no_ppe",
        standard: "EN 358, EN 813, EN 361, ANSI Z133",
      }),
    ]);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0].column).toBe("product_type");
    expect(report.errors[0].message).toContain("EN 361");
  });

  it("laat een echt niet-PBM product met rust", () => {
    // Een kettingzaaglijn zonder PBM-norm mag gewoon no_ppe zijn.
    const report = validateCatalog([
      row({ name: "Quick Cinch Chainsaw Lanyard", product_type: "no_ppe", standard: "" }),
    ]);
    expect(report.errors).toEqual([]);
  });

  it("valt niet over EN 795 of EN 12278", () => {
    // Ankervoorzieningen en katrollen zitten legitiem zowel bij PBM als bij
    // rigging; daar zou de regel vals alarm geven.
    expect(
      validateCatalog([row({ product_type: "no_ppe", standard: "EN 795 Type B" })]).errors,
    ).toEqual([]);
    expect(
      validateCatalog([row({ product_type: "no_ppe", standard: "EN 12278" })]).errors,
    ).toEqual([]);
  });

  it("herkent de norm ook zonder spatie", () => {
    const report = validateCatalog([
      row({ product_type: "no_ppe", standard: "EN813:2008 / EN358:2018" }),
    ]);
    expect(report.errors).toHaveLength(1);
  });

  it("bemoeit zich niet met ppe of rigging", () => {
    expect(validateCatalog([row({ product_type: "ppe", standard: "EN 361" })]).errors).toEqual([]);
    expect(validateCatalog([row({ product_type: "rigging", standard: "EN 795" })]).errors).toEqual([]);
  });
});
