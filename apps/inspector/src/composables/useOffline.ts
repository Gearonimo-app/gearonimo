import { ref, computed, watch } from 'vue'
import {
  useOfflineSession,
  useOnline,
  downloadCustomer,
  removeDownload as removeDownloadCache,
  listDownloads,
  fetchQuickSelectCustomers,
  isCustomerDownloaded,
  touchDownloadActivity,
  syncAll,
  isDownloadStale,
  errorMessage,
  type DownloadSummary,
  type QuickSelectCustomer,
  type SyncSummary,
} from '@gearonimo/core'
import { ensureInspector } from './useInspections'
// Dynamisch geïmporteerd in runSync() i.p.v. hier bovenaan: useOfflineSync
// trekt via useCertificate.ts ook pdf-lib mee (~470 kB), en useOffline.ts
// wordt al bij het opstarten geladen (SyncStatusBar in App.vue). Statisch
// importeren zou pdf-lib in de hoofdbundel duwen en de offline-app-shell
// onnodig zwaar maken (zie BOUWPLAN slice 1) -- terwijl het alleen nodig is
// op het moment dat er daadwerkelijk gesynchroniseerd wordt.

// Verbindt de generieke offline-laag uit packages/core met de app-specifieke
// "wie is de ingelogde keurmeester"-context (ensureInspector).

const downloads = ref<DownloadSummary[]>([])
const loadingDownloads = ref(false)
const busyCustomerId = ref<string | null>(null)
const syncing = ref(false)
const lastSyncSummary = ref<SyncSummary | null>(null)
const lastSyncError = ref('')

let autoSyncWired = false

export function useOffline() {
  const session = useOfflineSession()
  const { isOnline } = useOnline()

  const pendingTotal = computed(() => downloads.value.reduce((sum, d) => sum + d.pendingMutations, 0))

  async function runSync() {
    if (syncing.value || !isOnline.value) return
    syncing.value = true
    lastSyncError.value = ''
    try {
      lastSyncSummary.value = await syncAll()
      // Pas ná de generieke wachtrij (klant/artikel/keuringsitem-mutaties):
      // een certificaat heeft de bijbehorende keuringsitems nodig, die net
      // hierboven geüpload zijn. Dynamische import: zie toelichting bovenaan.
      const { completePendingInspections } = await import('./useOfflineSync')
      await completePendingInspections()
      if (session.isUnlocked.value) await refreshDownloads()
    } catch (e) {
      lastSyncError.value = errorMessage(e)
    } finally {
      syncing.value = false
    }
  }

  // Automatisch synchroniseren zodra er verbinding is (besloten: eager
  // uploaden, los van het wel/niet opruimen van een download -- zie
  // syncEngine.ts). Eenmalig bedraad, ongeacht hoe vaak useOffline()
  // aangeroepen wordt.
  if (!autoSyncWired) {
    autoSyncWired = true
    watch(isOnline, (online) => {
      if (online) void runSync()
    })
    if (isOnline.value) void runSync()
  }

  async function refreshDownloads() {
    if (!session.isUnlocked.value) {
      downloads.value = []
      return
    }
    loadingDownloads.value = true
    try {
      downloads.value = await listDownloads(session.getKey())
    } finally {
      loadingDownloads.value = false
    }
  }

  async function download(customerId: string) {
    const inspector = await ensureInspector()
    busyCustomerId.value = customerId
    try {
      await downloadCustomer(
        session.getKey(),
        { companyId: inspector.company_id, inspectorId: inspector.id },
        customerId
      )
      await refreshDownloads()
    } finally {
      busyCustomerId.value = null
    }
  }

  async function remove(customerId: string) {
    busyCustomerId.value = customerId
    try {
      await removeDownloadCache(customerId)
      await refreshDownloads()
    } finally {
      busyCustomerId.value = null
    }
  }

  async function quickSelect(kind: 'today' | 'week'): Promise<QuickSelectCustomer[]> {
    const inspector = await ensureInspector()
    return fetchQuickSelectCustomers({ companyId: inspector.company_id, inspectorId: inspector.id }, kind)
  }

  return {
    session,
    isOnline,
    downloads,
    loadingDownloads,
    busyCustomerId,
    pendingTotal,
    syncing,
    lastSyncSummary,
    lastSyncError,
    runSync,
    refreshDownloads,
    download,
    remove,
    quickSelect,
    isCustomerDownloaded,
    isDownloadStale,
    touchDownloadActivity,
  }
}
