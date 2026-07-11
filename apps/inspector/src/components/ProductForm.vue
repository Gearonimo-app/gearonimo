<!-- Gedeeld veldenset voor een catalogusproduct (products): gebruikt door
     CatalogQueue.vue (nieuw product vanuit de wachtrij) en
     CatalogManager.vue (handmatig toevoegen/bewerken). Eén plek voor de
     veldenlijst voorkomt dat de twee schermen uit elkaar gaan lopen. -->
<template>
  <form class="pf" @submit.prevent="submit">
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.brand') }} *</span>
        <input v-model="form.brand" class="pf__input" required />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.name') }} *</span>
        <input v-model="form.name" class="pf__input" required />
      </label>
    </div>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.productType') }}</span>
        <select v-model="form.product_type" class="pf__input">
          <option value="">—</option>
          <option value="ppe">{{ $t('settings.catalog.productTypes.ppe') }}</option>
          <option value="rigging">{{ $t('settings.catalog.productTypes.rigging') }}</option>
          <option value="aerial_platform">{{ $t('settings.catalog.productTypes.aerial_platform') }}</option>
          <option value="machine">{{ $t('settings.catalog.productTypes.machine') }}</option>
          <option value="other">{{ $t('settings.catalog.productTypes.other') }}</option>
        </select>
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.category') }}</span>
        <input v-model="form.category" class="pf__input" />
      </label>
    </div>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.material') }}</span>
        <input v-model="form.material" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.standard') }}</span>
        <input v-model="form.standard" class="pf__input" />
      </label>
    </div>
    <div class="pf__row pf__row--three">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.maxAgeYears') }}</span>
        <input v-model.number="form.max_age_years" type="number" min="0" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.maxAgeUseYears') }}</span>
        <input v-model.number="form.max_age_use_years" type="number" min="0" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.maxAgeMfrYears') }}</span>
        <input v-model.number="form.max_age_mfr_years" type="number" min="0" class="pf__input" />
      </label>
    </div>
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.breakingStrength') }}</span>
        <input v-model="form.breaking_strength" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.intervalOverride') }}</span>
        <input v-model.number="form.interval_override_months" type="number" min="0" class="pf__input" />
      </label>
    </div>
    <!-- Alleen relevant voor touwwerk (afdaalapparaten/grigri's e.d.); leeg
         laten is prima voor producten waar dit niet op van toepassing is. -->
    <div class="pf__row">
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.ropeDiameterMin') }}</span>
        <input v-model.number="form.rope_diameter_min_mm" type="number" min="0" step="0.1" class="pf__input" />
      </label>
      <label class="pf__field">
        <span>{{ $t('settings.catalog.fields.ropeDiameterMax') }}</span>
        <input v-model.number="form.rope_diameter_max_mm" type="number" min="0" step="0.1" class="pf__input" />
      </label>
    </div>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.manualUrl') }}</span>
      <input v-model="form.manual_url" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.productPageUrl') }}</span>
      <input v-model="form.product_page_url" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.recallUrl') }}</span>
      <input v-model="form.recall_url" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.inspectionNoticeUrl') }}</span>
      <input v-model="form.inspection_notice_url" type="url" class="pf__input" />
    </label>
    <label class="pf__field">
      <span>{{ $t('settings.catalog.fields.notes') }}</span>
      <textarea v-model="form.notes" class="pf__input" rows="2"></textarea>
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
import type { ProductFormModel } from '../composables/productForm'

const props = defineProps<{
  modelValue: ProductFormModel
  submitLabel: string
  saving?: boolean
  error?: string
}>()
const emit = defineEmits<{ (e: 'submit', value: ProductFormModel): void; (e: 'cancel'): void }>()

const form = ref<ProductFormModel>({ ...props.modelValue })
watch(() => props.modelValue, (v) => { form.value = { ...v } })

function submit() {
  emit('submit', { ...form.value })
}
</script>

<style scoped>
.pf { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.pf__row { display: flex; gap: 0.6rem; }
.pf__row--three .pf__field { flex: 1; }
.pf__row .pf__field { flex: 1; min-width: 0; }
.pf__field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #374151; }
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
