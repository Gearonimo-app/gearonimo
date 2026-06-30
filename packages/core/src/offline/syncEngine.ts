import { supabase } from "../supabase";
import { errorMessage } from "../errors";
import {
  listAllPendingMutations,
  countPendingForCustomer,
  markMutationStatus,
  deleteMutation,
} from "./mutationQueue";
import { markDownloadSynced, removeDownload } from "./download";
import { getOfflineDb, type MutationRecord } from "./db";

export interface SyncSummary {
  synced: number;
  failed: number;
  errors: string[];
}

/** Past één mutatie toe op Supabase. Inserts gaan via upsert (op de
 * client-gegenereerde id) zodat een herhaalde poging na een afgebroken
 * eerdere sync-poging geen dubbele rij of fout oplevert -- idempotent. */
async function applyMutation(m: MutationRecord): Promise<void> {
  if (m.op === "insert") {
    const { error } = await supabase.from(m.table).upsert(m.payload, { onConflict: m.matchColumn });
    if (error) throw error;
    return;
  }
  const matchValue = m.payload[m.matchColumn];
  const rest: Record<string, unknown> = { ...m.payload };
  delete rest[m.matchColumn];
  const { error } = await supabase.from(m.table).update(rest).eq(m.matchColumn, matchValue);
  if (error) throw error;
}

/** Speelt de hele mutatiewachtrij af, in volgorde -- belangrijk: niet
 * parallel, want een keuring-insert moet vóór de inserts van zijn eigen
 * keuringsitems geland zijn (foreign key). De wachtrij garandeert deze
 * volgorde al (zie useInspections.ts: eerst de keuring enqueuen, dan de
 * items), dit speelt ze gewoon in diezelfde volgorde sequentieel af. */
export async function syncAll(): Promise<SyncSummary> {
  const pending = await listAllPendingMutations();
  const summary: SyncSummary = { synced: 0, failed: 0, errors: [] };
  const touchedCustomers = new Set<string>();

  for (const mutation of pending) {
    touchedCustomers.add(mutation.customerId);
    await markMutationStatus(mutation.id!, "syncing");
    try {
      await applyMutation(mutation);
      await deleteMutation(mutation.id!);
      summary.synced += 1;
    } catch (e) {
      const message = errorMessage(e);
      await markMutationStatus(mutation.id!, "failed", message);
      summary.failed += 1;
      summary.errors.push(message);
      // Niet doorgaan na een fout voor dezelfde keten: een mislukte insert
      // (bv. keuring) zou de items die erop volgen toch laten falen op de FK.
      // Andere klanten in de wachtrij gaan gewoon door (geen totale stop).
    }
  }

  for (const customerId of touchedCustomers) {
    const remaining = await countPendingForCustomer(customerId);
    if (remaining === 0) await markDownloadSynced(customerId);
  }

  await cleanupSyncedDownloads();
  return summary;
}

/** Ruimt downloads automatisch op, maar pas als (a) alles van die klant
 * gesynchroniseerd is én (b) een tijdje niet meer actief gebruikt -- zo
 * trekt een korte wifi-flits halverwege de dag niet meteen de download weg
 * terwijl de keurmeester nog met die klant bezig is (besloten met Jos
 * 2026-06-30). Nooit data verwijderen die nog niet gesynchroniseerd is. */
export async function cleanupSyncedDownloads(inactivityHours = 4): Promise<void> {
  const db = await getOfflineDb();
  const downloads = await db.getAll("downloads");
  const now = Date.now();
  for (const entry of downloads) {
    const pending = await countPendingForCustomer(entry.customerId);
    if (pending > 0) continue;
    const idleMs = now - new Date(entry.lastActivityAt).getTime();
    if (idleMs < inactivityHours * 60 * 60 * 1000) continue;
    await removeDownload(entry.customerId, { force: true });
  }
}

export const STALE_WARNING_DAYS = 14;

/** Voor de UI: is deze download al langer dan de waarschuwingstermijn niet
 * gesynchroniseerd? Verwijdert niets vanzelf (besloten 2026-06-30) -- alleen
 * een signaal voor een zichtbare waarschuwing + handmatige verwijderknop. */
export function isDownloadStale(entry: { downloadedAt: string; lastSyncedAt: string | null }): boolean {
  const reference = entry.lastSyncedAt ?? entry.downloadedAt;
  const ageMs = Date.now() - new Date(reference).getTime();
  return ageMs > STALE_WARNING_DAYS * 24 * 60 * 60 * 1000;
}
