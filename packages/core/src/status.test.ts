import { describe, it, expect } from "vitest";
import { calcStatus, isFirstInspectionOverdue, customerArticleStatus } from "./status";

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

// ─── customerArticleStatus: de gedeelde status van de klant-app ─────────────
// Toegevoegd 2026-08-04 nadat het artikeldetailscherm bij een afgevinkte
// EHBO-koffer nog "Nog niet gekeurd" toonde: die berekening stond op drie
// plekken los.
describe("customerArticleStatus", () => {
  const today = new Date(2026, 7, 4); // 4 aug 2026

  it("afgekeurd wint van alles", () => {
    expect(
      customerArticleStatus({ today, last_result: "rejected", self_managed: true, self_check_interval_months: 12 })
    ).toBe("rejected");
  });

  it("net toegevoegd en zelf te controleren: rustig, geen alarm", () => {
    // Precies de klacht van Jos: een net toegevoegde EHBO-tas stond meteen
    // oranje. Binnen de termijn hoort dat "nog niet gecontroleerd" te zijn.
    expect(
      customerArticleStatus({
        today,
        self_managed: true,
        self_check_interval_months: 12,
        first_use_date: new Date(2026, 5, 6),
      })
    ).toBe("never_checked");
  });

  it("nooit gecontroleerd en de termijn is verstreken: wél aandacht", () => {
    expect(
      customerArticleStatus({
        today,
        self_managed: true,
        self_check_interval_months: 12,
        first_use_date: new Date(2024, 0, 1),
      })
    ).toBe("self_check_due");
  });

  it("valt terug op de aankoopdatum als ingebruikname leeg is", () => {
    expect(
      customerArticleStatus({
        today,
        self_managed: true,
        self_check_interval_months: 12,
        purchase_date: new Date(2024, 0, 1),
      })
    ).toBe("self_check_due");
  });

  it("net afgevinkt is in orde", () => {
    expect(
      customerArticleStatus({
        today,
        self_managed: true,
        self_check_interval_months: 12,
        self_checked_at: new Date(2026, 7, 1),
        self_next_due: new Date(2027, 7, 1),
      })
    ).toBe("ok");
  });

  it("afgevinkt maar de volgende datum is verlopen", () => {
    expect(
      customerArticleStatus({
        today,
        self_managed: true,
        self_check_interval_months: 12,
        self_checked_at: new Date(2025, 0, 1),
        self_next_due: new Date(2026, 0, 1),
      })
    ).toBe("self_check_due");
  });

  it("kleding: geen termijn, niets te doen", () => {
    expect(
      customerArticleStatus({
        today,
        self_managed: true,
        self_check_interval_months: null,
        type_is_inspected: false,
        first_use_date: new Date(2020, 0, 1),
      })
    ).toBe("no_inspection");
  });

  it("geen-PBM dat een keurmeester tóch een datum gaf, telt die datum", () => {
    expect(
      customerArticleStatus({
        today,
        type_is_inspected: false,
        next_due: new Date(2027, 0, 1),
      })
    ).toBe("ok");
  });

  it("keurmateriaal blijft werken zoals eerst", () => {
    expect(customerArticleStatus({ today, next_due: new Date(2027, 0, 1) })).toBe("ok");
    expect(customerArticleStatus({ today, next_due: new Date(2026, 0, 1) })).toBe("overdue");
    expect(customerArticleStatus({ today })).toBe("never_inspected");
    expect(customerArticleStatus({ today, first_use_date: new Date(2024, 0, 1) })).toBe(
      "first_inspection_due"
    );
  });
});
