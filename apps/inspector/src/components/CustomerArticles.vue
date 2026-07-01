<template>
  <section class="ca">
    <div class="ca__head">
      <h2>{{ $t('articles.title') }}</h2>
      <button v-if="!showAdd" class="ca__add" @click="openAdd">+ {{ $t('articles.add') }}</button>
    </div>

    <div v-if="loading" class="ca__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ca__state ca__state--error">{{ error }}</div>
    <p v-else-if="articles.length === 0 && !showAdd" class="ca__state">{{ $t('articles.empty') }}</p>

    <ul v-else-if="articles.length" class="ca__list">
      <li v-for="a in articles" :key="a.id" class="ca__item">
        <div class="ca__item-main" @click="$router.push(`/articles/${a.id}`)">
          <div class="ca__desc">{{ articleLabel(a) }}</div>
          <div class="ca__meta">
            <span v-if="a.serial_number">SN {{ a.serial_number }}</span>
            <span v-if="!a.product_id" class="ca__badge">{{ $t('articles.freeBadge') }}</span>
          </div>
        </div>
        <!-- Alleen bij vrije artikelen: aanbieden voor de catalogus-wachtlijst.
             Rechts in de rij (niet in het invoerformulier), gelijk aan de
             keuringstabel. @click.stop zodat het vinkje niet doorklikt naar
             het artikeldetail. -->
        <label v-if="!a.product_id" class="ca__catalog-toggle"
               :title="$t('articles.suggestForCatalog')" @click.stop>
          <input type="checkbox" v-model="a.suggest_for_catalog" @change="toggleCatalog(a)" />
          📚
        </label>
      </li>
    </ul>

    <!-- Toevoegen (inline) -->
    <div v-if="showAdd" class="ca__form">
      <h3>{{ $t('articles.add') }}</h3>

      <!-- Zelfde invoerflow als bij een keuring: Artikel/Merk/Categorie hebben
           ieder hun eigen typeahead op de catalogus; matcht het getypte
           artikel exact een catalogusproduct, dan vullen merk/categorie zich
           vanzelf. Geen match = vrij artikel. -->
      <div class="ca__field">
        <input
          v-model="newDescription"
          class="ca__input"
          :placeholder="$t('inspections.table.article')"
          @focus="activeField = 'article'"
          @blur="closeSuggest"
          @keydown="onSuggestKeydown"
        />
        <div v-if="activeField === 'article' && fieldSuggestions.length" class="ca__suggest">
          <button v-for="(s, i) in fieldSuggestions" :key="s" type="button"
                  class="ca__suggest-item" :class="{ 'ca__suggest-item--active': i === suggestIndex }"
                  @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
        </div>
      </div>
      <div class="ca__field">
        <input
          v-model="newBrand"
          class="ca__input"
          :placeholder="$t('inspections.table.brand')"
          @focus="activeField = 'brand'"
          @blur="closeSuggest"
          @keydown="onSuggestKeydown"
        />
        <div v-if="activeField === 'brand' && fieldSuggestions.length" class="ca__suggest">
          <button v-for="(s, i) in fieldSuggestions" :key="s" type="button"
                  class="ca__suggest-item" :class="{ 'ca__suggest-item--active': i === suggestIndex }"
                  @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
        </div>
      </div>
      <div class="ca__field">
        <input
          v-model="newCategory"
          class="ca__input"
          :placeholder="$t('inspections.table.category')"
          @focus="activeField = 'category'"
          @blur="closeSuggest"
          @keydown="onSuggestKeydown"
        />
        <div v-if="activeField === 'category' && fieldSuggestions.length" class="ca__suggest">
          <button v-for="(s, i) in fieldSuggestions" :key="s" type="button"
                  class="ca__suggest-item" :class="{ 'ca__suggest-item--active': i === suggestIndex }"
                  @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
        </div>
      </div>

      <!-- Vrij artikel: alleen de extra velden die het keurbedrijf aanzet
           (Norm/MBS). Het aanbieden voor de catalogus staat bewust niet hier
           maar per rij in de artikellijst hierboven. -->
      <template v-if="willBeFreeArticle && (freeFields.norm || freeFields.mbs)">
        <input v-if="freeFields.norm" v-model="form.free_norm" :placeholder="$t('inspections.table.norm')" class="ca__input" />
        <input v-if="freeFields.mbs"  v-model="form.free_mbs"  :placeholder="$t('inspections.table.mbs')"  class="ca__input" />
      </template>

      <hr class="ca__sep" />
      <div class="ca__row">
        <input v-model="newYear" type="number" class="ca__input ca__input--sm" :placeholder="$t('inspections.table.year')" />
        <select v-model="newMonth" class="ca__input ca__input--sm">
          <option :value="null">{{ $t('inspections.table.month') }}</option>
          <option v-for="m in 12" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <input v-model="form.serial_number"      :placeholder="$t('articles.fields.serial')" class="ca__input" />
      <input v-model="form.assigned_user_name" :placeholder="$t('articles.fields.user')"   class="ca__input" />
      <label class="ca__date-label">
        {{ $t('articles.fields.firstUse') }}
        <input v-model="form.first_use_date" type="date" class="ca__input" />
      </label>
      <input v-model="form.set_label" :placeholder="$t('articles.fields.set')" class="ca__input" />
      <textarea v-model="form.notes" :placeholder="$t('articles.fields.notes')" class="ca__input" rows="2"></textarea>

      <p v-if="formError" class="ca__error">{{ formError }}</p>
      <div class="ca__actions">
        <button class="ca__btn ca__btn--cancel" @click="closeAdd">{{ $t('common.cancel') }}</button>
        <button class="ca__btn ca__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, useOnline, useOfflineSession, getArticlesForCustomer, getProducts } from '@gearonimo/core'
