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
      <li v-for="a in articles" :key="a.id" class="ca__item" @click="$router.push(`/articles/${a.id}`)">
        <div class="ca__desc">{{ articleLabel(a) }}</div>
        <div class="ca__meta">
          <span v-if="a.serial_number">SN {{ a.serial_number }}</span>
          <span v-if="!a.product_id" class="ca__badge">{{ $t('articles.freeBadge') }}</span>
        </div>
      </li>
    </ul>

    <!-- Toevoegen (inline) -->
    <div v-if="showAdd" class="ca__form">
      <h3>{{ $t('articles.add') }}</h3>

      <!-- Catalogus-modus: eerst artikel zoeken, daarna eventueel op merk filteren -->
      <template v-if="!freeMode">
        <div class="ca__field">
          <input
            v-model="catalogQuery" type="search"
            :placeholder="$t('articles.catalogSearch')"
            class="ca__input"
            @input="onCatalogQueryChange" @keydown="onCatalogKeydown"
          />
          <ul v-if="catalogResults.length" class="ca__results">
            <li v-for="(p, i) in catalogResults" :key="p.id"
                :class="{ 'ca__results-item--active': i === catalogHighlight }"
                @click="pickProduct(p)">
              <strong>{{ p.brand }}</strong> {{ p.name }}
            </li>
          </ul>
          <p v-if="selectedProduct" class="ca__selected">
            ✓ {{ selectedProduct.brand }} {{ selectedProduct.name }}
            <button class="ca__clear" @click="clearSelectedProduct">×</button>
          </p>
        </div>

        <div class="ca__field">
          <input
            v-model="brandQuery" type="search"
            :placeholder="$t('articles.brandFilter')"
            class="ca__input"
            @input="onBrandQueryChange" @keydown="onBrandKeydown"
          />
          <ul v-if="brandResults.length" class="ca__results">
            <li v-for="(b, i) in brandResults" :key="b"
                :class="{ 'ca__results-item--active': i === brandHighlight }"
                @click="pickBrand(b)">{{ b }}</li>
          </ul>
          <p v-if="selectedBrand" class="ca__selected">
            ✓ {{ selectedBrand }}
            <button class="ca__clear" @click="clearBrand">×</button>
          </p>
        </div>

        <button v-if="catalogQuery.trim() && !selectedProduct" class="ca__link" @click="freeMode = true">
          {{ $t('articles.cantFind') }}
        </button>
      </template>

      <!-- Vrij artikel -->
      <template v-else>
        <button class="ca__link" @click="toCatalog">{{ $t('articles.backToCatalog') }}</button>
        <input v-model="form.free_brand"       :placeholder="$t('articles.fields.brand')"       class="ca__input" />
        <input v-model="form.free_description"  :placeholder="$t('articles.fields.description')" class="ca__input" />
        <label class="ca__checkbox">
          <input type="checkbox" v-model="form.suggest_for_catalog" />
          {{ $t('articles.suggestForCatalog') }}
        </label>
        <input v-if="form.suggest_for_catalog" v-model="form.free_manual_url"
               :placeholder="$t('articles.fields.manualUrl')" class="ca__input" />
      </template>

      <hr class="ca__sep" />
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'

const props = defineProps<{ customerId: string }>()
const { t } = useI18n()

interface ProductMatch { id: string; brand: string | null; name: string | null; product_type?: string | null }
interface Article {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_description: string | null
  product_id: string | null
  product: ProductMatch | null
}

const articles = ref<Article[]>([])
const loading = ref(true)
const error = ref('')

const showAdd = ref(false)
const freeMode = ref(false)
const saving = ref(false)
const formError = ref('')

const catalogQuery = ref('')
const catalogResults = ref<ProductMatch[]>([])
const selectedProduct = ref<ProductMatch | null>(null)
const catalogHighlight = ref(-1)
let catalogTimeout: ReturnType<typeof setTimeout> | undefined

const brandQuery = ref('')
const brandResults = ref<string[]>([])
const selectedBrand = ref<string | null>(null)
const brandHighlight = ref(-1)
let brandTimeout: ReturnType<typeof setTimeout> | undefined

function emptyForm() {
  return {
    free_brand: '', free_description: '', free_manual_url: '', suggest_for_catalog: false,
    serial_number: '', assigned_user_name: '', first_use_date: '', set_label: '', notes: '',
  }
}
const form = ref(emptyForm())

function articleLabel(a: Article) {
  const s = a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  return s || t('articles.untitled')
}

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('articles')
    .select('id, serial_number, free_brand, free_description, product_id, product:products(id, brand, name)')
    .eq('customer_id', props.customerId)
    .eq('retired', false)
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else articles.value = (data ?? []) as unknown as Article[]
  loading.value = false
}

function onCatalogQueryChange() {
  selectedProduct.value = null
  catalogHighlight.value = -1
  clearTimeout(catalogTimeout)
  const q = catalogQuery.value.trim()
  if (!q && !selectedBrand.value) { catalogResults.value = []; return }
  catalogTimeout = setTimeout(async () => {
    const { data, error: err } = await supabase.rpc('search_products', { q: q || null, brand_filter: selectedBrand.value })
    if (err) { catalogResults.value = []; return }
    catalogResults.value = (data ?? []) as ProductMatch[]
    catalogHighlight.value = catalogResults.value.length ? 0 : -1
  }, 250)
}

