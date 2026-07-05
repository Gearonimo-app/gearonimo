<!-- Vindbaarheid: de schakelaar "open voor nieuwe klanten" (listed) + de
     locatie van het keurbedrijf op de openbare wereldkaart in de klant-app.
     Zolang de schakelaar uit staat is het bedrijf alleen via naam-zoeken te
     vinden (BLAUWDRUK §7). Zie migratie 20260717_inspection_requests_leadmotor.sql. -->
<template>
  <section class="cl">
    <p class="cl__intro">{{ $t('settings.listing.intro') }}</p>

    <div v-if="loading" class="cl__state">{{ $t('common.loading') }}</div>
    <template v-else>
      <label class="cl__toggle">
        <input type="checkbox" v-model="listed" />
        <span>{{ $t('settings.listing.listedLabel') }}</span>
      </label>

      <div class="cl__field">
        <label>{{ $t('settings.listing.latitude') }}</label>
        <input v-model.number="latitude" type="number" step="0.0001" class="cl__input" placeholder="51.9231" />
      </div>
      <div class="cl__field">
        <label>{{ $t('settings.listing.longitude') }}</label>
        <input v-model.number="longitude" type="number" step="0.0001" class="cl__input" placeholder="5.8447" />
      </div>
      <p class="cl__hint">{{ $t('settings.listing.coordsHint') }}</p>

      <p v-if="error" class="cl__error">{{ error }}</p>
      <p v-if="saved" class="cl__saved">{{ $t('settings.listing.saved') }}</p>
      <button class="cl__btn" :disabled="saving" @click="save">
        {{ saving ? $t('common.saving') : $t('common.save') }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase, errorMessage } from '@gearonimo/core'

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

const listed = ref(false)
const latitude = ref<number | null>(null)
const longitude = ref<number | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase.rpc('my_company_listing')
    if (err) throw err
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      listed.value = !!row.listed
      latitude.value = row.latitude
      longitude.value = row.longitude
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const { error: err } = await supabase.rpc('set_company_listing', {
      p_listed: listed.value,
      p_latitude: latitude.value,
      p_longitude: longitude.value,
    })
    if (err) throw err
    saved.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.cl__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 1rem; }
.cl__state { color: #666; font-size: 0.9rem; }
.cl__toggle { display: flex; align-items: center; gap: 0.6rem; font-weight: 600; margin-bottom: 1rem; cursor: pointer; }
.cl__toggle input { width: 1.1rem; height: 1.1rem; }
.cl__field { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0.75rem; font-size: 0.85rem; color: #374151; }
.cl__input { padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem; width: 100%; box-sizing: border-box; }
.cl__hint { font-size: 0.8rem; color: #9ca3af; margin: 0 0 1rem; }
.cl__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.5rem; }
.cl__saved { color: #16a34a; font-size: 0.9rem; margin: 0 0 0.5rem; }
.cl__btn { background: #16a34a; color: #fff; border: none; border-radius: 10px; padding: 0.75rem 1.25rem; font-weight: 700; cursor: pointer; }
.cl__btn:disabled { opacity: 0.6; }
</style>
