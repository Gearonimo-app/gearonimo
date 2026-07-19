<!-- Beheer van de SN-referentie door curators (wens Jos 2026-07-19):
     derde tab onder Instellingen -> Catalogus. RLS dwingt het schrijfrecht
     af (sn_reference curator-policies, migratie 20260747); dit scherm is
     alleen bereikbaar via de Catalogus-tegel die al curator-only is. -->
<template>
  <section class="snm">
    <div class="snm__toolbar">
      <input v-model="search" class="snm__input snm__search" :placeholder="$t('cheatSheet.filterPh')" />
      <button v-if="!showForm" class="snm__add" @click="openAdd">+ {{ $t('settings.snref.add') }}</button>
    </div>

    <div v-if="loading" class="snm__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="snm__state snm__state--error">{{ error }}</div>

    <div v-if="showForm" class="snm__form">
      <h3>{{ editingId ? $t('settings.snref.edit') : $t('settings.snref.add') }}</h3>
      <label class="snm__field"><span>{{ $t('settings.snref.fields.brand') }}</span>
        <input v-model="form.brand" class="snm__input" /></label>
      <label class="snm__field"><span>{{ $t('cheatSheet.example') }}</span>
        <input v-model="form.example" class="snm__input" /></label>
      <label class="snm__field"><span>{{ $t('cheatSheet.format') }}</span>
        <input v-model="form.format" class="snm__input" :placeholder="$t('settings.snref.formatPh')" /></label>
      <label class="snm__field"><span>{{ $t('settings.snref.fields.note') }}</span>
        <input v-model="form.note" class="snm__input" /></label>
      <label class="snm__field"><span>{{ $t('settings.snref.fields.link') }}</span>
        <input v-model="form.link" class="snm__input" placeholder="https://..." /></label>
      <p v-if="formError" class="snm__error">{{ formError }}</p>
      <div class="snm__actions">
        <button v-if="editingId" class="snm__btn snm__btn--danger-ghost" :disabled="saving" @click="remove">{{ $t('common.delete') }}</button>
        <button class="snm__btn snm__btn--cancel" @click="closeForm">{{ $t('common.cancel') }}</button>
        <button class="snm__btn snm__btn--save" :disabled="saving" @click="save">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
      </div>
    </div>

    <ul v-else-if="!loading && !error" class="snm__list">
      <li v-if="filtered.length === 0" class="snm__state">{{ $t('settings.snref.empty') }}</li>
      <li v-for="r in filtered" :key="r.id" class="snm__item" @click="openEdit(r)">
        <div class="snm__body">
          <div class="snm__brand">{{ r.brand }}</div>
          <div class="snm__meta"><code>{{ r.example }}</code><template v-if="r.format"> · <code>{{ r.format }}</code></template></div>
        </div>
        <span class="snm__chev">›</span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, errorMessage } from '@gearonimo/core'
import type { SnRefRow } from '../composables/useSnReference'

const { t } = useI18n()

const rows = ref<SnRefRow[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')

const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({ brand: '', example: '', format: '', note: '', link: '' })

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => r.brand.toLowerCase().includes(q))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase
      .from('sn_reference')
      .select('id, brand, example, format, note, link')
      .order('brand')
    if (err) throw err
    rows.value = (data ?? []) as SnRefRow[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editingId.value = null
  form.brand = ''
  form.example = ''
  form.format = ''
  form.note = ''
  form.link = ''
  formError.value = ''
  showForm.value = true
}

function openEdit(r: SnRefRow) {
  editingId.value = r.id
  form.brand = r.brand
  form.example = r.example ?? ''
  form.format = r.format ?? ''
  form.note = r.note ?? ''
  form.link = r.link ?? ''
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
}

async function save() {
  formError.value = ''
  if (!form.brand.trim()) { formError.value = t('settings.snref.errors.brandRequired'); return }
  saving.value = true
  try {
    const row = {
      brand: form.brand.trim(),
      example: form.example.trim() || null,
      format: form.format.trim() || null,
      note: form.note.trim() || null,
      link: form.link.trim() || null,
    }
    const { error: err } = editingId.value
      ? await supabase.from('sn_reference').update(row).eq('id', editingId.value)
      : await supabase.from('sn_reference').insert(row)
    if (err) throw err
    closeForm()
    await load()
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!editingId.value) return
  saving.value = true
  try {
    const { error: err } = await supabase.from('sn_reference').delete().eq('id', editingId.value)
    if (err) throw err
    closeForm()
    await load()
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.snm__toolbar { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
.snm__search { flex: 1; }
.snm__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; white-space: nowrap; }
.snm__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.snm__state--error { color: #dc2626; }

.snm__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.snm__item { display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.snm__item:last-child { border-bottom: none; }
.snm__item:active { background: #f9fafb; }
.snm__body { flex: 1; min-width: 0; }
.snm__brand { font-weight: 600; }
.snm__meta { font-size: 0.82rem; color: #6b7280; margin-top: 0.15rem; }
.snm__meta code { font-family: ui-monospace, monospace; }
.snm__chev { color: #9ca3af; font-size: 1.4rem; }

.snm__form { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.snm__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.snm__field { display: flex; flex-direction: column; gap: 0.25rem; }
.snm__field > span { font-size: 0.8rem; color: #374151; font-weight: 600; }
.snm__input { padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit; }
.snm__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.snm__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.snm__btn { flex: 1; padding: 0.8rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.snm__btn--cancel { background: #f3f4f6; color: #374151; }
.snm__btn--save { background: #16a34a; color: #fff; }
.snm__btn--danger-ghost { background: #fff; color: #dc2626; border: 1px solid #fecaca; }
.snm__btn:disabled { opacity: 0.6; }
</style>
