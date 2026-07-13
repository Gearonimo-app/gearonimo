import { describe, it, expect } from "vitest";
import { calcStatus, isFirstInspectionOverdue } from "./status";

const today = new Date("2026-06-21");

describe("calcStatus", () => {
  it("returns never_inspected when next_due is null", () => {
    expect(calcStatus({ today, next_due: null })).toBe("never_inspected");
  });

  it("returns ok when next_due is far away", () => {
    const next_due = new Date("2027-01-01");
    expect(calcStatus({ today, next_due })).toBe("ok");
  });

  it("returns due_soon within 60 days", () => {
    const next_due = new Date("2026-07-01");
    expect(calcStatus({ today, next_due })).toBe("due_soon");
  });

  it("returns overdue when next_due has passed", () => {
    const next_due = new Date("2026-01-01");
    expect(calcStatus({ today, next_due })).toBe("overdue");
  });

  it("returns end_of_life when eol has passed", () => {
    const next_due = new Date("2027-01-01");
    const end_of_life = new Date("2025-01-01");
    expect(calcStatus({ today, next_due, end_of_life })).toBe("end_of_life");
  });
});

describe("isFirstInspectionOverdue", () => {
  it("is false when there is no first_use_date", () => {
    expect(isFirstInspectionOverdue(null, today)).toBe(false);
  });

  it("is false within 12 months of first use", () => {
    const first_use_date = new Date("2025-12-21");
    expect(isFirstInspectionOverdue(first_use_date, today)).toBe(false);
  });

  it("is true exactly 12 months after first use", () => {
    const first_use_date = new Date("2025-06-21");
    expect(isFirstInspectionOverdue(first_use_date, today)).toBe(true);
  });

  it("is true well past 12 months after first use", () => {
    const first_use_date = new Date("2024-01-01");
    expect(isFirstInspectionOverdue(first_use_date, today)).toBe(true);
  });
});
