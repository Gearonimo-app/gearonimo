<template>
  <div class="in">
    <header class="in__header">
      <button class="in__icon" @click="$router.push('/')">←</button>
      <h1>{{ $t('inspections.newTitle') }}</h1>
      <span class="in__icon"></span>
    </header>

    <div class="in__search">
      <input
        v-model="query"
        type="search"
        :placeholder="$t('customers.searchPlaceholder')"
        class="in__search-input"
      />
    </div>

    <button class="in__new-customer" @click="showNewCustomer = true">
      ➕ {{ $t('inspections.newCustomer') }}
    </button>

    <div v-if="pickError" class="in__state in__state--error">{{ pickError }}</div>

    <div v-if="loading" class="in__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="in__state in__state--error">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="in__state">{{ $t('customers.empty') }}</div>

    <ul v-else class="in__list">
      <li v-for="c in filtered" :key="c.id" class="in__item" @click="pick(c.id)">
        <div class="in__name">{{ c.name }}</div>
        <div class="in__meta">{{ c.city }} · {{ c.phone }}</div>
        <span class="in__arrow">›</span>
      </li>
    </ul>

    <ArticleScopeDialog
      v-if="showArticleSelect"
      :title="$t('inspections.selectArticles.title')"
      :hint="$t('inspections.selectArticles.hint')"
      :all-count="articleScope.allIds.length"
      :new-count="articleScope.newIds.length"
      @choose="confirmArticleSelect"
      @cancel="showArticleSelect = false"
    />

    <ArticleScopeDialog
      v-if="showAddExtra"
      :title="$t('inspections.selectArticles.addTitle')"
      :hint="$t('inspections.selectArticles.addHint')"
      :all-count="articleScope.allIds.length"
      :new-count="articleScope.newIds.length"
      @choose="confirmAddExtra"
      @cancel="cancelAddExtra"
    />

    <CustomerFormModal
      v-if="showNewCustomer"
      @saved="onNewCustomer"
      @cancel="showNewCustomer = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@gearonimo/core'
import ArticleScopeDialog from '../components/ArticleScopeDialog.vue'
import CustomerFormModal from '../components/CustomerFormModal.vue'
import {
  findDraftInspection,
  fetchArticleScope,
  fetchInspectionArticleIds,
  addArticlesToInspection,
  startInspectionWithArticles,
  type ArticleScope,
} from '../composables/useInspections'

const router = useRouter()

interface Customer { id: string; name: string; city: string | null; phone: string | null }

const customers = ref<Customer[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const picking = ref(false)
const pickError = ref('')
const showArticleSelect = ref(false)
const showAddExtra = ref(false)
const showNewCustomer = ref(false)
const articleScope = ref<ArticleScope>({ allIds: [], newIds: [] })
const pendingCustomerId = ref<string | null>(null)
const pendingDraftId = ref<string | null>(null)

const filtered = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return customers.value
  return customers.value.filter(c => [c.name, c.city, c.phone].some(v => v?.toLowerCase().includes(q)))
})

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase.from('customers').select('id, name, city, phone').order('name')
  if (err) { error.value = err.message } else { customers.value = data ?? [] }
  loading.value = false
}

// Bestaat er al een concept-keuring voor deze klant, dan bieden we eerst aan
// om er nog andere actieve artikelen bij te halen (staat er niets nieuws,
// dan hervatten we direct). Bestaat er nog geen concept, dan vraagt de
// keurmeester eerst zelf welke actieve artikelen erbij horen.
async function pick(customerId: string) {
  if (picking.value) return
  picking.value = true
  pickError.value = ''
  try {
    const existingDraft = await findDraftInspection(customerId)
    if (existingDraft) {
      const existingIds = await fetchInspectionArticleIds(existingDraft.id)
      const scope = await fetchArticleScope(customerId, existingIds)
      if (!scope.allIds.length) {
        router.push(`/inspections/${existingDraft.id}`)
        return
      }
      pendingDraftId.value = existingDraft.id
      articleScope.value = scope
      showAddExtra.value = true
      return
    }
    const scope = await fetchArticleScope(customerId)
    if (!scope.allIds.length) {
      const inspectionId = await startInspectionWithArticles(customerId, [])
      router.push(`/inspections/${inspectionId}`)
      return
    }
    pendingCustomerId.value = customerId
    articleScope.value = scope
    showArticleSelect.value = true
  } catch (e: any) {
    pickError.value = e?.message ?? String(e)
  } finally {
    picking.value = false
  }
}

async function confirmArticleSelect(scopeChoice: 'all' | 'new') {
  showArticleSelect.value = false
  if (!pendingCustomerId.value) return
  picking.value = true
  pickError.value = ''
  try {
    const articleIds = scopeChoice === 'all' ? articleScope.value.allIds : articleScope.value.newIds
    const inspectionId = await startInspectionWithArticles(pendingCustomerId.value, articleIds)
    router.push(`/inspections/${inspectionId}`)
  } catch (e: any) {
    pickError.value = e?.message ?? String(e)
  } finally {
    picking.value = false
  }
}

async function confirmAddExtra(scopeChoice: 'all' | 'new') {
  showAddExtra.value = false
  if (!pendingDraftId.value) return
  const draftId = pendingDraftId.value
  const articleIds = scopeChoice === 'all' ? articleScope.value.allIds : articleScope.value.newIds
  picking.value = true
  pickError.value = ''
  try {
    await addArticlesToInspection(draftId, articleIds)
    router.push(`/inspections/${draftId}`)
  } catch (e: any) {
    pickError.value = e?.message ?? String(e)
  } finally {
    picking.value = false
  }
}

function cancelAddExtra() {
  showAddExtra.value = false
  if (pendingDraftId.value) router.push(`/inspections/${pendingDraftId.value}`)
}

// Een net aangemaakte klant heeft nog geen artikelen, dus starten we direct
// een lege keuring en gaan we naar de wizard om de artikelen in te vullen.
async function onNewCustomer(customerId: string) {
  showNewCustomer.value = false
  picking.value = true
  pickError.value = ''
  try {
    const inspectionId = await startInspectionWithArticles(customerId, [])
    router.push(`/inspections/${inspectionId}`)
  } catch (e: any) {
    pickError.value = e?.message ?? String(e)
  } finally {
    picking.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.in { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.in__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
}
.in__header h1 { font-size: 1.2rem; margin: 0; }
.in__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }
.in__search { padding: 1rem 1.25rem 0.5rem; }
.in__search-input {
  width: 100%; padding: 0.75rem 1rem; border-radius: 10px;
  border: 1px solid #ddd; font-size: 1rem; box-sizing: border-box;
}
.in__new-customer {
  margin: 0 1.25rem 0.5rem; padding: 0.85rem 1rem; width: calc(100% - 2.5rem);
  background: #16a34a; color: #fff; border: none; border-radius: 10px;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}
.in__new-customer:active { opacity: 0.9; }
.in__state { text-align: center; padding: 3rem 1rem; color: #666; }
.in__state--error { color: #dc2626; }
.in__list { list-style: none; margin: 0.5rem 0 0; padding: 0; }
.in__item { background: #fff; border-bottom: 1px solid #eee; padding: 1rem 1.25rem; display: flex; align-items: center; cursor: pointer; }
.in__item:active { background: #f9fafb; }
.in__name { font-weight: 600; flex: 1; }
.in__meta { font-size: 0.85rem; color: #666; margin-top: 0.2rem; flex: 2; }
.in__arrow { color: #999; font-size: 1.4rem; margin-left: 0.5rem; }
</style>
