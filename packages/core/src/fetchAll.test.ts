import { describe, it, expect } from "vitest";
import { fetchAllRows } from "./fetchAll";

/** Nep-tabel die zich gedraagt als Supabase: nooit meer dan pageSize rijen. */
function fakeTable(total: number, pageSize: number) {
  const calls: [number, number][] = [];
  const rows = Array.from({ length: total }, (_, i) => ({ id: i }));
  const page = (from: number, to: number) => {
    calls.push([from, to]);
    const slice = rows.slice(from, Math.min(to + 1, from + pageSize));
    return Promise.resolve({ data: slice, error: null });
  };
  return { page, calls };
}

describe("fetchAllRows", () => {
  it("haalt alles op, ook voorbij één pagina (2294 producten)", async () => {
    const { page, calls } = fakeTable(2294, 1000);
    const out = await fetchAllRows<{ id: number }>(page, 1000);
    expect(out).toHaveLength(2294);
    expect(out[2293].id).toBe(2293);
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stopt na één ronde als de tabel in één pagina past", async () => {
    const { page, calls } = fakeTable(12, 1000);
    expect(await fetchAllRows(page, 1000)).toHaveLength(12);
    expect(calls).toHaveLength(1);
  });

  it("slikt een fout niet stil in, maar gooit hem door", async () => {
    await expect(
      fetchAllRows(() => Promise.resolve({ data: null, error: { message: "permission denied" } })),
    ).rejects.toThrow("permission denied");
  });
});
