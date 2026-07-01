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
  putCustomerMembers,
  getCustomerMembersForCustomer,
  putArticleSets,
  getArticleSetsForCustomer,
  getArticleSet,
  pruneArticlesForCustomer,
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

  it("replaces members and sets wholesale on re-download (no stale leftovers)", async () => {
    const key = await testKey();
    await putCustomerMembers(key, "cust-7", [{ id: "mem-1", name: "Jan" }, { id: "mem-2", name: "Piet" }]);
    await putArticleSets(key, "cust-7", [{ id: "set-1", name: "Klimset A" }]);

    // Her-download: Piet is server-side verwijderd, set-1 hernoemd, set-2 nieuw.
    await putCustomerMembers(key, "cust-7", [{ id: "mem-1", name: "Jan" }]);
    await putArticleSets(key, "cust-7", [
      { id: "set-1", name: "Klimset A2" },
      { id: "set-2", name: "Klimset B" },
    ]);

    const members = await getCustomerMembersForCustomer<{ id: string }>(key, "cust-7");
    expect(members.map((m) => m.id)).toEqual(["mem-1"]);
    const sets = await getArticleSetsForCustomer<{ id: string; name: string }>(key, "cust-7");
    expect(sets.map((s) => s.id).sort()).toEqual(["set-1", "set-2"]);
    expect((await getArticleSet<{ name: string }>(key, "set-1"))?.name).toBe("Klimset A2");
  });

  it("cleans up members and sets with the rest of the customer cache", async () => {
    const key = await testKey();
    await putCustomerMembers(key, "cust-8", [{ id: "mem-8" }]);
    await putArticleSets(key, "cust-8", [{ id: "set-8" }]);

    await deleteCustomerCache("cust-8");

    expect(await getCustomerMembersForCustomer(key, "cust-8")).toEqual([]);
    expect(await getArticleSetsForCustomer(key, "cust-8")).toEqual([]);
  });

  it("prunes cached articles that vanished server-side, keeping the fresh ones", async () => {
    const key = await testKey();
    await putArticles(key, "cust-9", [{ id: "art-9a" }, { id: "art-9b" }]);

    // Her-download: alleen art-9a bestaat nog op de server.
    await pruneArticlesForCustomer("cust-9", new Set(["art-9a"]));

    const remaining = await getArticlesForCustomer<{ id: string }>(key, "cust-9");
    expect(remaining.map((a) => a.id)).toEqual(["art-9a"]);
  });
});
