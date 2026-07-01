import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { EncryptedPayload } from "./crypto";

// Eén lokale database voor de hele offline-laag. Persoonsgegevens
// (klanten/artikelen) staan als versleutelde blob (`enc`); de sleutels
// waarop we moeten kunnen filteren (customerId, productId) staan bewust
// onversleuteld als kolom, anders kan IndexedDB er niet op indexeren. Zie
// crypto.ts voor de versleuteling zelf.

export interface EncryptedRecord {
  id: string;
  enc: EncryptedPayload;
}

export interface ArticleRecord extends EncryptedRecord {
  customerId: string;
}

export interface CustomerScopedRecord extends EncryptedRecord {
  customerId: string;
}

export interface InspectionRecordRow extends EncryptedRecord {
  customerId: string;
  status: string;
}

export interface InspectionItemRecord extends EncryptedRecord {
  inspectionId: string;
}

export interface DownloadEntry {
  customerId: string;
  customerNameEnc: EncryptedPayload;
  watermarkId: string;
  downloadedAt: string;
  lastSyncedAt: string | null;
  lastActivityAt: string;
  productIds: string[];
}

export type MutationStatus = "pending" | "syncing" | "failed";

export interface MutationRecord {
  id?: number;
  customerId: string;
  table: string;
  op: "insert" | "update";
  payload: Record<string, unknown>;
  matchColumn: string;
  status: MutationStatus;
  createdAt: string;
  attempts: number;
  lastError: string | null;
}

interface OfflineSchema extends DBSchema {
  meta: { key: string; value: unknown };
  downloads: { key: string; value: DownloadEntry };
  customers: { key: string; value: EncryptedRecord };
  articles: {
    key: string;
    value: ArticleRecord;
    indexes: { customerId: string };
  };
  products: { key: string; value: EncryptedRecord };
  rejectionCodes: { key: string; value: EncryptedRecord };
  companySettings: { key: string; value: EncryptedRecord };
  customerMembers: {
    key: string;
    value: CustomerScopedRecord;
    indexes: { customerId: string };
  };
  articleSets: {
    key: string;
    value: CustomerScopedRecord;
    indexes: { customerId: string };
  };
  inspections: {
    key: string;
    value: InspectionRecordRow;
    indexes: { customerId: string };
  };
  inspectionItems: {
    key: string;
    value: InspectionItemRecord;
    indexes: { inspectionId: string };
  };
  mutations: {
    key: number;
    value: MutationRecord;
    indexes: { customerId: string; status: string };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineSchema>> | null = null;

export function getOfflineDb(): Promise<IDBPDatabase<OfflineSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineSchema>("gearonimo-offline", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("meta");
          db.createObjectStore("downloads", { keyPath: "customerId" });
          db.createObjectStore("customers", { keyPath: "id" });
          const articles = db.createObjectStore("articles", { keyPath: "id" });
          articles.createIndex("customerId", "customerId");
          db.createObjectStore("products", { keyPath: "id" });
          db.createObjectStore("rejectionCodes", { keyPath: "id" });
          db.createObjectStore("companySettings", { keyPath: "id" });
          const inspections = db.createObjectStore("inspections", { keyPath: "id" });
          inspections.createIndex("customerId", "customerId");
          const inspectionItems = db.createObjectStore("inspectionItems", { keyPath: "id" });
          inspectionItems.createIndex("inspectionId", "inspectionId");
          const mutations = db.createObjectStore("mutations", {
            keyPath: "id",
            autoIncrement: true,
          });
          mutations.createIndex("customerId", "customerId");
          mutations.createIndex("status", "status");
        }
        if (oldVersion < 2) {
          // v2: medewerkers en sets van de klant horen ook bij een download
          // (het klantdetailscherm toonde er offline een kale fetch-fout voor).
          const members = db.createObjectStore("customerMembers", { keyPath: "id" });
          members.createIndex("customerId", "customerId");
          const sets = db.createObjectStore("articleSets", { keyPath: "id" });
          sets.createIndex("customerId", "customerId");
        }
      },
    });
  }
  return dbPromise;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getOfflineDb();
  return (await db.get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getOfflineDb();
  await db.put("meta", value, key);
}

/** Wist alle lokale offline-data (gebruikt bij PIN-reset: de oude sleutel is
 * weg, dus alles wat ermee versleuteld was is sowieso niet meer leesbaar). */
export async function wipeAllOfflineData(): Promise<void> {
  const db = await getOfflineDb();
  await Promise.all([
    db.clear("downloads"),
    db.clear("customers"),
    db.clear("articles"),
    db.clear("products"),
    db.clear("rejectionCodes"),
    db.clear("companySettings"),
    db.clear("customerMembers"),
    db.clear("articleSets"),
    db.clear("inspections"),
    db.clear("inspectionItems"),
    db.clear("mutations"),
    db.delete("meta", "pinSalt"),
    db.delete("meta", "pinCheck"),
  ]);
}

export type { OfflineSchema };
