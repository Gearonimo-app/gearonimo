import { describe, it, expect } from "vitest";
import { fuzzyFilter, fuzzyScore } from "./fuzzyMatch";

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
