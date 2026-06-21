<template>
  <div class="customer-detail">
    <header class="customer-detail__header">
      <button class="customer-detail__back" @click="$router.push('/customers')">← {{ $t('common.back') }}</button>
      <h1>{{ customer?.name }}</h1>
    </header>

    <div v-if="loading" class="customer-detail__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="customer-detail__state customer-detail__state--error">{{ error }}</div>

    <template v-else-if="customer">
      <div class="customer-detail__contact">
        <p v-if="customer.address || customer.city">📍 {{ [customer.address, customer.city].filter(Boolean).join(', ') }}</p>
        <p v-if="customer.phone">📞 {{ customer.phone }}</p>
        <p v-if="customer.email">✉️ {{ customer.email }}</p>
      </div>

      <button class="customer-detail__primary" @click="startOrResume">
        ▶ {{ $t('customerDetail.startInspection') }}
      </button>

      <nav class="customer-detail__tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="customer-detail__tab"
          :class="{ 'customer-detail__tab--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ $t(tab.label) }}
        </button>
      </nav>

      <!-- Artikelen -->
      <section v-if="activeTab === 'articles'" class="customer-detail__panel">
        <div v-if="articlesLoading" class="customer-detail__state">{{ $t('common.loading') }}</div>
        <div v-else-if="articlesError" class="customer-detail__state customer-detail__state--error">{{ articlesError }}</div>
        <template v-else>
          <ul v-if="articles.length" class="article-list">
            <li v-for="a in articles" :key="a.id" class="article-list__item">
              <div class="article-list__name">
                {{ a.product ? [a.product.brand, a.product.name].filter(Boolean).join(' ') : [a.free_brand, a.free_description].filter(Boolean).join(' ') }}
              </div>
              <div class="article-list__meta">
                <span v-if="a.serial_number">SN {{ a.serial_number }}</span>
                <span v-if="!a.product_id" class="article-list__badge">{{ $t('customerDetail.freeArticleBadge') }}</span>
              </div>
            </li>
          </ul>
          <p v-else class="customer-detail__empty">{{ $t('customerDetail.articlesEmpty') }}</p>

          <button v-if="!showAddArticle" class="article-add-toggle" @click="openAddArticle">
            + {{ $t('customerDetail.addArticle') }}
          </button>

          <div v-else class="article-form">
            <h3>{{ $t('customerDetail.addArticle') }}</h3>

            <template v-if="!freeMode">
              <div class="article-form__brand">
                <input
                  v-model="brandQuery"
                  type="search"
                  :placeholder="$t('customerDetail.brandFilterPlaceholder')"
                  class="article-form__input"
                  @input="onBrandQueryChange"
                  @keydown="onBrandKeydown"
                />
                <ul v-if="brandResults.length" class="catalog-results">
                  <li
                    v-for="(b, i) in brandResults"
                    :key="b"
                    :class="{ 'catalog-results__item--active': i === brandHighlight }"
                    @click="pickBrand(b)"
                  >{{ b }}</li>
                </ul>
                <p v-if="selectedBrand" class="article-form__selected">
                  ✓ {{ selectedBrand }}
                  <button class="article-form__clear" @click="clearBrand">×</button>
                </p>
              </div>

              <input
                v-model="catalogQuery"
                type="search"
                :placeholder="$t('customerDetail.catalogSearchPlaceholder')"
                class="article-form__input"
                @input="onCatalogQueryChange"
                @keydown="onCatalogKeydown"
              />
              <ul v-if="catalogResults.length" class="catalog-results">
                <li
                  v-for="(p, i) in catalogResults"
                  :key="p.id"
                  :class="{ 'catalog-results__item--active': i === catalogHighlight }"
                  @click="pickProduct(p)"
                >
                  <strong>{{ p.brand }}</strong> {{ p.name }}
                </li>
              </ul>
              <p v-if="selectedProduct" class="article-form__selected">
                ✓ {{ selectedProduct.brand }} {{ selectedProduct.name }}
                <button class="article-form__clear" @click="clearSelectedProduct">×</button>
              </p>
              <button
                v-if="catalogQuery.trim() && !selectedProduct"
                class="article-form__free-toggle"
                @click="freeMode = true"
              >
                {{ $t('customerDetail.cantFindIt') }}
              </button>
            </template>

            <template v-else>
              <p class="article-form__free-toggle" @click="freeMode = false; selectedProduct = null">
                ← {{ $t('customerDetail.backToCatalog') }}
              </p>
              <input v-model="form.free_brand" :placeholder="$t('customerDetail.fields.brand')" class="article-form__input" />
              <input v-model="form.free_description" :placeholder="$t('customerDetail.fields.description')" class="article-form__input" />
              <label class="article-form__checkbox">
                <input type="checkbox" v-model="form.suggest_for_catalog" />
                {{ $t('customerDetail.suggestForCatalog') }}
              </label>
              <input
                v-if="form.suggest_for_catalog"
                v-model="form.free_manual_url"
                :placeholder="$t('customerDetail.fields.manualUrl')"
                class="article-form__input"
              />
            </template>

            <input v-model="form.serial_number" :placeholder="$t('customerDetail.fields.serialNumber')" class="article-form__input" />

            <p v-if="addArticleError" class="customer-detail__state--error">{{ addArticleError }}</p>

            <div class="article-form__actions">
              <button class="article-form__btn article-form__btn--cancel" @click="closeAddArticle">{{ $t('common.cancel') }}</button>
              <button class="article-form__btn article-form__btn--save" :disabled="savingArticle" @click="saveArticle">
                {{ savingArticle ? $t('common.saving') : $t('common.save') }}
              </button>
            </div>
          </div>
        </template>
      </section>

      <section v-else-if="activeTab === 'history'" class="customer-detail__panel">
        <p class="customer-detail__empty">{{ $t('customerDetail.historyEmpty') }}</p>
      </section>

      <section v-else class="customer-detail__panel">
        <dl class="customer-detail__data">
          <dt>{{ $t('customers.fields.name') }}</dt><dd>{{ customer.name }}</dd>
          <dt>{{ $t('customers.fields.address') }}</dt><dd>{{ customer.address || '—' }}</dd>
          <dt>{{ $t('customers.fields.city') }}</dt><dd>{{ customer.city || '—' }}</dd>
          <dt>{{ $t('customers.fields.phone') }}</dt><dd>{{ customer.phone || '—' }}</dd>
          <dt>{{ $t('customers.fields.email') }}</dt><dd>{{ customer.email || '—' }}</dd>
        </dl>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@gearonimo/core'

