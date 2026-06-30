import { supabase } from "../supabase";
import { getOfflineDb, type DownloadEntry } from "./db";
import {
  putCustomer,
  putArticles,
  putProducts,
  putRejectionCodes,
  putCompanySettings,
  deleteCustomerCache,
  pruneUnusedProducts,
} from "./cache";
import { putInspection, putInspectionItems, deleteInspectionsForCustomer, getInspection } from "./inspectionCache";
import { countPendingForCustomer } from "./mutationQueue";
import { encryptJson, decryptJson } from "./crypto";

export interface InspectorContext {
  companyId: string;
  inspectorId: string;
}

// De inspector-eigen identiteit (welk keurbedrijf, welke keurmeester-rij) is
// niet klant-specifiek en niet gevoelig (de gebruiker kent zijn eigen
// gegevens al uit zijn sessie) -- onversleuteld in meta, zodat
// ensureInspector() ook zonder netwerk werkt, zolang er ooit online is
// ingelogd.
export async function cacheInspectorContext(ctx: InspectorContext): Promise<void> {
  const db = await getOfflineDb();
  await db.put("meta", ctx, "inspectorContext");
}

export async function getCachedInspectorContext(): Promise<InspectorContext | undefined> {
  const db = await getOfflineDb();
  return (await db.get("meta", "inspectorContext")) as InspectorContext | undefined;
}

export interface DownloadSummary {
  customerId: string;
  customerName: string;
  downloadedAt: string;
  lastSyncedAt: string | null;
  pendingMutations: number;
}

/** Legt server-side vast dat deze keurmeester deze klant offline heeft
 * gedownload (forensisch spoor, zie migratie 20260705_offline_downloads.sql).
 * De id wordt server-side aangemaakt en is dus niet door de keurmeester zelf
 * te vervalsen, ook al staat RLS uit -- alleen aanwezigheid van de rij telt. */
