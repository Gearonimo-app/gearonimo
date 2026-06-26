<template>
  <div class="cd">
    <header class="cd__header">
      <div class="cd__nav">
        <button class="cd__icon" @click="$router.push('/customers')">←</button>
        <button class="cd__icon" :title="$t('common.home')" @click="$router.push('/')">🏠</button>
      </div>
      <h1>{{ customer?.name || $t('customers.title') }}</h1>
      <button v-if="customer && !editMode" class="cd__icon" @click="startEdit">✎</button>
    </header>

    <div v-if="loading" class="cd__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="cd__state cd__state--error">{{ error }}</div>
    <div v-else-if="!customer" class="cd__state">{{ $t('customers.detail.notFound') }}</div>

    <!-- Bekijken -->
    <div v-else-if="!editMode" class="cd__body">
      <button class="cd__start-inspection" :disabled="startingInspection" @click="onStartInspection">
        {{ startingInspection ? $t('common.saving') : (draftInspection ? $t('inspections.resumeButton', { date: formatDate(draftInspection.inspection_date) }) : $t('inspections.startButton')) }}
      </button>
      <p v-if="startError" class="cd__error">{{ startError }}</p>
      <dl class="cd__list">
        <template v-for="f in fieldDefs" :key="f.col">
          <div v-if="customer[f.col]" class="cd__view-row">
            <dt>{{ label(f.label) }}</dt>
            <dd>{{ customer[f.col] }}</dd>
          </div>
        </template>
      </dl>
      <CustomerMembers :customer-id="id" />
      <CustomerArticles :customer-id="id" />
      <CustomerSets :customer-id="id" />
      <button class="cd__delete" @click="showDelete = true">{{ $t('common.delete') }}</button>
    </div>

    <!-- Bewerken -->
    <div v-else class="cd__body">
      <div v-for="f in fieldDefs" :key="f.col" class="cd__field">
        <label class="cd__field-label">{{ label(f.label) }}</label>
        <textarea v-if="f.textarea" v-model="form[f.col]" class="cd__input" rows="3"></textarea>
        <input v-else v-model="form[f.col]" class="cd__input" />
      </div>
      <p v-if="formError" class="cd__error">{{ formError }}</p>
      <div class="cd__actions">
        <button class="cd__btn cd__btn--cancel" @click="editMode = false">{{ $t('common.cancel') }}</button>
        <button class="cd__btn cd__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>

    <!-- Verwijderen bevestigen -->
    <div v-if="showDelete" class="cd__overlay" @click.self="showDelete = false">
      <div class="cd__dialog">
        <h2>{{ $t('customers.detail.deleteTitle') }}</h2>
        <p>{{ $t('customers.detail.deleteBody') }}</p>
        <div class="cd__actions">
          <button class="cd__btn cd__btn--cancel" @click="showDelete = false">{{ $t('common.cancel') }}</button>
          <button class="cd__btn cd__btn--danger" :disabled="deleting" @click="remove">{{ $t('common.delete') }}</button>
        </div>
      </div>
    </div>

    <ArticleSelectDialog
      v-if="showArticleSelect"
      :articles="selectableArticles"
      @confirm="confirmArticleSelect"
      @cancel="showArticleSelect = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'
import CustomerMembers from '../components/CustomerMembers.vue'
import CustomerArticles from '../components/CustomerArticles.vue'
import CustomerSets from '../components/CustomerSets.vue'
import ArticleSelectDialog from '../components/ArticleSelectDialog.vue'
import { findDraftInspection, fetchActiveArticles, startInspectionWithArticles, type ActiveArticleOption } from '../composables/useInspections'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = route.params.id as string

const fieldDefs: { col: string; label: string; textarea?: boolean }[] = [
  { col: 'name', label: 'customers.fields.name' },
  { col: 'customer_number', label: 'customers.fields.customerNumber' },
  { col: 'kvk_number', label: 'customers.fields.kvk' },
  { col: 'vat_number', label: 'customers.fields.vat' },
  { col: 'contact_person', label: 'customers.fields.contactPerson' },
  { col: 'email', label: 'customers.fields.email' },
  { col: 'phone', label: 'customers.fields.phone' },
  { col: 'street', label: 'customers.fields.street' },
  { col: 'house_number', label: 'customers.fields.houseNumber' },
  { col: 'house_number_addition', label: 'customers.fields.houseNumberAddition' },
  { col: 'postal_code', label: 'customers.fields.postalCode' },
  { col: 'city', label: 'customers.fields.city' },
  { col: 'province', label: 'customers.fields.province' },
  { col: 'country', label: 'customers.fields.country' },
  { col: 'notes', label: 'customers.fields.notes', textarea: true },
]