interface Customer {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
}

interface ProductMatch {
  id: string
  brand: string | null
  name: string
}

interface Article {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_description: string | null
  product_id: string | null
  product: ProductMatch | null
}

const route = useRoute()
const router = useRouter()

const customer = ref<Customer | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref<'articles' | 'history' | 'data'>('articles')

const tabs = [
  { key: 'articles', label: 'customerDetail.tabs.articles' },
  { key: 'history', label: 'customerDetail.tabs.history' },
  { key: 'data', label: 'customerDetail.tabs.data' },
] as const

const articles = ref<Article[]>([])
const articlesLoading = ref(true)
const articlesError = ref('')

const showAddArticle = ref(false)
const freeMode = ref(false)
const catalogQuery = ref('')
const catalogResults = ref<ProductMatch[]>([])
const selectedProduct = ref<ProductMatch | null>(null)
const savingArticle = ref(false)
const addArticleError = ref('')

const brandQuery = ref('')
const brandResults = ref<string[]>([])
const selectedBrand = ref<string | null>(null)
const brandHighlight = ref(-1)
let brandSearchTimeout: ReturnType<typeof setTimeout> | undefined

const catalogHighlight = ref(-1)

const form = ref({
  free_brand: '',
  free_description: '',
  free_manual_url: '',
  serial_number: '',
  suggest_for_catalog: false,
})

let catalogSearchTimeout: ReturnType<typeof setTimeout> | undefined

async function load() {
  loading.value = true
  error.value = ''
  const id = route.params.id as string
  const { data, error: err } = await supabase
    .from('customers')
    .select('id, name, address, city, phone, email')
    .eq('id', id)
    .single()
  if (err) { error.value = err.message } else { customer.value = data }
  loading.value = false
}

async function loadArticles() {
  articlesLoading.value = true
  articlesError.value = ''
  const id = route.params.id as string
  const { data, error: err } = await supabase
    .from('articles')
    .select('id, serial_number, free_brand, free_description, product_id, product:products(id, brand, name)')
    .eq('customer_id', id)
    .eq('retired', false)
    .order('created_at', { ascending: false })
  if (err) { articlesError.value = err.message } else { articles.value = (data ?? []) as unknown as Article[] }
  articlesLoading.value = false
}