function onCatalogKeydown(e: KeyboardEvent) {
  if (!catalogResults.value.length) return
  if (e.key === 'ArrowDown') { e.preventDefault(); catalogHighlight.value = (catalogHighlight.value + 1) % catalogResults.value.length }
  else if (e.key === 'ArrowUp') { e.preventDefault(); catalogHighlight.value = (catalogHighlight.value - 1 + catalogResults.value.length) % catalogResults.value.length }
  else if (e.key === 'Enter') { e.preventDefault(); if (catalogHighlight.value >= 0) pickProduct(catalogResults.value[catalogHighlight.value]) }
  else if (e.key === 'Escape') { catalogResults.value = [] }
}

function pickProduct(p: ProductMatch) { selectedProduct.value = p; catalogResults.value = [] }
function clearSelectedProduct() { selectedProduct.value = null; catalogQuery.value = '' }

function onBrandQueryChange() {
  selectedBrand.value = null
  brandHighlight.value = -1
  clearTimeout(brandTimeout)
  const q = brandQuery.value.trim()
  if (!q) { brandResults.value = []; return }
  brandTimeout = setTimeout(async () => {
    const { data } = await supabase
      .from('products').select('brand')
      .ilike('brand', `%${q}%`).not('brand', 'is', null).limit(50)
    const unique = Array.from(new Set((data ?? []).map((r: any) => r.brand as string))).sort()
    brandResults.value = unique.slice(0, 8)
    brandHighlight.value = brandResults.value.length ? 0 : -1
  }, 200)
}

function onBrandKeydown(e: KeyboardEvent) {
  if (!brandResults.value.length) return
  if (e.key === 'ArrowDown') { e.preventDefault(); brandHighlight.value = (brandHighlight.value + 1) % brandResults.value.length }
  else if (e.key === 'ArrowUp') { e.preventDefault(); brandHighlight.value = (brandHighlight.value - 1 + brandResults.value.length) % brandResults.value.length }
  else if (e.key === 'Enter') { e.preventDefault(); if (brandHighlight.value >= 0) pickBrand(brandResults.value[brandHighlight.value]) }
  else if (e.key === 'Escape') { brandResults.value = [] }
}

function pickBrand(b: string) {
  selectedBrand.value = b; brandQuery.value = b; brandResults.value = []
  if (catalogQuery.value.trim() || selectedProduct.value) onCatalogQueryChange()
}
function clearBrand() {
  selectedBrand.value = null; brandQuery.value = ''
  if (catalogQuery.value.trim()) onCatalogQueryChange()
}

function openAdd() { showAdd.value = true }
function toCatalog() { freeMode.value = false; selectedProduct.value = null }
function closeAdd() {
  showAdd.value = false
  freeMode.value = false
  catalogQuery.value = ''; catalogResults.value = []; selectedProduct.value = null
  brandQuery.value = ''; brandResults.value = []; selectedBrand.value = null
  catalogHighlight.value = -1; brandHighlight.value = -1; formError.value = ''
  form.value = emptyForm()
}

async function save() {
  formError.value = ''
  if (!selectedProduct.value && !form.value.free_description.trim()) {
    formError.value = t('articles.errors.chooseOrDescribe'); return
  }
  if (form.value.suggest_for_catalog &&
      (!form.value.free_brand.trim() || !form.value.free_description.trim() || !form.value.free_manual_url.trim())) {
    formError.value = t('articles.errors.suggestRequired'); return
  }
  saving.value = true
  const { error: err } = await supabase.from('articles').insert({
    customer_id: props.customerId,
    product_id: selectedProduct.value?.id ?? null,
    free_brand: selectedProduct.value ? null : (form.value.free_brand.trim() || null),
    free_description: selectedProduct.value ? null : (form.value.free_description.trim() || null),
    free_manual_url: selectedProduct.value ? null : (form.value.free_manual_url.trim() || null),
    serial_number: form.value.serial_number.trim() || null,
    assigned_user_name: form.value.assigned_user_name.trim() || null,
    first_use_date: form.value.first_use_date || null,
    set_label: form.value.set_label.trim() || null,
    notes: form.value.notes.trim() || null,
    suggest_for_catalog: selectedProduct.value ? false : form.value.suggest_for_catalog,
    retired: false,
  })
  saving.value = false
  if (err) { formError.value = err.message; return }
  closeAdd()
  await load()
}

onMounted(load)
</script>

<style scoped>
.ca { margin-top: 1.5rem; }
.ca__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.ca__head h2 { font-size: 1rem; margin: 0; }
.ca__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.ca__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.ca__state--error { color: #dc2626; }
.ca__list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ca__item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.ca__item:last-child { border-bottom: none; }
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
.ca__sep { border: none; border-top: 1px solid #eee; margin: 0.4rem 0; }
.ca__date-label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: #6b7280; }
.ca__selected { margin: 0.35rem 0 0; color: #16a34a; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
.ca__clear { background: none; border: none; color: #6b7280; font-size: 1.1rem; cursor: pointer; }
.ca__link { background: none; border: none; color: #2563eb; text-align: left; padding: 0; font-size: 0.9rem; cursor: pointer; }
.ca__checkbox { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #374151; }
.ca__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.ca__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.ca__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.ca__btn--cancel { background: #f3f4f6; color: #374151; }
.ca__btn--save { background: #16a34a; color: #fff; }
.ca__btn:disabled { opacity: 0.6; }
</style>
