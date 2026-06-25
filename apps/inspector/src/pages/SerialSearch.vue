<template>
  <div class="ss">
    <header class="ss__header">
      <button class="ss__icon" @click="$router.push('/')">←</button>
      <h1>{{ $t('serialSearch.title') }}</h1>
      <span class="ss__icon"></span>
    </header>

    <div class="ss__search">
      <input
        ref="inputEl"
        v-model="query"
        type="search"
        :placeholder="$t('serialSearch.placeholder')"
        class="ss__input"
        @input="onInput"
      />
      <p class="ss__hint">{{ $t('serialSearch.hint') }}</p>
    </div>

    <div v-if="error" class="ss__state ss__state--error">{{ error }}</div>
    <div v-else-if="loading" class="ss__state">{{ $t('common.loading') }}</div>
    <div v-else-if="!hasQuery" class="ss__state">{{ $t('serialSearch.prompt') }}</div>
    <div v-else-if="results.length === 0" class="ss__state">{{ $t('serialSearch.noMatches') }}</div>

    <ul v-else class="ss__list">
      <li
        v-for="r in results"
        :key="r.id"
        class="ss__item"
        @click="$router.push(`/articles/${r.id}`)"
      >
        <div class="ss__main">
          <div class="ss__desc">{{ label(r) }}</div>
          <div class="ss__meta">
            <span v-if="r.serial_number" class="ss__sn">SN {{ r.serial_number }}</span>
            <span v-if="!r.product_id" class="ss__badge ss__badge--free">{{ $t('articles.freeBadge') }}</span>
          </div>
          <div class="ss__customer">{{ r.customer?.name || '—' }}</div>
        </div>

        <div v-if="hasFlags(r)" class="ss__flags" @click.stop>
          <a v-if="recallUrl(r)" class="ss__flag ss__flag--recall" :href="recallUrl(r)!" target="_blank" rel="noopener">
            🚩 {{ $t('serialSearch.recall') }}
          </a>
          <span v-else-if="hasRecall(r)" class="ss__flag ss__flag--recall ss__flag--static">
            🚩 {{ $t('serialSearch.recall') }}
          </span>
          <a v-if="r.product?.inspection_notice_url" class="ss__flag ss__flag--notice" :href="r.product.inspection_notice_url" target="_blank" rel="noopener">
            ⚠ {{ $t('serialSearch.notice') }}
          </a>
          <a v-if="manualUrl(r)" class="ss__flag ss__flag--manual" :href="manualUrl(r)!" target="_blank" rel="noopener">
            📄 {{ $t('serialSearch.manual') }}
          </a>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'

interface Product {
  brand: string | null
  name: string | null
  category: string | null
  recall_url: string | null
  inspection_notice_url: string | null
  manual_url: string | null
}
interface Row {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_description: string | null
  free_category: string | null
  free_recall_flag: boolean | null
  free_recall_url: string | null
  free_manual_url: string | null
  product_id: string | null
  customer: { name: string } | null
  product: Product | null
}

const route = useRoute()
const { t } = useI18n()

const query = ref('')
const results = ref<Row[]>([])
const loading = ref(false)
const error = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
let debounce: ReturnType<typeof setTimeout> | undefined

const SELECT =
  'id, serial_number, free_brand, free_description, free_category, free_recall_flag, free_recall_url, free_manual_url, product_id, ' +
  'customer:customers(name), ' +
  'product:products(brand, name, category, recall_url, inspection_notice_url, manual_url)'

const hasQuery = computed(() => query.value.trim().length >= 2)

function label(r: Row) {
  const s = r.product
    ? [r.product.brand, r.product.name].filter(Boolean).join(' ')
    : [r.free_brand, r.free_description].filter(Boolean).join(' ')
  return s || r.product?.category || r.free_category || t('articles.untitled')
}

function hasRecall(r: Row) {
  return !!r.product?.recall_url || !!r.free_recall_flag
}
function recallUrl(r: Row): string | null {
  return r.product?.recall_url || r.free_recall_url || null
}
function manualUrl(r: Row): string | null {
  return r.product?.manual_url || r.free_manual_url || null
}
function hasFlags(r: Row) {
  return hasRecall(r) || !!r.product?.inspection_notice_url || !!manualUrl(r)
}

