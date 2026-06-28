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
 * Kan elk zoek-token achtereenvolgens op de kandidaat-woorden gelegd worden?
 * Een token matcht een woord als prefix ("tri" → "triact"), óf een reeks
 * woorden als acroniem van hun beginletters ("tl" → "triact"+"lock"). Tokens
 * mogen woorden overslaan, zodat "lock" ook het tweede woord mag raken.
 */
function matchTokens(qTokens: string[], cWords: string[]): boolean {
  function go(qi: number, wi: number): boolean {
    if (qi === qTokens.length) return true;
    if (wi >= cWords.length) return false;
    const tok = qTokens[qi];
    // (a) token is prefix van dit ene woord
    if (cWords[wi].startsWith(tok) && go(qi + 1, wi + 1)) return true;
    // (b) token is acroniem: beginletters van opeenvolgende woorden
    let k = 0;
    while (k < tok.length && wi + k < cWords.length && cWords[wi + k].startsWith(tok[k])) k++;
    if (k === tok.length && go(qi + 1, wi + k)) return true;
    // (c) dit woord overslaan en het token verderop proberen
    return go(qi, wi + 1);
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
  if (matchTokens(q.split(/\s+/).filter(Boolean), words(candidate))) return 400;
  return 0;
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
