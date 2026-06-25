<template>
  <div class="iw">
    <header class="iw__header">
      <button class="iw__icon" @click="$router.push(`/customers/${inspection?.customer_id}`)">←</button>
      <h1>{{ inspection?.customer?.name }}</h1>
      <span class="iw__totals">{{ $t('inspections.table.totals', { passed: passedCount, rejected: rejectedCount, open: notAssessedCount }) }}</span>
    </header>

    <div v-if="loading" class="iw__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="iw__state iw__state--error">{{ error }}</div>

    <template v-else-if="finished">
      <div class="iw__body iw__cert-done">
        <p class="iw__cert-ok">✅ {{ $t('inspections.certificateReady') }}</p>
        <a v-if="certificateUrl" :href="certificateUrl" target="_blank" class="iw__btn iw__btn--save iw__cert-link">
          {{ $t('inspections.downloadCertificate') }}
        </a>
        <button class="iw__btn iw__btn--cancel" @click="$router.push(`/customers/${inspection.customer_id}`)">
          {{ $t('inspections.backToCustomer') }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="iw__body">
        <!-- Gedeelde datalists: elk invulveld zoekt in de catalogus, maar je
             mag altijd vrij iets typen dat er niet in staat. -->
        <datalist id="dl-articles"><option v-for="n in allArticleNames" :key="n" :value="n" /></datalist>
        <datalist id="dl-brands"><option v-for="b in allBrands" :key="b" :value="b" /></datalist>
        <datalist id="dl-categories"><option v-for="c in allCategories" :key="c" :value="c" /></datalist>

        <!-- Toevoegrij -->
        <div class="iw__add">
          <input v-model="newDescription" list="dl-articles" class="iw__input" :placeholder="$t('inspections.table.article')" />
          <input v-model="newBrand" list="dl-brands" class="iw__input iw__input--sm" :placeholder="$t('inspections.table.brand')" />
          <input v-model="newCategory" list="dl-categories" class="iw__input iw__input--sm" :placeholder="$t('inspections.table.category')" />
          <input v-model="newSerial" class="iw__input iw__input--sm" :placeholder="$t('inspections.table.serial')" />
          <input v-model="newYear" type="number" class="iw__input iw__input--xs" :placeholder="$t('inspections.table.year')" />
          <input v-model="newMonth" type="number" min="1" max="12" class="iw__input iw__input--xs" :placeholder="$t('inspections.table.month')" />
          <button class="iw__btn iw__btn--save" :disabled="!canAdd" @click="addRow">{{ $t('inspections.table.add') }}</button>
        </div>

        <!-- Zoek/filter bestaande artikelen -->
        <input v-model="filterText" type="search" class="iw__input iw__search" :placeholder="$t('inspections.table.searchPlaceholder')" />

        <p v-if="addError" class="iw__error">{{ addError }}</p>

        <!-- Tabel -->
        <div class="iw__table-wrap">
          <table class="iw__table">
            <thead>
              <tr>
                <th></th>
                <th class="iw__sortable" @click="toggleSort('category')">{{ $t('inspections.table.colCategory') }}</th>
                <th class="iw__sortable" @click="toggleSort('brand')">{{ $t('inspections.table.colBrand') }}</th>
                <th class="iw__sortable" @click="toggleSort('label')">{{ $t('inspections.table.colDescription') }}</th>
                <th class="iw__sortable" @click="toggleSort('serial')">{{ $t('inspections.table.colSerial') }}</th>
                <th class="iw__sortable" @click="toggleSort('year')">{{ $t('inspections.table.colYear') }}</th>
                <th>{{ $t('inspections.table.colPrevious') }}</th>
                <th>{{ $t('inspections.table.colResult') }}</th>
                <th class="iw__sortable" @click="toggleSort('nextDue')">{{ $t('inspections.table.colNextDue') }}</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in sortedRows" :key="row.it.id">
                <tr :class="{ 'iw__row--rejected': row.it.result === 'rejected', 'iw__row--passed': row.it.result === 'passed' }">
                  <td class="iw__warn-cell">
                    <span v-if="row.warning" :title="row.warning.text" class="iw__warn-icon">{{ row.warning.icon }}</span>
                    <span v-if="row.it.article.product?.recall_url" class="iw__warn-icon" title="Recall">
                      <a :href="row.it.article.product.recall_url" target="_blank">🚩</a>
                    </span>
                  </td>
                  <td class="iw__category">{{ row.category || '—' }}</td>
                  <td>{{ row.brand || '—' }}</td>
                  <td>{{ row.label }}</td>
                  <td class="iw__sn">{{ row.it.article.serial_number || '—' }}</td>
                  <td>{{ row.year || '—' }}</td>
                  <td>
                    <span v-if="row.previous" :class="row.previous.result === 'passed' ? 'iw__prev--pass' : 'iw__prev--fail'">
                      {{ row.previous.result === 'passed' ? '✅' : '❌' }} {{ formatDate(row.previous.inspection_date) }}
                    </span>
                    <span v-else class="iw__prev--none">—</span>
                  </td>
                  <td>
                    <div class="iw__result-buttons">
                      <button
                        class="iw__result-btn iw__result-btn--pass"
                        :class="{ 'iw__result-btn--active': row.it.result === 'passed' }"
                        @click="setResult(row.it, 'passed')"
                      >✅ {{ $t('inspections.table.pass') }}</button>
                      <button
                        class="iw__result-btn iw__result-btn--fail"
                        :class="{ 'iw__result-btn--active': row.it.result === 'rejected' }"
                        @click="setResult(row.it, 'rejected')"
                      >❌ {{ $t('inspections.table.fail') }}</button>
                    </div>
                    <div v-if="row.it.result === 'rejected'" class="iw__reject-form">
                      <select v-model="row.it.rejection_code_id" class="iw__select iw__select--sm" @change="saveRow(row.it)">
                        <option :value="null">{{ $t('inspections.noCode') }}</option>
                        <option v-for="c in rejectionCodes" :key="c.id" :value="c.id">{{ c.code }} — {{ c.label }}</option>
                      </select>
                      <input
                        v-model="row.it.comment"
                        class="iw__input iw__input--sm"
                        :placeholder="$t('inspections.commentPlaceholder')"
                        @blur="saveRow(row.it)"
                      />
                    </div>
                  </td>
                  <td>
                    <input
                      v-if="row.it.result === 'passed'"
                      type="date"
                      v-model="row.it.next_due"
                      class="iw__date-input"
                      @change="saveRow(row.it)"
                    />
                    <span v-else>—</span>
                  </td>
                </tr>
              </template>
              <tr v-if="!sortedRows.length">
                <td colspan="9" class="iw__empty">{{ $t('inspections.table.noMatches') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="completeError" class="iw__error">{{ completeError }}</p>
        <button class="iw__next" :disabled="notAssessedCount > 0 || completing" @click="finish">
          {{ completing ? $t('common.saving') : $t('inspections.table.finish') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'
import { fetchRejectionCodes, findPreviousResult } from '../composables/useInspections'
import { generateCertificate } from '../composables/useCertificate'

const route = useRoute()
const { t } = useI18n()
const id = route.params.id as string

interface Product {
  id: string
  brand: string | null
  name: string | null
  category: string | null
  product_type: string | null
  interval_override_months: number | null
  max_age_mfr_years: number | null
  max_age_use_years: number | null
  recall_url: string | null
  inspection_notice_url: string | null
}
interface Article {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_category: string | null
  free_description: string | null
  manufacture_year: number | null
  manufacture_month: number | null
  first_use_date: string | null
  severe_use: boolean
  interval_override_months: number | null
  product: Product | null
}
interface Item {
  id: string
  article_id: string
  result: string
  next_due: string | null
  rejection_code_id: string | null
  comment: string | null
  article: Article
}

const inspection = ref<any>(null)
const items = ref<Item[]>([])
const loading = ref(true)
const error = ref('')

const filterText = ref('')
const previousResults = ref<Record<string, { result: string; comment: string | null; inspection_date: string } | null>>({})
const rejectionCodes = ref<{ id: string; code: number; label: string | null }[]>([])

const completing = ref(false)
const completeError = ref('')
const finished = ref(false)
const certificateUrl = ref('')
const addError = ref('')

const sortKey = ref<'category' | 'brand' | 'label' | 'serial' | 'year' | 'nextDue'>('label')
const sortDir = ref<1 | -1>(1)

// Hele catalogus één keer geladen; voedt de datalists (zoeken + vrije invoer)
// en laat ons een getypt artikel terugkoppelen aan een productrij (product_id),
// zodat levensduur/recall/interval-data meekomen.
const products = ref<Product[]>([])
const allBrands = computed(() => unique(products.value.map(p => p.brand)))
const allCategories = computed(() => unique(products.value.map(p => p.category)))
const allArticleNames = computed(() => unique(products.value.map(p => p.name)))

function unique(arr: (string | null)[]): string[] {
  return Array.from(new Set(arr.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
}

// Toevoegrij
const newBrand = ref('')
const newCategory = ref('')
const newDescription = ref('')
const newSerial = ref('')
const newYear = ref<number | null>(null)
const newMonth = ref<number | null>(null)
const canAdd = computed(() => !!newDescription.value.trim() || !!newCategory.value.trim())

function itemBrand(it: Item) { return it.article.product?.brand ?? it.article.free_brand ?? '' }
function itemName(it: Item) { return it.article.product?.name ?? it.article.free_description ?? '' }
function itemCategory(it: Item) { return it.article.product?.category ?? it.article.free_category ?? '' }
function itemLabel(it: Item) { return itemName(it) || t('articles.untitled') }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const passedCount = computed(() => items.value.filter(i => i.result === 'passed').length)
const rejectedCount = computed(() => items.value.filter(i => i.result === 'rejected').length)
const notAssessedCount = computed(() => items.value.filter(i => i.result === 'not_assessed').length)

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

// Standaard keuringsinterval: artikel-override > product-override >
// bedrijfsinstelling per producttype (PPE/rigging, standaard 12 mnd). Bewust
// NIET gekapt op de levensduur — de keurmeester bepaalt zelf de datum; de
// levensduur-waarschuwing (zie rowWarning) is alleen advies.
function defaultIntervalMonths(it: Item): number {
  const a = it.article
  if (a.interval_override_months != null) return a.interval_override_months
  if (a.product?.interval_override_months != null) return a.product.interval_override_months
  const type = a.product?.product_type
  if (type === 'rigging') return inspection.value?.company?.default_interval_rigging_months ?? 12
  return inspection.value?.company?.default_interval_ppe_months ?? 12
}

function suggestedNextDue(it: Item): Date {
  return addMonths(new Date(), defaultIntervalMonths(it))
}

function endOfLife(it: Item): Date | null {
  const a = it.article
  let eol: Date | null = null
  if (a.manufacture_year != null && a.product?.max_age_mfr_years != null) {
    eol = new Date(a.manufacture_year + a.product.max_age_mfr_years, (a.manufacture_month ?? 1) - 1, 1)
  }
  if (a.first_use_date && a.product?.max_age_use_years != null) {
    const eolUse = addMonths(new Date(a.first_use_date), a.product.max_age_use_years * 12)
    if (!eol || eolUse < eol) eol = eolUse
  }
  return eol
}

// Levensduur-waarschuwing voor de keurmeester (advies, geen blokkade — de
// keurmeester bepaalt goed/afgekeurd). Verschijnt bewust niet op het
// certificaat (useCertificate.ts gebruikt deze data niet).
function rowWarning(it: Item): { icon: string; text: string } | null {
  const eol = endOfLife(it)
  if (!eol) return null
  const now = Date.now()
  if (eol.getTime() <= now) return { icon: '⛔', text: t('inspections.table.ageWarningOverdue') }
  if (eol.getTime() <= suggestedNextDue(it).getTime()) {
    const months = Math.max(1, Math.round((eol.getTime() - now) / (1000 * 60 * 60 * 24 * 30)))
    return { icon: '⚠', text: t('inspections.table.ageWarningSoon', { months }) }
  }
  return null
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

interface Row {
  it: Item
  label: string
  brand: string
  category: string
  year: string
  previous: { result: string; comment: string | null; inspection_date: string } | null
  warning: { icon: string; text: string } | null
  score: number
}

function searchScore(it: Item, q: string): number {
  if (!q) return 0
  const sn = (it.article.serial_number || '').toLowerCase()
  if (sn === q) return 0
  if (sn.endsWith(q)) return 1
  if (sn.includes(q)) return 2
  if (itemName(it).toLowerCase().includes(q)) return 3
  if (itemBrand(it).toLowerCase().includes(q)) return 4
  if (itemCategory(it).toLowerCase().includes(q)) return 5
  return -1
}

const rows = computed<Row[]>(() => {
  const q = filterText.value.toLowerCase().trim()
  const result: Row[] = []
  for (const it of items.value) {
    const score = searchScore(it, q)
    if (q && score < 0) continue
    const y = it.article.manufacture_year
    result.push({
      it,
      label: itemLabel(it),
      brand: itemBrand(it),
      category: itemCategory(it),
      year: y ? String(y) + (it.article.manufacture_month ? '/' + String(it.article.manufacture_month).padStart(2, '0') : '') : '',
      previous: previousResults.value[it.article_id] ?? null,
      warning: rowWarning(it),
      score,
    })
  }
  return result
})

const sortedRows = computed(() => {
  const list = [...rows.value]
  if (filterText.value.trim()) {
    list.sort((a, b) => a.score - b.score)
    return list
  }
  list.sort((a, b) => {
    let cmp = 0
    if (sortKey.value === 'category') cmp = a.category.localeCompare(b.category)
    else if (sortKey.value === 'brand') cmp = a.brand.localeCompare(b.brand)
    else if (sortKey.value === 'label') cmp = a.label.localeCompare(b.label)
    else if (sortKey.value === 'serial') cmp = (a.it.article.serial_number || '').localeCompare(b.it.article.serial_number || '')
    else if (sortKey.value === 'year') cmp = (a.it.article.manufacture_year ?? 0) - (b.it.article.manufacture_year ?? 0)
    else if (sortKey.value === 'nextDue') cmp = (a.it.next_due || '').localeCompare(b.it.next_due || '')
    return cmp * sortDir.value
  })
  return list
})

function toggleSort(key: typeof sortKey.value) {
  if (sortKey.value === key) sortDir.value = (sortDir.value * -1) as 1 | -1
  else { sortKey.value = key; sortDir.value = 1 }
}

async function load() {
  loading.value = true
  error.value = ''
  const { data: insp, error: insErr } = await supabase
    .from('inspections')
    .select('*, customer:customers(name), company:inspection_companies(country_code, default_interval_ppe_months, default_interval_rigging_months)')
    .eq('id', id)
    .single()
  if (insErr) { error.value = insErr.message; loading.value = false; return }
  inspection.value = insp

  const { data: rowsData, error: itemsErr } = await supabase
    .from('inspection_items')
    .select('id, article_id, result, next_due, rejection_code_id, comment, article:articles(*, product:products(*))')
    .eq('inspection_id', id)
    .order('created_at')
  if (itemsErr) { error.value = itemsErr.message; loading.value = false; return }
  items.value = (rowsData ?? []) as unknown as Item[]

  rejectionCodes.value = await fetchRejectionCodes(insp.company_id)

  const prevEntries = await Promise.all(
    items.value.map(async (it) => [it.article_id, await findPreviousResult(it.article_id, id)] as const)
  )
  previousResults.value = Object.fromEntries(prevEntries)

  const { data: prods } = await supabase
    .from('products')
    .select('id, brand, name, category, product_type, interval_override_months, max_age_mfr_years, max_age_use_years, recall_url, inspection_notice_url')
  products.value = (prods ?? []) as Product[]

  if (insp.status === 'completed') finished.value = true
  loading.value = false
}

// Koppel een getypt artikel aan een catalogusproduct (op naam, en als er een
// merk is ingevuld ook op merk). Niet gevonden = vrij artikel.
function matchProduct(): Product | null {
  const name = newDescription.value.trim().toLowerCase()
  const brand = newBrand.value.trim().toLowerCase()
  if (!name) return null
  const matches = products.value.filter(p => (p.name ?? '').toLowerCase() === name)
  if (!matches.length) return null
  if (brand) {
    const withBrand = matches.find(p => (p.brand ?? '').toLowerCase() === brand)
    if (withBrand) return withBrand
  }
  return matches[0]
}

async function addRow() {
  addError.value = ''
  try {
    const product = matchProduct()
    const { data: article, error: artErr } = await supabase
      .from('articles')
      .insert({
        customer_id: inspection.value.customer_id,
        product_id: product?.id ?? null,
        free_brand: product ? null : (newBrand.value.trim() || null),
        free_category: product ? null : (newCategory.value.trim() || null),
        free_description: product ? null : (newDescription.value.trim() || null),
        serial_number: newSerial.value.trim() || null,
        manufacture_year: newYear.value || null,
        manufacture_month: newMonth.value || null,
        retired: false,
      })
      .select('*, product:products(*)')
      .single()
    if (artErr) throw artErr

    const { data: item, error: itemErr } = await supabase
      .from('inspection_items')
      .insert({ inspection_id: id, article_id: article.id, article_snapshot: article, result: 'not_assessed' })
      .select('id, article_id, result, next_due, rejection_code_id, comment')
      .single()
    if (itemErr) throw itemErr

    items.value.push({ ...item, article } as Item)
    previousResults.value[article.id] = null

    newBrand.value = ''
    newCategory.value = ''
    newDescription.value = ''
    newSerial.value = ''
    newYear.value = null
    newMonth.value = null
  } catch (e: any) {
    addError.value = e.message
  }
}

function setResult(it: Item, result: 'passed' | 'rejected') {
  it.result = result
  it.next_due = result === 'passed' ? toIsoDate(suggestedNextDue(it)) : null
  if (result === 'passed') { it.rejection_code_id = null; it.comment = null }
  saveRow(it)
}

async function saveRow(it: Item) {
  await supabase.from('inspection_items').update({
    result: it.result,
    next_due: it.next_due,
    rejection_code_id: it.rejection_code_id,
    comment: it.comment,
  }).eq('id', it.id)
}

async function finish() {
  completing.value = true
  completeError.value = ''
  try {
    const { error: err } = await supabase
      .from('inspections')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err

    const { storagePath } = await generateCertificate(id)
    certificateUrl.value = supabase.storage.from('certificates').getPublicUrl(storagePath).data.publicUrl
    finished.value = true
  } catch (e: any) {
    completeError.value = e.message
  } finally {
    completing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.iw { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.iw__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10; gap: 0.75rem;
}
.iw__header h1 { font-size: 1.1rem; margin: 0; flex: 1; text-align: center; }
.iw__totals { font-size: 0.8rem; opacity: 0.9; white-space: nowrap; }
.iw__state { text-align: center; padding: 3rem 1rem; color: #666; }
.iw__state--error { color: #dc2626; }
.iw__body { padding: 1.25rem; }

.iw__add { background: #fff; border-radius: 12px; padding: 0.85rem; margin-bottom: 0.85rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }

.iw__input, .iw__select {
  padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; box-sizing: border-box; font-family: inherit; flex: 1; min-width: 8rem;
}
.iw__input--sm { flex: 1; min-width: 7rem; }
.iw__input--xs { flex: 0 0 5rem; min-width: 4rem; }
.iw__select--sm { min-width: 8rem; }
.iw__search { width: 100%; margin-bottom: 0.85rem; }

.iw__table-wrap { background: #fff; border-radius: 12px; overflow-x: auto; }
.iw__table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.iw__table th, .iw__table td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #eee; text-align: left; vertical-align: top; }
.iw__table th { color: #6b7280; font-weight: 600; font-size: 0.8rem; white-space: nowrap; }
.iw__sortable { cursor: pointer; user-select: none; }
.iw__sortable:hover { color: #111827; }
.iw__row--passed { background: #f0fdf4; }
.iw__row--rejected { background: #fef2f2; }
.iw__warn-cell { white-space: nowrap; }
.iw__warn-icon { margin-right: 0.25rem; }
.iw__category { color: #374151; }
.iw__sn { color: #6b7280; }
.iw__prev--pass { color: #16a34a; }
.iw__prev--fail { color: #dc2626; }
.iw__prev--none { color: #9ca3af; }
.iw__empty { text-align: center; color: #9ca3af; padding: 2rem 1rem; }

.iw__result-buttons { display: flex; gap: 0.4rem; }
.iw__result-btn { padding: 0.45rem 0.65rem; border-radius: 8px; border: 1px solid #ddd; background: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.iw__result-btn--pass.iw__result-btn--active { background: #16a34a; color: #fff; border-color: #16a34a; }
.iw__result-btn--fail.iw__result-btn--active { background: #dc2626; color: #fff; border-color: #dc2626; }
.iw__reject-form { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem; min-width: 12rem; }
.iw__date-input { padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #ddd; }

.iw__error { color: #dc2626; font-size: 0.9rem; margin: 0.5rem 0; }

.iw__next {
  width: 100%; margin-top: 1.25rem; padding: 0.9rem; border-radius: 10px;
  border: none; background: #16a34a; color: #fff; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.iw__next:disabled { opacity: 0.6; }

.iw__btn { padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.iw__btn--cancel { background: #f3f4f6; color: #374151; }
.iw__btn--save { background: #16a34a; color: #fff; }
.iw__btn:disabled { opacity: 0.6; }

.iw__cert-done { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
.iw__cert-ok { font-weight: 600; color: #16a34a; margin: 0; }
.iw__cert-link { text-align: center; text-decoration: none; display: block; }
</style>
