<template>
  <section class="ca">
    <div class="ca__head">
      <h2>{{ $t('articles.title') }}</h2>
      <button class="ca__add" @click="showAdd = true">+ {{ $t('articles.add') }}</button>
    </div>

    <div v-if="loading" class="ca__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ca__state ca__state--error">{{ error }}</div>
    <p v-else-if="articles.length === 0" class="ca__state">{{ $t('articles.empty') }}</p>

    <ul v-else class="ca__list">
      <li v-for="a in articles" :key="a.id" class="ca__item">
        <div class="ca__desc">{{ a.free_description || $t('articles.untitled') }}</div>
        <div class="ca__meta">
          <span v-if="a.free_brand">{{ a.free_brand }}</span>
          <span v-if="a.serial_number">· {{ a.serial_number }}</span>
          <span v-if="a.manufacture_year">· {{ a.manufacture_year }}</span>
        </div>
      </li>
    </ul>

    <!-- Toevoegen -->
    <div v-if="showAdd" class="ca__overlay" @click.self="showAdd = false">
      <div class="ca__form">
        <h2>{{ $t('articles.addTitle') }}</h2>
        <input v-model="form.description" :placeholder="$t('articles.fields.description')" class="ca__input" />
        <input v-model="form.brand"       :placeholder="$t('articles.fields.brand')"       class="ca__input" />
        <input v-model="form.serial"      :placeholder="$t('articles.fields.serial')"      class="ca__input" />
        <input v-model="form.year"        :placeholder="$t('articles.fields.year')"        class="ca__input" type="number" inputmode="numeric" />
        <textarea v-model="form.notes"    :placeholder="$t('articles.fields.notes')"       class="ca__input" rows="2"></textarea>
        <p v-if="formError" class="ca__error">{{ formError }}</p>
        <div class="ca__actions">
          <button class="ca__btn ca__btn--cancel" @click="showAdd = false">{{ $t('common.cancel') }}</button>
          <button class="ca__btn ca__btn--save" :disabled="saving" @click="save">
            {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
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

const articles = ref<Record<string, any>[]>([])
const loading = ref(true)
const error = ref('')
const showAdd = ref(false)
const saving = ref(false)
const formError = ref('')
const form = ref({ description: '', brand: '', serial: '', year: '', notes: '' })

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('articles')
    .select('*')
    .eq('customer_id', props.customerId)
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else articles.value = data ?? []
  loading.value = false
}

async function save() {
  if (!form.value.description.trim()) { formError.value = t('articles.errors.descriptionRequired'); return }
  saving.value = true
  formError.value = ''
  const year = parseInt(form.value.year, 10)
  const { error: err } = await supabase.from('articles').insert({
    customer_id: props.customerId,
    free_description: form.value.description.trim(),
    free_brand: form.value.brand.trim() || null,
    serial_number: form.value.serial.trim() || null,
    manufacture_year: Number.isFinite(year) ? year : null,
    notes: form.value.notes.trim() || null,
  })
  saving.value = false
  if (err) { formError.value = err.message; return }
  showAdd.value = false
  form.value = { description: '', brand: '', serial: '', year: '', notes: '' }
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
.ca__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ca__item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; }
.ca__item:last-child { border-bottom: none; }
.ca__desc { font-weight: 600; }
.ca__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }

.ca__overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 100; }
.ca__form {
  background: #fff; width: 100%; border-radius: 16px 16px 0 0;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
  max-height: 88vh; overflow-y: auto;
}
.ca__form h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.ca__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
textarea.ca__input { resize: vertical; }
.ca__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.ca__actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
.ca__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.ca__btn--cancel { background: #f3f4f6; color: #374151; }
.ca__btn--save { background: #16a34a; color: #fff; }
.ca__btn:disabled { opacity: 0.6; }
</style>
