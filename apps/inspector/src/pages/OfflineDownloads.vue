<template>
  <div class="od">
    <header class="od__header">
      <button class="od__icon" @click="$router.push('/')">←</button>
      <h1>{{ $t('offline.title') }}</h1>
      <span class="od__icon"></span>
    </header>

    <!-- Vergrendeld: eerst PIN instellen of invoeren -->
    <div v-if="!session.checking.value && !session.isUnlocked.value" class="od__locked">
      <p class="od__locked-text">
        {{ session.pinConfigured.value ? $t('offline.locked.unlockHint') : $t('offline.locked.setupHint') }}
      </p>
      <button class="od__btn od__btn--primary" @click="showPinDialog = true">
        {{ session.pinConfigured.value ? $t('offline.locked.unlockButton') : $t('offline.locked.setupButton') }}
      </button>
    </div>

    <template v-else>
      <!-- Snelkeuze -->
      <div class="od__quick">
        <button class="od__quick-btn" :disabled="quickBusy" @click="runQuickSelect('today')">
          {{ $t('offline.quick.today') }}
        </button>
        <button class="od__quick-btn" :disabled="quickBusy" @click="runQuickSelect('week')">
          {{ $t('offline.quick.week') }}
        </button>
      </div>

      <!-- Gedownloade klanten -->
      <div class="od__section-title">{{ $t('offline.downloadedTitle') }}</div>
      <p v-if="removeError" class="od__state od__state--error">{{ removeError }}</p>
      <div v-if="loadingDownloads" class="od__state">{{ $t('common.loading') }}</div>
      <div v-else-if="downloads.length === 0" class="od__state">{{ $t('offline.empty') }}</div>
      <ul v-else class="od__list">
        <li v-for="d in downloads" :key="d.customerId" class="od__item">
          <div class="od__item-body">
            <div class="od__item-name">{{ d.customerName }}</div>
            <div class="od__item-meta">{{ downloadMeta(d) }}</div>
            <div v-if="isDownloadStale(d)" class="od__stale">{{ $t('offline.staleWarning') }}</div>
          </div>
          <button
            class="od__remove"
            :disabled="busyCustomerId === d.customerId"
            @click="remove(d.customerId)"
          >
            {{ $t('offline.removeDownload') }}
          </button>
        </li>
      </ul>

      <!-- Klant toevoegen -->
      <div class="od__section-title">{{ $t('offline.addTitle') }}</div>
      <p v-if="downloadError" class="od__state od__state--error">{{ downloadError }}</p>
      <div class="od__search">
        <input
          v-model="query"
          type="search"
          :placeholder="$t('customers.searchPlaceholder')"
          class="od__search-input"
        />
      </div>
      <div v-if="loadingCustomers" class="od__state">{{ $t('common.loading') }}</div>
      <div v-else-if="customerLoadError" class="od__state od__state--error">{{ customerLoadError }}</div>
      <ul v-else class="od__list">
        <li v-for="c in pickableCustomers" :key="c.id" class="od__item">
          <div class="od__item-body">
            <div class="od__item-name">{{ c.name }}</div>
            <div class="od__item-meta">{{ c.city }}</div>
          </div>
          <button
            class="od__add"
            :disabled="busyCustomerId === c.id"
            @click="download(c.id)"
          >
            {{ busyCustomerId === c.id ? $t('offline.downloading') : $t('offline.download') }}
          </button>
        </li>
        <li v-if="pickableCustomers.length === 0" class="od__state">{{ $t('offline.noMoreToAdd') }}</li>
      </ul>
    </template>

    <OfflinePinDialog v-if="showPinDialog" @unlocked="onUnlocked" @cancel="showPinDialog = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@gearonimo/core'
import { useOffline } from '../composables/useOffline'
import OfflinePinDialog from '../components/OfflinePinDialog.vue'
import { listCustomers, type CustomerListItem } from '../composables/useCustomers'

const { t } = useI18n()
const {
  session,
  downloads,
  loadingDownloads,
  busyCustomerId,
  refreshDownloads,
  download,
  downloadError,
  remove: removeDownload,
  quickSelect,
  isDownloadStale,
} = useOffline()

const showPinDialog = ref(false)
const query = ref('')
const allCustomers = ref<CustomerListItem[]>([])
const loadingCustomers = ref(false)
const customerLoadError = ref('')
const quickBusy = ref(false)
const quickSelectedIds = ref<Set<string> | null>(null)
const removeError = ref('')

