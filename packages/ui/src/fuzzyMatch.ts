// Tolerante typeahead-matching voor de Artikel/Merk/Categorie-suggesties.
//
// Achtergrond: oude certificaten bevatten vaak een eigen schrijfwijze ("ok tl")
// die de keurmeester wil omzetten naar het juiste catalogusproduct
// ("OK TriactLock"). Een simpele `includes()` vindt "OK TriactLock" wél bij
// "ok t" (aaneengesloten deelreeks) maar niet bij "ok tl", omdat "tl" niet
// letterlijk in "triactlock" voorkomt. Daarom matchen we hier óók op
// woord-initialen: "tl" = begin­letters van "Triact" + "Lock".

/**
 * Splits een tekst in losse "woorden" op spaties, leestekens, cijfer-grenzen
 * én camelCase-grenzen, zodat "OK TriactLock" → ["ok", "triact", "lock"].
 */
function words(s: string): string[] {
  return s
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase: TriactLock → Triact Lock
    .replace(/([A-Za-z])([0-9])/g, "$1 $2") // letter→cijfer: A4 → A 4
    .replace(/([0-9])([A-Za-z])/g, "$1 $2") // cijfer→letter: 4A → 4 A
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Verschillen `a` en `b` in hoogstens één teken (vervangen, invoegen of
 * weglaten)? Bewust geen volledige Levenshtein: dit draait per toetsaanslag
 * over de hele catalogus (±2600 producten), en één afwijking is precies wat
 * een tikfout is.
 */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let fouten = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++fouten > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return fouten + (a.length - i) + (b.length - j) <= 1;
}

/**
 * Vanaf welke tokenlengte een tikfout wordt toegestaan.
 *
 * Onder de vier tekens niet: "ok" zou dan ook "ak" en "oz" vinden, en juist
 * korte tokens zijn hier vaak acroniemen ("tl" → TriactLock) die exact horen
 * te matchen.
 */
const MIN_TYPOLENGTE = 4;

/** Matcht `tok` het begin van `woord`, eventueel met één tikfout? */
function matchtWoord(tok: string, woord: string): "exact" | "tikfout" | null {
  if (woord.startsWith(tok)) return "exact";
  if (tok.length < MIN_TYPOLENGTE) return null;
  // Zowel even lang (vervanging: save/safe) als één korter of langer
  // (weglaten/invoegen: sae/safe, saafe/safe).
  if (
    withinOneEdit(tok, woord.slice(0, tok.length)) ||
    withinOneEdit(tok, woord.slice(0, tok.length + 1))
  ) {
    return "tikfout";
  }
  return null;
}

/** Geen match mogelijk. */
const GEEN_MATCH = Infinity;

/**
 * Dezelfde tekst zonder leestekens en spaties.
 *
 * Petzl schrijft ASAP'SORBER, Am'D en I'D met een apostrof; wie "asapsorber"
 * of "amd" intikt vindt anders niets. De losse woorden matchen wél
 * ("asap sorber"), maar dat is niet hoe iemand het typt.
 */
