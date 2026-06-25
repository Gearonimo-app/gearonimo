<template>
  <section class="rc">
    <div class="rc__head">
      <h2>{{ $t('settings.rejection.title') }}</h2>
      <button v-if="!showForm" class="rc__add" @click="openAdd">+ {{ $t('settings.rejection.add') }}</button>
    </div>
    <p class="rc__intro">{{ $t('settings.rejection.intro') }}</p>

    <div v-if="loading" class="rc__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="rc__state rc__state--error">{{ error }}</div>
    <p v-else-if="codes.length === 0 && !showForm" class="rc__state">{{ $t('settings.rejection.empty') }}</p>

    <ul v-else-if="!showForm" class="rc__list">
      <li
        v-for="c in codes"
        :key="c.id"
        class="rc__item"
        :class="{ 'rc__item--inactive': !c.active }"
        @click="openEdit(c)"
      >
        <span class="rc__code">{{ c.code }}</span>
        <div class="rc__body">
          <div class="rc__label">
            {{ c.label || '—' }}
            <span class="rc__badge" :class="c.company_id ? 'rc__badge--own' : 'rc__badge--platform'">
              {{ c.company_id ? $t('settings.rejection.ownBadge') : $t('settings.rejection.platformBadge') }}
            </span>
          </div>
        </div>
        <button
          class="rc__toggle"
          :class="{ 'rc__toggle--on': c.active }"
          :disabled="togglingId === c.id"
          @click.stop="toggleActive(c)"
        >
          {{ c.active ? $t('settings.rejection.on') : $t('settings.rejection.off') }}
        </button>
      </li>
    </ul>

    <div v-if="showForm" class="rc__form">
      <h3>{{ editing ? $t('settings.rejection.edit') : $t('settings.rejection.add') }}</h3>

      <p v-if="editing && !editing.company_id" class="rc__note">
        ⚠ {{ $t('settings.rejection.platformNote') }}
      </p>

      <label class="rc__field">
        <span>{{ $t('settings.rejection.fields.code') }}</span>
        <input v-model.number="form.code" type="number" min="1" class="rc__input" />
      </label>
      <label class="rc__field">
        <span>{{ $t('settings.rejection.fields.label') }}</span>
        <input v-model="form.label" class="rc__input" :placeholder="$t('settings.rejection.fields.labelPh')" />
      </label>
      <label class="rc__checkbox">
        <input type="checkbox" v-model="form.active" />
        {{ $t('settings.rejection.fields.active') }}
      </label>

      <p v-if="formError" class="rc__error">{{ formError }}</p>
      <div class="rc__actions">
        <button class="rc__btn rc__btn--cancel" @click="closeForm">{{ $t('common.cancel') }}</button>
        <button class="rc__btn rc__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
      <button v-if="editing && editing.company_id" class="rc__delete" @click="showDelete = true">
        {{ $t('common.delete') }}
      </button>
    </div>

    <!-- Verwijderen bevestigen (alleen eigen codes) -->
    <div v-if="showDelete" class="rc__overlay" @click.self="showDelete = false">
      <div class="rc__dialog">
        <h2>{{ $t('settings.rejection.deleteTitle') }}</h2>
        <p>{{ $t('settings.rejection.deleteBody') }}</p>
        <div class="rc__actions">
          <button class="rc__btn rc__btn--cancel" @click="showDelete = false">{{ $t('common.cancel') }}</button>
          <button class="rc__btn rc__btn--danger" :disabled="deleting" @click="remove">{{ $t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'

const { t } = useI18n()

interface Code {
  id: string
  company_id: string | null
  code: number
  label: string | null
  active: boolean
}

const codes = ref<Code[]>([])
const loading = ref(true)
const error = ref('')
const companyId = ref('')

const showForm = ref(false)
const editing = ref<Code | null>(null)
const saving = ref(false)
const formError = ref('')
const togglingId = ref<string | null>(null)
const showDelete = ref(false)
const deleting = ref(false)

function emptyForm() {
  return { code: nextCode(), label: '', active: true }
}
const form = ref({ code: 1, label: '', active: true })

// Volgende vrije codenummer (boven het hoogste bestaande, platform + eigen),
// zodat een nieuwe eigen code niet botst met een platformstandaard.
function nextCode() {
  return codes.value.reduce((max, c) => Math.max(max, c.code), 0) + 1
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const inspector = await ensureInspector()
    companyId.value = inspector.company_id
    // Eigen codes van dit bedrijf + de platformstandaard (company_id leeg),
    // gelijk aan fetchRejectionCodes in de wizard (zie useInspections.ts).
    const { data, error: err } = await supabase
      .from('rejection_codes')
      .select('id, company_id, code, label, active')
      .or(`company_id.eq.${inspector.company_id},company_id.is.null`)
      .order('code')
    if (err) throw err
    codes.value = (data ?? []) as Code[]
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openAdd() {
  editing.value = null
  form.value = emptyForm()
  formError.value = ''
  showForm.value = true
}

function openEdit(c: Code) {
  editing.value = c
  form.value = { code: c.code, label: c.label ?? '', active: c.active }
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
  formError.value = ''
}

async function save() {
  formError.value = ''
  if (!form.value.label.trim()) { formError.value = t('settings.rejection.errors.labelRequired'); return }
  if (!form.value.code || form.value.code < 1) { formError.value = t('settings.rejection.errors.codeRequired'); return }

  saving.value = true
  const patch = {
    code: form.value.code,
    label: form.value.label.trim(),
    active: form.value.active,
  }
  // Nieuwe codes horen bij dit bedrijf; bestaande codes (ook platformstandaard)
  // worden ter plekke bijgewerkt — er is nog één keurbedrijf, dus dat is
  // bewust toegestaan (zie DATAMODEL §rejection_codes).
  const { error: err } = editing.value
    ? await supabase.from('rejection_codes').update(patch).eq('id', editing.value.id)
    : await supabase.from('rejection_codes').insert({ company_id: companyId.value, ...patch })

  saving.value = false
  if (err) { formError.value = err.message; return }
  closeForm()
  await load()
}

async function toggleActive(c: Code) {
  togglingId.value = c.id
  const { error: err } = await supabase
    .from('rejection_codes')
    .update({ active: !c.active })
    .eq('id', c.id)
  togglingId.value = null
  if (err) { error.value = err.message; return }
  c.active = !c.active
}

async function remove() {
  if (!editing.value) return
  deleting.value = true
  const { error: err } = await supabase.from('rejection_codes').delete().eq('id', editing.value.id)
  deleting.value = false
  showDelete.value = false
  if (err) { formError.value = err.message; return }
  closeForm()
  await load()
}

onMounted(load)
</script>

<style scoped>
.rc { margin-top: 0.5rem; }
.rc__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem; }
.rc__head h2 { font-size: 1.05rem; margin: 0; }
.rc__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.rc__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 0.75rem; }
.rc__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.rc__state--error { color: #dc2626; }

.rc__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.rc__item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer;
}
.rc__item:last-child { border-bottom: none; }
.rc__item:active { background: #f9fafb; }
.rc__item--inactive { opacity: 0.55; }
.rc__code {
  flex-shrink: 0; width: 1.9rem; height: 1.9rem; border-radius: 8px;
  background: #1a3a2a; color: #fff; font-weight: 700;
  display: flex; align-items: center; justify-content: center; font-size: 0.95rem;
}
.rc__body { flex: 1; min-width: 0; }
.rc__label { font-weight: 600; }
.rc__badge {
  display: inline-block; margin-left: 0.5rem; border-radius: 6px;
  padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 600; vertical-align: middle;
}
.rc__badge--platform { background: #e0e7ff; color: #3730a3; }
.rc__badge--own { background: #dcfce7; color: #166534; }
.rc__toggle {
  flex-shrink: 0; border: 1px solid #d1d5db; background: #f3f4f6; color: #6b7280;
  border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer;
}
.rc__toggle--on { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
.rc__toggle:disabled { opacity: 0.6; }

.rc__form { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.rc__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.rc__note {
  margin: 0; font-size: 0.8rem; color: #92400e; background: #fef3c7;
  border-radius: 8px; padding: 0.5rem 0.7rem;
}
.rc__field { display: flex; flex-direction: column; gap: 0.25rem; }
.rc__field > span { font-size: 0.8rem; color: #374151; font-weight: 600; }
.rc__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
.rc__checkbox { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; }
.rc__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.rc__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.rc__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.rc__btn--cancel { background: #f3f4f6; color: #374151; }
.rc__btn--save { background: #16a34a; color: #fff; }
.rc__btn--danger { background: #dc2626; color: #fff; }
.rc__btn:disabled { opacity: 0.6; }
.rc__delete {
  margin-top: 0.25rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: 1px solid #fecaca; background: #fff; color: #dc2626;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}

.rc__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.rc__dialog { background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 360px; }
.rc__dialog h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.rc__dialog p { margin: 0 0 0.5rem; color: #4b5563; }
</style>