async function remove(customerId: string) {
  removeError.value = ''
  try {
    await removeDownload(customerId)
  } catch (e) {
    removeError.value = errorMessage(e)
  }
}

const downloadedIds = computed(() => new Set(downloads.value.map((d) => d.customerId)))

const pickableCustomers = computed(() => {
  let list = allCustomers.value.filter((c) => !downloadedIds.value.has(c.id))
  if (quickSelectedIds.value) {
    list = list.filter((c) => quickSelectedIds.value!.has(c.id))
  }
  const q = query.value.toLowerCase().trim()
  if (q) {
    list = list.filter((c) => [c.name, c.city].some((v) => v?.toLowerCase().includes(q)))
  }
  return list
})

function downloadMeta(entry: { downloadedAt: string; lastSyncedAt: string | null; pendingMutations: number }) {
  const downloadedAt = new Date(entry.downloadedAt).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  if (entry.pendingMutations > 0) {
    return t('offline.pendingOn', { date: downloadedAt, count: entry.pendingMutations })
  }
  return entry.lastSyncedAt
    ? t('offline.syncedOn', { date: downloadedAt })
    : t('offline.downloadedOn', { date: downloadedAt })
}

async function loadCustomers() {
  loadingCustomers.value = true
  customerLoadError.value = ''
  try {
    allCustomers.value = await listCustomers()
  } catch (e) {
    customerLoadError.value = errorMessage(e) || t('offline.cannotLoadCustomers')
  } finally {
    loadingCustomers.value = false
  }
}

async function runQuickSelect(kind: 'today' | 'week') {
  quickBusy.value = true
  try {
    const customers = await quickSelect(kind)
    quickSelectedIds.value = new Set(customers.map((c) => c.id))
    if (allCustomers.value.length === 0) await loadCustomers()
  } catch (e) {
    customerLoadError.value = errorMessage(e)
  } finally {
    quickBusy.value = false
  }
}

async function onUnlocked() {
  showPinDialog.value = false
  await refreshDownloads()
  await loadCustomers()
}

watch(
  () => session.isUnlocked.value,
  (unlocked) => {
    if (unlocked) {
      refreshDownloads()
      loadCustomers()
    }
  }
)

onMounted(async () => {
  if (session.isUnlocked.value) {
    await refreshDownloads()
    await loadCustomers()
  }
})
</script>

<style scoped>
.od { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.od__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem;
}
.od__header h1 { font-size: 1.2rem; margin: 0; }
.od__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }

.od__locked { padding: 2.5rem 1.5rem; text-align: center; }
.od__locked-text { color: #4b5563; margin-bottom: 1.25rem; }

.od__btn { padding: 0.85rem 1.5rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.od__btn--primary { background: #16a34a; color: #fff; }

.od__quick { display: flex; gap: 0.75rem; padding: 1.25rem 1.25rem 0; }
.od__quick-btn {
  flex: 1; padding: 0.7rem; border-radius: 10px; border: 1px solid #16a34a;
  background: #fff; color: #16a34a; font-weight: 600; cursor: pointer;
}
.od__quick-btn:disabled { opacity: 0.6; }

.od__section-title { font-size: 0.85rem; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 1.25rem 1.25rem 0.5rem; }

.od__search { padding: 0 1.25rem; }
.od__search-input { width: 100%; padding: 0.65rem 1rem; border-radius: 8px; border: 1px solid #ddd; font-size: 1rem; box-sizing: border-box; }

.od__state { padding: 1rem 1.25rem; color: #6b7280; }
.od__state--error { color: #dc2626; }

.od__list { list-style: none; margin: 0.5rem 1.25rem 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.od__item { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-bottom: 1px solid #eee; }
.od__item:last-child { border-bottom: none; }
.od__item-body { flex: 1; min-width: 0; }
.od__item-name { font-weight: 600; }
.od__item-meta { font-size: 0.8rem; color: #6b7280; margin-top: 0.1rem; }
.od__stale { font-size: 0.78rem; color: #92400e; background: #fffbeb; border-radius: 6px; padding: 0.2rem 0.5rem; margin-top: 0.3rem; display: inline-block; }

.od__add, .od__remove {
  padding: 0.5rem 0.9rem; border-radius: 8px; border: none; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.od__add { background: #16a34a; color: #fff; }
.od__add:disabled { opacity: 0.6; }
.od__remove { background: #fee2e2; color: #b91c1c; }
.od__remove:disabled { opacity: 0.6; }
</style>
