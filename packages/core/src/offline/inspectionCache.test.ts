import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { deriveKey, randomBytes } from "./crypto";
import {
  putInspection,
  getInspection,
  getDraftInspectionForCustomer,
  putInspectionItems,
  getInspectionItems,
  patchInspectionItem,
  findLocalPreviousResult,
  getLocallyInspectedArticleIds,
} from "./inspectionCache";
import { getOfflineDb } from "./db";

async function testKey(): Promise<CryptoKey> {
  return deriveKey("1234", randomBytes(16));
}

// inspectionItems/inspections delen één database-singleton over alle tests in
// dit bestand (fake-indexeddb persisteert per proces); de tests die de hele
// store doorzoeken (findLocalPreviousResult, getLocallyInspectedArticleIds)
// zouden anders ook rijen van eerdere tests tegenkomen die met een andere
// (ondertussen weggegooide) sleutel versleuteld zijn.
beforeEach(async () => {
  const db = await getOfflineDb();
  await db.clear("inspections");
  await db.clear("inspectionItems");
});

describe("offline inspection cache", () => {
  it("round-trips an inspection and finds it as the customer's draft", async () => {
    const key = await testKey();
    await putInspection(key, { id: "insp-1", customer_id: "cust-1", status: "draft" });
    await putInspection(key, { id: "insp-2", customer_id: "cust-1", status: "completed" });

    const draft = await getDraftInspectionForCustomer<{ id: string }>(key, "cust-1");
    expect(draft?.id).toBe("insp-1");

    const fetched = await getInspection<{ id: string; status: string }>(key, "insp-2");
    expect(fetched?.status).toBe("completed");
  });

  it("stores and retrieves items per inspection", async () => {
    const key = await testKey();
    await putInspectionItems(key, "insp-3", [
      { id: "item-a", article_id: "art-a", result: "not_assessed" },
      { id: "item-b", article_id: "art-b", result: "not_assessed" },
    ]);
    const items = await getInspectionItems<{ id: string; result: string }>(key, "insp-3");
    expect(items.map((i) => i.id).sort()).toEqual(["item-a", "item-b"]);
  });

  it("merges a patch into an existing item without losing other fields", async () => {
    const key = await testKey();
    await putInspectionItems(key, "insp-4", [
      { id: "item-c", article_id: "art-c", result: "not_assessed", comment: null },
    ]);
    await patchInspectionItem(key, "item-c", { result: "passed", next_due: "2027-01-01" });

    const [item] = await getInspectionItems<{ id: string; result: string; next_due: string; comment: string | null }>(
      key,
      "insp-4"
    );
    expect(item).toEqual({ id: "item-c", article_id: "art-c", result: "passed", next_due: "2027-01-01", comment: null });
  });

  it("finds the previous locally cached result for an article, excluding the current inspection", async () => {
    const key = await testKey();
    await putInspectionItems(key, "insp-old", [
      { id: "item-old", article_id: "art-x", result: "passed", inspection_id: "insp-old" },
    ]);
    await putInspectionItems(key, "insp-new", [
      { id: "item-new", article_id: "art-x", result: "not_assessed", inspection_id: "insp-new" },
    ]);

    const prev = await findLocalPreviousResult<{ result: string; inspection_id: string }>(key, "art-x", "insp-new");
    expect(prev?.inspection_id).toBe("insp-old");
  });

  it("collects all locally inspected article ids across inspections", async () => {
    const key = await testKey();
    await putInspectionItems(key, "insp-5", [{ id: "item-d", article_id: "art-d" }]);
    await putInspectionItems(key, "insp-6", [{ id: "item-e", article_id: "art-e" }]);

    const ids = await getLocallyInspectedArticleIds(key);
    expect(ids.has("art-d")).toBe(true);
    expect(ids.has("art-e")).toBe(true);
    expect(ids.has("art-unknown")).toBe(false);
  });
});
