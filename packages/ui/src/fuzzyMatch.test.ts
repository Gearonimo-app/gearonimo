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

describe("tikfouten", () => {
  // Melding Jos 2026-08-01: hij zocht "Save vision static line" (Save i.p.v.
  // Safe) en kreeg EDELRID Fast Saver en Cambiumsaver terug. Eén verkeerde
  // letter in het eerste woord maakte de drie kloppende woorden waardeloos,
  // omdat het vangnet steeds het láátste woord eraf haalde en dus juist het
  // foute woord overhield.
  const ropes = [
    "Tree Runner Safe Vision Static Line",
    "EDELRID FAST SAVER AIR",
    "EDELRID CAMBIUMSAVER BICOLOR",
    "Notch Friction Savers with Aluminum",
  ];

  it("vindt het product ondanks één verkeerde letter", () => {
    expect(fuzzyFilter(ropes, "Save vision static line")[0]).toBe(
      "Tree Runner Safe Vision Static Line",
    );
  });

  it("zet een exacte match boven een match met tikfout", () => {
    expect(fuzzyScore("safe vision", "Tree Runner Safe Vision Static Line"))
      .toBeGreaterThan(
        fuzzyScore("save vision", "Tree Runner Safe Vision Static Line"),
      );
  });

  it("laat korte tokens met rust", () => {
    // "ok" mag niet ineens "ak" of "oz" vinden: onder de vier tekens zijn het
    // vaak acroniemen die exact horen te matchen.
    expect(fuzzyScore("ak", "OK TriactLock")).toBe(0);
  });

  it("vergeeft een vergeten of een dubbele letter", () => {
    // vergeten letter: vison → vision
    expect(fuzzyFilter(ropes, "safe vison")).toContain(
      "Tree Runner Safe Vision Static Line",
    );
    // dubbele letter: saafe → safe
    expect(fuzzyFilter(ropes, "saafe vision")).toContain(
      "Tree Runner Safe Vision Static Line",
    );
  });

  it("geeft tokens korter dan vier tekens geen marge", () => {
    // Bewuste grens: onder de vier tekens levert één afwijking te veel ruis op
    // ("rop" zou "top" vinden), en juist korte tokens zijn hier vaak
    // acroniemen die exact horen te matchen. Gevolg: een tikfout in een kort
    // woord wordt níét gecorrigeerd.
    expect(fuzzyScore("sae", "Tree Runner Safe Vision Static Line")).toBe(0);
  });

  it("verzint niets bij een woord dat er niet op lijkt", () => {
    expect(fuzzyScore("harnas", "Tree Runner Safe Vision Static Line")).toBe(0);
  });
});

describe("leestekens in de productnaam", () => {
  // Melding Jos 2026-08-13: hij kon de ASAP'SORBER niet vinden. Die stond
  // toen nog niet in de catalogus, maar zou ook daarna niet gevonden zijn:
  // Petzl schrijft hem met een apostrof en niemand tikt die mee.
  const petzl = [
    "ASAP'SORBER 20",
    "ASAP'SORBER 40",
    "ASAP'SORBER AXESS",
    "Am'D TRIACT-LOCK",
    "I'D S",
    "ASAP LOCK",
  ];

  it("vindt ASAP'SORBER als je 'asapsorber' tikt", () => {
    expect(fuzzyFilter(petzl, "asapsorber")).toContain("ASAP'SORBER 20");
  });

  it("vindt Am'D als je 'amd' tikt", () => {
    expect(fuzzyFilter(petzl, "amd")).toContain("Am'D TRIACT-LOCK");
  });

  it("houdt de letterlijke match bovenaan", () => {
    // "asap" staat letterlijk vooraan in beide, dus die volgorde mag de
    // leesteken-route niet omgooien.
    expect(fuzzyScore("asap", "ASAP LOCK")).toBeGreaterThan(
      fuzzyScore("asapsorber", "ASAP'SORBER 20"),
    );
  });

  it("verzint nog steeds niets", () => {
    expect(fuzzyScore("harnas", "ASAP'SORBER 20")).toBe(0);
  });
});
