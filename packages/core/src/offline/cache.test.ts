import "fake-indexeddb/auto";
import { describe, it, expect } from "vitest";
import { deriveKey, randomBytes } from "./crypto";
import {
  putCustomer,
  getCustomer,
  putArticles,
  getArticlesForCustomer,
  getArticle,
  putProducts,
  getProducts,
  deleteCustomerCache,
  pruneUnusedProducts,
} from "./cache";
import { getOfflineDb } from "./db";

async function testKey(): Promise<CryptoKey> {
  return deriveKey("1234", randomBytes(16));
}

describe("offline cache", () => {
  it("round-trips a customer record, encrypted at rest", async () => {
    const key = await testKey();
    await putCustomer(key, { id: "cust-1", name: "Acme BV", email: "info@acme.test" });

    const result = await getCustomer<{ id: string; name: string }>(key, "cust-1");
    expect(result?.name).toBe("Acme BV");

    // De ruwe IndexedDB-rij mag het Acme-veld nergens in plaintext bevatten.
    const db = await getOfflineDb();
    const raw = await db.get("customers", "cust-1");
    const rawJson = JSON.stringify(raw);
    expect(rawJson).not.toContain("Acme");
  });

  it("indexes articles by customer", async () => {
    const key = await testKey();
    await putArticles(key, "cust-2", [
      { id: "art-1", serial_number: "SN-1" },
      { id: "art-2", serial_number: "SN-2" },
    ]);
    await putArticles(key, "cust-3", [{ id: "art-3", serial_number: "SN-3" }]);

    const articles = await getArticlesForCustomer<{ id: string; serial_number: string }>(key, "cust-2");
    expect(articles.map((a) => a.id).sort()).toEqual(["art-1", "art-2"]);
  });

  it("removes a customer's articles on deleteCustomerCache without touching others", async () => {
    const key = await testKey();
    await putCustomer(key, { id: "cust-4", name: "Te verwijderen" });
    await putArticles(key, "cust-4", [{ id: "art-4a" }, { id: "art-4b" }]);
    await putCustomer(key, { id: "cust-5", name: "Blijft staan" });
    await putArticles(key, "cust-5", [{ id: "art-5a" }]);

    await deleteCustomerCache("cust-4");

    expect(await getCustomer(key, "cust-4")).toBeNull();
    expect(await getArticlesForCustomer(key, "cust-4")).toEqual([]);
    expect(await getArticlesForCustomer(key, "cust-5")).toHaveLength(1);
  });

  it("prunes only products no longer referenced by any download", async () => {
    const key = await testKey();
    await putProducts(key, [
      { id: "prod-shared", brand: "Petzl" },
      { id: "prod-orphan", brand: "Singing Rock" },
    ]);

    await pruneUnusedProducts(new Set(["prod-shared"]));

    const remaining = await getProducts<{ id: string }>(key, ["prod-shared", "prod-orphan"]);
    expect(remaining.map((p) => p.id)).toEqual(["prod-shared"]);
  });

  it("looks up a single article by id, independent of customer scoping", async () => {
    const key = await testKey();
    await putArticles(key, "cust-6", [{ id: "art-6a", serial_number: "SN-6" }]);

    const found = await getArticle<{ id: string; serial_number: string }>(key, "art-6a");
    expect(found?.serial_number).toBe("SN-6");
    expect(await getArticle(key, "does-not-exist")).toBeNull();
  });
});
