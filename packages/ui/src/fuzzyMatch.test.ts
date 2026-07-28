import { describe, it, expect } from "vitest";
import { fuzzyFilter, fuzzyScore, fuzzySearch } from "./fuzzyMatch";

const catalogus = [
  "OK TriactLock",
  "OK Triact",
  "Petzl Grillon",
  "Black Diamond ATC",
  "Petzl Tibloc",
];

describe("fuzzyFilter", () => {
  it("vindt het product bij een aaneengesloten begin (ok t)", () => {
    expect(fuzzyFilter(catalogus, "ok t")).toContain("OK TriactLock");
  });

  it("vindt het product óók bij woord-initialen (ok tl)", () => {
    // De kern van het verzoek: "ok tl" → "OK TriactLock" via T(riact)L(ock).
    expect(fuzzyFilter(catalogus, "ok tl")).toContain("OK TriactLock");
  });

  it("matcht een acroniem over meerdere woorden (bd atc, pg)", () => {
    expect(fuzzyFilter(catalogus, "bd atc")).toContain("Black Diamond ATC");
    expect(fuzzyFilter(catalogus, "pg")).toContain("Petzl Grillon");
  });

  it("zet een letterlijke (deel)treffer boven een acroniem-treffer", () => {
    const out = fuzzyFilter(catalogus, "triact");
    expect(out[0]).toBe("OK Triact");
  });

  it("geeft niets terug zonder enige overeenkomst", () => {
    expect(fuzzyFilter(catalogus, "xyz")).toEqual([]);
  });

  it("laat de lijst ongemoeid bij lege invoer", () => {
    expect(fuzzyFilter(catalogus, "")).toEqual(catalogus);
  });

  it("scoort 0 als er geen match is en >0 als die er wel is", () => {
    expect(fuzzyScore("xyz", "OK TriactLock")).toBe(0);
    expect(fuzzyScore("ok tl", "OK TriactLock")).toBeGreaterThan(0);
  });
});

describe("fuzzySearch", () => {
  // Zoals de "bedoelt u"-koppeling ze aanbiedt: objecten met een label.
  const producten = [
    { id: "1", label: "Distel Alu 3.1" },
    { id: "2", label: "Distel Alu Plus" },
    { id: "3", label: "Distel Carbon 3.1" },
    { id: "4", label: "Petzl Grillon" },
  ];
  const zoek = (q: string, limit?: number) =>
    fuzzySearch(producten, q, (p) => p.label, limit).map((p) => p.label);

  it("vindt de producten bij een begin-treffer (Dis)", () => {
    expect(zoek("Dis")).toEqual([
      "Distel Alu 3.1",
      "Distel Alu Plus",
      "Distel Carbon 3.1",
    ]);
  });

  it("valt terug op minder woorden als de hele zoekterm niets oplevert", () => {
    // De vrije schrijfwijze van een oud certificaat: "kort" staat in geen
    // enkele catalogusnaam, maar "Distel Alu" wel.
    expect(zoek("Distel Alu kort")).toEqual(["Distel Alu 3.1", "Distel Alu Plus"]);
  });

  it("geeft niets terug als geen enkel woord matcht", () => {
    expect(zoek("xyz qqq")).toEqual([]);
  });

  it("respecteert de limiet en lege invoer", () => {
    expect(zoek("Dis", 2)).toHaveLength(2);
    expect(zoek("   ")).toEqual([]);
  });
});
