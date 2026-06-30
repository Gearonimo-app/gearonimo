import { getOfflineDb } from "./db";
import { encryptJson, decryptJson } from "./crypto";

// Lokale cache van keuringen + keuringsitems, zelfde versleutel-aanpak als
// cache.ts. Apart bestand omdat keuringen een eigen levenscyclus hebben
// (concept -> ingevuld -> afgerond) en straks (slice 5) de
// certificaat-afhandeling erbij komt.

export async function putInspection(
  key: CryptoKey,
  inspection: { id: string; customer_id: string; status: string } & Record<string, unknown>
): Promise<void> {
  const db = await getOfflineDb();
  const enc = await encryptJson(key, inspection);
  await db.put("inspections", { id: inspection.id, customerId: inspection.customer_id, status: inspection.status, enc });
}

export async function getInspection<T>(key: CryptoKey, id: string): Promise<T | null> {
  const db = await getOfflineDb();
  const row = await db.get("inspections", id);
  if (!row) return null;
  return decryptJson<T>(key, row.enc);
}

export async function getDraftInspectionForCustomer<T>(key: CryptoKey, customerId: string): Promise<T | null> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("inspections", "customerId", customerId);
  const draftRow = rows.find((r) => r.status === "draft");
  if (!draftRow) return null;
  return decryptJson<T>(key, draftRow.enc);
}

export async function putInspectionItems(
  key: CryptoKey,
  inspectionId: string,
  items: ({ id: string } & Record<string, unknown>)[]
): Promise<void> {
  // Zelfde reden als putArticles: eerst alles versleutelen, dán pas de
  // IndexedDB-transactie openen (anders sluit die voortijdig door de
  // async Web Crypto-aanroepen).
  const encrypted = await Promise.all(
    items.map(async (item) => ({ id: item.id, inspectionId, enc: await encryptJson(key, item) }))
  );
  const db = await getOfflineDb();
  const tx = db.transaction("inspectionItems", "readwrite");
  for (const record of encrypted) {
    void tx.store.put(record);
  }
  await tx.done;
}

export async function getInspectionItems<T>(key: CryptoKey, inspectionId: string): Promise<T[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("inspectionItems", "inspectionId", inspectionId);
  return Promise.all(rows.map((row) => decryptJson<T>(key, row.enc)));
}

/** Eén keuringsitem bijwerken (resultaat invullen tijdens de keuring). Leest
 * het bestaande record, voegt de patch toe en versleutelt opnieuw -- de
 * lokale weergave is hiermee altijd de laatste stand, los van de
 * mutatiewachtrij die hetzelfde naar de server stuurt. */
export async function patchInspectionItem(
  key: CryptoKey,
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const db = await getOfflineDb();
  const row = await db.get("inspectionItems", id);
  if (!row) return;
  const current = await decryptJson<Record<string, unknown>>(key, row.enc);
  const merged = { ...current, ...patch };
  const enc = await encryptJson(key, merged);
  await db.put("inspectionItems", { ...row, enc });
}

/** Verwijdert alle lokaal gecachete keuringen + keuringsitems van één klant
 * (gebruikt door removeDownload). Alleen veilig als er geen openstaande
 * mutaties meer zijn voor deze klant -- dat checkt de aanroeper. */
export async function deleteInspectionsForCustomer(customerId: string): Promise<void> {
  const db = await getOfflineDb();
  const inspections = await db.getAllFromIndex("inspections", "customerId", customerId);
  const itemIds: string[] = [];
  for (const insp of inspections) {
    const items = await db.getAllFromIndex("inspectionItems", "inspectionId", insp.id);
    itemIds.push(...items.map((i) => i.id));
  }
  const tx = db.transaction(["inspections", "inspectionItems"], "readwrite");
  for (const insp of inspections) void tx.objectStore("inspections").delete(insp.id);
  for (const itemId of itemIds) void tx.objectStore("inspectionItems").delete(itemId);
  await tx.done;
}

/** Alle artikel-id's waar lokaal al minstens één keuringsitem voor bestaat
 * (op dit toestel, ongeacht welke keuring) -- gebruikt om offline te bepalen
 * welke artikelen "nieuw" zijn voor de scope-keuze bij het starten/hervatten
 * van een keuring (zie fetchArticleScope in useInspections.ts). */
export async function getLocallyInspectedArticleIds(key: CryptoKey): Promise<Set<string>> {
  const db = await getOfflineDb();
  const allItems = await db.getAll("inspectionItems");
  const ids = new Set<string>();
  for (const row of allItems) {
    const item = await decryptJson<{ article_id: string }>(key, row.enc);
    ids.add(item.article_id);
  }
  return ids;
}

/** Alle lokaal bekende eerdere keuringsitems voor een artikel, voor de
 * "vorige keuring"-contexthint in de wizard. Beperking: ziet alleen
 * geschiedenis die op dít toestel ooit gecached is (gedownload of zelf
 * offline gemaakt), niet de volledige serverhistorie -- prima voor een
 * contexthint, niet voor besluitvorming (de keurmeester vult het resultaat
 * altijd zelf opnieuw in). */
export async function findLocalPreviousResult<T extends { article_id: string; inspection_id: string }>(
  key: CryptoKey,
  articleId: string,
  excludeInspectionId: string
): Promise<T | null> {
  const db = await getOfflineDb();
  const allItems = await db.getAll("inspectionItems");
  const candidates: T[] = [];
  for (const row of allItems) {
    const item = await decryptJson<T>(key, row.enc);
    if (item.article_id === articleId && item.inspection_id !== excludeInspectionId) {
      candidates.push(item);
    }
  }
  if (!candidates.length) return null;
  // Nieuwste eerst; we hebben geen created_at-index, dus simpelweg de laatst
  // toegevoegde van de kandidaten (insertievolgorde uit getAll is stabiel
  // genoeg voor een hint).
  return candidates[candidates.length - 1];
}
