import { describe, it, expect } from "vitest";
import { fetchAllRows, fetchAllRowsIn, insertInChunks, IN_CHUNK_SIZE } from "./fetchAll";

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

describe("fetchAllRowsIn", () => {
  it("splitst een lange id-lijst in blokken en pagineert elk blok", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
    const chunks: number[] = [];
    // Elk id heeft 15 rijen: blok van 100 id's = 1500 rijen = 2 pagina's.
    const out = await fetchAllRowsIn<{ id: string }>(ids, (chunk, from, to) => {
      if (from === 0) chunks.push(chunk.length);
      const all = chunk.flatMap((id) => Array.from({ length: 15 }, () => ({ id })));
      return Promise.resolve({ data: all.slice(from, Math.min(to + 1, from + 1000)), error: null });
    });
    expect(chunks).toEqual([IN_CHUNK_SIZE, IN_CHUNK_SIZE, 50]);
    expect(out).toHaveLength(250 * 15);
  });

  it("lege lijst = geen verzoek", async () => {
    let called = false;
    const out = await fetchAllRowsIn([], () => { called = true; return Promise.resolve({ data: [], error: null }); });
    expect(out).toEqual([]);
    expect(called).toBe(false);
  });
});

describe("insertInChunks", () => {
  it("schrijft in blokken en stopt bij de eerste fout", async () => {
    const sizes: number[] = [];
    const rows = Array.from({ length: 1200 }, (_, i) => i);
    await insertInChunks(rows, (c) => { sizes.push(c.length); return Promise.resolve({ error: null }); });
    expect(sizes).toEqual([500, 500, 200]);
    await expect(
      insertInChunks(rows, (c) => Promise.resolve({ error: c[0] === 500 ? { message: "boem" } : null }))
    ).rejects.toThrow("boem");
  });
});
