<template>
  <div class="ss">
    <header class="ss__header">
      <button class="ss__icon" @click="$router.push('/')">←</button>
      <h1>{{ $t('serialSearch.title') }}</h1>
      <button class="ss__icon" :title="$t('common.home')" @click="$router.push('/')">🏠</button>
    </header>

    <!-- Modus-schakelaar: serienummer zoeken vs. recall zoeken -->
    <div class="ss__modes">
      <button class="ss__mode" :class="{ 'ss__mode--active': mode === 'serial' }" @click="mode = 'serial'">
        🔎 {{ $t('serialSearch.modeSerial') }}
      </button>
      <button class="ss__mode" :class="{ 'ss__mode--active': mode === 'recall' }" @click="mode = 'recall'">
        🔔 {{ $t('serialSearch.modeRecall') }}
      </button>
    </div>

    <!-- ===================== SERIENUMMER ZOEKEN ===================== -->
    <template v-if="mode === 'serial'">
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
    </template>

    <!-- ========================= RECALL ZOEKEN ========================= -->
    <template v-else>
      <div class="ss__recall-form">
        <p class="ss__recall-intro">{{ $t('serialSearch.recallIntro') }}</p>
        <div class="ss__field">
          <label>{{ $t('serialSearch.recallBrand') }}</label>
          <input v-model="rcBrand" type="search" :placeholder="$t('serialSearch.recallBrandPh')" class="ss__rc-input" />
        </div>
        <div class="ss__field">
          <label>{{ $t('serialSearch.recallProduct') }}</label>
          <input v-model="rcProduct" type="search" :placeholder="$t('serialSearch.recallProductPh')" class="ss__rc-input" />
        </div>
        <div class="ss__row">
          <div class="ss__field">
            <label>{{ $t('serialSearch.recallBeforeYear') }}</label>
            <input v-model.number="rcBeforeYear" type="number" min="1990" max="2099" placeholder="2023" class="ss__rc-input" />
          </div>
          <div class="ss__field">
            <label>{{ $t('serialSearch.recallBeforeMonth') }}</label>
            <select v-model.number="rcBeforeMonth" class="ss__rc-input">
              <option :value="0">—</option>
              <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
            </select>
          </div>
        </div>
        <div class="ss__row">
          <div class="ss__field">
            <label>{{ $t('serialSearch.recallFromYear') }}</label>
            <input v-model.number="rcFromYear" type="number" min="1990" max="2099" placeholder="2020" class="ss__rc-input" />
          </div>
          <div class="ss__field">
            <label>{{ $t('serialSearch.recallFromMonth') }}</label>
            <select v-model.number="rcFromMonth" class="ss__rc-input">
              <option :value="0">—</option>
              <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
            </select>
          </div>
        </div>
        <div class="ss__recall-actions">
          <button class="ss__rc-btn ss__rc-btn--go" :disabled="loading" @click="doRecall">
            🔔 {{ $t('serialSearch.recallSearch') }}
          </button>
          <button v-if="recallResults.length" class="ss__rc-btn" @click="exportRecallCsv">
            ↓ {{ $t('serialSearch.recallExport') }}
          </button>
        </div>
      </div>

      <div v-if="error" class="ss__state ss__state--error">{{ error }}</div>
      <div v-else-if="loading" class="ss__state">{{ $t('common.loading') }}</div>
      <div v-else-if="!recallRan" class="ss__state">{{ $t('serialSearch.recallPrompt') }}</div>
      <div v-else-if="recallResults.length === 0" class="ss__state">{{ $t('serialSearch.noMatches') }}</div>

      <template v-else>
        <p class="ss__recall-count">
          <strong>{{ recallResults.length }}</strong> {{ $t('serialSearch.recallResultUnit') }} ·
          <strong>{{ uniqueCustomers }}</strong> {{ $t('serialSearch.recallCustomerUnit') }}
        </p>
        <p v-if="unknownDateCount" class="ss__recall-warn">
          ⚠ {{ $t('serialSearch.recallUnknownNote', { n: unknownDateCount }) }}
        </p>
        <div class="ss__table-wrap">
          <table class="ss__table">
            <thead>
              <tr>
                <th>{{ $t('serialSearch.colProduct') }}</th>
                <th>{{ $t('serialSearch.colBrand') }}</th>
                <th>{{ $t('serialSearch.colSerial') }}</th>
                <th>{{ $t('serialSearch.colManufacture') }}</th>
                <th>{{ $t('serialSearch.colUser') }}</th>
                <th>{{ $t('serialSearch.colCustomer') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in recallResults" :key="r.id" class="ss__trow" @click="$router.push(`/articles/${r.id}`)">
                <td class="ss__td-name">{{ name(r) || '—' }}</td>
                <td>{{ brand(r) || '—' }}</td>
                <td class="ss__td-sn">{{ r.serial_number || '—' }}</td>
                <td class="ss__td-mfr" :class="{ 'ss__td-mfr--unknown': r._unknownDate }">
                  <template v-if="r._unknownDate">⚠ {{ $t('serialSearch.dateUnknown') }}</template>
                  <template v-else>{{ manufactureStr(r) }}</template>
                </td>
                <td>{{ r.assigned_user_name || '—' }}</td>
                <td class="ss__td-cust">{{ r.customer?.name || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { supabase, errorMessage } from '@gearonimo/core'

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
  manufacture_year: number | null
  manufacture_month: number | null
  assigned_user_name: string | null
  customer: { name: string } | null
  product: Product | null
  _unknownDate?: boolean
}

const route = useRoute()
const { t, locale } = useI18n()

const mode = ref<'serial' | 'recall'>('serial')

const SELECT =
  'id, serial_number, free_brand, free_description, free_category, free_recall_flag, free_recall_url, free_manual_url, ' +
  'product_id, manufacture_year, manufacture_month, assigned_user_name, ' +
  'customer:customers(name), ' +
  'product:products(brand, name, category, recall_url, inspection_notice_url, manual_url)'

const loading = ref(false)
const error = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

/* ---------- gedeelde helpers ---------- */
function brand(r: Row) {
  return (r.product ? r.product.brand : r.free_brand) || ''
}
function name(r: Row) {
  return (r.product ? r.product.name : r.free_description) || ''
}
function label(r: Row) {
  const s = [brand(r), name(r)].filter(Boolean).join(' ')
  return s || r.product?.category || r.free_category || t('articles.untitled')
}
function monthName(m: number) {
  return new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(2000, m - 1, 1))
}
function manufactureStr(r: Row) {
  if (!r.manufacture_year) return '—'
  return r.manufacture_month
    ? `${r.manufacture_year}/${String(r.manufacture_month).padStart(2, '0')}`
    : String(r.manufacture_year)
}

/* ---------- serienummer zoeken ---------- */
const query = ref('')
const results = ref<Row[]>([])
let debounce: ReturnType<typeof setTimeout> | undefined

const hasQuery = computed(() => query.value.trim().length >= 2)

function hasRecall(r: Row) { return !!r.product?.recall_url || !!r.free_recall_flag }
function recallUrl(r: Row): string | null { return r.product?.recall_url || r.free_recall_url || null }
function manualUrl(r: Row): string | null { return r.product?.manual_url || r.free_manual_url || null }
function hasFlags(r: Row) { return hasRecall(r) || !!r.product?.inspection_notice_url || !!manualUrl(r) }

function onInput() {
  clearTimeout(debounce)
  debounce = setTimeout(runSearch, 250)
}

async function runSearch() {
  const q = query.value.trim()
  if (q.length < 2) { results.value = []; loading.value = false; return }
  loading.value = true
  error.value = ''
  try {
    const byId = new Map<string, Row>()

    // 1. Primaire route: serienummer (suffix/bevat-match — Jos zoekt op de
    //    laatste cijfers, zie UX-FLOW §4.2). Serie-treffers staan bovenaan.
    const serial = await supabase
      .from('articles').select(SELECT)
      .ilike('serial_number', `%${q}%`).eq('retired', false).limit(50)
    if (serial.error) throw serial.error
    for (const r of (serial.data ?? []) as unknown as Row[]) byId.set(r.id, r)

    // 2. Vrije artikelen op omschrijving/merk/categorie.
    const free = await supabase
      .from('articles').select(SELECT)
      .or(`free_brand.ilike.%${q}%,free_description.ilike.%${q}%,free_category.ilike.%${q}%`)
      .eq('retired', false).limit(50)
    if (free.error) throw free.error
    for (const r of (free.data ?? []) as unknown as Row[]) if (!byId.has(r.id)) byId.set(r.id, r)

    // 3. Catalogus-artikelen via de fuzzy productzoeker → product-id's.
    const prod = await supabase.rpc('search_products', { q, brand_filter: null })
    if (!prod.error) {
      const ids = (prod.data ?? []).map((p: { id: string }) => p.id)
      if (ids.length) {
        const cat = await supabase
          .from('articles').select(SELECT)
          .in('product_id', ids).eq('retired', false).limit(50)
        if (cat.error) throw cat.error
        for (const r of (cat.data ?? []) as unknown as Row[]) if (!byId.has(r.id)) byId.set(r.id, r)
      }
    }

    results.value = Array.from(byId.values())
  } catch (e) {
    error.value = errorMessage(e)
    results.value = []
  } finally {
    loading.value = false
  }
}

/* ---------- recall zoeken ---------- */
const rcBrand = ref('')
const rcProduct = ref('')
const rcBeforeYear = ref<number | null>(null)
const rcBeforeMonth = ref(0)
const rcFromYear = ref<number | null>(null)
const rcFromMonth = ref(0)
const recallResults = ref<Row[]>([])
const recallRan = ref(false)

// Doorzoekt productnaam + categorie (zowel catalogus als vrij artikel), zodat
// "astro" óók Astro Int, Astro Bod Fast, Astro mt 2 enz. vindt (bevat-match).
function prodHaystack(r: Row) {
  return [name(r), r.product?.category, r.free_category].filter(Boolean).join(' ').toLowerCase()
}

const uniqueCustomers = computed(
  () => new Set(recallResults.value.map((r) => r.customer?.name || '?')).size
)
const unknownDateCount = computed(
  () => recallResults.value.filter((r) => r._unknownDate).length
)

async function doRecall() {
  const bMerk = rcBrand.value.trim().toLowerCase()
  const bProd = rcProduct.value.trim().toLowerCase()
  const voorJaar = rcBeforeYear.value || 0
  const voorMaand = rcBeforeMonth.value || 0
  const vanafJaar = rcFromYear.value || 0
  const vanafMaand = rcFromMonth.value || 0

  if (!bMerk && !bProd && !voorJaar && !vanafJaar) {
    error.value = t('serialSearch.recallNeedFilter')
    return
  }
  loading.value = true
  error.value = ''
  try {
    // We filteren bouwjaar/maand volledig client-side (niet server-side): zo
    // komen artikelen zónder bouwjaar óók binnen — die mogen we bij een recall
    // niet stil weglaten. Merk/naam kan bovendien uit de catalogus (products)
    // of uit een vrij artikel (free_*) komen, niet in één query te filteren.
    const { data, error: err } = await supabase
      .from('articles').select(SELECT).eq('retired', false).limit(1000)
    if (err) throw err

    const dateActive = !!(voorJaar || vanafJaar)
    const rows: Row[] = []
    for (const r of (data ?? []) as unknown as Row[]) {
      if (bMerk && !brand(r).toLowerCase().includes(bMerk)) continue
      if (bProd && !prodHaystack(r).includes(bProd)) continue
      const ij = r.manufacture_year || 0
      // Bouwjaar onbekend + datumfilter actief: niet weglaten, wél markeren
      // zodat de keurmeester het zelf kan beoordelen (UX-FLOW §1.6).
      if (dateActive && !ij) {
        rows.push({ ...r, _unknownDate: true })
        continue
      }
      // Bovengrens "fabricage vóór": ontbrekende maand telt als dec.
      if (voorJaar) {
        if (voorMaand) {
          if (ij * 100 + (r.manufacture_month || 12) >= voorJaar * 100 + voorMaand) continue
        } else if (ij > voorJaar) continue
      }
      // Ondergrens "fabricage vanaf": ontbrekende maand telt als jan.
      if (vanafJaar) {
        if (vanafMaand) {
          if (ij * 100 + (r.manufacture_month || 1) < vanafJaar * 100 + vanafMaand) continue
        } else if (ij < vanafJaar) continue
      }
      rows.push(r)
    }
    // Onbekend-bouwjaar bovenaan (vragen om aandacht), daarna oplopend bouwjaar.
    rows.sort((a, b) => {
      if (!!a._unknownDate !== !!b._unknownDate) return a._unknownDate ? -1 : 1
      return (a.manufacture_year || 9999) - (b.manufacture_year || 9999) || brand(a).localeCompare(brand(b))
    })
    recallResults.value = rows
    recallRan.value = true
  } catch (e) {
    error.value = errorMessage(e)
    recallResults.value = []
  } finally {
    loading.value = false
  }
}

function exportRecallCsv() {
  if (!recallResults.value.length) return
  const header = 'Product;Merk;Serienummer;Bouwjaar;Bouwmaand;Gebruiker;Klant'
  const lines = recallResults.value.map((r) =>
    [name(r), brand(r), r.serial_number, r.manufacture_year, r.manufacture_month, r.assigned_user_name, r.customer?.name]
      .map((v) => '"' + String(v ?? '').replace(/"/g, '""') + '"')
      .join(';')
  )
  const csv = '﻿' + header + '\n' + lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'recall_' + new Date().toISOString().slice(0, 10) + '.csv'
  a.click()
  URL.revokeObjectURL(url)
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

/* Modus-schakelaar */
.ss__modes { display: flex; background: #1a3a2a; padding: 0 1.25rem 0.75rem; gap: 0.5rem; }
.ss__mode {
  flex: 1; padding: 0.55rem; border-radius: 8px; border: none; cursor: pointer;
  font-size: 0.9rem; font-weight: 600; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.85);
}
.ss__mode--active { background: #16a34a; color: #fff; }

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

/* Recall-formulier */
.ss__recall-form { background: #fff; margin: 1rem 1.25rem; padding: 1rem; border-radius: 12px; }
.ss__recall-intro { margin: 0 0 0.75rem; font-size: 0.85rem; color: #6b7280; }
.ss__field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.6rem; flex: 1; }
.ss__field label { font-size: 0.8rem; color: #374151; font-weight: 600; }
.ss__row { display: flex; gap: 0.6rem; }
.ss__rc-input {
  padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
.ss__recall-actions { display: flex; gap: 0.6rem; margin-top: 0.5rem; flex-wrap: wrap; }
.ss__rc-btn {
  padding: 0.7rem 1.1rem; border-radius: 10px; border: 1px solid #d1d5db; background: #f3f4f6;
  color: #374151; font-size: 0.95rem; font-weight: 600; cursor: pointer;
}
.ss__rc-btn--go { background: #16a34a; color: #fff; border-color: #16a34a; }
.ss__rc-btn:disabled { opacity: 0.6; }

.ss__recall-count { margin: 0 1.25rem 0.5rem; font-size: 0.9rem; color: #374151; }
.ss__table-wrap { margin: 0 1.25rem 1.25rem; background: #fff; border-radius: 12px; overflow-x: auto; }
.ss__table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.ss__table th {
  text-align: left; padding: 0.6rem 0.7rem; background: #f9fafb; color: #6b7280;
  font-weight: 600; border-bottom: 1px solid #eee; white-space: nowrap;
}
.ss__table td { padding: 0.6rem 0.7rem; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
.ss__trow { cursor: pointer; }
.ss__trow:active { background: #f9fafb; }
.ss__td-name { font-weight: 600; }
.ss__td-sn { font-family: monospace; font-size: 0.8rem; }
.ss__td-mfr { font-weight: 600; color: #b45309; }
.ss__td-mfr--unknown { color: #b91c1c; }
.ss__td-cust { color: #16a34a; }
.ss__recall-warn {
  margin: 0 1.25rem 0.6rem; font-size: 0.85rem; color: #b91c1c;
  background: #fee2e2; border-radius: 8px; padding: 0.5rem 0.7rem;
}
</style>
