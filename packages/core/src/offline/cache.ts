import { getOfflineDb, type ArticleRecord, type EncryptedRecord } from "./db";
import { encryptJson, decryptJson } from "./crypto";

// Lees/schrijf-laag voor de versleutelde offline-cache. Eén plek die weet hoe
// een record versleuteld/ontsleuteld wordt; download.ts en de composables
// errboven praten in gewone (plain) objecten.

export async function putCustomer(key: CryptoKey, customer: { id: string } & Record<string, unknown>): Promise<void> {
  const db = await getOfflineDb();
  const enc = await encryptJson(key, customer);
  await db.put("customers", { id: customer.id, enc });
}

export async function getCustomer<T>(key: CryptoKey, id: string): Promise<T | null> {
  const db = await getOfflineDb();
  const row = await db.get("customers", id);
  if (!row) return null;
  return decryptJson<T>(key, row.enc);
}

export async function putArticles(
  key: CryptoKey,
  customerId: string,
  articles: ({ id: string } & Record<string, unknown>)[]
): Promise<void> {
  // Eerst alles versleutelen (echt async, Web Crypto), dán pas de transactie
  // openen: IndexedDB-transacties sluiten automatisch zodra er geen
  // synchrone/microtask-aaneengesloten activiteit meer in zit, en
  // crypto.subtle is geen microtask-achtige await.
  const encrypted = await Promise.all(
    articles.map(async (article) => ({ id: article.id, customerId, enc: await encryptJson(key, article) }))
  );
  const db = await getOfflineDb();
  const tx = db.transaction("articles", "readwrite");
  for (const record of encrypted) {
    void tx.store.put(record);
  }
  await tx.done;
}

export async function getArticlesForCustomer<T>(key: CryptoKey, customerId: string): Promise<T[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("articles", "customerId", customerId);
  return Promise.all(rows.map((row) => decryptJson<T>(key, row.enc)));
}

export async function getArticle<T>(key: CryptoKey, id: string): Promise<T | null> {
  const db = await getOfflineDb();
  const row = await db.get("articles", id);
  if (!row) return null;
  return decryptJson<T>(key, row.enc);
}

export async function putProducts(key: CryptoKey, products: ({ id: string } & Record<string, unknown>)[]): Promise<void> {
  const encrypted = await Promise.all(
    products.map(async (product) => ({ id: product.id, enc: await encryptJson(key, product) }))
  );
  const db = await getOfflineDb();
  const tx = db.transaction("products", "readwrite");
  for (const record of encrypted) {
    void tx.store.put(record);
  }
  await tx.done;
}

export async function getProducts<T>(key: CryptoKey, ids: string[]): Promise<T[]> {
  const db = await getOfflineDb();
  const out: T[] = [];
  for (const id of ids) {
    const row = await db.get("products", id);
    if (row) out.push(await decryptJson<T>(key, row.enc));
  }
  return out;
}

/** Verwijdert gecachete artikelen van deze klant die niet meer in `keepIds`
 * zitten -- bij een her-download, zodat server-side verwijderde/afgevoerde
 * artikelen niet als spookrijen offline blijven opduiken. De aanroeper is
 * verantwoordelijk om dit NIET te doen zolang er nog niet-gesynchroniseerde
 * mutaties voor deze klant zijn (offline aangemaakte artikelen staan dan nog
 * niet op de server en zouden hier onterecht sneuvelen). */
export async function pruneArticlesForCustomer(customerId: string, keepIds: Set<string>): Promise<void> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("articles", "customerId", customerId);
  const tx = db.transaction("articles", "readwrite");
  for (const row of rows) {
    if (!keepIds.has(row.id)) void tx.store.delete(row.id);
  }
  await tx.done;
}

// Medewerkers en sets van de klant: zelfde versleutel-aanpak, maar met
// vervang-alles-semantiek per klant -- een her-download is de volledige
// serverstand, dus wat er lokaal nog extra staat is per definitie verouderd.
// (Er bestaan geen offline-schrijfacties voor deze twee, dus er kan geen
// lokaal-nieuwer record tussen zitten.)

