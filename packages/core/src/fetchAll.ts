// Volledige tabellen ophalen zonder stil te worden afgekapt.
//
// Achtergrond (echt gebeurd, 2026-07-28): de catalogus groeide met de
// bronlijst-import naar 2294 producten. Supabase kapt élk API-antwoord af op de
// project-instelling "Max rows" (standaard 1000) — zónder foutmelding. Een
// `select()` zonder paginering levert dus stil een deel van de tabel op:
// - de "bedoelt u"-koppeling op de artikelpagina vond "Distel …" niet meer,
//   terwijl het catalogusoverzicht die producten wél liet zien (dat overzicht
//   sorteert op merk, dus de D's zaten toevallig nog in de eerste 1000);
// - "Exporteren naar Excel" exporteerde een onvolledige catalogus.
//
// Daarom altijd via deze helper pagineren. Let op: geef de query een *stabiele*
// sortering mee (bijv. `.order('brand').order('name')`), anders kan een rij
// tussen twee pagina's door verspringen of dubbel voorkomen.

/** Pagina-grootte; gelijk aan Supabase's standaard "Max rows". */
export const SUPABASE_PAGE_SIZE = 1000;

/** Veiligheidsrem: nooit meer dan dit aantal pagina's ophalen. */
const MAX_PAGES = 100;

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/**
 * Haalt alle rijen op door de query in pagina's te herhalen.
 *
 * @param page bouwt de query voor één pagina; `from`/`to` horen in `.range()`.
 * @throws de Supabase-fout van de eerste pagina die faalt (niet stil slikken).
 *
 * ```ts
 * const products = await fetchAllRows<Product>((from, to) =>
 *   supabase.from('products').select('id, brand, name')
 *     .order('brand').order('name').range(from, to))
 * ```
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const from = i * pageSize;
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    // Minder dan een volle pagina terug = einde tabel. (Een precies volle
    // laatste pagina kost één extra, lege ronde — dat mag.)
    if (batch.length < pageSize) return rows;
  }
  // De rem is bereikt: liever een duidelijke fout dan stil een deel teruggeven
  // -- precies wat deze helper moet voorkomen.
  throw new Error(`Te veel rijen om op te halen (meer dan ${MAX_PAGES * pageSize}).`);
}

/** Aantal id's per `.in()`-blok. Honderden UUID's in één filter maken de URL
 * te lang (de server weigert dan het hele verzoek); 100 blijft ruim binnen
 * de grens. */
export const IN_CHUNK_SIZE = 100;

/**
 * Als fetchAllRows, maar voor een query met een `.in()`-filter op een lange
 * lijst id's: per blok van IN_CHUNK_SIZE, en elk blok volledig gepagineerd.
 * Zo kan een grote klant (honderden artikelen) geen te lange URL meer geven,
 * en wordt er niets stil afgekapt.
 *
 * ```ts
 * const items = await fetchAllRowsIn<Item>(articleIds, (chunk, from, to) =>
 *   supabase.from('inspection_items').select('article_id')
 *     .in('article_id', chunk).order('id').range(from, to))
 * ```
 */
export async function fetchAllRowsIn<T>(
  ids: readonly string[],
  page: (chunk: string[], from: number, to: number) => PromiseLike<PageResult>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + IN_CHUNK_SIZE);
    rows.push(...(await fetchAllRows<T>((from, to) => page(chunk, from, to), pageSize)));
  }
  return rows;
}

/** Grote inserts in blokken, zodat één verzoek nooit te groot wordt. Gooit
 * de eerste fout; eerder geschreven blokken blijven staan (de aanroeper ruimt
 * op als dat nodig is). */
export async function insertInChunks<R>(
  rows: readonly R[],
  insert: (chunk: R[]) => PromiseLike<{ error: { message: string } | null }>,
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const { error } = await insert(rows.slice(i, i + chunkSize));
    if (error) throw new Error(error.message);
  }
}
