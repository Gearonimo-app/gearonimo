// Gedeelde vorm en afgeleiden van één keuringsregel.
//
// Stonden eerder allemaal binnen InspectionWizard.vue. Sinds de tabelrij een
// eigen component is (InspectionRow.vue, zie de prestatie-commit van
// 2026-08-02) hebben wizard én rij dezelfde types en dezelfde afleidingen
// nodig -- vandaar hier, één bron, geen kopie per component.
//
// Alleen pure afleidingen: alles wat vertaling (`t`) of netwerk nodig heeft
// blijft in het component staan waar die context is.

export interface Product {
  id: string;
  brand: string | null;
  name: string | null;
  category: string | null;
  product_type: string | null;
  interval_override_months: number | null;
  max_age_mfr_years: number | null;
  max_age_use_years: number | null;
  recall_url: string | null;
  inspection_notice_url: string | null;
  manual_url: string | null;
  // Opmerking uit de catalogus. Stond hier eerder niet: de keurmeester zag
  // `products.notes` tijdens een keuring dus helemaal niet, waardoor
  // fabrikantseisen zonder document (bv. "elke 5 jaar Level 2-service bij een
  // erkende partner") noodgedwongen in `inspection_notice_url` belandden --
  // een linkveld, dus daar werd lopende tekst een kapotte link van.
  notes: string | null;
}

export interface Article {
  id: string;
  serial_number: string | null;
  free_brand: string | null;
  free_category: string | null;
  free_description: string | null;
  free_manual_url: string | null;
  free_recall_flag: boolean;
  free_recall_url: string | null;
  recall_cleared_url: string | null;
  recall_cleared_note: string | null;
  notice_cleared_url: string | null;
  notice_cleared_note: string | null;
  assigned_user_name: string | null;
  manufacture_year: number | null;
  manufacture_month: number | null;
  first_use_date: string | null;
  severe_use: boolean;
  interval_override_months: number | null;
  retired: boolean;
  suggest_for_catalog: boolean;
  product: Product | null;
}

export interface Item {
  id: string;
  article_id: string;
  result: string;
  next_due: string | null;
  rejection_code_id: string | null;
  comment: string | null;
  article: Article;
}

export interface RejectionCode {
  id: string;
  code: number;
  label: string | null;
}

export function itemBrand(it: Item): string {
  return it.article.product?.brand ?? it.article.free_brand ?? "";
}
export function itemName(it: Item): string {
  return it.article.product?.name ?? it.article.free_description ?? "";
}
export function itemCategory(it: Item): string {
  return it.article.product?.category ?? it.article.free_category ?? "";
}
export function itemManualUrl(it: Item): string | null {
  return it.article.product?.manual_url ?? it.article.free_manual_url ?? null;
}

// Catalogus-artikel: uit products.recall_url. Vrij artikel: alleen als de
// keurmeester de handmatige recall-toggle heeft aangezet (free_recall_flag) --
// zonder catalogus is een recall anders niet vast te stellen.
export function itemRecallRawUrl(it: Item): string | null {
  if (it.article.product) return it.article.product.recall_url ?? null;
  return it.article.free_recall_flag ? it.article.free_recall_url : null;
}
// Afgevinkt door de keurmeester (met opmerking, zie clearRecallFlag) blijft
// verborgen zolang het dezelfde link betreft -- wijzigt products.recall_url
// later (een nieuwe recall), dan verschijnt de vlag vanzelf weer.
export function itemRecallUrl(it: Item): string | null {
  const url = itemRecallRawUrl(it);
  return url && url === it.article.recall_cleared_url ? null : url;
}
export function itemRecallClearedNote(it: Item): string | null {
  const url = itemRecallRawUrl(it);
  if (!url || url !== it.article.recall_cleared_url) return null;
  return it.article.recall_cleared_note || null;
}

// Inspection notice / veiligheidsbulletin van de fabrikant: alleen
// catalogusproducten (products.inspection_notice_url) -- geen vrij-artikel-
// equivalent, zie DATAMODEL. Los van itemRecallUrl: een echte recall en een
// routinebulletin zijn geen hetzelfde signaal en horen niet achter dezelfde
// vlag te schuilen.
export function itemNoticeRawUrl(it: Item): string | null {
  return it.article.product?.inspection_notice_url ?? null;
}
export function itemNoticeUrl(it: Item): string | null {
  const url = itemNoticeRawUrl(it);
  return url && url === it.article.notice_cleared_url ? null : url;
}
export function itemNoticeClearedNote(it: Item): string | null {
  const url = itemNoticeRawUrl(it);
  if (!url || url !== it.article.notice_cleared_url) return null;
  return it.article.notice_cleared_note || null;
}

/**
 * Opmerking uit de catalogus (`products.notes`).
 *
 * Anders dan een recall of een inspection notice is dit geen vlag die
 * afgevinkt wordt: het is achtergrond die bij élke keuring van dit product
 * geldt (fabrikantseisen, servicetermijnen, bijzonderheden). Daarom geen ✕ om
 * te verbergen -- verbergen zou de eerstvolgende keurmeester de informatie
 * onthouden.
 */
export function itemProductNotes(it: Item): string | null {
  return it.article.product?.notes?.trim() || null;
}

/** Maandafkorting bij het bouwjaar -- gebruikt in de toevoegrij én in de tabel. */
const MONTH_NAMES_NL = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];
export function monthName(m: number): string {
  return MONTH_NAMES_NL[m - 1];
}