function onCatalogQueryChange() {
  selectedProduct.value = null
  catalogHighlight.value = -1
  clearTimeout(catalogSearchTimeout)
  const q = catalogQuery.value.trim()
  if (!q && !selectedBrand.value) { catalogResults.value = []; return }
  catalogSearchTimeout = setTimeout(async () => {
    const { data, error: err } = await supabase.rpc('search_products', {
      q: q || null,
      brand_filter: selectedBrand.value,
    })
    if (err) { catalogResults.value = []; return }
    catalogResults.value = data ?? []
    catalogHighlight.value = catalogResults.value.length ? 0 : -1
  }, 250)
}

function onCatalogKeydown(e: KeyboardEvent) {
  if (!catalogResults.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    catalogHighlight.value = (catalogHighlight.value + 1) % catalogResults.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    catalogHighlight.value = (catalogHighlight.value - 1 + catalogResults.value.length) % catalogResults.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (catalogHighlight.value >= 0) pickProduct(catalogResults.value[catalogHighlight.value])
  } else if (e.key === 'Escape') {
    catalogResults.value = []
  }
}

function pickProduct(p: ProductMatch) {
  selectedProduct.value = p
  catalogResults.value = []
}

function clearSelectedProduct() {
  selectedProduct.value = null
  catalogQuery.value = ''
}

function onBrandQueryChange() {
  selectedBrand.value = null
  brandHighlight.value = -1
  clearTimeout(brandSearchTimeout)
  const q = brandQuery.value.trim()
  if (!q) { brandResults.value = []; return }
  brandSearchTimeout = setTimeout(async () => {
    const { data } = await supabase
      .from('products')
      .select('brand')
      .ilike('brand', `%${q}%`)
      .not('brand', 'is', null)
      .limit(50)
    const unique = Array.from(new Set((data ?? []).map((r) => r.brand as string))).sort()
    brandResults.value = unique.slice(0, 8)
    brandHighlight.value = brandResults.value.length ? 0 : -1
  }, 200)
}

function onBrandKeydown(e: KeyboardEvent) {
  if (!brandResults.value.length) return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    brandHighlight.value = (brandHighlight.value + 1) % brandResults.value.length
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    brandHighlight.value = (brandHighlight.value - 1 + brandResults.value.length) % brandResults.value.length
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (brandHighlight.value >= 0) pickBrand(brandResults.value[brandHighlight.value])
  } else if (e.key === 'Escape') {
    brandResults.value = []
  }
}

function pickBrand(b: string) {
  selectedBrand.value = b
  brandQuery.value = b
  brandResults.value = []
  if (catalogQuery.value.trim() || selectedProduct.value) onCatalogQueryChange()
}

function clearBrand() {
  selectedBrand.value = null
  brandQuery.value = ''
  if (catalogQuery.value.trim()) onCatalogQueryChange()
}

function openAddArticle() {
  showAddArticle.value = true
}

function closeAddArticle() {
  showAddArticle.value = false
  freeMode.value = false
  catalogQuery.value = ''
  catalogResults.value = []
  selectedProduct.value = null
  brandQuery.value = ''
  brandResults.value = []
  selectedBrand.value = null
  catalogHighlight.value = -1
  brandHighlight.value = -1
  addArticleError.value = ''
  form.value = { free_brand: '', free_description: '', free_manual_url: '', serial_number: '', suggest_for_catalog: false }
}

async function saveArticle() {
  addArticleError.value = ''

  if (!selectedProduct.value && !form.value.free_description.trim()) {
    addArticleError.value = 'Kies een product uit de catalogus of vul een omschrijving in.'
    return
  }
  if (form.value.suggest_for_catalog && (!form.value.free_brand.trim() || !form.value.free_description.trim() || !form.value.free_manual_url.trim())) {
    addArticleError.value = 'Voor de catalogus-wachtrij zijn merk, omschrijving en handleiding-link verplicht.'
    return
  }

  savingArticle.value = true
  const { error: err } = await supabase.from('articles').insert({
    customer_id: route.params.id as string,
    product_id: selectedProduct.value?.id ?? null,
    free_brand: selectedProduct.value ? null : (form.value.free_brand.trim() || null),
    free_description: selectedProduct.value ? null : (form.value.free_description.trim() || null),
    free_manual_url: selectedProduct.value ? null : (form.value.free_manual_url.trim() || null),
    serial_number: form.value.serial_number.trim() || null,
    suggest_for_catalog: selectedProduct.value ? false : form.value.suggest_for_catalog,
    retired: false,
  })
  savingArticle.value = false
  if (err) { addArticleError.value = err.message; return }
  closeAddArticle()
  await loadArticles()
}