async function replaceCustomerScoped(
  store: "customerMembers" | "articleSets",
  key: CryptoKey,
  customerId: string,
  rows: ({ id: string } & Record<string, unknown>)[]
): Promise<void> {
  const encrypted = await Promise.all(
    rows.map(async (row) => ({ id: row.id, customerId, enc: await encryptJson(key, row) }))
  );
  const db = await getOfflineDb();
  const existing = await db.getAllFromIndex(store, "customerId", customerId);
  const tx = db.transaction(store, "readwrite");
  for (const row of existing) {
    void tx.store.delete(row.id);
  }
  for (const record of encrypted) {
    void tx.store.put(record);
  }
  await tx.done;
}

export async function putCustomerMembers(
  key: CryptoKey,
  customerId: string,
  members: ({ id: string } & Record<string, unknown>)[]
): Promise<void> {
  await replaceCustomerScoped("customerMembers", key, customerId, members);
}

export async function getCustomerMembersForCustomer<T>(key: CryptoKey, customerId: string): Promise<T[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("customerMembers", "customerId", customerId);
  return Promise.all(rows.map((row) => decryptJson<T>(key, row.enc)));
}

export async function putArticleSets(
  key: CryptoKey,
  customerId: string,
  sets: ({ id: string } & Record<string, unknown>)[]
): Promise<void> {
  await replaceCustomerScoped("articleSets", key, customerId, sets);
}

export async function getArticleSetsForCustomer<T>(key: CryptoKey, customerId: string): Promise<T[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("articleSets", "customerId", customerId);
  return Promise.all(rows.map((row) => decryptJson<T>(key, row.enc)));
}

export async function getArticleSet<T>(key: CryptoKey, id: string): Promise<T | null> {
  const db = await getOfflineDb();
  const row = await db.get("articleSets", id);
  if (!row) return null;
  return decryptJson<T>(key, row.enc);
}

export async function putRejectionCodes(
  key: CryptoKey,
  companyId: string,
  codes: { id: string; code: number; label: string | null }[]
): Promise<void> {
  const db = await getOfflineDb();
  const enc = await encryptJson(key, codes);
  await db.put("rejectionCodes", { id: companyId, enc });
}

export async function getRejectionCodes<T>(key: CryptoKey, companyId: string): Promise<T[]> {
  const db = await getOfflineDb();
  const row = await db.get("rejectionCodes", companyId);
  if (!row) return [];
  return decryptJson<T[]>(key, row.enc);
}

export async function putCompanySettings(
  key: CryptoKey,
  companyId: string,
  settings: Record<string, unknown>
): Promise<void> {
  const db = await getOfflineDb();
  const enc = await encryptJson(key, settings);
  await db.put("companySettings", { id: companyId, enc });
}

export async function getCompanySettings<T>(key: CryptoKey, companyId: string): Promise<T | null> {
  const db = await getOfflineDb();
  const row = await db.get("companySettings", companyId);
  if (!row) return null;
  return decryptJson<T>(key, row.enc);
}

/** Verwijdert alle gecachete data van één klant (download "uitzetten"). Geeft
 * de product-id's terug die deze klant gebruikte, zodat de aanroeper kan
 * beslissen of een gedeeld catalogusproduct ook opgeruimd mag worden (alleen
 * als geen andere gedownloade klant het nog gebruikt). */
export async function deleteCustomerCache(customerId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.delete("customers", customerId);
  for (const store of ["articles", "customerMembers", "articleSets"] as const) {
    const rows = await db.getAllFromIndex(store, "customerId", customerId);
    const tx = db.transaction(store, "readwrite");
    await Promise.all(rows.map((r) => tx.store.delete(r.id)));
    await tx.done;
  }
}

export async function pruneUnusedProducts(stillUsedProductIds: Set<string>): Promise<void> {
  const db = await getOfflineDb();
  const allIds = await db.getAllKeys("products");
  const tx = db.transaction("products", "readwrite");
  await Promise.all(
    allIds.filter((id) => !stillUsedProductIds.has(String(id))).map((id) => tx.store.delete(id))
  );
  await tx.done;
}

export type { ArticleRecord, EncryptedRecord };
