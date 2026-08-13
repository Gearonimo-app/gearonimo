/**
 * Article status — calculated, never stored.
 *
 * never_inspected : no inspection on record → "request inspection" (not red!)
 * ok              : next_due > 60 days away
 * due_soon        : next_due within 60 days
 * overdue         : next_due has passed
 * end_of_life     : article has exceeded its maximum age
 */

export type ArticleStatus =
  | "never_inspected"
  | "ok"
  | "due_soon"
  | "overdue"
  | "end_of_life";

export interface StatusInput {
  today: Date;
  next_due: Date | null; // null = never inspected
  end_of_life?: Date | null;
  due_soon_days?: number; // default 60
}

export function calcStatus(input: StatusInput): ArticleStatus {
  const { today, next_due, end_of_life, due_soon_days = 60 } = input;

  // End of life takes priority
  if (end_of_life != null && today >= end_of_life) {
    return "end_of_life";
  }

  if (next_due == null) return "never_inspected";

  const diff_ms = next_due.getTime() - today.getTime();
  const diff_days = diff_ms / (1000 * 60 * 60 * 24);

  if (diff_days < 0) return "overdue";
  if (diff_days <= due_soon_days) return "due_soon";
  return "ok";
}

/**
 * EN 365: the first periodic inspection is due at the latest 12 months
 * after first use. Only meaningful while calcStatus still says
 * "never_inspected" (that state itself never alarms, by design — the
 * customer app is a free lead funnel and shouldn't scare people off).
 * Kept separate from calcStatus: this is a customer-app nudge, not part of
 * the inspection-company regime the Pro-app calculates with.
 */
export function isFirstInspectionOverdue(
  first_use_date: Date | null,
  today: Date,
  threshold_months = 12
): boolean {
  if (first_use_date == null) return false;
  const due = new Date(first_use_date);
  due.setMonth(due.getMonth() + threshold_months);
  return today >= due;
}

/**
 * De status zoals de klant-app hem toont. Eén bron voor drie schermen
 * (dashboard, materiaallijst, artikeldetail) — die berekenden dit tot
 * 2026-08-04 alledrie zelf, waardoor het artikeldetail bij de invoering van de
 * materiaal-tegels achterbleef en een afgevinkte EHBO-koffer daar nog
 * "Nog niet gekeurd" toonde.
 *
 * Bovenop `calcStatus`:
 * - `rejected`             — bij de laatste keuring afgekeurd.
 * - `first_inspection_due` — 12 maanden in gebruik zonder ooit gekeurd (EN 365).
 * - `never_checked`        — eigen todo-lijst, nog nooit afgevinkt, maar nog
 *                            binnen de termijn. Bewust rustig: net gekocht is
 *                            geen alarm (blauwdruk §7).
 * - `self_check_due`       — eigen todo-lijst, termijn verstreken.
 * - `no_inspection`        — kleding en geen-PBM: geen termijn, niets te doen.
 */
export type CustomerArticleStatus =
  | "rejected"
  | "overdue"
  | "due_soon"
  | "first_inspection_due"
  | "ok"
  | "never_inspected"
  | "no_inspection"
  | "never_checked"
  | "self_check_due";

export interface CustomerArticleInput {
  today?: Date;
  last_result?: string | null;
  next_due?: string | Date | null;
  first_use_date?: string | Date | null;
  purchase_date?: string | Date | null;
  /** `true` = valt buiten het keurbedrijf; de klant vinkt zelf af. */
  self_managed?: boolean | null;
  /** Termijn van de eigen controle in maanden; `null` = hoeft nooit. */
  self_check_interval_months?: number | null;
  self_checked_at?: string | Date | null;
  self_next_due?: string | Date | null;
  /** `false` = dit type heeft geen keurtermijn (kleding, geen-PBM). */
  type_is_inspected?: boolean;
}

function asDate(v?: string | Date | null): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

export function customerArticleStatus(input: CustomerArticleInput): CustomerArticleStatus {
  const today = input.today ?? new Date();
  if (input.last_result === "rejected") return "rejected";

  // Eigen todo-lijst (brandblusser, kettingzaag). Vertakt op de vlag
  // `self_managed` en niet op het producttype: gaat een machine ooit terug naar
  // een keurbedrijf, dan volgt dit vanzelf.
  if (input.self_managed && input.self_check_interval_months != null) {
    const checked = asDate(input.self_checked_at);
    if (checked == null) {
      // Nog nooit afgevinkt. Pas ná de termijn (gerekend vanaf ingebruikname,
      // anders aankoop) is dat iets om aandacht voor te vragen -- een net
      // toegevoegde EHBO-koffer hoort niet meteen oranje te staan.
      const start = asDate(input.first_use_date) ?? asDate(input.purchase_date);
      return isFirstInspectionOverdue(start, today, input.self_check_interval_months)
        ? "self_check_due"
        : "never_checked";
    }
    const next = asDate(input.self_next_due);
    const base = calcStatus({ today, next_due: next });
    // Afgevinkt zonder vervolgdatum = klaar; alleen een verstreken datum
    // vraagt weer aandacht.
    if (base === "never_inspected") return "ok";
    return base === "overdue" ? "self_check_due" : (base as CustomerArticleStatus);
  }

  // Geen keurtermijn én geen afvinkplicht. Een handmatig gezette datum wint
  // wél: heeft een keurmeester een geen-PBM-artikel tóch meegekeurd en er een
  // datum bij gezet, dan telt die.
  const nextDue = asDate(input.next_due);
  if (input.type_is_inspected === false && nextDue == null) return "no_inspection";

  const base = calcStatus({ today, next_due: nextDue });
  if (base === "never_inspected" && isFirstInspectionOverdue(asDate(input.first_use_date), today)) {
    return "first_inspection_due";
  }
  return base as CustomerArticleStatus;
}
