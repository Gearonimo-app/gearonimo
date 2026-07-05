<!-- Aanmelden van een vrij artikel voor de catalogus-wachtrij. Vervangt het
     oude kale 📚-vinkje: de keurmeester die iets voorstelt vult nu zélf het
     productformulier in (merk/type/categorie/materiaal/norm/leeftijds-
     termijnen/MBS/handleiding-/recall-/veiligheidsbulletin-links) vóór het op
     de wachtrij komt, zodat de curator vooral controleert i.p.v. alles
     uitzoekt (besluit Jos 2026-07-05).

     De ingevulde velden gaan naar `articles.catalog_suggestion` (jsonb) naast
     `articles.suggest_for_catalog` -- bewust nog geen `products`-rij (die zou
     meteen zichtbaar zijn in de echte catalogus, zie de migratie). De curator
     maakt er in CatalogQueue.vue pas een echt product van.

     Zelfstandig: haalt de artikelvelden zelf op (één plek voor de
     prefill-logica, i.p.v. door beide aanroepende schermen te threaden) en
     schrijft zelf weg. Bewust online-only -- catalogus aanvullen is een
     online-handeling; offline valt het netjes terug op een melding. -->
<template>
  <div class="csd" @click.self="$emit('close')">
    <div class="csd__panel">
      <div class="csd__head">
        <h3 class="csd__title">{{ $t('catalogSuggest.title') }}</h3>
        <button class="csd__x" :title="$t('common.cancel')" @click="$emit('close')">✕</button>
      </div>
      <p class="csd__label">{{ label }}</p>
      <p class="csd__intro">{{ $t('catalogSuggest.intro') }}</p>

      <div v-if="loading" class="csd__state">{{ $t('common.loading') }}</div>
      <div v-else-if="offline" class="csd__state csd__state--error">{{ $t('catalogSuggest.offline') }}</div>
      <div v-else-if="loadError" class="csd__state csd__state--error">{{ loadError }}</div>

      <template v-else>
        <ProductForm
          :model-value="prefill"
          :submit-label="alreadySuggested ? $t('catalogSuggest.saveChanges') : $t('catalogSuggest.submit')"
          :saving="saving"
          :error="saveError"
          @submit="save"
          @cancel="$emit('close')"
        />
        <button v-if="alreadySuggested" class="csd__withdraw" :disabled="saving" @click="withdraw">
          {{ $t('catalogSuggest.withdraw') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase, errorMessage, useOnline } from '@gearonimo/core'
import { emptyProductForm, type ProductFormModel } from '../composables/productForm'
import ProductForm from './ProductForm.vue'

const props = defineProps<{ articleId: string; label: string }>()
const emit = defineEmits<{ (e: 'saved', suggested: boolean): void; (e: 'close'): void }>()

const { isOnline } = useOnline()

const loading = ref(true)
const loadError = ref('')
const offline = ref(false)
const saving = ref(false)
const saveError = ref('')
const alreadySuggested = ref(false)
const prefill = ref<ProductFormModel>(emptyProductForm())

interface ArticleRow {
  free_brand: string | null
  free_description: string | null
  free_category: string | null
  free_material: string | null
  free_norm: string | null
  free_mbs: string | null
  suggest_for_catalog: boolean
  catalog_suggestion: ProductFormModel | null
}

onMounted(async () => {
  if (!isOnline.value) {
    offline.value = true
    loading.value = false
    return
  }
  try {
    const { data, error } = await supabase
      .from('articles')
      .select('free_brand, free_description, free_category, free_material, free_norm, free_mbs, suggest_for_catalog, catalog_suggestion')
      .eq('id', props.articleId)
      .single()
    if (error) throw error
    const row = data as unknown as ArticleRow
    alreadySuggested.value = row.suggest_for_catalog && !!row.catalog_suggestion
    // Al eerder ingevuld voorstel wint; anders vullen we alvast wat de
    // keurmeester in de vrije velden heeft getypt (merk/omschrijving/
    // categorie/materiaal/norm/MBS) zodat hij alleen aanvult.
    prefill.value = row.catalog_suggestion
      ? { ...emptyProductForm(), ...row.catalog_suggestion }
      : {
          ...emptyProductForm(),
          brand: row.free_brand ?? '',
          name: row.free_description ?? '',
          category: row.free_category ?? '',
          material: row.free_material ?? '',
          standard: row.free_norm ?? '',
          breaking_strength: row.free_mbs ?? '',
        }
  } catch (e) {
    loadError.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})

async function save(form: ProductFormModel) {
  saving.value = true
  saveError.value = ''
  try {
    const { error } = await supabase
      .from('articles')
      .update({ suggest_for_catalog: true, catalog_suggestion: form })
      .eq('id', props.articleId)
    if (error) throw error
    emit('saved', true)
    emit('close')
  } catch (e) {
    saveError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

async function withdraw() {
  saving.value = true
  saveError.value = ''
  try {
    const { error } = await supabase
      .from('articles')
      .update({ suggest_for_catalog: false, catalog_suggestion: null })
      .eq('id', props.articleId)
    if (error) throw error
    emit('saved', false)
    emit('close')
  } catch (e) {
    saveError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.csd {
  position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: flex-start; justify-content: center;
  padding: 1.25rem; overflow-y: auto;
}
.csd__panel {
  background: #f8fafc; border-radius: 16px; padding: 1.1rem;
  width: 100%; max-width: 560px; margin: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
}
.csd__head { display: flex; align-items: center; justify-content: space-between; }
.csd__title { margin: 0; font-size: 1.05rem; }
.csd__x { background: none; border: none; font-size: 1.1rem; color: #6b7280; cursor: pointer; }
.csd__label { margin: 0.35rem 0 0; font-weight: 600; color: #111827; }
.csd__intro { margin: 0.15rem 0 0.75rem; font-size: 0.85rem; color: #6b7280; }
.csd__state { color: #666; font-size: 0.9rem; padding: 0.75rem 0; }
.csd__state--error { color: #dc2626; }
.csd__withdraw {
  display: block; width: 100%; margin-top: 0.6rem; padding: 0.6rem;
  background: none; border: none; color: #b91c1c; font-size: 0.9rem;
  font-weight: 600; cursor: pointer;
}
.csd__withdraw:disabled { opacity: 0.6; }
</style>
