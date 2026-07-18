import { getOfflineDb, type MutationRecord, type MutationStatus } from "./db";

// De mutatiewachtrij: alles wat offline geschreven wordt komt hier als rij
// bij, in volgorde, en wordt later (slice 4, sync-engine) afgespeeld richting
// Supabase. Conflictstrategie (besloten): last-write-wins per record. Voor
// "update"-mutaties betekent dat hier al iets: een tweede wijziging aan
// hetzelfde record (zelfde tabel + matchColumn-waarde) wordt **samengevoegd**
// in de al openstaande mutatie i.p.v. een nieuwe rij toe te voegen -- anders
// zou elke toetsaanslag een eigen wachtrij-item worden. Inserts worden nooit
// samengevoegd (elke insert is een eigen, nieuw record).

export interface EnqueueInput {
  customerId: string;
  table: string;
  op: "insert" | "update";
  payload: Record<string, unknown>;
  matchColumn?: string;
}

export async function enqueueMutation(input: EnqueueInput): Promise<void> {
  const matchColumn = input.matchColumn ?? "id";
  const db = await getOfflineDb();

  if (input.op === "update") {
    const matchValue = input.payload[matchColumn];
    const existing = await db.getAllFromIndex("mutations", "customerId", input.customerId);
    const pendingMatch = existing.find(
      (m) =>
        m.status === "pending" &&
        m.op === "update" &&
        m.table === input.table &&
        m.matchColumn === matchColumn &&
        m.payload[matchColumn] === matchValue
    );
    if (pendingMatch) {
      pendingMatch.payload = { ...pendingMatch.payload, ...input.payload };
      pendingMatch.createdAt = new Date().toISOString();
      await db.put("mutations", pendingMatch);
      return;
    }
  }

  const record: MutationRecord = {
    customerId: input.customerId,
    table: input.table,
    op: input.op,
    payload: input.payload,
    matchColumn,
    status: "pending",
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
  };
  await db.add("mutations", record);
}

export async function listPendingMutationsForCustomer(customerId: string): Promise<MutationRecord[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllFromIndex("mutations", "customerId", customerId);
  return rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function countPendingForCustomer(customerId: string): Promise<number> {
  const rows = await listPendingMutationsForCustomer(customerId);
  // "syncing" telt bewust mee als openstaand werk (code review 2026-07-18):
  // crasht de app midden in een sync, dan blijft die status achter. Zou hij
  // hier niet meetellen, dan kon de opruimlogica (cleanupSyncedDownloads) een
  // download verwijderen terwijl er nog een niet-verzonden mutatie in zat.
  return rows.filter((r) => r.status === "pending" || r.status === "failed" || r.status === "syncing").length;
}

/** Herstelt mutaties die op "syncing" zijn blijven staan (app gecrasht of
 * gesloten midden in een sync-ronde) terug naar "pending", zodat de volgende
 * ronde ze gewoon weer oppakt. Wordt aan het begin van syncAll aangeroepen --
 * op dat moment loopt er geen andere sync (app-laag bewaakt dat met de
 * `syncing`-vlag), dus elke "syncing"-status die we hier tegenkomen is per
 * definitie een achtergebleven rest. Zonder dit herstel werd zo'n mutatie
 * nooit meer geprobeerd én nooit opgeruimd: onzichtbaar verloren werk. */
export async function recoverStuckSyncing(): Promise<number> {
  const db = await getOfflineDb();
  const all = await db.getAll("mutations");
  let recovered = 0;
  for (const m of all) {
    if (m.status === "syncing") {
      m.status = "pending";
      m.lastError = "Hersteld na afgebroken synchronisatie.";
      await db.put("mutations", m);
      recovered += 1;
    }
  }
  return recovered;
}

/** Alle openstaande mutaties, in volgorde -- gebruikt door de sync-engine
 * (slice 4) om de hele wachtrij in één keer af te spelen, niet per klant. */
export async function listAllPendingMutations(): Promise<MutationRecord[]> {
  const db = await getOfflineDb();
  const all = await db.getAll("mutations");
  return all.filter((r) => r.status === "pending" || r.status === "failed").sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function markMutationStatus(id: number, status: MutationStatus, error: string | null = null): Promise<void> {
  const db = await getOfflineDb();
  const record = await db.get("mutations", id);
  if (!record) return;
  record.status = status;
  record.lastError = error;
  if (status === "failed") record.attempts += 1;
  await db.put("mutations", record);
}

export async function deleteMutation(id: number): Promise<void> {
  const db = await getOfflineDb();
  await db.delete("mutations", id);
}

/** Ruimt alle wachtrij-mutaties op die bij één keuring horen (de keuring
 * zelf, inserts van haar items, en updates op die items -- die laatste dragen
 * alleen het item-id, vandaar de meegegeven lijst). Gebruikt bij het
 * verwijderen van een concept: zonder dit zou de eerstvolgende sync het net
 * verwijderde concept gewoon opnieuw op de server zetten. */
export async function deleteMutationsForInspection(inspectionId: string, itemIds: string[]): Promise<void> {
  const itemIdSet = new Set(itemIds);
  const db = await getOfflineDb();
  const all = await db.getAll("mutations");
  for (const m of all) {
    const p = m.payload as { id?: unknown; inspection_id?: unknown };
    const hit =
      (m.table === "inspections" && p.id === inspectionId) ||
      (m.table === "inspection_items" && (p.inspection_id === inspectionId || itemIdSet.has(String(p.id))));
    if (hit && m.id != null) await db.delete("mutations", m.id);
  }
}