import { useFieldSuggest, fuzzyFilter } from '@gearonimo/ui'
import { fetchFreeInputFields } from '../composables/useInspections'

const { isOnline } = useOnline()

const props = defineProps<{ customerId: string }>()
const { t } = useI18n()

interface Product { id: string; brand: string | null; name: string | null; category: string | null }
interface ProductMatch { id: string; brand: string | null; name: string | null; product_type?: string | null }
interface Article {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_description: string | null
  product_id: string | null
  suggest_for_catalog: boolean
  product: ProductMatch | null
}

const articles = ref<Article[]>([])
const loading = ref(true)
const error = ref('')

const showAdd = ref(false)
const saving = ref(false)
const formError = ref('')

// Hele catalogus één keer geladen, zelfde aanpak als in InspectionWizard.vue:
// voedt de Artikel/Merk/Categorie-typeaheads en laat een getypt artikel
// terugkoppelen aan een catalogusproduct.
const products = ref<Product[]>([])
const allBrands = computed(() => unique(products.value.map(p => p.brand)))
const allCategories = computed(() => unique(products.value.map(p => p.category)))
const allArticleNames = computed(() => unique(products.value.map(p => p.name)))
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

const newDescription = ref('')
const newBrand = ref('')
const newCategory = ref('')
const newYear = ref<number | null>(null)
const newMonth = ref<number | null>(null)

type SuggestField = 'article' | 'brand' | 'category'

// Tolerante matching uit @gearonimo/ui: vindt ook "OK TriactLock" bij "ok tl"
// (acroniem van woord-initialen), niet alleen bij een aaneengesloten "ok t".
function suggestFilter(list: string[], typed: string): string[] {
  return fuzzyFilter(list, typed, 30)
}
function setFieldValue(field: SuggestField, val: string) {
  switch (field) {
    case 'article': newDescription.value = val; break
    case 'brand': newBrand.value = val; break
    case 'category': newCategory.value = val; break
  }
}

// Gedeelde typeahead-besturing (zie @gearonimo/ui). De template gebruikt de
// vertrouwde namen via aliassen.
const {
  activeField,
  suggestIndex,
  suggestions: fieldSuggestions,
  pick: pickSuggestion,
  close: closeSuggest,
  onKeydown: onSuggestKeydown,
} = useFieldSuggest<SuggestField>({
  resolve: (field) => {
    switch (field) {
      case 'article': return suggestFilter(matchingArticleNames.value, newDescription.value)
      case 'brand': return suggestFilter(allBrands.value, newBrand.value)
      case 'category': return suggestFilter(allCategories.value, newCategory.value)
      default: return []
    }
  },
  select: setFieldValue,
})

