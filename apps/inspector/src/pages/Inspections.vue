<template>
  <div class="il">
    <header class="il__header">
      <button class="il__icon" @click="$router.push('/')">←</button>
      <h1>{{ $t('inspections.listTitle') }}</h1>
      <span class="il__icon"></span>
    </header>

    <!-- Primaire actie: nieuwe keuring starten (los van de lijst zodat je
         nooit per ongeluk een oude keuring opent) -->
    <div class="il__actions">
      <button class="il__primary" @click="$router.push('/inspections/new')">
        ➕ {{ $t('inspections.startNew') }}
      </button>
      <button class="il__secondary" @click="$router.push('/import')">
        📥 {{ $t('inspections.importOld') }}
      </button>
    </div>

    <div class="il__search">
      <input
        v-model="query"
        type="search"
        :placeholder="$t('inspections.searchPlaceholder')"
        class="il__search-input"
      />
    </div>

    <div v-if="loading" class="il__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="il__state il__state--error">{{ error }}</div>

    <template v-else>
      <section v-if="drafts.length" class="il__section">
        <h2>{{ $t('inspections.drafts') }}</h2>
        <p v-if="deleteError" class="il__state il__state--error">{{ deleteError }}</p>
        <ul class="il__list">
          <li v-for="i in drafts" :key="i.id" class="il__item" @click="$router.push(`/inspections/${i.id}`)">
            <div class="il__name">{{ i.customer?.name }}</div>
            <div class="il__meta">{{ formatDate(i.inspection_date) }}</div>
            <!-- Concept weggooien (testresten, dubbel gestart). Alleen online:
                 het serverrecord is de bron; lokale kopie + wachtrij worden
                 mee opgeruimd (zie deleteDraftInspection). -->
            <button
              v-if="isOnline"
              class="il__delete"
              :disabled="deletingId === i.id"
              :title="$t('inspections.deleteDraft')"
              @click.stop="removeDraft(i)"
            >🗑</button>
            <span class="il__arrow">›</span>
          </li>
        </ul>
      </section>

      <section class="il__section">
        <h2>{{ $t('inspections.completed') }}</h2>
        <p v-if="!completed.length" class="il__state">
          {{ query ? $t('inspections.noMatches') : $t('inspections.empty') }}
        </p>
        <ul v-else class="il__list">
          <!-- Naar de keuring zelf (afgerond-scherm met certificaat-download),
               niet naar de klantpagina: daarvandaan is de klant alsnog één tik
               ("Terug naar klant"), andersom was het certificaat onvindbaar. -->
          <li v-for="i in completed" :key="i.id" class="il__item" @click="$router.push(`/inspections/${i.id}`)">
            <div class="il__name">{{ i.customer?.name }}</div>
            <div class="il__meta">{{ formatDate(i.completed_at ?? i.inspection_date) }}</div>
            <span class="il__arrow">›</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, errorMessage, useOnline } from '@gearonimo/core'
import { ensureInspector, deleteDraftInspection } from '../composables/useInspections'

const { t } = useI18n()
const { isOnline } = useOnline()

interface InspectionRow {
  id: string
  customer_id: string
  inspection_date: string
  completed_at: string | null
  status: string
  customer: { name: string } | null
}

const inspections = ref<InspectionRow[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

const filtered = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return inspections.value
  return inspections.value.filter(i =>
    [i.customer?.name, formatDate(i.inspection_date), i.completed_at ? formatDate(i.completed_at) : '']
      .some(v => v?.toLowerCase().includes(q))
  )
})

const drafts = computed(() => filtered.value.filter(i => i.status === 'draft'))
// Afgerond toont en sorteert op de afronddatum, niet de startdatum van het
// concept: een keuring die vandaag (offline) is afgerond maar dagen eerder
// als concept begon, leek anders spoorloos -- hij stond onder de oude datum
// halverwege de lijst (live gevonden door Jos, nacht van 1 op 2 juli).
const completed = computed(() =>
  [...filtered.value.filter(i => i.status === 'completed')]
    .sort((a, b) => (b.completed_at ?? b.inspection_date).localeCompare(a.completed_at ?? a.inspection_date))
)

const deletingId = ref<string | null>(null)
const deleteError = ref('')

async function removeDraft(i: InspectionRow) {
  if (!confirm(t('inspections.deleteDraftConfirm', { name: i.customer?.name ?? '', date: formatDate(i.inspection_date) }))) return
  deletingId.value = i.id
  deleteError.value = ''
  try {
    await deleteDraftInspection(i.id)
    inspections.value = inspections.value.filter((x) => x.id !== i.id)
  } catch (e) {
    deleteError.value = errorMessage(e)
  } finally {
    deletingId.value = null
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const inspector = await ensureInspector()
    const { data, error: err } = await supabase
      .from('inspections')
      .select('id, customer_id, inspection_date, completed_at, status, customer:customers(name)')
      .eq('company_id', inspector.company_id)
      .order('inspection_date', { ascending: false })
    if (err) throw err
    inspections.value = (data ?? []) as unknown as InspectionRow[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.il { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.il__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
}
.il__header h1 { font-size: 1.2rem; margin: 0; }
.il__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }
.il__actions { display: flex; flex-direction: column; gap: 0.6rem; padding: 1rem 1.25rem 0.25rem; }
.il__primary {
  padding: 1rem; border: none; border-radius: 12px; background: #16a34a;
  color: #fff; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.il__primary:active { opacity: 0.92; }
.il__secondary {
  padding: 0.75rem; border: 1px solid #d1d5db; border-radius: 12px; background: #fff;
  color: #374151; font-size: 0.95rem; font-weight: 600; cursor: pointer;
}
.il__secondary:active { background: #f9fafb; }
.il__search { padding: 0.5rem 1.25rem 0.25rem; }
.il__search-input {
  width: 100%; padding: 0.75rem 1rem; border-radius: 10px;
  border: 1px solid #ddd; font-size: 1rem; box-sizing: border-box;
}
.il__state { text-align: center; padding: 2rem 1rem; color: #666; }
.il__state--error { color: #dc2626; }
.il__section { padding: 1rem 1.25rem 0; }
.il__section h2 { font-size: 0.95rem; color: #374151; margin: 0.5rem 0; }
.il__list { list-style: none; margin: 0 0 0.5rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.il__item { padding: 1rem 1.25rem; display: flex; align-items: center; border-bottom: 1px solid #eee; cursor: pointer; }
.il__item:last-child { border-bottom: none; }
.il__item:active { background: #f9fafb; }
.il__name { font-weight: 600; flex: 1; }
.il__meta { font-size: 0.85rem; color: #666; flex: 1; }
.il__arrow { color: #999; font-size: 1.4rem; margin-left: 0.5rem; }
.il__delete {
  border: none; background: transparent; cursor: pointer;
  font-size: 1rem; opacity: 0.55; padding: 0.35rem 0.5rem;
}
.il__delete:hover { opacity: 1; }
.il__delete:disabled { opacity: 0.3; }
</style>
