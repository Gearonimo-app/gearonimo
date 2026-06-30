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
  return rows.filter((r) => r.status === "pending" || r.status === "failed").length;
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