// Zodra het getypte artikel exact een catalogusproduct matcht, merk en
// categorie meteen invullen. Vrije tekst laat de velden met rust.
watch(newDescription, (name) => {
  const n = name.trim().toLowerCase()
  if (!n) return
  const p = products.value.find(p => (p.name ?? '').toLowerCase() === n)
  if (p) {
    if (p.brand) newBrand.value = p.brand
    if (p.category) newCategory.value = p.category
  }
})

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
const willBeFreeArticle = computed(() => !!newDescription.value.trim() && !matchProduct())

function emptyForm() {
  return {
    free_norm: '', free_mbs: '',
    serial_number: '', assigned_user_name: '', first_use_date: '', set_label: '', notes: '',
  }
}

// Per-rij wachtlijst-toggle in de artikellijst (zie ook InspectionWizard).
async function toggleCatalog(a: Article) {
  const { error: err } = await supabase
    .from('articles')
    .update({ suggest_for_catalog: a.suggest_for_catalog })
    .eq('id', a.id)
  if (err) { error.value = err.message; a.suggest_for_catalog = !a.suggest_for_catalog }
}
const form = ref(emptyForm())

// Extra vrije-invoervelden die het keurbedrijf heeft aangezet (Norm/MBS).
const freeFields = ref<{ norm: boolean; mbs: boolean }>({ norm: false, mbs: false })

function articleLabel(a: Article) {
  const s = a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  return s || t('articles.untitled')
}

