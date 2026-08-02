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

/** Bovengrens van deze helper: erboven wordt er geen lijst meer opgeleverd. */
export const FETCH_ALL_MAX_ROWS = MAX_PAGES * SUPABASE_PAGE_SIZE;

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/**
 * Haalt alle rijen op door de query in pagina's te herhalen.
 *
 * @param page bouwt de query voor één pagina; `from`/`to` horen in `.range()`.
 * @throws de Supabase-fout van de eerste pagina die faalt (niet stil slikken).
 * @throws als de veiligheidsrem bereikt wordt — zie hieronder.
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
  // Veiligheidsrem geraakt. Bewust een fout en géén halve lijst: deze helper
  // bestaat juist om stille afkapping te voorkomen, en een aanroeper die hier
  // een lijst terugkrijgt zou dénken dat hij alles heeft. Bij een recall-
  // zoekopdracht is dat het verschil tussen "geen treffers" en "niet gekeken".
  throw new Error(
    `fetchAllRows: meer dan ${MAX_PAGES * pageSize} rijen; veiligheidsrem geraakt. ` +
      `Deze zoekopdracht hoort server-side te filteren in plaats van alles op te halen.`,
  );
}