function startOrResume() {
  // Keuring-wizard volgt in een volgende stap (BOUWPLAN fase 2).
  router.push(`/inspection/new?customer=${route.params.id}`)
}

onMounted(() => {
  load()
  loadArticles()
})
</script>

<style scoped>
.customer-detail { min-height: 100vh; background: #f0f4f8; }
.customer-detail__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem 1.25rem;
}
.customer-detail__header h1 { font-size: 1.2rem; margin: 0; flex: 1; }
.customer-detail__back { background: none; border: none; color: #fff; font-size: 1rem; cursor: pointer; padding: 0.25rem 0.5rem; }
.customer-detail__state { text-align: center; padding: 3rem 1rem; color: #666; }
.customer-detail__state--error { color: #dc2626; }
.customer-detail__contact { padding: 1rem 1.25rem 0; color: #444; font-size: 0.95rem; }
.customer-detail__contact p { margin: 0.25rem 0; }
.customer-detail__primary {
  display: block; width: calc(100% - 2.5rem); margin: 1rem 1.25rem;
  background: #16a34a; color: #fff; border: none; border-radius: 12px;
  padding: 1rem; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.customer-detail__primary:active { transform: scale(0.99); }
.customer-detail__tabs { display: flex; border-bottom: 1px solid #ddd; padding: 0 1.25rem; gap: 1.5rem; }
.customer-detail__tab {
  background: none; border: none; padding: 0.75rem 0; font-size: 0.95rem; color: #666; cursor: pointer;
  border-bottom: 2px solid transparent;
}
.customer-detail__tab--active { color: #1a3a2a; font-weight: 600; border-bottom-color: #16a34a; }
.customer-detail__panel { padding: 1.25rem; }
.customer-detail__empty { color: #888; text-align: center; padding: 2rem 0; }
.customer-detail__data { margin: 0; }
.customer-detail__data dt { font-size: 0.8rem; color: #888; margin-top: 0.75rem; }
.customer-detail__data dd { margin: 0.1rem 0 0; font-size: 1rem; color: #222; }

.article-list { list-style: none; margin: 0; padding: 0; }
.article-list__item { background: #fff; border-bottom: 1px solid #eee; padding: 0.85rem 1rem; border-radius: 8px; margin-bottom: 0.4rem; }
.article-list__name { font-weight: 600; }
.article-list__meta { font-size: 0.85rem; color: #666; display: flex; gap: 0.75rem; margin-top: 0.2rem; }
.article-list__badge { background: #fef3c7; color: #92400e; padding: 0.05rem 0.4rem; border-radius: 6px; font-size: 0.75rem; }

.article-add-toggle {
  display: block; width: 100%; margin-top: 0.75rem; padding: 0.85rem;
  background: none; border: 2px dashed #bbb; border-radius: 10px; color: #555; font-weight: 600; cursor: pointer;
}
.article-form { margin-top: 0.75rem; background: #fff; border-radius: 10px; padding: 1rem; }
.article-form h3 { margin: 0 0 0.75rem; font-size: 1rem; }
.article-form__input {
  display: block; width: 100%; box-sizing: border-box; padding: 0.7rem 0.9rem; margin-bottom: 0.6rem;
  border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem;
}
.catalog-results { list-style: none; margin: -0.4rem 0 0.6rem; padding: 0; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
.catalog-results li { padding: 0.6rem 0.9rem; cursor: pointer; border-bottom: 1px solid #f3f3f3; }
.catalog-results li:hover { background: #f9fafb; }
.catalog-results__item--active { background: #16a34a; color: #fff; }
.catalog-results__item--active strong { color: #fff; }
.article-form__selected { background: #ecfdf5; color: #065f46; padding: 0.5rem 0.75rem; border-radius: 8px; margin: -0.3rem 0 0.6rem; }
.article-form__clear { background: none; border: none; color: #065f46; font-size: 1.1rem; cursor: pointer; float: right; }
.article-form__free-toggle { color: #2563eb; background: none; border: none; cursor: pointer; padding: 0; margin: 0 0 0.6rem; font-size: 0.9rem; }
.article-form__brand { position: relative; margin-bottom: 0.2rem; }
.article-form__checkbox { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; margin-bottom: 0.6rem; }
.article-form__actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
.article-form__btn { flex: 1; padding: 0.75rem; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; }
.article-form__btn--cancel { background: #f3f4f6; color: #374151; }
.article-form__btn--save { background: #16a34a; color: #fff; }
.article-form__btn--save:disabled { opacity: 0.6; }
</style>
