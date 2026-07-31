<!-- Gedeeld veldenset voor een catalogusproduct (products): gebruikt door
     CatalogQueue.vue (nieuw product vanuit de wachtrij) en
     CatalogManager.vue (handmatig toevoegen/bewerken). Eén plek voor de
     veldenlijst voorkomt dat de twee schermen uit elkaar gaan lopen. -->
<template>
  <form class="pf" @submit.prevent="submit">
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.brand') }} *</span>
        <input v-model="form.brand" :placeholder="$t('settings.catalog.placeholders.brand')" class="pf__input" required />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.name') }} *</span>
        <input v-model="form.name" :placeholder="$t('settings.catalog.placeholders.name')" class="pf__input" required />
      </label>
    </div>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.productType') }}</span>
        <!-- Keuzelijst, géén vrij tekstveld (Jos 2026-07-28): de kolom heeft in
             de database een check-constraint op vaste codes. Het oude veld bood
             de vertáálde labels als suggestie ("PBM"), en die sloeg de database
             af met "violates check constraint products_product_type_check".
             Nu is de waarde altijd de code, en zie je de vertaling. -->
        <select v-model="form.product_type" class="pf__input">
          <option value="">—</option>
          <option v-for="key in productTypeKeys" :key="key" :value="key">
            {{ $t(`settings.catalog.productTypes.${key}`) }}
          </option>
        </select>
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.category') }}</span>
        <input v-model="form.category" :placeholder="$t('settings.catalog.placeholders.category')" class="pf__input" />
      </label>
    </div>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.material') }}</span>
        <input v-model="form.material" :placeholder="$t('settings.catalog.placeholders.material')" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.standard') }}</span>
        <input v-model="form.standard" :placeholder="$t('settings.catalog.placeholders.standard')" class="pf__input" />
      </label>
    </div>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.manufacturerCode') }}</span>
      <input v-model="form.manufacturer_code" :placeholder="$t('settings.catalog.placeholders.manufacturerCode')" class="pf__input" />
    </label>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.maxAgeUseYears') }}</span>
        <input v-model.number="form.max_age_use_years" :placeholder="$t('settings.catalog.placeholders.maxAgeUseYears')" type="number" min="0" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.maxAgeMfrYears') }}</span>
        <input v-model.number="form.max_age_mfr_years" :placeholder="$t('settings.catalog.placeholders.maxAgeMfrYears')" type="number" min="0" class="pf__input" />
      </label>
    </div>
    <!-- 999 = onbeperkt (besluit Jos 2026-07-28): leeg betekent "nog opzoeken",
         999 betekent "bewust geen leeftijdsgrens". -->
    <p class="pf__hint">{{ $t('settings.catalog.fields.maxAgeHint') }}</p>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.breakingStrength') }}</span>
        <input v-model="form.breaking_strength" :placeholder="$t('settings.catalog.placeholders.breakingStrength')" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.workingLoadLimit') }}</span>
        <input v-model="form.working_load_limit" :placeholder="$t('settings.catalog.placeholders.workingLoadLimit')" class="pf__input" />
      </label>
    </div>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.maxUserWeightKg') }}</span>
        <!-- Vrij tekstveld: mag een bereik of voorwaarde bevatten
             ('130-150', '100 (bij EN 12841/B, 10.5-13mm touw)'). -->
        <input v-model="form.max_user_weight_kg" :placeholder="$t('settings.catalog.placeholders.maxUserWeightKg')" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.intervalOverride') }}</span>
        <input v-model.number="form.interval_override_months" :placeholder="$t('settings.catalog.placeholders.intervalOverride')" type="number" min="0" class="pf__input" />
      </label>
    </div>
    <!-- Alleen relevant voor touwwerk (afdaalapparaten/grigri's e.d.); leeg
         laten is prima voor producten waar dit niet op van toepassing is. -->
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.ropeDiameterMin') }}</span>
        <input v-model.number="form.rope_diameter_min_mm" :placeholder="$t('settings.catalog.placeholders.ropeDiameterMin')" type="number" min="0" step="0.1" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.ropeDiameterMax') }}</span>
        <input v-model.number="form.rope_diameter_max_mm" :placeholder="$t('settings.catalog.placeholders.ropeDiameterMax')" type="number" min="0" step="0.1" class="pf__input" />
      </label>
    </div>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.serialNumberLocation') }}</span>
      <input v-model="form.serial_number_location" :placeholder="$t('settings.catalog.placeholders.serialNumberLocation')" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.manualUrl') }}</span>
      <input v-model="form.manual_url" :placeholder="$t('settings.catalog.placeholders.manualUrl')" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.productPageUrl') }}</span>
      <input v-model="form.product_page_url" :placeholder="$t('settings.catalog.placeholders.productPageUrl')" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.recallUrl') }}</span>
      <input v-model="form.recall_url" :placeholder="$t('settings.catalog.placeholders.recallUrl')" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.inspectionNoticeUrl') }}</span>
      <input v-model="form.inspection_notice_url" :placeholder="$t('settings.catalog.placeholders.inspectionNoticeUrl')" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.notes') }}</span>
      <textarea v-model="form.notes" :placeholder="$t('settings.catalog.placeholders.notes')" class="pf__input" rows="2"></textarea>
    </label>

    <p v-if="error" class="pf__error">{{ error }}</p>
    <div class="pf__actions">
      <button type="button" class="pf__btn pf__btn--cancel" @click="$emit('cancel')">{{ $t('common.cancel') }}</button>
      <button type="submit" class="pf__btn pf__btn--save" :disabled="saving">
        {{ saving ? $t('common.saving') : submitLabel }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { PRODUCT_TYPES } from '@gearonimo/core'
import type { ProductFormModel } from '../composables/productForm'

const props = defineProps<{
  modelValue: ProductFormModel
  submitLabel: string
  saving?: boolean
  error?: string
}>()
const emit = defineEmits<{ (e: 'submit', value: ProductFormModel): void; (e: 'cancel'): void }>()

// Gedeeld met de controle op de bronlijst (packages/core), zodat een
// producttype dat hier gekozen kan worden daar niet als fout geldt.
const productTypeKeys = PRODUCT_TYPES

const form = ref<ProductFormModel>({ ...props.modelValue })
watch(() => props.modelValue, (v) => { form.value = { ...v } })

function submit() {
  emit('submit', { ...form.value })
}
</script>

<style scoped>
.pf { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.pf__row { display: flex; gap: 0.6rem; }
.pf__row .pf__field { flex: 1; min-width: 0; }
.pf__field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #374151; }
.pf__hint { margin: -0.25rem 0 0; font-size: 0.8rem; color: #6b7280; }
.pf__input {
  padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
textarea.pf__input { resize: vertical; }
.pf__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.pf__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.pf__btn { flex: 1; padding: 0.75rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.pf__btn--cancel { background: #f3f4f6; color: #374151; }
.pf__btn--save { background: #16a34a; color: #fff; }
.pf__btn:disabled { opacity: 0.6; }
</style>
