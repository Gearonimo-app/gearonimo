import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import {
  enqueueMutation,
  listPendingMutationsForCustomer,
  countPendingForCustomer,
  markMutationStatus,
  deleteMutation,
  listAllPendingMutations,
} from "./mutationQueue";
import { getOfflineDb } from "./db";

beforeEach(async () => {
  const db = await getOfflineDb();
  await db.clear("mutations");
});

describe("mutation queue", () => {
  it("enqueues an insert as its own entry", async () => {
    await enqueueMutation({ customerId: "c1", table: "inspections", op: "insert", payload: { id: "i1" } });
    const rows = await listPendingMutationsForCustomer("c1");
    expect(rows).toHaveLength(1);
    expect(rows[0].op).toBe("insert");
  });

  it("merges repeated updates to the same record into one pending mutation", async () => {
    await enqueueMutation({
      customerId: "c1",
      table: "inspection_items",
      op: "update",
      payload: { id: "item1", result: "passed" },
    });
    await enqueueMutation({
      customerId: "c1",
      table: "inspection_items",
      op: "update",
      payload: { id: "item1", comment: "ziet er goed uit" },
    });

    const rows = await listPendingMutationsForCustomer("c1");
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ id: "item1", result: "passed", comment: "ziet er goed uit" });
  });

  it("does not merge updates to different records", async () => {
    await enqueueMutation({ customerId: "c1", table: "inspection_items", op: "update", payload: { id: "item1", result: "passed" } });
    await enqueueMutation({ customerId: "c1", table: "inspection_items", op: "update", payload: { id: "item2", result: "rejected" } });
    const rows = await listPendingMutationsForCustomer("c1");
    expect(rows).toHaveLength(2);
  });

  it("does not merge an update that arrives after the prior one already started syncing", async () => {
    await enqueueMutation({ customerId: "c1", table: "inspection_items", op: "update", payload: { id: "item1", result: "passed" } });
    const [first] = await listPendingMutationsForCustomer("c1");
    await markMutationStatus(first.id!, "syncing");

    await enqueueMutation({ customerId: "c1", table: "inspection_items", op: "update", payload: { id: "item1", comment: "extra" } });
    const rows = await listPendingMutationsForCustomer("c1");
    expect(rows).toHaveLength(2);
  });

  it("counts only pending/failed mutations", async () => {
    await enqueueMutation({ customerId: "c2", table: "inspections", op: "insert", payload: { id: "i2" } });
    const [row] = await listPendingMutationsForCustomer("c2");
    await markMutationStatus(row.id!, "syncing");
    expect(await countPendingForCustomer("c2")).toBe(0);

    await markMutationStatus(row.id!, "failed", "netwerkfout");
    expect(await countPendingForCustomer("c2")).toBe(1);
  });

  it("removes a mutation once synced", async () => {
    await enqueueMutation({ customerId: "c3", table: "inspections", op: "insert", payload: { id: "i3" } });
    const [row] = await listPendingMutationsForCustomer("c3");
    await deleteMutation(row.id!);
    expect(await listPendingMutationsForCustomer("c3")).toHaveLength(0);
  });

  it("lists pending mutations across all customers in queue order", async () => {
    await enqueueMutation({ customerId: "c1", table: "inspections", op: "insert", payload: { id: "a" } });
    await enqueueMutation({ customerId: "c2", table: "inspections", op: "insert", payload: { id: "b" } });
    const all = await listAllPendingMutations();
    expect(all.map((m) => m.payload.id)).toEqual(["a", "b"]);
  });
});