const customer = ref<Record<string, any> | null>(null)
const loading = ref(true)
const error = ref('')
const editMode = ref(false)
const saving = ref(false)
const deleting = ref(false)
const formError = ref('')
const showDelete = ref(false)
const form = ref<Record<string, string>>({})
const draftInspection = ref<{ id: string; inspection_date: string } | null>(null)
const startingInspection = ref(false)
const startError = ref('')
const showArticleSelect = ref(false)
const selectableArticles = ref<ActiveArticleOption[]>([])

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })
}

// Bestaat er al een concept-keuring, dan hervatten we die direct (de
// artikelen staan er al in). Anders vraagt de keurmeester eerst zelf welke
// van de actieve artikelen van deze klant erbij horen.
async function onStartInspection() {
  startError.value = ''
  if (draftInspection.value) {
    router.push(`/inspections/${draftInspection.value.id}`)
    return
  }
  startingInspection.value = true
  try {
    const articles = await fetchActiveArticles(id)
    if (!articles.length) {
      const inspectionId = await startInspectionWithArticles(id, [])
      router.push(`/inspections/${inspectionId}`)
      return
    }
    selectableArticles.value = articles
    showArticleSelect.value = true
  } catch (e: any) {
    startError.value = e?.message ?? String(e)
  } finally {
    startingInspection.value = false
  }
}

async function confirmArticleSelect(articleIds: string[]) {
  showArticleSelect.value = false
  startingInspection.value = true
  startError.value = ''
  try {
    const inspectionId = await startInspectionWithArticles(id, articleIds)
    router.push(`/inspections/${inspectionId}`)
  } catch (e: any) {
    startError.value = e?.message ?? String(e)
  } finally {
    startingInspection.value = false
  }
}

// Labels delen de placeholders uit het toevoegformulier; strip de " *" voor weergave.
function label(key: string) {
  return t(key).replace(' *', '')
}

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (err) error.value = err.message
  else customer.value = data
  loading.value = false
  draftInspection.value = await findDraftInspection(id)
}

function startEdit() {
  const f: Record<string, string> = {}
  for (const def of fieldDefs) f[def.col] = customer.value?.[def.col] ?? ''
  form.value = f
  formError.value = ''
  editMode.value = true
}

async function save() {
  if (!form.value.name.trim())  { formError.value = t('customers.errors.nameRequired');  return }
  if (!form.value.email.trim()) { formError.value = t('customers.errors.emailRequired'); return }
  saving.value = true
  formError.value = ''
  const patch: Record<string, any> = {}
  for (const def of fieldDefs) patch[def.col] = form.value[def.col].trim() || null
  const { data, error: err } = await supabase
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  saving.value = false
  if (err) { formError.value = err.message; return }
  customer.value = data
  editMode.value = false
}

async function remove() {
  deleting.value = true
  const { error: err } = await supabase.from('customers').delete().eq('id', id)
  deleting.value = false
  showDelete.value = false
  if (err) { error.value = err.message; return }
  router.push('/customers')
}

onMounted(load)
</script>

<style scoped>
.cd { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.cd__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.cd__nav { display: flex; align-items: center; gap: 0.15rem; }
.cd__header h1 { font-size: 1.2rem; margin: 0; flex: 1; text-align: center; }
.cd__icon {
  background: none; border: none; color: #fff; font-size: 1.3rem;
  cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem;
}
.cd__state { text-align: center; padding: 3rem 1rem; color: #666; }
.cd__state--error { color: #dc2626; }
.cd__body { padding: 1.25rem; }

/* Bekijken */
.cd__start-inspection {
  width: 100%; padding: 1rem; margin-bottom: 1rem; border-radius: 12px;
  border: none; background: #16a34a; color: #fff; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.cd__start-inspection:disabled { opacity: 0.6; }
.cd__list { margin: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.cd__view-row {
  display: flex; justify-content: space-between; gap: 1rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.cd__view-row:last-child { border-bottom: none; }
.cd__view-row dt { color: #6b7280; font-size: 0.85rem; }
.cd__view-row dd { margin: 0; font-weight: 600; text-align: right; word-break: break-word; }
.cd__delete {
  margin-top: 1.5rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: 1px solid #fecaca; background: #fff; color: #dc2626;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}

/* Bewerken */
.cd__field { margin-bottom: 0.85rem; }
.cd__field-label { display: block; font-size: 0.8rem; color: #6b7280; margin-bottom: 0.25rem; }
.cd__input {
  width: 100%; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; font-family: inherit;
}
textarea.cd__input { resize: vertical; }
.cd__error { color: #dc2626; font-size: 0.9rem; margin: 0.5rem 0; }
.cd__actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
.cd__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.cd__btn--cancel { background: #f3f4f6; color: #374151; }
.cd__btn--save { background: #16a34a; color: #fff; }
.cd__btn--danger { background: #dc2626; color: #fff; }
.cd__btn:disabled { opacity: 0.6; }

/* Dialoog */
.cd__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.cd__dialog { background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 360px; }
.cd__dialog h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.cd__dialog p { margin: 0 0 0.5rem; color: #4b5563; }
</style>
