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

// Lokale, derde status (bestaat alleen in de cache, nooit in de database):
// "pending_completion" = de keurmeester heeft offline op Afronden gedrukt,
// maar het certificaat kan pas gegenereerd/geüpload worden zodra er weer
// verbinding is (besloten: PDF blijft client-side, maar uitgesteld tot sync —
// zie BOUWPLAN slice 5). Een aparte status i.p.v. meteen "completed" houdt
// "Hervat" op de klantpagina correct: een keuring die nog op synchronisatie
// wacht hoort niet meer als hervatbaar concept te tonen, maar is ook nog niet
// écht afgerond (dat gebeurt pas ná de certificaatgeneratie bij sync).
export async function markInspectionPendingCompletion(key: CryptoKey, inspectionId: string): Promise<void> {
  const inspection = await getInspection<{ id: string; customer_id: string; status: string } & Record<string, unknown>>(
    key,
    inspectionId
  );
  if (!inspection) return;
  await putInspection(key, { ...inspection, status: "pending_completion" });
}

export async function listInspectionsPendingCompletion<T extends { id: string }>(key: CryptoKey): Promise<T[]> {
  const db = await getOfflineDb();
  const rows = await db.getAll("inspections");
  const pending = rows.filter((r) => r.status === "pending_completion");
  return Promise.all(pending.map((row) => decryptJson<T>(key, row.enc)));
}

/** Sleutelloos (status staat als plaintext-kolom op de rij): heeft deze klant
 * nog een offline afgeronde keuring waarvan het certificaat op synchronisatie
 * wacht? Gebruikt door de opruimlogica en removeDownload, die ook zonder
 * ontgrendelde PIN-sessie draaien en zo'n keuring nooit mogen weggooien. */
export async function hasInspectionsPendingCompletionForCustomer(customerId: string): Promise<boolean> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("inspections", "customerId", customerId);
  return rows.some((r) => r.status === "pending_completion");
}

/** Sleutelloos totaal over alle klanten, voor de sync-statusbalk: "er wacht
 * nog werk" hoort ook zichtbaar te zijn als de wachtrij leeg is maar er nog
 * certificaten gegenereerd moeten worden. */
export async function countInspectionsPendingCompletion(): Promise<number> {
  const db = await getOfflineDb();
  const rows = await db.getAll("inspections");
  return rows.filter((r) => r.status === "pending_completion").length;
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

/** Sleutelloos de lokale status van één keuring opvragen (plaintext-kolom).
 * Gebruikt door het verwijderen van een concept om een pending_completion-
 * keuring (offline afgerond, certificaat wacht op sync) nooit weg te gooien. */
export async function getLocalInspectionStatus(inspectionId: string): Promise<string | null> {
  const db = await getOfflineDb();
  const row = await db.get("inspections", inspectionId);
  return row?.status ?? null;
}

/** Verwijdert één keuring + haar items uit de lokale cache (bv. nadat een
 * concept online is weggegooid, zodat een gedownloade kopie niet blijft
 * spoken of offline weer opduikt). Geeft de item-id's terug zodat de
 * aanroeper ook wachtrij-mutaties op die items kan opruimen. */
export async function deleteInspectionCache(inspectionId: string): Promise<string[]> {
  const db = await getOfflineDb();
  const items = await db.getAllFromIndex("inspectionItems", "inspectionId", inspectionId);
  const itemIds = items.map((i) => i.id);
  const tx = db.transaction(["inspections", "inspectionItems"], "readwrite");
  void tx.objectStore("inspections").delete(inspectionId);
  for (const itemId of itemIds) void tx.objectStore("inspectionItems").delete(itemId);
  await tx.done;
  return itemIds;
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
export async function findLocalPreviousResult<T extends { article_id: string; inspection_id: string; result: string }>(
  key: CryptoKey,
  articleId: string,
  excludeInspectionId: string
): Promise<T | null> {
  const db = await getOfflineDb();
  const allItems = await db.getAll("inspectionItems");
  const candidates: T[] = [];
  for (const row of allItems) {
    const item = await decryptJson<T>(key, row.enc);
    // 'not_assessed' overslaan (Jos 2026-07-18): de hint moet de laatste
    // ÉCHTE beoordeling tonen, niet een keer dat het artikel vergeten/kwijt
    // was. Zelfde regel als de online variant in useInspections.
    if (item.article_id === articleId && item.inspection_id !== excludeInspectionId && item.result !== "not_assessed") {
      candidates.push(item);
    }
  }
  if (!candidates.length) return null;
  // Nieuwste eerst; we hebben geen created_at-index, dus simpelweg de laatst
  // toegevoegde van de kandidaten (insertievolgorde uit getAll is stabiel
  // genoeg voor een hint).
  return candidates[candidates.length - 1];
}

/** Bulk-variant van findLocalPreviousResult voor de wizard: die riep 'm per
 * keuringsitem aan, wat álle lokale items per rij opnieuw ontsleutelde --
 * O(n^2) Web Crypto-aanroepen, merkbaar traag op een tablet bij een klant
 * met honderden artikelen. Dit ontsleutelt alles precies één keer en geeft
 * per artikel dezelfde "laatst toegevoegde kandidaat"-hint terug. */
export async function findLocalPreviousResults<T extends { article_id: string; inspection_id: string; result: string }>(
  key: CryptoKey,
  articleIds: string[],
  excludeInspectionId: string
): Promise<Map<string, T>> {
  const wanted = new Set(articleIds);
  const db = await getOfflineDb();
  const allItems = await db.getAll("inspectionItems");
  const hits = new Map<string, T>();
  for (const row of allItems) {
    const item = await decryptJson<T>(key, row.enc);
    // 'not_assessed' overslaan -- zie findLocalPreviousResult hierboven.
    if (wanted.has(item.article_id) && item.inspection_id !== excludeInspectionId && item.result !== "not_assessed") {
      hits.set(item.article_id, item);
    }
  }
  return hits;
}
