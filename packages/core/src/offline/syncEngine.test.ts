import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";

// supabase.ts gooit bij module-load als de Supabase-env-vars ontbreken (geen
// echte backend nodig in deze test); we mocken de hele module zodat
// syncEngine.ts zijn eigen `import { supabase } from "../supabase"` een
// controleerbare fake-client krijgt i.p.v. een echte HTTP-client.
const calls: { table: string; method: string; arg: unknown }[] = [];
let failTables = new Set<string>();
// Tabellen waar een update "slaagt" maar 0 rijen raakt (rij bestaat niet op
// de server, bv. omdat de insert eerder in de keten faalde).
let zeroRowTables = new Set<string>();

vi.mock("../supabase", () => {
  function makeQuery(table: string) {
    return {
      upsert(payload: unknown) {
        calls.push({ table, method: "upsert", arg: payload });
        if (failTables.has(table)) return Promise.resolve({ error: new Error(`upsert faalde voor ${table}`) });
        return Promise.resolve({ error: null });
      },
      update(payload: unknown) {
        calls.push({ table, method: "update", arg: payload });
        return {
          eq() {
            return {
              select() {
                if (failTables.has(table))
                  return Promise.resolve({ data: null, error: new Error(`update faalde voor ${table}`) });
                if (zeroRowTables.has(table)) return Promise.resolve({ data: [], error: null });
                return Promise.resolve({ data: [{ id: "geraakt" }], error: null });
              },
            };
          },
        };
      },
    };
  }
  return {
    supabase: {
      from: (table: string) => makeQuery(table),
    },
  };
});

import { enqueueMutation, listPendingMutationsForCustomer, listAllPendingMutations, countPendingForCustomer } from "./mutationQueue";
import { syncAll, isDownloadStale, STALE_WARNING_DAYS } from "./syncEngine";
import { removeDownload } from "./download";
import { getOfflineDb } from "./db";

beforeEach(async () => {
  calls.length = 0;
  failTables = new Set();
  zeroRowTables = new Set();
  const db = await getOfflineDb();
  await db.clear("mutations");
  await db.clear("downloads");
  await db.clear("inspections");
});

function downloadEntry(customerId: string, lastActivityAt: string) {
  return {
    customerId,
    customerNameEnc: { iv: new Uint8Array(), ciphertext: new ArrayBuffer(0) },
    watermarkId: "w",
    downloadedAt: lastActivityAt,
    lastSyncedAt: null,
    lastActivityAt,
    productIds: [],
  };
}

function inspectionRow(id: string, customerId: string, status: string) {
  return { id, customerId, status, enc: { iv: new Uint8Array(), ciphertext: new ArrayBuffer(0) } };
}

