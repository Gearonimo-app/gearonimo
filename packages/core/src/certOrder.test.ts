import { describe, expect, it } from "vitest";
import { sortCertItems, type CertSortFields } from "./certOrder";

const item = (user: string | null, category: string | null, brand: string | null, name = "x", serial_number: string | null = null): CertSortFields => ({
  user, category, brand, name, serial_number,
});

const label = (it: CertSortFields) => [it.user, it.category, it.brand, it.name, it.serial_number].join("|");

describe("sortCertItems", () => {
  it("gebruiker, dan categorie, dan merk", () => {
    const sorted = sortCertItems(
      [
        item("Piet", "Karabiner", "Petzl"),
        item("Jan", "Karabiner", "Petzl"),
        item("Jan", "Harnas", "Petzl"),
        item("Jan", "Karabiner", "DMM"),
        item("Piet", "Harnas", "Edelrid"),
      ],
      "nl",
    );
    expect(sorted.map(label)).toEqual([
      "Jan|Harnas|Petzl|x|",
      "Jan|Karabiner|DMM|x|",
      "Jan|Karabiner|Petzl|x|",
      "Piet|Harnas|Edelrid|x|",
      "Piet|Karabiner|Petzl|x|",
    ]);
  });

  it("zonder gebruiker (of leeg) onderaan, ook lege categorie en merk per niveau", () => {
    const sorted = sortCertItems(
      [item(null, "Harnas", "Petzl"), item("  ", "Harnas", "DMM"), item("Jan", null, "Petzl"), item("Jan", "Harnas", null), item("Jan", "Harnas", "Petzl")],
      "nl",
    );
    expect(sorted.map(label)).toEqual([
      "Jan|Harnas|Petzl|x|",
      "Jan|Harnas||x|",
      "Jan||Petzl|x|",
      "  |Harnas|DMM|x|",
      "|Harnas|Petzl|x|",
    ]);
  });

  it("hoofdletters tellen niet; serienummers als getal", () => {
    const sorted = sortCertItems(
      [item("jan", "karabiner", "petzl", "Am'D", "SN10"), item("Jan", "Karabiner", "Petzl", "Am'D", "SN2"), item("JAN", "KARABINER", "PETZL", "Am'D", "SN1")],
      "en",
    );
    expect(sorted.map((it) => it.serial_number)).toEqual(["SN1", "SN2", "SN10"]);
  });

  it("volledig gelijke regels houden hun oorspronkelijke volgorde", () => {
    const a = { ...item("Jan", "Harnas", "Petzl"), id: 1 };
    const b = { ...item("Jan", "Harnas", "Petzl"), id: 2 };
    expect(sortCertItems([a, b], "nl").map((x) => x.id)).toEqual([1, 2]);
    expect(sortCertItems([b, a], "nl").map((x) => x.id)).toEqual([2, 1]);
  });
});
