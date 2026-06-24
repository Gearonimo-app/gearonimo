<template>
  <div class="iw">
    <header class="iw__header">
      <button class="iw__icon" @click="$router.push(`/customers/${inspection?.customer_id}`)">←</button>
      <h1>{{ inspection?.customer?.name }}</h1>
      <span class="iw__step">{{ $t('inspections.step', { n: step }) }}</span>
    </header>

    <div v-if="loading" class="iw__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="iw__state iw__state--error">{{ error }}</div>

    <template v-else>
      <!-- Stap 1: artikelen kiezen -->
      <div v-if="step === 1" class="iw__body">
        <div class="iw__filters">
          <input v-model="filterText" type="search" :placeholder="$t('inspections.filterPlaceholder')" class="iw__input" />
          <select v-model="filterType" class="iw__select">
            <option value="">{{ $t('inspections.filterAll') }}</option>
            <option v-for="t in availableTypes" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <ul class="iw__check-list">
          <li v-for="it in filteredItems" :key="it.id" class="iw__check-item">
            <label>
              <input type="checkbox" :checked="true" @change="toggleItem(it)" />
              {{ itemLabel(it) }}
              <span v-if="it.article.serial_number" class="iw__sn">SN {{ it.article.serial_number }}</span>
            </label>
          </li>
        </ul>

        <button v-if="!showFreeForm" class="iw__link" @click="showFreeForm = true">
          + {{ $t('inspections.addUnknown') }}
        </button>
        <div v-else class="iw__free-form">
          <input v-model="freeDescription" :placeholder="$t('articles.fields.description')" class="iw__input" />
          <input v-model="freeBrand" :placeholder="$t('articles.fields.brand')" class="iw__input" />
          <div class="iw__actions">
            <button class="iw__btn iw__btn--cancel" @click="showFreeForm = false">{{ $t('common.cancel') }}</button>
            <button class="iw__btn iw__btn--save" :disabled="!freeDescription.trim()" @click="addFreeArticle">{{ $t('common.save') }}</button>
          </div>
        </div>

        <button class="iw__next" :disabled="!items.length" @click="goToReview(0)">
          {{ $t('inspections.next') }}
        </button>
      </div>

      <!-- Stap 2: per artikel beoordelen -->
      <div v-else-if="step === 2 && currentItem" class="iw__body">
        <p class="iw__counter">{{ $t('inspections.itemCounter', { n: reviewIndex + 1, total: items.length }) }}</p>

        <h2 class="iw__article-name">{{ itemLabel(currentItem) }}</h2>
        <p v-if="currentItem.article.serial_number" class="iw__sn">SN {{ currentItem.article.serial_number }}</p>

        <p v-if="previousResult" class="iw__previous">
          {{ $t('inspections.previousResult', {
            result: previousResult.result === 'passed' ? $t('inspections.passed') : $t('inspections.rejected'),
            date: formatDate(previousResult.inspection_date),
          }) }}
        </p>

        <p v-if="lifeCycleWarning" class="iw__warning">⚠ {{ lifeCycleWarning }}</p>
        <p v-if="currentItem.article.product?.recall_url" class="iw__flag">
          🚩 <a :href="currentItem.article.product.recall_url" target="_blank">{{ $t('inspections.recallFlag') }}</a>
        </p>
        <p v-if="currentItem.article.product?.inspection_notice_url" class="iw__flag">
          🚩 <a :href="currentItem.article.product.inspection_notice_url" target="_blank">{{ $t('inspections.noticeFlag') }}</a>
        </p>

        <div class="iw__result-buttons">
          <button class="iw__result-btn iw__result-btn--pass" :class="{ 'iw__result-btn--active': currentItem.result === 'passed' }" @click="markResult('passed')">
            ✅ {{ $t('inspections.passed') }}
          </button>
          <button class="iw__result-btn iw__result-btn--fail" :class="{ 'iw__result-btn--active': currentItem.result === 'rejected' }" @click="markResult('rejected')">
            ❌ {{ $t('inspections.rejected') }}
          </button>
        </div>

        <div v-if="currentItem.result === 'rejected'" class="iw__reject-form">
          <select v-if="rejectionCodes.length" v-model="currentItem.rejection_code_id" class="iw__select">
            <option :value="null">{{ $t('inspections.noCode') }}</option>
            <option v-for="c in rejectionCodes" :key="c.id" :value="c.id">{{ c.code }} — {{ c.label }}</option>
          </select>
          <textarea v-model="currentItem.comment" :placeholder="$t('inspections.commentPlaceholder')" class="iw__input" rows="2"></textarea>
        </div>

        <div class="iw__nav">
          <button class="iw__btn iw__btn--cancel" :disabled="reviewIndex === 0" @click="goToReview(reviewIndex - 1)">{{ $t('inspections.prev') }}</button>
          <button class="iw__btn iw__btn--save" @click="onReviewNext">{{ $t('inspections.next') }}</button>
        </div>
      </div>

      <!-- Stap 3: overzicht -->
      <div v-else-if="step === 3" class="iw__body">
        <p class="iw__counter">{{ $t('inspections.totalCount', { n: items.length }) }}</p>
        <p class="iw__tally">
          ✅ {{ $t('inspections.passed') }} {{ passedCount }}
          &nbsp;❌ {{ $t('inspections.rejected') }} {{ rejectedCount }}
          &nbsp;⏳ {{ $t('inspections.notAssessed') }} {{ notAssessedCount }}
        </p>

        <div v-if="notAssessedCount" class="iw__not-assessed">
          <h3>⚠ {{ $t('inspections.notAssessedTitle') }}</h3>
          <div v-for="(it, idx) in items" :key="it.id">
            <div v-if="it.result === 'not_assessed'" class="iw__not-assessed-row">
              <span>{{ itemLabel(it) }}</span>
              <button class="iw__link" @click="step = 2; goToReview(idx)">{{ $t('inspections.assess') }}</button>
            </div>
          </div>
        </div>

        <div class="iw__next-due">
          <h3>{{ $t('inspections.nextDueTitle') }}</h3>
          <div v-for="it in items.filter(i => i.result === 'passed')" :key="it.id" class="iw__next-due-row">
            <span>{{ itemLabel(it) }}</span>
            <input type="date" v-model="it.next_due" class="iw__date-input" />
          </div>
        </div>

        <button class="iw__next" :disabled="notAssessedCount > 0" @click="step = 4">
          {{ $t('inspections.finish') }}
        </button>
      </div>

      <!-- Stap 4: afronden -->
      <div v-else-if="step === 4" class="iw__body">
        <dl class="iw__summary">
          <div class="iw__summary-row"><dt>{{ $t('inspections.totalAssessed') }}</dt><dd>{{ items.length }}</dd></div>
          <div class="iw__summary-row"><dt>✅ {{ $t('inspections.passed') }}</dt><dd>{{ passedCount }}</dd></div>
          <div class="iw__summary-row"><dt>❌ {{ $t('inspections.rejected') }}</dt><dd>{{ rejectedCount }}</dd></div>
        </dl>

        <div v-if="rejectedCount" class="iw__rejected-list">
          <h3>{{ $t('inspections.rejected') }}</h3>
          <p v-for="it in items.filter(i => i.result === 'rejected')" :key="it.id">
            {{ itemLabel(it) }}<span v-if="it.rejection_code_id"> ({{ codeLabel(it.rejection_code_id) }})</span>
          </p>
        </div>

        <p v-if="completeError" class="iw__error">{{ completeError }}</p>
        <button v-if="!finished" class="iw__next" :disabled="completing" @click="finish">
          {{ completing ? $t('common.saving') : $t('inspections.saveFinish') }}
        </button>

        <div v-else class="iw__cert-done">
          <p class="iw__cert-ok">✅ {{ $t('inspections.certificateReady') }}</p>
          <a v-if="certificateUrl" :href="certificateUrl" target="_blank" class="iw__btn iw__btn--save iw__cert-link">
            {{ $t('inspections.downloadCertificate') }}
          </a>
          <button class="iw__btn iw__btn--cancel" @click="$router.push(`/customers/${inspection.customer_id}`)">
            {{ $t('inspections.backToCustomer') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'
import { calcNextDue, ProductType, CountryCode } from '@gearonimo/core'
import { fetchRejectionCodes, findPreviousResult } from '../composables/useInspections'
import { generateCertificate } from '../composables/useCertificate'

const route = useRoute()
const { t } = useI18n()
const id = route.params.id as string

interface Product {
  id: string
  brand: string | null
  name: string | null
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
const step = ref(1)

const filterText = ref('')
const filterType = ref('')
const showFreeForm = ref(false)
const freeDescription = ref('')
const freeBrand = ref('')

const reviewIndex = ref(0)
const previousResult = ref<{ result: string; comment: string | null; inspection_date: string } | null>(null)
const rejectionCodes = ref<{ id: string; code: number; label: string | null }[]>([])

const completing = ref(false)
const completeError = ref('')
const finished = ref(false)
const certificateUrl = ref('')

function itemLabel(it: Item) {
  const a = it.article
  const s = a.product ? [a.product.brand, a.product.name].filter(Boolean).join(' ') : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  return s || t('articles.untitled')
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function codeLabel(rejectionCodeId: string) {
  const c = rejectionCodes.value.find(r => r.id === rejectionCodeId)
  return c ? `${c.code} — ${c.label}` : ''
}

const availableTypes = computed(() => {
  const types = items.value.map(i => i.article.product?.product_type).filter(Boolean) as string[]
  return Array.from(new Set(types))
})

const filteredItems = computed(() => {
  const q = filterText.value.toLowerCase().trim()
  return items.value.filter(it => {
    if (filterType.value && it.article.product?.product_type !== filterType.value) return false
    if (!q) return true
    return [it.article.serial_number, it.article.free_description, it.article.product?.name].some(v => v?.toLowerCase().includes(q))
  })
})

const currentItem = computed(() => items.value[reviewIndex.value] ?? null)

const passedCount = computed(() => items.value.filter(i => i.result === 'passed').length)
const rejectedCount = computed(() => items.value.filter(i => i.result === 'rejected').length)
const notAssessedCount = computed(() => items.value.filter(i => i.result === 'not_assessed').length)

const lifeCycleWarning = computed(() => {
  const it = currentItem.value
  if (!it) return ''
  const due = suggestedNextDue(it)
  const dueNoCaps = suggestedNextDue(it, true)
  if (due.getTime() < dueNoCaps.getTime()) {
    const months = Math.round((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))
    return t('inspections.lifeCycleWarning', { months })
  }
  return ''
})

function suggestedNextDue(it: Item, ignoreCaps = false): Date {
  const a = it.article
  return calcNextDue({
    inspection_date: new Date(),
    country_code: (inspection.value?.company?.country_code ?? 'NL') as CountryCode,
    product_type: (a.product?.product_type ?? 'other') as ProductType,
    severe_use: a.severe_use,
    article_interval_override_months: a.interval_override_months,
    product_interval_override_months: a.product?.interval_override_months,
    manufacture_year: ignoreCaps ? null : a.manufacture_year,
    manufacture_month: a.manufacture_month,
    max_age_mfr_years: ignoreCaps ? null : a.product?.max_age_mfr_years,
    first_use_date: ignoreCaps || !a.first_use_date ? null : new Date(a.first_use_date),
    max_age_use_years: ignoreCaps ? null : a.product?.max_age_use_years,
  })
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function load() {
  loading.value = true
  error.value = ''
  const { data: insp, error: insErr } = await supabase
    .from('inspections')
    .select('*, customer:customers(name), company:inspection_companies(country_code)')
    .eq('id', id)
    .single()
  if (insErr) { error.value = insErr.message; loading.value = false; return }
  inspection.value = insp

  const { data: rows, error: itemsErr } = await supabase
    .from('inspection_items')
    .select('id, article_id, result, next_due, rejection_code_id, comment, article:articles(*, product:products(*))')
    .eq('inspection_id', id)
    .order('created_at')
  if (itemsErr) { error.value = itemsErr.message; loading.value = false; return }
  items.value = (rows ?? []) as unknown as Item[]

  rejectionCodes.value = await fetchRejectionCodes(insp.company_id)

  if (insp.status === 'completed') step.value = 4
  loading.value = false
}

async function toggleItem(it: Item) {
  items.value = items.value.filter(i => i.id !== it.id)
  await supabase.from('inspection_items').delete().eq('id', it.id)
}

async function addFreeArticle() {
  const { data: article, error: artErr } = await supabase
    .from('articles')
    .insert({
      customer_id: inspection.value.customer_id,
      free_description: freeDescription.value.trim(),
      free_brand: freeBrand.value.trim() || null,
      retired: false,
    })
    .select('*')
    .single()
  if (artErr) { error.value = artErr.message; return }

  const { data: item, error: itemErr } = await supabase
    .from('inspection_items')
    .insert({ inspection_id: id, article_id: article.id, article_snapshot: article, result: 'not_assessed' })
    .select('id, article_id, result, next_due, rejection_code_id, comment')
    .single()
  if (itemErr) { error.value = itemErr.message; return }

  items.value.push({ ...item, article: { ...article, product: null } } as Item)
  freeDescription.value = ''
  freeBrand.value = ''
  showFreeForm.value = false
}

async function markResult(result: 'passed' | 'rejected') {
  const it = currentItem.value
  if (!it) return
  it.result = result
  it.next_due = result === 'passed' ? toIsoDate(suggestedNextDue(it)) : null
  if (result === 'passed') { it.rejection_code_id = null; it.comment = null }
}

async function goToReview(index: number) {
  step.value = 2
  reviewIndex.value = index
  const it = currentItem.value
  previousResult.value = it ? await findPreviousResult(it.article_id, id) : null
}

async function onReviewNext() {
  const it = currentItem.value
  if (it) {
    await supabase.from('inspection_items').update({
      result: it.result,
      next_due: it.next_due,
      rejection_code_id: it.rejection_code_id,
      comment: it.comment,
    }).eq('id', it.id)
  }
  if (reviewIndex.value < items.value.length - 1) {
    await goToReview(reviewIndex.value + 1)
  } else {
    step.value = 3
  }
}

async function finish() {
  completing.value = true
  completeError.value = ''
  try {
    for (const it of items.value) {
      await supabase.from('inspection_items').update({ next_due: it.next_due }).eq('id', it.id)
    }
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
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.iw__header h1 { font-size: 1.1rem; margin: 0; flex: 1; text-align: center; }
.iw__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }
.iw__step { font-size: 0.85rem; opacity: 0.85; min-width: 3rem; text-align: right; }
.iw__state { text-align: center; padding: 3rem 1rem; color: #666; }
.iw__state--error { color: #dc2626; }
.iw__body { padding: 1.25rem; }

.iw__filters { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.iw__input, .iw__select {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; font-family: inherit; width: 100%;
}
.iw__check-list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.iw__check-item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; }
.iw__check-item:last-child { border-bottom: none; }
.iw__check-item label { display: flex; align-items: center; gap: 0.6rem; }
.iw__sn { color: #6b7280; font-size: 0.85rem; }
.iw__link { background: none; border: none; color: #2563eb; padding: 0.5rem 0; font-size: 0.95rem; cursor: pointer; }
.iw__free-form { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.5rem; }

.iw__next {
  width: 100%; margin-top: 1.25rem; padding: 0.9rem; border-radius: 10px;
  border: none; background: #16a34a; color: #fff; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.iw__next:disabled { opacity: 0.6; }

.iw__counter { color: #6b7280; font-size: 0.85rem; margin: 0 0 0.5rem; }
.iw__article-name { margin: 0 0 0.25rem; }
.iw__previous { background: #fff; border-radius: 8px; padding: 0.6rem 0.85rem; font-size: 0.9rem; color: #374151; margin: 0.5rem 0; }
.iw__warning { color: #b45309; font-size: 0.9rem; }
.iw__flag { color: #b91c1c; font-size: 0.9rem; }
.iw__flag a { color: #b91c1c; }

.iw__result-buttons { display: flex; gap: 0.75rem; margin: 1rem 0; }
.iw__result-btn { flex: 1; padding: 1rem; border-radius: 10px; border: 2px solid #ddd; background: #fff; font-size: 1rem; font-weight: 600; cursor: pointer; }
.iw__result-btn--pass.iw__result-btn--active { background: #16a34a; color: #fff; border-color: #16a34a; }
.iw__result-btn--fail.iw__result-btn--active { background: #dc2626; color: #fff; border-color: #dc2626; }
.iw__reject-form { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
.iw__nav { display: flex; gap: 0.75rem; margin-top: 1rem; }

.iw__tally { background: #fff; border-radius: 10px; padding: 0.85rem; margin: 0.5rem 0; }
.iw__not-assessed, .iw__next-due { margin-top: 1rem; }
.iw__not-assessed h3, .iw__next-due h3 { font-size: 0.95rem; margin: 0 0 0.5rem; }
.iw__not-assessed-row, .iw__next-due-row {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  background: #fff; border-radius: 8px; padding: 0.6rem 0.85rem; margin-bottom: 0.4rem;
}
.iw__date-input { padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #ddd; }

.iw__summary { background: #fff; border-radius: 12px; padding: 0.5rem 1rem; margin: 0; }
.iw__summary-row { display: flex; justify-content: space-between; padding: 0.6rem 0; border-bottom: 1px solid #eee; }
.iw__summary-row:last-child { border-bottom: none; }
.iw__rejected-list { margin-top: 1rem; background: #fff; border-radius: 12px; padding: 0.85rem 1rem; }
.iw__rejected-list h3 { margin: 0 0 0.5rem; font-size: 0.95rem; }
.iw__error { color: #dc2626; font-size: 0.9rem; margin: 0.5rem 0; }

.iw__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.iw__btn--cancel { background: #f3f4f6; color: #374151; }
.iw__btn--save { background: #16a34a; color: #fff; }
.iw__btn:disabled { opacity: 0.6; }
.iw__actions { display: flex; gap: 0.75rem; }

.iw__cert-done { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
.iw__cert-ok { font-weight: 600; color: #16a34a; margin: 0; }
.iw__cert-link { text-align: center; text-decoration: none; display: block; }
</style>