function onInput() {
  clearTimeout(debounce)
  debounce = setTimeout(runSearch, 250)
}

async function runSearch() {
  const q = query.value.trim()
  if (q.length < 2) {
    results.value = []
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const byId = new Map<string, Row>()

    // 1. Primaire route: serienummer (suffix/bevat-match — Jos zoekt op de
    //    laatste cijfers, zie UX-FLOW §4.2). Serie-treffers staan bovenaan.
    const serial = await supabase
      .from('articles')
      .select(SELECT)
      .ilike('serial_number', `%${q}%`)
      .eq('retired', false)
      .limit(50)
    if (serial.error) throw serial.error
    for (const r of (serial.data ?? []) as unknown as Row[]) byId.set(r.id, r)

    // 2. Vrije artikelen op omschrijving/merk/categorie.
    const free = await supabase
      .from('articles')
      .select(SELECT)
      .or(`free_brand.ilike.%${q}%,free_description.ilike.%${q}%,free_category.ilike.%${q}%`)
      .eq('retired', false)
      .limit(50)
    if (free.error) throw free.error
    for (const r of (free.data ?? []) as unknown as Row[]) if (!byId.has(r.id)) byId.set(r.id, r)

    // 3. Catalogus-artikelen via de fuzzy productzoeker → product-id's.
    const prod = await supabase.rpc('search_products', { q, brand_filter: null })
    if (!prod.error) {
      const ids = (prod.data ?? []).map((p: { id: string }) => p.id)
      if (ids.length) {
        const cat = await supabase
          .from('articles')
          .select(SELECT)
          .in('product_id', ids)
          .eq('retired', false)
          .limit(50)
        if (cat.error) throw cat.error
        for (const r of (cat.data ?? []) as unknown as Row[]) if (!byId.has(r.id)) byId.set(r.id, r)
      }
    }

    results.value = Array.from(byId.values())
  } catch (e: any) {
    error.value = e.message
    results.value = []
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const q = route.query.q
  if (typeof q === 'string' && q.trim()) {
    query.value = q.trim()
    runSearch()
  }
  await nextTick()
  inputEl.value?.focus()
})
</script>

<style scoped>
.ss { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.ss__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
}
.ss__header h1 { font-size: 1.2rem; margin: 0; }
.ss__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }

.ss__search { padding: 1rem 1.25rem 0.5rem; background: #1a3a2a; }
.ss__input {
  width: 100%; padding: 0.75rem 1rem; border-radius: 10px; border: none;
  font-size: 1rem; background: rgba(255,255,255,0.15); color: #fff; box-sizing: border-box;
}
.ss__input::placeholder { color: rgba(255,255,255,0.6); }
.ss__input:focus { outline: none; background: rgba(255,255,255,0.25); }
.ss__hint { color: rgba(255,255,255,0.6); font-size: 0.8rem; margin: 0.4rem 0 0.6rem; }

.ss__state { text-align: center; padding: 2rem 1rem; color: #666; }
.ss__state--error { color: #dc2626; }

.ss__list { list-style: none; margin: 1rem 1.25rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ss__item { padding: 0.9rem 1.1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.ss__item:last-child { border-bottom: none; }
.ss__item:active { background: #f9fafb; }
.ss__desc { font-weight: 600; }
.ss__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; display: flex; gap: 0.5rem; align-items: center; }
.ss__customer { font-size: 0.85rem; color: #374151; margin-top: 0.15rem; }
.ss__badge { border-radius: 6px; padding: 0.05rem 0.4rem; font-size: 0.75rem; }
.ss__badge--free { background: #fef3c7; color: #92400e; }

.ss__flags { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
.ss__flag {
  font-size: 0.8rem; font-weight: 600; text-decoration: none;
  border-radius: 8px; padding: 0.3rem 0.6rem; display: inline-flex; align-items: center; gap: 0.3rem;
}
.ss__flag--recall { background: #fee2e2; color: #b91c1c; }
.ss__flag--static { cursor: default; }
.ss__flag--notice { background: #ffedd5; color: #9a3412; }
.ss__flag--manual { background: #e0e7ff; color: #3730a3; }
</style>
