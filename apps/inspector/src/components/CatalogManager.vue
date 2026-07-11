<template>
  <section class="cm">
    <div class="cm__toolbar">
      <input v-model="search" class="cm__search" :placeholder="$t('settings.catalog.manager.search')" />
      <button v-if="!showForm" class="cm__btn cm__btn--ghost" @click="openAdd">
        + {{ $t('settings.catalog.manager.add') }}
      </button>
    </div>

    <div class="cm__io">
      <button class="cm__btn cm__btn--ghost" :disabled="exporting" @click="exportExcel">
        {{ $t('settings.catalog.manager.export') }}
      </button>
      <label class="cm__btn cm__btn--ghost cm__upload">
        {{ $t('settings.catalog.manager.import') }}
        <input type="file" accept=".xlsx,.xls,.csv" class="cm__file" @change="onFilePicked" />
      </label>
    </div>
    <p v-if="importError" class="cm__state cm__state--error">{{ importError }}</p>

    <!-- Dryrun-preview voordat er iets geschreven wordt. -->
    <div v-if="importPreview" class="cm__preview">
      <p>
        {{ $t('settings.catalog.manager.previewSummary', {
          create: importPreview.toCreate.length,
          update: importPreview.toUpdate.length,
          skip: importPreview.errors.length,
        }) }}
      </p>
      <ul v-if="importPreview.errors.length" class="cm__preview-errors">
        <li v-for="(e, i) in importPreview.errors" :key="i">{{ e }}</li>
      </ul>
      <div class="cm__actions">
        <button class="cm__btn cm__btn--cancel" @click="importPreview = null">{{ $t('common.cancel') }}</button>
        <button class="cm__btn cm__btn--save" :disabled="importing" @click="commitImport">
          {{ importing ? $t('common.saving') : $t('settings.catalog.manager.importConfirm') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="cm__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="cm__state cm__state--error">{{ error }}</div>

    <div v-if="showForm" class="cm__form">
      <h3>{{ editingId ? $t('settings.catalog.manager.edit') : $t('settings.catalog.manager.add') }}</h3>
      <ProductForm
        :model-value="form"
        :submit-label="$t('common.save')"
        :saving="saving"
        :error="formError"
        @submit="save"
        @cancel="closeForm"
      />
    </div>

    <ul v-else-if="!loading && !error" class="cm__list">
      <li v-if="filtered.length === 0" class="cm__state">{{ $t('settings.catalog.manager.empty') }}</li>
      <li v-for="p in filtered" :key="p.id" class="cm__item" @click="openEdit(p)">
        <div class="cm__name">{{ p.brand }} {{ p.name }}</div>
        <div class="cm__meta">{{ [p.category, p.product_type].filter(Boolean).join(' · ') }}</div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import * as XLSX from 'xlsx'
import { supabase, errorMessage } from '@gearonimo/core'
import { emptyProductForm, type ProductFormModel } from '../composables/productForm'
import ProductForm from './ProductForm.vue'

interface Product extends ProductFormModel {
  id: string
}

const { t } = useI18n()

const products = ref<Product[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')

const showForm = ref(false)
const editingId = ref<string | null>(null)
const form = ref<ProductFormModel>(emptyProductForm())
const saving = ref(false)
const formError = ref('')

const COLUMNS = [
  'id', 'brand', 'name', 'product_type', 'category', 'material', 'standard',
  'max_age_years', 'max_age_use_years', 'max_age_mfr_years', 'breaking_strength',
  'rope_diameter_min_mm', 'rope_diameter_max_mm',
  'interval_override_months', 'manual_url', 'product_page_url', 'recall_url', 'inspection_notice_url', 'notes',
] as const

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase
      .from('products')
      .select(COLUMNS.join(', '))
      .order('brand')
      .order('name')
    if (err) throw err
    products.value = (data ?? []) as unknown as Product[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return products.value
  return products.value.filter((p) =>
    [p.brand, p.name, p.category].filter(Boolean).some((v) => v!.toLowerCase().includes(q))
  )
})

function openAdd() {
  editingId.value = null
  form.value = emptyProductForm()
  formError.value = ''
  showForm.value = true
}

function openEdit(p: Product) {
  editingId.value = p.id
  form.value = { ...p }
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

function toRow(f: ProductFormModel) {
  return {
    brand: f.brand.trim(),
    name: f.name.trim(),
    product_type: f.product_type || null,
    category: f.category.trim() || null,
    material: f.material.trim() || null,
    standard: f.standard.trim() || null,
    max_age_years: f.max_age_years,
    max_age_use_years: f.max_age_use_years,
    max_age_mfr_years: f.max_age_mfr_years,
    breaking_strength: f.breaking_strength.trim() || null,
    rope_diameter_min_mm: f.rope_diameter_min_mm,
    rope_diameter_max_mm: f.rope_diameter_max_mm,
    interval_override_months: f.interval_override_months,
    manual_url: f.manual_url.trim() || null,
    product_page_url: f.product_page_url.trim() || null,
    recall_url: f.recall_url.trim() || null,
    inspection_notice_url: f.inspection_notice_url.trim() || null,
    notes: f.notes.trim() || null,
  }
}

async function save(f: ProductFormModel) {
  saving.value = true
  formError.value = ''
  try {
    const row = toRow(f)
    const { error: err } = editingId.value
      ? await supabase.from('products').update(row).eq('id', editingId.value)
      : await supabase.from('products').insert(row)
    if (err) throw err
    closeForm()
    await load()
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

let exporting_ = false
const exporting = computed(() => exporting_)
function exportExcel() {
  exporting_ = true
  try {
    const rows = products.value.map((p) => Object.fromEntries(COLUMNS.map((c) => [c, p[c as keyof Product] ?? ''])))
    const sheet = XLSX.utils.json_to_sheet(rows, { header: [...COLUMNS] })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, sheet, 'Catalogus')
    XLSX.writeFile(wb, `gearonimo-catalogus-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } finally {
    exporting_ = false
  }
}

// ─── Import: alleen inlezen + dryrun-preview; commitImport() schrijft echt. ──

interface ImportPreview {
  toCreate: ReturnType<typeof toRow>[]
  toUpdate: { id: string; row: ReturnType<typeof toRow> }[]
  errors: string[]
}

const importPreview = ref<ImportPreview | null>(null)
const importing = ref(false)
const importError = ref('')

function onFilePicked(e: Event) {
  importError.value = ''
  importPreview.value = null
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const reader = new FileReader()
  reader.onload = () => {
    try {
      const wb = XLSX.read(reader.result, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null })
      importPreview.value = buildPreview(rows)
    } catch (err) {
      importError.value = errorMessage(err)
    }
  }
  reader.onerror = () => { importError.value = t('settings.catalog.manager.readError') }
  reader.readAsArrayBuffer(file)
}

function buildPreview(rows: Record<string, unknown>[]): ImportPreview {
  const byId = new Map(products.value.map((p) => [p.id, p]))
  const toCreate: ReturnType<typeof toRow>[] = []
  const toUpdate: { id: string; row: ReturnType<typeof toRow> }[] = []
  const errors: string[] = []

  rows.forEach((raw, i) => {
    const line = i + 2 // rij 1 = koprij
    const id = raw.id ? String(raw.id).trim() : ''
    const f: ProductFormModel = {
      ...emptyProductForm(),
      brand: String(raw.brand ?? '').trim(),
      name: String(raw.name ?? '').trim(),
      product_type: String(raw.product_type ?? '').trim(),
      category: String(raw.category ?? '').trim(),
      material: String(raw.material ?? '').trim(),
      standard: String(raw.standard ?? '').trim(),
      max_age_years: numOrNull(raw.max_age_years),
      max_age_use_years: numOrNull(raw.max_age_use_years),
      max_age_mfr_years: numOrNull(raw.max_age_mfr_years),
      breaking_strength: String(raw.breaking_strength ?? '').trim(),
      rope_diameter_min_mm: numOrNull(raw.rope_diameter_min_mm),
      rope_diameter_max_mm: numOrNull(raw.rope_diameter_max_mm),
      interval_override_months: numOrNull(raw.interval_override_months),
      manual_url: String(raw.manual_url ?? '').trim(),
      product_page_url: String(raw.product_page_url ?? '').trim(),
      recall_url: String(raw.recall_url ?? '').trim(),
      inspection_notice_url: String(raw.inspection_notice_url ?? '').trim(),
      notes: String(raw.notes ?? '').trim(),
    }
    if (!f.brand || !f.name) {
      errors.push(t('settings.catalog.manager.errorMissing', { line }))
      return
    }
    if (id) {
      if (!byId.has(id)) {
        errors.push(t('settings.catalog.manager.errorUnknownId', { line, id }))
        return
      }
      toUpdate.push({ id, row: toRow(f) })
    } else {
      toCreate.push(toRow(f))
    }
  })

  return { toCreate, toUpdate, errors }
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function commitImport() {
  if (!importPreview.value) return
  importing.value = true
  importError.value = ''
  try {
    const { toCreate, toUpdate } = importPreview.value
    if (toCreate.length) {
      const { error: err } = await supabase.from('products').insert(toCreate)
      if (err) throw err
    }
    for (const { id, row } of toUpdate) {
      const { error: err } = await supabase.from('products').update(row).eq('id', id)
      if (err) throw err
    }
    importPreview.value = null
    await load()
  } catch (e) {
    importError.value = errorMessage(e)
  } finally {
    importing.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.cm__toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
.cm__search {
  flex: 1; padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem;
}
.cm__io { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
.cm__upload { position: relative; overflow: hidden; }
.cm__file {
  position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%;
}
.cm__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.cm__state--error { color: #dc2626; }
.cm__preview {
  background: #fff; border-radius: 12px; padding: 1rem; margin-bottom: 0.75rem; font-size: 0.9rem;
}
.cm__preview p { margin: 0 0 0.5rem; }
.cm__preview-errors { margin: 0 0 0.5rem; padding-left: 1.1rem; color: #dc2626; font-size: 0.85rem; }
.cm__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.cm__item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.cm__item:last-child { border-bottom: none; }
.cm__name { font-weight: 600; }
.cm__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
.cm__form h3 { margin: 0 0 0.5rem; font-size: 1rem; }
.cm__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.cm__btn { border: none; border-radius: 8px; padding: 0.6rem 1rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
.cm__btn--ghost { background: #f3f4f6; color: #374151; }
.cm__btn--cancel { background: #f3f4f6; color: #374151; flex: 1; }
.cm__btn--save { background: #16a34a; color: #fff; flex: 1; }
.cm__btn:disabled { opacity: 0.6; }
</style>
