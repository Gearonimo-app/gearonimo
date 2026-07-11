<template>
  <section class="cq">
    <p class="cq__intro">{{ $t('settings.catalog.queue.intro') }}</p>

    <div v-if="loading" class="cq__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="cq__state cq__state--error">{{ error }}</div>
    <p v-else-if="items.length === 0 && !addingFor" class="cq__state">{{ $t('settings.catalog.queue.empty') }}</p>

    <ul v-else-if="!addingFor" class="cq__list">
      <li v-for="a in items" :key="a.id" class="cq__item">
        <div class="cq__body">
          <div class="cq__name">{{ [a.free_brand, a.free_description].filter(Boolean).join(' ') || '—' }}</div>
          <div class="cq__meta">
            {{ [a.free_category, a.customer?.name, a.serial_number ? `SN ${a.serial_number}` : null].filter(Boolean).join(' · ') }}
          </div>
        </div>
        <div class="cq__actions">
          <button class="cq__btn cq__btn--reject" :disabled="rejectingId === a.id" @click="reject(a)">
            {{ $t('settings.catalog.queue.reject') }}
          </button>
          <button class="cq__btn cq__btn--add" @click="openAdd(a)">
            {{ $t('settings.catalog.queue.add') }}
          </button>
        </div>
      </li>
    </ul>

    <div v-if="addingFor" class="cq__form">
      <h3>{{ $t('settings.catalog.queue.addTitle') }}</h3>
      <ProductForm
        :model-value="prefill"
        :submit-label="$t('settings.catalog.queue.addSubmit')"
        :saving="saving"
        :error="formError"
        @submit="createProduct"
        @cancel="addingFor = null"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase, errorMessage } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'
import { emptyProductForm, type ProductFormModel } from '../composables/productForm'
import ProductForm from './ProductForm.vue'

interface QueueArticle {
  id: string
  free_brand: string | null
  free_description: string | null
  free_category: string | null
  free_material: string | null
  free_norm: string | null
  free_mbs: string | null
  catalog_suggestion: ProductFormModel | null
  serial_number: string | null
  customer: { name: string } | null
}

const items = ref<QueueArticle[]>([])
const loading = ref(true)
const error = ref('')

const addingFor = ref<QueueArticle | null>(null)
const prefill = ref<ProductFormModel>(emptyProductForm())
const saving = ref(false)
const formError = ref('')
const rejectingId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    await ensureInspector()
    const { data, error: err } = await supabase
      .from('articles')
      .select(
        'id, free_brand, free_description, free_category, free_material, free_norm, free_mbs, catalog_suggestion, serial_number, customer:customers(name)'
      )
      .eq('suggest_for_catalog', true)
      .is('product_id', null)
      .order('created_at', { ascending: false })
    if (err) throw err
    items.value = (data ?? []) as unknown as QueueArticle[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function openAdd(a: QueueArticle) {
  addingFor.value = a
  formError.value = ''
  // De keurmeester vult sinds 2026-07-05 zelf het productformulier in bij het
  // aanmelden; dat voorstel staat in `catalog_suggestion`. De curator
  // controleert/corrigeert dat i.p.v. alles zelf uit te zoeken. Valt terug op
  // de schamele vrije velden voor artikelen die vóór die wijziging (of door de
  // klant-app) op de wachtrij kwamen zonder ingevuld voorstel.
  prefill.value = a.catalog_suggestion
    ? { ...emptyProductForm(), ...a.catalog_suggestion }
    : {
        ...emptyProductForm(),
        brand: a.free_brand ?? '',
        name: a.free_description ?? '',
        category: a.free_category ?? '',
        material: a.free_material ?? '',
        standard: a.free_norm ?? '',
        breaking_strength: a.free_mbs ?? '',
      }
}

async function createProduct(form: ProductFormModel) {
  if (!addingFor.value) return
  saving.value = true
  formError.value = ''
  try {
    const { data, error: err } = await supabase
      .from('products')
      .insert({
        brand: form.brand.trim(),
        name: form.name.trim(),
        product_type: form.product_type || null,
        category: form.category.trim() || null,
        material: form.material.trim() || null,
        standard: form.standard.trim() || null,
        max_age_years: form.max_age_years,
        max_age_use_years: form.max_age_use_years,
        max_age_mfr_years: form.max_age_mfr_years,
        breaking_strength: form.breaking_strength.trim() || null,
        rope_diameter_min_mm: form.rope_diameter_min_mm,
        rope_diameter_max_mm: form.rope_diameter_max_mm,
        interval_override_months: form.interval_override_months,
        manual_url: form.manual_url.trim() || null,
        product_page_url: form.product_page_url.trim() || null,
        recall_url: form.recall_url.trim() || null,
        inspection_notice_url: form.inspection_notice_url.trim() || null,
        notes: form.notes.trim() || null,
      })
      .select('id')
      .single()
    if (err) throw err

    // Koppel het aanmeldende artikel meteen aan het nieuwe product. Vrije
    // velden blijven staan (onschadelijk: overal in de app wint het
    // gekoppelde product al via coalesce(product, vrij-veld)).
    const { error: linkErr } = await supabase
      .from('articles')
      .update({ product_id: data.id, suggest_for_catalog: false, catalog_suggestion: null })
      .eq('id', addingFor.value.id)
    if (linkErr) throw linkErr

    addingFor.value = null
    await load()
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

async function reject(a: QueueArticle) {
  rejectingId.value = a.id
  try {
    const { error: err } = await supabase
      .from('articles')
      .update({ suggest_for_catalog: false, catalog_suggestion: null })
      .eq('id', a.id)
    if (err) throw err
    items.value = items.value.filter((x) => x.id !== a.id)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    rejectingId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.cq__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 0.75rem; }
.cq__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.cq__state--error { color: #dc2626; }
.cq__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.cq__item {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.cq__item:last-child { border-bottom: none; }
.cq__body { min-width: 0; }
.cq__name { font-weight: 600; }
.cq__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
.cq__actions { display: flex; gap: 0.5rem; flex: 0 0 auto; }
.cq__btn { border: none; border-radius: 8px; padding: 0.4rem 0.7rem; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.cq__btn--reject { background: #f3f4f6; color: #6b7280; }
.cq__btn--add { background: #16a34a; color: #fff; }
.cq__btn:disabled { opacity: 0.6; }
.cq__form { margin-top: 0.5rem; }
.cq__form h3 { margin: 0 0 0.5rem; font-size: 1rem; }
</style>