function zonderLeestekens(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Kan elk zoek-token achtereenvolgens op de kandidaat-woorden gelegd worden,
 * en zo ja: met hoeveel tikfouten op zijn minst?
 *
 * Een token matcht een woord als prefix ("tri" → "triact"), als prefix met één
 * tikfout ("save" → "safe"), óf een reeks woorden als acroniem van hun
 * beginletters ("tl" → "triact"+"lock"). Tokens mogen woorden overslaan, zodat
 * "lock" ook het tweede woord mag raken.
 *
 * Het aantal tikfouten telt mee in de score, zodat een product dat exact
 * matcht altijd bovenaan blijft staan boven één dat een correctie nodig had.
 */
function matchTokens(qTokens: string[], cWords: string[]): number {
  function go(qi: number, wi: number): number {
    if (qi === qTokens.length) return 0;
    if (wi >= cWords.length) return GEEN_MATCH;
    const tok = qTokens[qi];
    let beste = GEEN_MATCH;

    // (a) token is prefix van dit ene woord, eventueel met één tikfout
    const soort = matchtWoord(tok, cWords[wi]);
    if (soort) {
      const rest = go(qi + 1, wi + 1);
      if (rest !== GEEN_MATCH) {
        beste = Math.min(beste, rest + (soort === "tikfout" ? 1 : 0));
      }
    }

    // (b) token is acroniem: beginletters van opeenvolgende woorden
    let k = 0;
    while (k < tok.length && wi + k < cWords.length && cWords[wi + k].startsWith(tok[k])) k++;
    if (k === tok.length) {
      const rest = go(qi + 1, wi + k);
      if (rest !== GEEN_MATCH) beste = Math.min(beste, rest);
    }

    // (c) dit woord overslaan en het token verderop proberen
    return Math.min(beste, go(qi, wi + 1));
  }
  return go(0, 0);
}

/**
 * Hoe goed past `typed` bij `candidate`? Hoger = relevanter; 0 = geen match.
 * Aaneengesloten (deel)reeksen scoren hoger dan losse token-/acroniem-matches,
 * zodat de meest voor de hand liggende suggestie bovenaan blijft staan.
 */
export function fuzzyScore(typed: string, candidate: string): number {
  const q = typed.trim().toLowerCase();
  if (!q) return 1;
  const cand = candidate.toLowerCase();
  const idx = cand.indexOf(q);
  if (idx === 0) return 1000; // begint er letterlijk mee
  if (idx > 0) return 800 - Math.min(idx, 200); // bevat het letterlijk
  // Zelfde vergelijking, maar met de leestekens weggelaten: "asapsorber" hoort
  // ASAP'SORBER te vinden. Scoort onder elke letterlijke match en boven een
  // token-match, want dit is nog steeds precies de getypte reeks.
  const qKaal = zonderLeestekens(q);
  if (qKaal) {
    const kaalIdx = zonderLeestekens(cand).indexOf(qKaal);
    if (kaalIdx === 0) return 500;
    if (kaalIdx > 0) return 450;
  }
  // Per tikfout een flinke aftrek: een product dat exact matcht hoort altijd
  // boven een product te staan waarvoor een letter gecorrigeerd moest worden.
  const typos = matchTokens(q.split(/\s+/).filter(Boolean), words(candidate));
  if (typos !== GEEN_MATCH) return Math.max(1, 400 - 100 * typos);
  return 0;
}

/**
 * Zoekt in een lijst objecten op hun label, met een "steeds korter"-vangnet.
 *
 * Alle zoekwoorden moeten matchen (AND). Dat is precies wat je wilt terwijl
 * iemand tikt, maar niet wanneer het veld is voorgevuld met de vrije
 * schrijfwijze van een oud certificaat: "Distel Alu kort" levert dan niets op,
 * want "kort" staat in geen enkele catalogusnaam. Daarom vallen we terug op
 * steeds minder woorden (laatste woord eraf) tot er wél suggesties zijn —
 * "Distel Alu kort" → "Distel Alu" → Distel Alu 3.1 / Distel Alu Plus.
 * De keurmeester ziet zo altijd de dichtstbijzijnde kandidaten in plaats van
 * een lege lijst die hij eerst moet leegvegen.
 */
export function fuzzySearch<T>(
  items: T[],
  typed: string,
  labelOf: (item: T) => string,
  limit = 8,
): T[] {
  let tokens = typed.trim().split(/\s+/).filter(Boolean);
  while (tokens.length) {
    const q = tokens.join(" ");
    const hits = items
      .map((item) => ({ item, s: fuzzyScore(q, labelOf(item)) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || labelOf(a.item).localeCompare(labelOf(b.item)))
      .slice(0, limit)
      .map((x) => x.item);
    if (hits.length) return hits;
    tokens = tokens.slice(0, -1);
  }
  return [];
}

/**
 * Filtert en sorteert een lijst op relevantie t.o.v. de getypte tekst.
 * Lege invoer geeft de (al gesorteerde) lijst ongewijzigd terug.
 */
export function fuzzyFilter(list: string[], typed: string, limit = 30): string[] {
  const q = typed.trim();
  if (!q) return list.slice(0, limit);
  return list
    .map((v) => ({ v, s: fuzzyScore(q, v) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.v.localeCompare(b.v))
    .slice(0, limit)
    .map((x) => x.v);
}