describe("syncAll", () => {
  it("uploads pending mutations in order and clears them on success", async () => {
    await enqueueMutation({ customerId: "c1", table: "inspections", op: "insert", payload: { id: "insp-1" } });
    await enqueueMutation({
      customerId: "c1",
      table: "inspection_items",
      op: "insert",
      payload: { id: "item-1", inspection_id: "insp-1" },
    });

    const summary = await syncAll();

    expect(summary.synced).toBe(2);
    expect(summary.failed).toBe(0);
    expect(calls.map((c) => c.table)).toEqual(["inspections", "inspection_items"]);
    expect(await listPendingMutationsForCustomer("c1")).toHaveLength(0);
  });

  it("uses upsert for inserts (idempotent retries) and update+eq for updates", async () => {
    await enqueueMutation({ customerId: "c2", table: "inspections", op: "insert", payload: { id: "insp-2" } });
    await enqueueMutation({
      customerId: "c2",
      table: "inspection_items",
      op: "update",
      payload: { id: "item-2", result: "passed" },
    });

    await syncAll();

    expect(calls[0]).toEqual({ table: "inspections", method: "upsert", arg: { id: "insp-2" } });
    expect(calls[1]).toEqual({ table: "inspection_items", method: "update", arg: { result: "passed" } });
  });

  it("marks a failed mutation as failed and leaves it in the queue for retry", async () => {
    failTables.add("inspections");
    await enqueueMutation({ customerId: "c3", table: "inspections", op: "insert", payload: { id: "insp-3" } });

    const summary = await syncAll();

    expect(summary.failed).toBe(1);
    const remaining = await listPendingMutationsForCustomer("c3");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].status).toBe("failed");
    expect(remaining[0].lastError).toContain("inspections");
  });

  it("keeps syncing other customers after one customer's mutation fails", async () => {
    failTables.add("inspections");
    await enqueueMutation({ customerId: "c4", table: "inspections", op: "insert", payload: { id: "insp-4" } });
    await enqueueMutation({ customerId: "c5", table: "inspection_items", op: "insert", payload: { id: "item-5" } });

    const summary = await syncAll();

    expect(summary.synced).toBe(1);
    expect(summary.failed).toBe(1);
    expect(await listPendingMutationsForCustomer("c5")).toHaveLength(0);
  });

  it("marks a download as synced once all of its mutations are uploaded", async () => {
    const db = await getOfflineDb();
    await db.put("downloads", {
      customerId: "c6",
      customerNameEnc: { iv: new Uint8Array(), ciphertext: new ArrayBuffer(0) },
      watermarkId: "w1",
      downloadedAt: new Date().toISOString(),
      lastSyncedAt: null,
      lastActivityAt: new Date().toISOString(),
      productIds: [],
    });
    await enqueueMutation({ customerId: "c6", table: "inspections", op: "insert", payload: { id: "insp-6" } });

    await syncAll();

    const entry = await db.get("downloads", "c6");
    expect(entry?.lastSyncedAt).not.toBeNull();
  });

  it("removes a fully synced, long-idle download automatically", async () => {
    const db = await getOfflineDb();
    const longAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    await db.put("downloads", {
      customerId: "c7",
      customerNameEnc: { iv: new Uint8Array(), ciphertext: new ArrayBuffer(0) },
      watermarkId: "w2",
      downloadedAt: longAgo,
      lastSyncedAt: null,
      lastActivityAt: longAgo,
      productIds: [],
    });
    await enqueueMutation({ customerId: "c7", table: "inspections", op: "insert", payload: { id: "insp-7" } });

    await syncAll();

    expect(await db.get("downloads", "c7")).toBeUndefined();
  });

  it("does not remove a synced download that was active moments ago (flaky-wifi case)", async () => {
    const db = await getOfflineDb();
    const justNow = new Date().toISOString();
    await db.put("downloads", {
      customerId: "c8",
      customerNameEnc: { iv: new Uint8Array(), ciphertext: new ArrayBuffer(0) },
      watermarkId: "w3",
      downloadedAt: justNow,
      lastSyncedAt: null,
      lastActivityAt: justNow,
      productIds: [],
    });
    await enqueueMutation({ customerId: "c8", table: "inspections", op: "insert", payload: { id: "insp-8" } });

    await syncAll();

    expect(await db.get("downloads", "c8")).toBeDefined();
  });

  it("treats an update that matches zero rows as a failure (row never landed -- keep for retry)", async () => {
    zeroRowTables.add("inspection_items");
    await enqueueMutation({
      customerId: "c11",
      table: "inspection_items",
      op: "update",
      payload: { id: "item-11", result: "passed" },
    });

    const summary = await syncAll();

    expect(summary.failed).toBe(1);
    const remaining = await listPendingMutationsForCustomer("c11");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].status).toBe("failed");
    expect(remaining[0].lastError).toContain("geen bestaande rij");
  });

  it("skips the rest of a customer's chain after a failure (no FK spam, no lost updates)", async () => {
    failTables.add("inspections");
    await enqueueMutation({ customerId: "c12", table: "inspections", op: "insert", payload: { id: "insp-12" } });
    await enqueueMutation({
      customerId: "c12",
      table: "inspection_items",
      op: "insert",
      payload: { id: "item-12", inspection_id: "insp-12" },
    });
    await enqueueMutation({
      customerId: "c12",
      table: "inspection_items",
      op: "update",
      payload: { id: "item-12", result: "passed" },
    });

    const summary = await syncAll();

    // Alleen de keuring-insert is geprobeerd; de rest van de keten is niet
    // aangeraakt en blijft gewoon pending voor de volgende ronde.
    expect(calls.map((c) => c.table)).toEqual(["inspections"]);
    expect(summary.failed).toBe(1);
    const remaining = await listPendingMutationsForCustomer("c12");
    expect(remaining).toHaveLength(3);
    expect(remaining.map((m) => m.status)).toEqual(["failed", "pending", "pending"]);
  });

  it("does not clean up an idle download that still has an inspection awaiting its certificate", async () => {
    const db = await getOfflineDb();
    const longAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    await db.put("downloads", downloadEntry("c13", longAgo));
    await db.put("inspections", inspectionRow("insp-13", "c13", "pending_completion"));

    await syncAll();

    // Geen mutaties, wel >4h idle -- maar de pending_completion-keuring is de
    // enige plek die vastlegt dat er nog een certificaat gegenereerd moet
    // worden, dus de download moet blijven staan.
    expect(await db.get("downloads", "c13")).toBeDefined();
  });

  it("processes the full queue across customers (sanity check on listAllPendingMutations)", async () => {
    await enqueueMutation({ customerId: "c9", table: "inspections", op: "insert", payload: { id: "a" } });
    await enqueueMutation({ customerId: "c10", table: "inspections", op: "insert", payload: { id: "b" } });
    expect(await listAllPendingMutations()).toHaveLength(2);
    await syncAll();
    expect(await listAllPendingMutations()).toHaveLength(0);
  });

  it("recovers a mutation stuck on 'syncing' (app crashed mid-sync) and uploads it", async () => {
    // Nabootsen van een crash midden in een eerdere sync-ronde: de mutatie
    // staat in de database met status "syncing" en zou zonder herstel nooit
    // meer opgepakt worden (listAllPendingMutations ziet alleen
    // pending/failed).
    await enqueueMutation({ customerId: "c11", table: "inspections", op: "insert", payload: { id: "stuck-1" } });
    const db = await getOfflineDb();
    const [record] = await db.getAll("mutations");
    record.status = "syncing";
    await db.put("mutations", record);
    expect(await listAllPendingMutations()).toHaveLength(0); // het gat dat we dichten

    const summary = await syncAll();

    expect(summary.synced).toBe(1);
    expect(calls.map((c) => c.arg)).toEqual([{ id: "stuck-1" }]);
    expect(await listPendingMutationsForCustomer("c11")).toHaveLength(0);
  });

  it("counts a stuck 'syncing' mutation as pending work (protects download cleanup)", async () => {
    await enqueueMutation({ customerId: "c12", table: "articles", op: "insert", payload: { id: "art-1" } });
    const db = await getOfflineDb();
    const [record] = await db.getAll("mutations");
    record.status = "syncing";
    await db.put("mutations", record);

    expect(await countPendingForCustomer("c12")).toBe(1);
  });
});

describe("removeDownload", () => {
  it("refuses (without force) while an inspection still awaits its certificate", async () => {
    const db = await getOfflineDb();
    await db.put("downloads", downloadEntry("c14", new Date().toISOString()));
    await db.put("inspections", inspectionRow("insp-14", "c14", "pending_completion"));

    await expect(removeDownload("c14")).rejects.toThrow(/certificaat/);
    expect(await db.get("downloads", "c14")).toBeDefined();
  });
});

describe("isDownloadStale", () => {
  it("is not stale right after download", () => {
    expect(isDownloadStale({ downloadedAt: new Date().toISOString(), lastSyncedAt: null })).toBe(false);
  });

  it(`is stale after ${STALE_WARNING_DAYS} days without a sync`, () => {
    const old = new Date(Date.now() - (STALE_WARNING_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    expect(isDownloadStale({ downloadedAt: old, lastSyncedAt: null })).toBe(true);
  });

  it("uses lastSyncedAt instead of downloadedAt when available", () => {
    const oldDownload = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const recentSync = new Date().toISOString();
    expect(isDownloadStale({ downloadedAt: oldDownload, lastSyncedAt: recentSync })).toBe(false);
  });
});
