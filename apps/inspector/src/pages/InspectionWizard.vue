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
        <!-- Zoek én toevoegen in één: deze velden filteren meteen de tabel
             hieronder; staat een artikel er niet bij, vul de overige velden
             aan en klik op Toevoegen. De velden staan bovenaan zodat invoer
             altijd in beeld blijft. -->
        <div class="iw__add">
          <input
            v-model="newDescription"
            class="iw__input"
            :placeholder="$t('inspections.table.article')"
            @focus="activeField = 'article'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <input
            v-model="newBrand"
            class="iw__input iw__input--sm"
            :placeholder="$t('inspections.table.brand')"
            @focus="activeField = 'brand'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <input
            v-model="newCategory"
            class="iw__input iw__input--sm"
            :placeholder="$t('inspections.table.category')"
            @focus="activeField = 'category'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <input
            v-model="newSerial"
            class="iw__input iw__input--sm"
            :placeholder="$t('inspections.table.serial')"
            @focus="activeField = 'serial'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <input v-model="newYear" type="number" class="iw__input iw__input--xs iw__input--nospin" :placeholder="$t('inspections.table.year')" />
          <select v-model="newMonth" class="iw__select iw__select--xs">
            <option :value="null">{{ $t('inspections.table.month') }}</option>
            <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
          </select>
          <div class="iw__result-buttons">
            <button
              class="iw__result-btn iw__result-btn--pass"
              :class="{ 'iw__result-btn--active': newResult === 'passed' }"
              @click="newResult = newResult === 'passed' ? 'not_assessed' : 'passed'"
            >✅</button>
            <button
              class="iw__result-btn iw__result-btn--fail"
              :class="{ 'iw__result-btn--active': newResult === 'rejected' }"
              @click="newResult = newResult === 'rejected' ? 'not_assessed' : 'rejected'"
            >❌</button>
          </div>
          <select v-if="newResult === 'rejected'" v-model="newRejectionCodeId" class="iw__select iw__select--sm">
            <option :value="null">{{ $t('inspections.noCode') }}</option>
            <option v-for="c in rejectionCodes" :key="c.id" :value="c.id">{{ c.code }} — {{ c.label }}</option>
          </select>
          <button class="iw__btn iw__btn--save" :disabled="!canAdd" @click="addRow">{{ $t('inspections.table.add') }}</button>
          <button
            v-if="lastArticle"
            class="iw__btn iw__btn--copy"
            type="button"
            :title="$t('inspections.table.copyLastTooltip')"
            @click="copyLastArticle"
          >{{ $t('inspections.table.copyLast') }}</button>
        </div>

        <!-- Eigen, niet-zwevende suggestielijst (i.p.v. native datalist): duwt
             de tabel naar beneden i.p.v. eroverheen te vallen. Elk veld zoekt
             in z'n eigen bron: Artikel/Merk/Categorie in de catalogus,
             Serienummer in de al toegevoegde artikelen van deze keuring. -->
        <div v-if="activeField && fieldSuggestions.length" class="iw__suggest">
          <button
            v-for="(s, i) in fieldSuggestions"
            :key="s"
            type="button"
            ref="suggestItemRefs"
            class="iw__suggest-item"
            :class="{ 'iw__suggest-item--active': i === suggestIndex }"
            @mousedown.prevent="pickSuggestion(s)"
            @mouseenter="suggestIndex = i"
          >{{ s }}</button>
        </div>

        <!-- Spiekbriefje: productiedag (uit SN) of weeknummer naar maand. Past
             niets automatisch toe — alleen op klik, om verwarring tussen
             dag-van-jaar en datum te voorkomen. -->
        <div class="iw__cheatsheet">
          <span class="iw__cheatsheet-label" :title="$t('inspections.table.dayHelperTooltip')">{{ $t('inspections.table.dayHelper') }} ⓘ</span>
          <input
            v-model="dayHint"
            type="number"
            min="1"
            max="366"
            class="iw__input iw__input--xs iw__input--nospin"
            :placeholder="$t('inspections.table.dayPlaceholder')"
            :title="$t('inspections.table.dayHelperTooltip')"
          />
          <template v-if="dayHintMonth">
            <span class="iw__cheatsheet-result">→ {{ monthName(dayHintMonth) }}</span>
            <button class="iw__cheatsheet-apply" @click="newMonth = dayHintMonth">{{ $t('inspections.table.useMonth') }}</button>
          </template>
          <span class="iw__cheatsheet-sep">·</span>
          <span class="iw__cheatsheet-label" :title="$t('inspections.table.weekHelperTooltip')">{{ $t('inspections.table.weekHelper') }} ⓘ</span>
          <input
            v-model="weekHint"
            type="number"
            min="1"
            max="53"
            class="iw__input iw__input--xs iw__input--nospin"
            :placeholder="$t('inspections.table.weekPlaceholder')"
            :title="$t('inspections.table.weekHelperTooltip')"
          />
          <span v-if="weekHintMonth" class="iw__cheatsheet-result">→ {{ monthName(weekHintMonth) }}</span>
          <button v-if="weekHintMonth" class="iw__cheatsheet-apply" @click="newMonth = weekHintMonth">{{ $t('inspections.table.useMonth') }}</button>
        </div>

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
                <th>{{ $t('inspections.table.colFirstUse') }}</th>
                <th>{{ $t('inspections.table.colUser') }}</th>
                <th>{{ $t('inspections.table.colPrevious') }}</th>
                <th>{{ $t('inspections.table.colResult') }}</th>
                <th class="iw__sortable" @click="toggleSort('nextDue')">{{ $t('inspections.table.colNextDue') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <template v-for="row in sortedRows" :key="row.it.id">
                <tr :class="{ 'iw__row--rejected': row.it.result === 'rejected', 'iw__row--passed': row.it.result === 'passed' }">
                  <td class="iw__warn-cell">
                    <span v-if="row.warning" :title="row.warning.text" class="iw__warn-icon">{{ row.warning.icon }}</span>
                    <a v-if="itemManualUrl(row.it)" :href="itemManualUrl(row.it)!" target="_blank" class="iw__warn-icon" :title="$t('articles.fields.manualUrl')">📖</a>
                    <button v-else-if="!row.it.article.product" class="iw__icon-btn" :title="$t('inspections.table.addManualUrl')" @click="editManualUrl(row.it)">📖</button>
                    <a v-if="itemHasRecall(row.it) && itemRecallUrl(row.it)" :href="itemRecallUrl(row.it)!" target="_blank" class="iw__warn-icon" title="Recall">🚩</a>
                    <span v-else-if="itemHasRecall(row.it)" class="iw__warn-icon" title="Recall">🚩</span>
                    <button
                      v-if="!row.it.article.product"
                      class="iw__icon-btn"
                      :class="{ 'iw__icon-btn--active': row.it.article.free_recall_flag }"
                      :title="$t('inspections.table.toggleRecall')"
                      @click="toggleFreeRecall(row.it)"
                    >🚩</button>
                  </td>
                  <td class="iw__category">{{ row.category || '—' }}</td>
                  <td>{{ row.brand || '—' }}</td>
                  <td>{{ row.label }}</td>
                  <td>
                    <input
                      v-model="row.it.article.serial_number"
                      class="iw__cell-input"
                      :placeholder="$t('inspections.table.serial')"
                      @change="saveArticle(row.it)"
                    />
                  </td>
                  <td class="iw__year-cell">
                    <span v-if="row.warning" :title="row.warning.text" class="iw__warn-icon">{{ row.warning.icon }}</span>
                    <input
                      v-model.number="row.it.article.manufacture_year"
                      type="number"
                      class="iw__cell-input iw__cell-input--xs"
                      placeholder="JJJJ"
                      @change="saveArticle(row.it)"
                    />
                  </td>
                  <td>
                    <input
                      v-model="row.it.article.first_use_date"
                      type="date"
                      class="iw__date-input"
                      @change="saveArticle(row.it)"
                    />
                  </td>
                  <td>
                    <input
                      v-model="row.it.article.assigned_user_name"
                      class="iw__cell-input"
                      :placeholder="$t('articles.fields.user')"
                      @change="saveArticle(row.it)"
                    />
                  </td>
                  <td>
                    <span v-if="row.previous" :class="row.previous.result === 'passed' ? 'iw__prev--pass' : 'iw__prev--fail'">
                      {{ row.previous.result === 'passed' ? '✅' : '❌' }} {{ formatDate(row.previous.inspection_date) }}
                    </span>
                    <span v-else class="iw__prev--none">—</span>
                  </td>
                  <td class="iw__result-cell">
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
                      <select v-if="row.it.result === 'rejected'" v-model="row.it.rejection_code_id" class="iw__select iw__select--sm" @change="saveRow(row.it)">
                        <option :value="null">{{ $t('inspections.noCode') }}</option>
                        <option v-for="c in rejectionCodes" :key="c.id" :value="c.id">{{ c.code }} — {{ c.label }}</option>
                      </select>
                      <input
                        v-model="row.it.comment"
                        class="iw__input iw__input--sm iw__comment-input"
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
                  <td class="iw__actions-cell">
                    <span v-if="row.it.article.retired" class="iw__retired-badge" :title="$t('articles.detail.retiredBadge')">🗑</span>
                    <button v-else class="iw__retire-btn" :title="$t('articles.detail.retire')" @click="retireArticle(row.it)">🗑</button>
                  </td>
                </tr>
              </template>
              <tr v-if="!sortedRows.length">
                <td colspan="12" class="iw__empty">{{ $t('inspections.table.noMatches') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="addError" class="iw__error">{{ addError }}</p>

        <p v-if="completeError" class="iw__error">{{ completeError }}</p>
        <button class="iw__next" :disabled="notAssessedCount > 0 || completing" @click="finish">
          {{ completing ? $t('common.saving') : $t('inspections.table.finish') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
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
  manual_url: string | null
}
interface Article {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_category: string | null
  free_description: string | null
  free_manual_url: string | null
  free_recall_flag: boolean
  free_recall_url: string | null
  assigned_user_name: string | null
  manufacture_year: number | null
  manufacture_month: number | null
  first_use_date: string | null
  severe_use: boolean
  interval_override_months: number | null
  retired: boolean
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

// Artikel-dropdown houdt rekening met al gekozen Merk/Categorie, zodat je
// na het selecteren van "FALL SAFE" + "Harnesses" alleen nog FALL SAFE
// harnassen ziet (en de lijst korter en relevanter blijft).
const matchingArticleNames = computed(() => {
  const b = newBrand.value.trim().toLowerCase()
  const c = newCategory.value.trim().toLowerCase()
  if (!b && !c) return allArticleNames.value
  const filtered = products.value.filter(p =>
    (!b || (p.brand ?? '').toLowerCase() === b) &&
    (!c || (p.category ?? '').toLowerCase() === c)
  )
  return unique(filtered.map(p => p.name))
})

function unique(arr: (string | null)[]): string[] {
  return Array.from(new Set(arr.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
}

// Eigen suggestielijst (Optie A): in plaats van de native <datalist> die over
// de tabel heen viel, tonen we een inline lijst onder de toevoegrij. Elk veld
// zoekt strikt in z'n eigen bron — Serienummer kijkt alleen naar de artikelen
// die al in deze keuring staan, niet in de catalogus.
const activeField = ref<null | 'article' | 'brand' | 'category' | 'serial'>(null)
const existingSerials = computed(() => unique(items.value.map(i => i.article.serial_number)))

function suggestFilter(list: string[], typed: string): string[] {
  const q = typed.trim().toLowerCase()
  const out = q ? list.filter(v => v.toLowerCase().includes(q)) : list
  return out.slice(0, 30)
}

const fieldSuggestions = computed<string[]>(() => {
  switch (activeField.value) {
    case 'article': return suggestFilter(matchingArticleNames.value, newDescription.value)
    case 'brand': return suggestFilter(allBrands.value, newBrand.value)
    case 'category': return suggestFilter(allCategories.value, newCategory.value)
    case 'serial': return suggestFilter(existingSerials.value, newSerial.value)
    default: return []
  }
})

function pickSuggestion(val: string) {
  switch (activeField.value) {
    case 'article': newDescription.value = val; break
    case 'brand': newBrand.value = val; break
    case 'category': newCategory.value = val; break
    case 'serial': newSerial.value = val; break
  }
  activeField.value = null
}

// Korte vertraging zodat een klik op een suggestie nog registreert voordat de
// lijst door blur verdwijnt (mousedown.prevent vangt de meeste gevallen al af).
function closeSuggest() {
  setTimeout(() => { activeField.value = null }, 120)
}

// Met pijltjestoetsen door de suggestielijst lopen, Enter kiest, Escape sluit.
const suggestIndex = ref(-1)
const suggestItemRefs = ref<HTMLButtonElement[]>([])
watch(fieldSuggestions, () => { suggestIndex.value = -1 })
watch(suggestIndex, (i) => {
  if (i < 0) return
  nextTick(() => suggestItemRefs.value[i]?.scrollIntoView({ block: 'nearest' }))
})

function onSuggestKeydown(e: KeyboardEvent) {
  if (!activeField.value || !fieldSuggestions.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    suggestIndex.value = (suggestIndex.value + 1) % fieldSuggestions.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    suggestIndex.value = suggestIndex.value <= 0 ? fieldSuggestions.value.length - 1 : suggestIndex.value - 1
  } else if (e.key === 'Enter' && suggestIndex.value >= 0) {
    e.preventDefault()
    pickSuggestion(fieldSuggestions.value[suggestIndex.value])
  } else if (e.key === 'Escape') {
    activeField.value = null
  }
}

// Toevoegrij
const newBrand = ref('')
const newCategory = ref('')
const newDescription = ref('')
const newSerial = ref('')
const newYear = ref<number | null>(null)
const newMonth = ref<number | null>(null)
const newResult = ref<'not_assessed' | 'passed' | 'rejected'>('not_assessed')
const newRejectionCodeId = ref<string | null>(null)
const canAdd = computed(() => !!newDescription.value.trim() || !!newCategory.value.trim())

// Onthoudt het laatst toegevoegde artikel zodat een serie identieke
// exemplaren (bv. 10 karabiners) snel achter elkaar in te voeren is: alles
// kopiëren behalve het serienummer.
const lastArticle = ref<{ description: string; brand: string; category: string; year: number | null; month: number | null } | null>(null)
function copyLastArticle() {
  if (!lastArticle.value) return
  newDescription.value = lastArticle.value.description
  newBrand.value = lastArticle.value.brand
  newCategory.value = lastArticle.value.category
  newYear.value = lastArticle.value.year
  newMonth.value = lastArticle.value.month
  newSerial.value = ''
}

// Spiekbriefje: dag-van-jaar (Juliaanse dag, vaak 3 cijfers in het SN
// verwerkt) of weeknummer naar maand. Levert alleen een suggestie — de
// keurmeester past 'm zelf toe op Maand, zodat "3" nooit stilzwijgend als
// "3 juni" wordt opgeslagen.
const dayHint = ref<number | null>(null)
const weekHint = ref<number | null>(null)
const MONTH_NAMES_NL = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
function monthName(m: number) { return MONTH_NAMES_NL[m - 1] }
const dayHintMonth = computed<number | null>(() => {
  const d = dayHint.value
  if (!d || d < 1 || d > 366) return null
  const y = newYear.value || new Date().getFullYear()
  return new Date(y, 0, d).getMonth() + 1
})
// Een week kan over twee maanden lopen; we pakken bewust altijd de laagste
// (vroegste) maand. Dat scheelt iemand hooguit een paar dagen levensduur,
// in plaats van een artikel per ongeluk weken te lang "goedgekeurd" te laten.
const weekHintMonth = computed<number | null>(() => {
  const w = weekHint.value
  if (!w || w < 1 || w > 53) return null
  const y = newYear.value || new Date().getFullYear()
  const start = new Date(y, 0, 1 + (w - 1) * 7)
  return start.getMonth() + 1
})

// Zodra een artikel uit de catalogus gekozen wordt (naam matcht exact een
// product), meteen merk en categorie invullen. Vrije tekst laat de velden met
// rust.
watch(newDescription, (name) => {
  const n = name.trim().toLowerCase()
  if (!n) return
  const p = products.value.find(p => (p.name ?? '').toLowerCase() === n)
  if (p) {
    if (p.brand) newBrand.value = p.brand
    if (p.category) newCategory.value = p.category
  }
})

function itemBrand(it: Item) { return it.article.product?.brand ?? it.article.free_brand ?? '' }
function itemName(it: Item) { return it.article.product?.name ?? it.article.free_description ?? '' }
function itemCategory(it: Item) { return it.article.product?.category ?? it.article.free_category ?? '' }
function itemLabel(it: Item) { return itemName(it) || t('articles.untitled') }
function itemManualUrl(it: Item) { return it.article.product?.manual_url ?? it.article.free_manual_url ?? null }
function itemRecallUrl(it: Item) { return it.article.product?.recall_url ?? it.article.free_recall_url ?? null }
function itemHasRecall(it: Item) { return !!it.article.product?.recall_url || it.article.free_recall_flag }

// Bij vrije (niet-catalogus) artikelen kan de keurmeester zelf een recall
// aanvinken (en optioneel een link erbij zetten) — bij catalogusartikelen
// komt dit automatisch uit het product.
async function toggleFreeRecall(it: Item) {
  if (it.article.product) return
  const next = !it.article.free_recall_flag
  let url = it.article.free_recall_url
  if (next) {
    url = window.prompt(t('inspections.table.recallUrlPrompt'), url ?? '') || null
  }
  const { error: err } = await supabase
    .from('articles')
    .update({ free_recall_flag: next, free_recall_url: url })
    .eq('id', it.article.id)
  if (!err) { it.article.free_recall_flag = next; it.article.free_recall_url = url }
}

async function editManualUrl(it: Item) {
  if (it.article.product) return
  const url = window.prompt(t('inspections.table.manualUrlPrompt'), it.article.free_manual_url ?? '')
  if (url === null) return
  const value = url.trim() || null
  const { error: err } = await supabase.from('articles').update({ free_manual_url: value }).eq('id', it.article.id)
  if (!err) it.article.free_manual_url = value
}

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

// De toevoegvelden filteren meteen de tabel: elk ingevuld veld moet matchen
// (AND), zo niet dan blijft de getypte tekst gewoon staan om als nieuw
// (vrij) artikel te kunnen toevoegen.
const hasFilter = computed(() =>
  !!(newDescription.value.trim() || newBrand.value.trim() || newCategory.value.trim() || newSerial.value.trim())
)

function matchesFilters(it: Item): boolean {
  const d = newDescription.value.trim().toLowerCase()
  const b = newBrand.value.trim().toLowerCase()
  const c = newCategory.value.trim().toLowerCase()
  const s = newSerial.value.trim().toLowerCase()
  if (d && !itemName(it).toLowerCase().includes(d)) return false
  if (b && !itemBrand(it).toLowerCase().includes(b)) return false
  if (c && !itemCategory(it).toLowerCase().includes(c)) return false
  if (s && !(it.article.serial_number || '').toLowerCase().includes(s)) return false
  return true
}

function matchScore(it: Item): number {
  const s = newSerial.value.trim().toLowerCase()
  if (s) {
    const sn = (it.article.serial_number || '').toLowerCase()
    if (sn === s) return 0
    if (sn.endsWith(s)) return 1
    return 2
  }
  const d = newDescription.value.trim().toLowerCase()
  if (d && itemName(it).toLowerCase().startsWith(d)) return 1
  return 3
}

const rows = computed<Row[]>(() => {
  const result: Row[] = []
  for (const it of items.value) {
    if (hasFilter.value && !matchesFilters(it)) continue
    const y = it.article.manufacture_year
    result.push({
      it,
      label: itemLabel(it),
      brand: itemBrand(it),
      category: itemCategory(it),
      year: y ? String(y) + (it.article.manufacture_month ? '/' + String(it.article.manufacture_month).padStart(2, '0') : '') : '',
      previous: previousResults.value[it.article_id] ?? null,
      warning: rowWarning(it),
      score: matchScore(it),
    })
  }
  return result
})

const sortedRows = computed(() => {
  const list = [...rows.value]
  if (hasFilter.value) {
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
    .select('id, brand, name, category, product_type, interval_override_months, max_age_mfr_years, max_age_use_years, recall_url, inspection_notice_url, manual_url')
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

    const initialNextDue = newResult.value === 'passed' ? toIsoDate(suggestedNextDue({ article } as Item)) : null
    const { data: item, error: itemErr } = await supabase
      .from('inspection_items')
      .insert({
        inspection_id: id,
        article_id: article.id,
        article_snapshot: article,
        result: newResult.value,
        next_due: initialNextDue,
        rejection_code_id: newResult.value === 'rejected' ? newRejectionCodeId.value : null,
      })
      .select('id, article_id, result, next_due, rejection_code_id, comment')
      .single()
    if (itemErr) throw itemErr

    items.value.push({ ...item, article } as Item)
    previousResults.value[article.id] = null

    lastArticle.value = {
      description: newDescription.value.trim(),
      brand: newBrand.value.trim(),
      category: newCategory.value.trim(),
      year: newYear.value,
      month: newMonth.value,
    }

    newBrand.value = ''
    newCategory.value = ''
    newDescription.value = ''
    newSerial.value = ''
    newYear.value = null
    newMonth.value = null
    newResult.value = 'not_assessed'
    newRejectionCodeId.value = null
    dayHint.value = null
    weekHint.value = null
  } catch (e: any) {
    addError.value = e.message
  }
}

// Klik op een al actief resultaat zet 'm terug naar niet-beoordeeld (herstel
// van een misklik); opmerking blijft altijd staan, ook bij goedkeur.
function setResult(it: Item, result: 'passed' | 'rejected') {
  if (it.result === result) {
    it.result = 'not_assessed'
    it.next_due = null
  } else {
    it.result = result
    it.next_due = result === 'passed' ? toIsoDate(suggestedNextDue(it)) : null
    if (result === 'passed') it.rejection_code_id = null
  }
  saveRow(it)
}

// "Afvoeren" = zachte verwijdering (prullenbak): het artikel blijft bestaan
// zodat eerder uitgegeven certificaten (die een snapshot bevatten) intact
// blijven, maar telt niet meer mee voor nieuwe keuringen.
async function retireArticle(it: Item) {
  if (!confirm(t('articles.detail.retireBody'))) return
  const { error: err } = await supabase
    .from('articles')
    .update({ retired: true, retired_at: new Date().toISOString() })
    .eq('id', it.article.id)
  if (!err) it.article.retired = true
}

// Bestaande artikelgegevens corrigeren vanuit de tabel (verkeerd serienummer,
// vergeten datum/bouwjaar). Slaat direct op in de articles-tabel.
async function saveArticle(it: Item) {
  const a = it.article
  await supabase.from('articles').update({
    serial_number: a.serial_number?.toString().trim() || null,
    manufacture_year: a.manufacture_year || null,
    first_use_date: a.first_use_date || null,
    assigned_user_name: a.assigned_user_name?.toString().trim() || null,
  }).eq('id', a.id)
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

/* Inline suggestielijst (Optie A): duwt de tabel naar beneden i.p.v. eroverheen. */
.iw__suggest {
  background: #fff; border: 1px solid #ddd; border-radius: 8px;
  margin: -0.35rem 0 0.85rem; padding: 0.3rem;
  display: flex; flex-direction: column; gap: 0.1rem;
  max-height: 240px; overflow-y: auto;
}
.iw__suggest-item {
  text-align: left; border: none; background: transparent; cursor: pointer;
  padding: 0.45rem 0.6rem; border-radius: 6px; font-size: 0.9rem;
  color: #111827; font-family: inherit;
}
.iw__suggest-item:hover { background: #f3f4f6; }
.iw__suggest-item--active { background: #e0e7ff; }

.iw__input, .iw__select {
  padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; box-sizing: border-box; font-family: inherit; flex: 1; min-width: 8rem;
}
.iw__input--sm { flex: 1; min-width: 7rem; }
.iw__input--xs { flex: 0 0 5rem; min-width: 4rem; }
.iw__select--sm { min-width: 8rem; }
.iw__select--xs { flex: 0 0 5.5rem; min-width: 5rem; padding: 0.6rem 0.5rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem; font-family: inherit; }
.iw__input--nospin { -moz-appearance: textfield; }
.iw__input--nospin::-webkit-outer-spin-button,
.iw__input--nospin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

.iw__cheatsheet {
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
  font-size: 0.8rem; color: #6b7280; margin-bottom: 0.85rem; padding: 0 0.25rem;
}
.iw__cheatsheet .iw__input { flex: 0 0 4rem; min-width: 3.5rem; padding: 0.35rem 0.5rem; }
.iw__cheatsheet-label { white-space: nowrap; }
.iw__cheatsheet-result { font-weight: 600; color: #16a34a; white-space: nowrap; }
.iw__cheatsheet-apply { border: 1px solid #16a34a; color: #16a34a; background: #fff; border-radius: 6px; padding: 0.15rem 0.5rem; font-size: 0.75rem; cursor: pointer; }
.iw__cheatsheet-sep { opacity: 0.5; }

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
.iw__icon-btn {
  margin-right: 0.25rem;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.1rem;
  opacity: 0.55;
}
.iw__icon-btn:hover { opacity: 1; }
.iw__icon-btn--active { opacity: 1; filter: drop-shadow(0 0 1px #dc2626); }
.iw__category { color: #374151; }
.iw__sn { color: #6b7280; }
.iw__prev--pass { color: #16a34a; }
.iw__prev--fail { color: #dc2626; }
.iw__prev--none { color: #9ca3af; }
.iw__empty { text-align: center; color: #9ca3af; padding: 2rem 1rem; }

.iw__result-buttons { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
.iw__result-btn { padding: 0.45rem 0.65rem; border-radius: 8px; border: 1px solid #ddd; background: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer; white-space: nowrap; }
.iw__result-btn--pass.iw__result-btn--active { background: #16a34a; color: #fff; border-color: #16a34a; }
.iw__result-btn--fail.iw__result-btn--active { background: #dc2626; color: #fff; border-color: #dc2626; }
.iw__result-cell { min-width: 11rem; }
.iw__comment-input { flex: 1 1 9rem; min-width: 9rem; }
.iw__actions-cell { text-align: center; }
.iw__retire-btn { border: none; background: transparent; cursor: pointer; font-size: 1rem; opacity: 0.6; }
.iw__retire-btn:hover { opacity: 1; }
.iw__retired-badge { opacity: 0.5; }
.iw__date-input { padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid #ddd; }
.iw__cell-input {
  padding: 0.4rem 0.5rem; border-radius: 6px; border: 1px solid transparent;
  font-size: 0.9rem; font-family: inherit; width: 100%; min-width: 6rem; box-sizing: border-box;
  background: transparent;
}
.iw__cell-input:hover { border-color: #ddd; }
.iw__cell-input:focus { border-color: #16a34a; background: #fff; outline: none; }
.iw__cell-input--xs { min-width: 4rem; width: 4.5rem; }
.iw__year-cell { white-space: nowrap; }

.iw__error { color: #dc2626; font-size: 0.9rem; margin: 0.5rem 0; }

.iw__next {
  width: 100%; margin-top: 1.25rem; padding: 0.9rem; border-radius: 10px;
  border: none; background: #16a34a; color: #fff; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.iw__next:disabled { opacity: 0.6; }

.iw__btn { padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.iw__btn--cancel { background: #f3f4f6; color: #374151; }
.iw__btn--save { background: #16a34a; color: #fff; }
.iw__btn--copy { background: #f3f4f6; color: #374151; padding: 0.6rem 0.85rem; font-size: 0.9rem; }
.iw__btn:disabled { opacity: 0.6; }

.iw__cert-done { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
.iw__cert-ok { font-weight: 600; color: #16a34a; margin: 0; }
.iw__cert-link { text-align: center; text-decoration: none; display: block; }
</style>