async function load() {
  loading.value = true
  error.value = ''

  if (!isOnline.value) {
    try {
      const key = useOfflineSession().getKey()
      const cached = await getArticlesForCustomer<
        { id: string; serial_number: string | null; free_brand: string | null; free_description: string | null; product_id: string | null; suggest_for_catalog: boolean; retired: boolean }
      >(key, props.customerId)
      const productIds = [...new Set(cached.map((a) => a.product_id).filter((v): v is string => !!v))]
      const cachedProducts = productIds.length ? await getProducts<ProductMatch>(key, productIds) : []
      const productById = new Map(cachedProducts.map((p) => [p.id, p]))
      articles.value = cached
        .filter((a) => !a.retired)
        .map((a) => ({
          id: a.id,
          serial_number: a.serial_number,
          free_brand: a.free_brand,
          free_description: a.free_description,
          product_id: a.product_id,
          suggest_for_catalog: a.suggest_for_catalog,
          product: a.product_id ? productById.get(a.product_id) ?? null : null,
        }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
    loading.value = false
    return
  }

  const { data, error: err } = await supabase
    .from('articles')
    .select('id, serial_number, free_brand, free_description, product_id, suggest_for_catalog, product:products(id, brand, name)')
    .eq('customer_id', props.customerId)
    .eq('retired', false)
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else articles.value = (data ?? []) as unknown as Article[]
  loading.value = false
}

function openAdd() { showAdd.value = true }
function closeAdd() {
  showAdd.value = false
  newDescription.value = ''; newBrand.value = ''; newCategory.value = ''
  newYear.value = null; newMonth.value = null
  activeField.value = null; suggestIndex.value = -1
  formError.value = ''
  form.value = emptyForm()
}

async function save() {
  formError.value = ''
  if (!newDescription.value.trim()) {
    formError.value = t('articles.errors.chooseOrDescribe'); return
  }
  const product = matchProduct()
  saving.value = true
  const { error: err } = await supabase.from('articles').insert({
    customer_id: props.customerId,
    product_id: product?.id ?? null,
    free_brand: product ? null : (newBrand.value.trim() || null),
    free_category: product ? null : (newCategory.value.trim() || null),
    free_description: product ? null : (newDescription.value.trim() || null),
    free_norm: product ? null : (form.value.free_norm.trim() || null),
    free_mbs: product ? null : (form.value.free_mbs.trim() || null),
    serial_number: form.value.serial_number.trim() || null,
    assigned_user_name: form.value.assigned_user_name.trim() || null,
    first_use_date: form.value.first_use_date || null,
    set_label: form.value.set_label.trim() || null,
    notes: form.value.notes.trim() || null,
    manufacture_year: newYear.value || null,
    manufacture_month: newMonth.value || null,
    // Aanbieden voor de catalogus gebeurt nu per rij in de lijst, niet bij toevoegen.
    suggest_for_catalog: false,
    retired: false,
  })
  saving.value = false
  if (err) { formError.value = err.message; return }
  closeAdd()
  await load()
}

onMounted(async () => {
  fetchFreeInputFields().then((f) => { freeFields.value = f })
  // Offline: geen volledige catalogusaanroep (die is sowieso te groot om
  // mee te downloaden, zie slice 2) -- de typeaheads voor een nieuw artikel
  // blijven dan leeg (toevoegen is al online-only), maar de bestaande
  // artikellijst (load() hieronder) blijft wel gewoon werken uit de cache.
  if (isOnline.value) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, brand, name, category')
    products.value = (prods ?? []) as Product[]
  }
  await load()
})
</script>

<style scoped>
.ca { margin-top: 1.5rem; }
.ca__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.ca__head h2 { font-size: 1rem; margin: 0; }
.ca__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.ca__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.ca__state--error { color: #dc2626; }
.ca__list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ca__item { display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1rem; border-bottom: 1px solid #eee; }
.ca__item:last-child { border-bottom: none; }
.ca__item-main { flex: 1; min-width: 0; cursor: pointer; }
.ca__catalog-toggle {
  display: inline-flex; align-items: center; cursor: pointer;
  opacity: 0.4; filter: grayscale(1); font-size: 1.05rem; padding: 0.2rem;
}
.ca__catalog-toggle:has(input:checked) { opacity: 1; filter: none; }
.ca__catalog-toggle input { cursor: pointer; }
.ca__desc { font-weight: 600; }
.ca__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; display: flex; gap: 0.5rem; align-items: center; }
.ca__badge { background: #fef3c7; color: #92400e; border-radius: 6px; padding: 0.05rem 0.4rem; font-size: 0.75rem; }

.ca__form {
  background: #fff; border-radius: 12px; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.6rem;
}
.ca__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.ca__field { position: relative; }
.ca__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
.ca__results {
  list-style: none; margin: 0.25rem 0 0; padding: 0;
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff;
}
.ca__results li { padding: 0.6rem 0.85rem; cursor: pointer; border-bottom: 1px solid #f3f4f6; }
.ca__results li:last-child { border-bottom: none; }
.ca__results-item--active { background: #16a34a; color: #fff; }
.ca__results-item--active strong { color: #fff; }
.ca__suggest {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 5;
  background: #fff; border: 1px solid #ddd; border-radius: 8px;
  margin-top: 0.25rem; padding: 0.3rem;
  display: flex; flex-direction: column; gap: 0.1rem;
  max-height: 240px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.ca__suggest-item {
  text-align: left; border: none; background: transparent; cursor: pointer;
  padding: 0.45rem 0.6rem; border-radius: 6px; font-size: 0.9rem;
  color: #111827; font-family: inherit;
}
.ca__suggest-item:hover { background: #f3f4f6; }
.ca__suggest-item--active { background: #e0e7ff; }
.ca__row { display: flex; gap: 0.6rem; }
.ca__input--sm { flex: 1; }
.ca__sep { border: none; border-top: 1px solid #eee; margin: 0.4rem 0; }
.ca__date-label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: #6b7280; }
.ca__selected { margin: 0.35rem 0 0; color: #16a34a; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
.ca__clear { background: none; border: none; color: #6b7280; font-size: 1.1rem; cursor: pointer; }
.ca__link { background: none; border: none; color: #2563eb; text-align: left; padding: 0; font-size: 0.9rem; cursor: pointer; }
.ca__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.ca__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.ca__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.ca__btn--cancel { background: #f3f4f6; color: #374151; }
.ca__btn--save { background: #16a34a; color: #fff; }
.ca__btn:disabled { opacity: 0.6; }
</style>
