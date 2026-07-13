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
