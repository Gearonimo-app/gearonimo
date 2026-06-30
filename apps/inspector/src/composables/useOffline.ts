import { ref } from 'vue'
import {
  useOfflineSession,
  downloadCustomer,
  removeDownload as removeDownloadCache,
  listDownloads,
  fetchQuickSelectCustomers,
  isCustomerDownloaded,
  touchDownloadActivity,
  type DownloadSummary,
  type QuickSelectCustomer,
} from '@gearonimo/core'
import { ensureInspector } from './useInspections'

// Verbindt de generieke offline-laag uit packages/core met de app-specifieke
// "wie is de ingelogde keurmeester"-context (ensureInspector).

const downloads = ref<DownloadSummary[]>([])
const loadingDownloads = ref(false)
const busyCustomerId = ref<string | null>(null)

export function useOffline() {
  const session = useOfflineSession()

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
    downloads,
    loadingDownloads,
    busyCustomerId,
    refreshDownloads,
    download,
    remove,
    quickSelect,
    isCustomerDownloaded,
    touchDownloadActivity,
  }
}