async function recordWatermark(ctx: InspectorContext, customerId: string): Promise<string> {
  const { data, error } = await supabase
    .from("offline_downloads")
    .insert({ company_id: ctx.companyId, inspector_id: ctx.inspectorId, customer_id: customerId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Haalt klant + diens artikelen + de catalogusproducten die daarbij horen +
 * afkeurcodes + bedrijfsinstellingen op en zet ze versleuteld lokaal. Alleen
 * wat voor déze klant relevant is -- niet de hele klanten-/productenbestand
 * (dataminimalisatie, besloten met Jos 2026-06-30). */
export async function downloadCustomer(key: CryptoKey, ctx: InspectorContext, customerId: string): Promise<void> {
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .single();
  if (custErr) throw custErr;

  const { data: articles, error: artErr } = await supabase
    .from("articles")
    .select("*")
    .eq("customer_id", customerId)
    .eq("retired", false);
  if (artErr) throw artErr;

  const productIds = [...new Set((articles ?? []).map((a) => a.product_id).filter((id): id is string => !!id))];
  let products: ({ id: string } & Record<string, unknown>)[] = [];
  if (productIds.length) {
    const { data, error } = await supabase.from("products").select("*").in("id", productIds);
    if (error) throw error;
    products = data ?? [];
  }

  const { data: rejectionCodes, error: rcErr } = await supabase
    .from("rejection_codes")
    .select("id, code, label, active")
    .eq("company_id", ctx.companyId)
    .eq("active", true)
    .order("code");
  if (rcErr) throw rcErr;

  const { data: company, error: companyErr } = await supabase
    .from("inspection_companies")
    .select("*")
    .eq("id", ctx.companyId)
    .single();
  if (companyErr) throw companyErr;

  // Een al lopend concept van deze klant ook meenemen, zodat hervatten
  // offline werkt (niet alleen nieuw starten).
  const { data: draftInspection, error: draftErr } = await supabase
    .from("inspections")
    .select("*")
    .eq("customer_id", customerId)
    .eq("company_id", ctx.companyId)
    .eq("status", "draft")
    .maybeSingle();
  if (draftErr) throw draftErr;
  let draftItems: ({ id: string } & Record<string, unknown>)[] = [];
  if (draftInspection) {
    const { data, error } = await supabase
      .from("inspection_items")
      .select("*")
      .eq("inspection_id", draftInspection.id);
    if (error) throw error;
    draftItems = data ?? [];
  }

  const watermarkId = await recordWatermark(ctx, customerId);

  await putCustomer(key, customer);
  await putArticles(key, customerId, articles ?? []);
  if (products.length) await putProducts(key, products);
  await putRejectionCodes(key, ctx.companyId, (rejectionCodes ?? []) as { id: string; code: number; label: string | null }[]);
  await putCompanySettings(key, ctx.companyId, company);
  // Niet overschrijven als deze keuring lokaal al "pending_completion" is
  // (offline afgerond, certificaat wacht nog op sync, zie BOUWPLAN slice 5):
  // op de server staat hij dan nog gewoon op "draft" totdat de sync-engine
  // 'm afrondt, en een her-download zou anders die lokale status -- en
  // daarmee het feit dat het certificaat nog gegenereerd moet worden -- stil
  // wissen.
  const localInspection = draftInspection
    ? await getInspection<{ status: string }>(key, draftInspection.id)
    : null;
  if (draftInspection && localInspection?.status !== "pending_completion") {
    await putInspection(key, draftInspection);
    if (draftItems.length) await putInspectionItems(key, draftInspection.id, draftItems);
  }

  const db = await getOfflineDb();
  const now = new Date().toISOString();
  const nameEnc = await encryptJson(key, customer.name as string);
  const entry: DownloadEntry = {
    customerId,
    customerNameEnc: nameEnc,
    watermarkId,
    downloadedAt: now,
    lastSyncedAt: null,
    lastActivityAt: now,
    productIds,
  };
  await db.put("downloads", entry);
}

/** Handmatig een download verwijderen (Netflix-stijl "verwijder download").
 * Catalogusproducten blijven staan als een andere gedownloade klant ze ook
 * gebruikt; anders worden ze ook opgeruimd. */
export async function removeDownload(customerId: string, opts: { force?: boolean } = {}): Promise<void> {
  if (!opts.force) {
    const pending = await countPendingForCustomer(customerId);
    if (pending > 0) {
      throw new Error(
        `Deze klant heeft nog ${pending} niet-gesynchroniseerde wijziging(en). Synchroniseer eerst voordat je de download verwijdert.`
      );
    }
  }

  const db = await getOfflineDb();
  await deleteCustomerCache(customerId);
  await deleteInspectionsForCustomer(customerId);
  await db.delete("downloads", customerId);

  const remaining = await db.getAll("downloads");
  const stillUsed = new Set(remaining.flatMap((d) => d.productIds));
  await pruneUnusedProducts(stillUsed);
}

export async function listDownloads(key: CryptoKey): Promise<DownloadSummary[]> {
  const db = await getOfflineDb();
  const entries = await db.getAll("downloads");
  const out: DownloadSummary[] = [];
  for (const entry of entries) {
    const name = await decryptJson<string>(key, entry.customerNameEnc);
    out.push({
      customerId: entry.customerId,
      customerName: name,
      downloadedAt: entry.downloadedAt,
      lastSyncedAt: entry.lastSyncedAt,
      pendingMutations: await countPendingForCustomer(entry.customerId),
    });
  }
  return out.sort((a, b) => a.customerName.localeCompare(b.customerName));
}

export async function isCustomerDownloaded(customerId: string): Promise<boolean> {
  const db = await getOfflineDb();
  return (await db.get("downloads", customerId)) !== undefined;
}

/** Markeert dat de keurmeester net nog met deze klant bezig was -- gebruikt
 * door de opruimlogica in slice 4 om niet midden in actief gebruik een
 * download weg te trekken bij een toevallige korte sync. */
export async function touchDownloadActivity(customerId: string): Promise<void> {
  const db = await getOfflineDb();
  const entry = await db.get("downloads", customerId);
  if (!entry) return;
  entry.lastActivityAt = new Date().toISOString();
  await db.put("downloads", entry);
}

/** Gebruikt door de sync-engine (slice 4) zodra alle mutaties van deze klant
 * zijn geüpload, zodat de downloadlijst "gesynchroniseerd op ..." kan tonen. */
export async function markDownloadSynced(customerId: string): Promise<void> {
  const db = await getOfflineDb();
  const entry = await db.get("downloads", customerId);
  if (!entry) return;
  entry.lastSyncedAt = new Date().toISOString();
  await db.put("downloads", entry);
}

export interface QuickSelectCustomer {
  id: string;
  name: string;
}

/** Suggesties voor de "Vandaag" / "Deze week"-snelkeuze bij het downloaden.
 * Bewust een ruwe (over-inclusieve) query, geen vervanging van de echte
 * next_due-berekening: het is alleen een startpunt dat de keurmeester nog
 * bevestigt/aanpast in de downloadkeuze, geen besluitvormende logica. */
export async function fetchQuickSelectCustomers(
  ctx: InspectorContext,
  kind: "today" | "week"
): Promise<QuickSelectCustomer[]> {
  if (kind === "today") {
    const { data, error } = await supabase
      .from("inspections")
      .select("customer_id, customers(id, name)")
      .eq("company_id", ctx.companyId)
      .eq("status", "draft");
    if (error) throw error;
    interface TodayRow {
      customers: { id: string; name: string } | null;
    }
    return dedupeCustomers((data ?? []) as unknown as TodayRow[]);
  }

  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);
  const { data, error } = await supabase
    .from("inspection_items")
    .select("next_due, inspections!inner(customer_id, company_id, status, customers(id, name))")
    .lte("next_due", horizon.toISOString().slice(0, 10))
    .eq("inspections.company_id", ctx.companyId)
    .eq("inspections.status", "completed");
  if (error) throw error;
  interface WeekRow {
    inspections: { customers: { id: string; name: string } | null } | null;
  }
  return dedupeCustomers(
    ((data ?? []) as unknown as WeekRow[]).map((r) => ({ customers: r.inspections?.customers ?? null }))
  );
}

function dedupeCustomers(rows: { customers: { id: string; name: string } | null }[]): QuickSelectCustomer[] {
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.customers) map.set(row.customers.id, row.customers.name);
  }
  return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
