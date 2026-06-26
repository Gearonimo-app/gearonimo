<template>
  <section class="ins">
    <p class="ins__intro">{{ $t('settings.inspectors.intro') }}</p>

    <div v-if="loading" class="ins__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ins__state ins__state--error">{{ error }}</div>

    <!-- ===================== LIJST ===================== -->
    <template v-else-if="!selected">
      <div class="ins__head">
        <h2>{{ $t('settings.inspectors.title') }}</h2>
        <button v-if="!showAdd" class="ins__add" @click="openAdd">+ {{ $t('settings.inspectors.add') }}</button>
      </div>

      <p v-if="inspectors.length === 0 && !showAdd" class="ins__state">{{ $t('settings.inspectors.empty') }}</p>

      <ul v-else-if="!showAdd" class="ins__list">
        <li v-for="i in inspectors" :key="i.id" class="ins__item" :class="{ 'ins__item--inactive': !i.active }" @click="select(i)">
          <div class="ins__body">
            <div class="ins__name">{{ i.name || $t('settings.inspectors.noName') }}</div>
            <div class="ins__badges">
              <span v-if="i.is_admin" class="ins__badge ins__badge--admin">{{ $t('settings.inspectors.adminBadge') }}</span>
              <span v-if="!i.user_id" class="ins__badge ins__badge--noacc">{{ $t('settings.inspectors.noAccountBadge') }}</span>
              <span v-if="!i.active" class="ins__badge">{{ $t('settings.inspectors.inactiveBadge') }}</span>
            </div>
          </div>
          <span class="ins__chev">›</span>
        </li>
      </ul>

      <div v-if="showAdd" class="ins__form">
        <h3>{{ $t('settings.inspectors.add') }}</h3>
        <label class="ins__field"><span>{{ $t('settings.inspectors.fields.name') }}</span>
          <input v-model="addForm.name" class="ins__input" /></label>
        <label class="ins__check"><input type="checkbox" v-model="addForm.is_admin" /> {{ $t('settings.inspectors.fields.admin') }}</label>
        <label class="ins__check"><input type="checkbox" v-model="addForm.active" /> {{ $t('settings.inspectors.fields.active') }}</label>
        <p v-if="formError" class="ins__error">{{ formError }}</p>
        <div class="ins__actions">
          <button class="ins__btn ins__btn--cancel" @click="showAdd = false">{{ $t('common.cancel') }}</button>
          <button class="ins__btn ins__btn--save" :disabled="saving" @click="addInspector">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </template>

    <!-- ===================== DETAIL ===================== -->
    <template v-else>
      <button class="ins__back" @click="deselect">← {{ $t('settings.inspectors.backToList') }}</button>

      <div class="ins__card">
        <label class="ins__field"><span>{{ $t('settings.inspectors.fields.name') }}</span>
          <input v-model="editForm.name" class="ins__input" /></label>
        <label class="ins__check"><input type="checkbox" v-model="editForm.is_admin" /> {{ $t('settings.inspectors.fields.admin') }}</label>
        <label class="ins__check"><input type="checkbox" v-model="editForm.active" /> {{ $t('settings.inspectors.fields.active') }}</label>
        <p v-if="!selected.user_id" class="ins__note">{{ $t('settings.inspectors.noAccountNote') }}</p>
        <p v-else class="ins__note">{{ $t('settings.inspectors.accountNote') }}</p>
        <p v-if="editError" class="ins__error">{{ editError }}</p>
        <div class="ins__actions">
          <button v-if="!selected.user_id" class="ins__btn ins__btn--danger-ghost" @click="showDelete = true">{{ $t('common.delete') }}</button>
          <button class="ins__btn ins__btn--save" :disabled="savingEdit" @click="saveInspector">{{ savingEdit ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>

      <!-- Kwalificaties -->
      <div class="ins__qhead">
        <h3>{{ $t('settings.inspectors.qualifications') }}</h3>
        <button v-if="!showQual" class="ins__add" @click="openQual">+ {{ $t('settings.inspectors.addQual') }}</button>
      </div>

      <div v-if="qualLoading" class="ins__state">{{ $t('common.loading') }}</div>
      <p v-else-if="quals.length === 0 && !showQual" class="ins__state">{{ $t('settings.inspectors.noQuals') }}</p>

      <ul v-else-if="!showQual" class="ins__list">
        <li v-for="q in quals" :key="q.id" class="ins__qitem">
          <div class="ins__body">
            <div class="ins__name">{{ q.name }}</div>
            <div class="ins__qmeta">
              <span v-if="q.number">{{ $t('settings.inspectors.qNumber') }}: {{ q.number }}</span>
              <span v-if="q.valid_until" class="ins__valid" :class="`ins__valid--${qualStatus(q)}`">
                {{ $t('settings.inspectors.validUntil') }}: {{ formatDate(q.valid_until) }}
                <template v-if="qualStatus(q) === 'expired'"> · {{ $t('settings.inspectors.expired') }}</template>
                <template v-else-if="qualStatus(q) === 'soon'"> · {{ $t('settings.inspectors.expiringSoon') }}</template>
              </span>
            </div>
          </div>
          <div class="ins__qactions" @click.stop>
            <button v-if="q.storage_path" class="ins__link" :disabled="opening === q.id" @click="openFile(q)">📄 {{ $t('settings.inspectors.viewFile') }}</button>
            <button class="ins__link ins__link--del" @click="removeQual(q)">{{ $t('common.delete') }}</button>
          </div>
        </li>
      </ul>

      <div v-if="showQual" class="ins__form">
        <h3>{{ $t('settings.inspectors.addQual') }}</h3>
        <label class="ins__field"><span>{{ $t('settings.inspectors.qFields.name') }}</span>
          <input v-model="qualForm.name" class="ins__input" :placeholder="$t('settings.inspectors.qFields.namePh')" /></label>
        <label class="ins__field"><span>{{ $t('settings.inspectors.qFields.number') }}</span>
          <input v-model="qualForm.number" class="ins__input" /></label>
        <label class="ins__field"><span>{{ $t('settings.inspectors.qFields.validUntil') }}</span>
          <input v-model="qualForm.valid_until" type="date" class="ins__input" /></label>
        <label class="ins__field"><span>{{ $t('settings.inspectors.qFields.file') }}</span>
          <input type="file" accept="application/pdf,image/*" class="ins__input" @change="onQualFile" /></label>
        <p v-if="qualError" class="ins__error">{{ qualError }}</p>
        <div class="ins__actions">
          <button class="ins__btn ins__btn--cancel" @click="showQual = false">{{ $t('common.cancel') }}</button>
          <button class="ins__btn ins__btn--save" :disabled="savingQual" @click="addQual">{{ savingQual ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>

      <!-- Verwijder-bevestiging keurmeester -->
      <div v-if="showDelete" class="ins__overlay" @click.self="showDelete = false">
        <div class="ins__dialog">
          <h2>{{ $t('settings.inspectors.deleteTitle') }}</h2>
          <p>{{ $t('settings.inspectors.deleteBody') }}</p>
          <div class="ins__actions">
            <button class="ins__btn ins__btn--cancel" @click="showDelete = false">{{ $t('common.cancel') }}</button>
            <button class="ins__btn ins__btn--danger" :disabled="deleting" @click="deleteInspector">{{ $t('common.delete') }}</button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'

const { t } = useI18n()

interface Inspector {
  id: string
  name: string | null
  active: boolean
  is_admin: boolean
  user_id: string | null
}
interface Qualification {
  id: string
  inspector_id: string
  name: string
  number: string | null
  valid_until: string | null
  storage_path: string | null
}

const loading = ref(true)
const error = ref('')
const companyId = ref('')
const inspectors = ref<Inspector[]>([])
const selected = ref<Inspector | null>(null)

// --- lijst: toevoegen ---
const showAdd = ref(false)
const saving = ref(false)
const formError = ref('')
const addForm = reactive({ name: '', is_admin: false, active: true })

// --- detail: bewerken ---
const editForm = reactive({ name: '', is_admin: false, active: true })
const savingEdit = ref(false)
const editError = ref('')
const showDelete = ref(false)
const deleting = ref(false)

// --- kwalificaties ---
const quals = ref<Qualification[]>([])
const qualLoading = ref(false)
const showQual = ref(false)
const savingQual = ref(false)
const qualError = ref('')
const opening = ref<string | null>(null)
const qualForm = reactive({ name: '', number: '', valid_until: '' })
let qualFile: File | null = null

function formatDate(d: string) {
  const date = new Date(d)
  return isNaN(date.getTime()) ? d : date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}
function qualStatus(q: Qualification): 'ok' | 'soon' | 'expired' {
  if (!q.valid_until) return 'ok'
  const days = (new Date(q.valid_until).getTime() - Date.now()) / 86400000
  if (days < 0) return 'expired'
  if (days <= 60) return 'soon'
  return 'ok'
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const me = await ensureInspector()
    companyId.value = me.company_id
    const { data, error: err } = await supabase
      .from('inspectors')
      .select('id, name, active, is_admin, user_id')
      .eq('company_id', me.company_id)
      .order('created_at')
    if (err) throw err
    inspectors.value = (data ?? []) as Inspector[]
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function openAdd() {
  addForm.name = ''
  addForm.is_admin = false
  addForm.active = true
  formError.value = ''
  showAdd.value = true
}
async function addInspector() {
  formError.value = ''
  if (!addForm.name.trim()) { formError.value = t('settings.inspectors.errors.nameRequired'); return }
  saving.value = true
  const { error: err } = await supabase.from('inspectors').insert({
    company_id: companyId.value,
    user_id: null,
    name: addForm.name.trim(),
    is_admin: addForm.is_admin,
    active: addForm.active,
  })
  saving.value = false
  if (err) { formError.value = err.message; return }
  showAdd.value = false
  await load()
}

function select(i: Inspector) {
  selected.value = i
  editForm.name = i.name ?? ''
  editForm.is_admin = i.is_admin
  editForm.active = i.active
  editError.value = ''
  showQual.value = false
  loadQuals(i.id)
}
function deselect() {
  selected.value = null
  quals.value = []
}

async function saveInspector() {
  if (!selected.value) return
  editError.value = ''
  savingEdit.value = true
  const { error: err } = await supabase
    .from('inspectors')
    .update({ name: editForm.name.trim() || null, is_admin: editForm.is_admin, active: editForm.active })
    .eq('id', selected.value.id)
  savingEdit.value = false
  if (err) { editError.value = err.message; return }
  await load()
  deselect()
}

async function deleteInspector() {
  if (!selected.value) return
  deleting.value = true
  try {
    // Eerst de geüploade kwalificatiebestanden opruimen (rijen gaan via cascade).
    const paths = quals.value.map((q) => q.storage_path).filter(Boolean) as string[]
    if (paths.length) await supabase.storage.from('qualifications').remove(paths)
    const { error: err } = await supabase.from('inspectors').delete().eq('id', selected.value.id)
    if (err) throw err
    showDelete.value = false
    await load()
    deselect()
  } catch (e: any) {
    editError.value = e.message
    showDelete.value = false
  } finally {
    deleting.value = false
  }
}

// ---- kwalificaties ----
async function loadQuals(inspectorId: string) {
  qualLoading.value = true
  const { data, error: err } = await supabase
    .from('inspector_qualifications')
    .select('id, inspector_id, name, number, valid_until, storage_path')
    .eq('inspector_id', inspectorId)
    .order('created_at', { ascending: false })
  qualLoading.value = false
  if (!err) quals.value = (data ?? []) as Qualification[]
}

function openQual() {
  qualForm.name = ''
  qualForm.number = ''
  qualForm.valid_until = ''
  qualFile = null
  qualError.value = ''
  showQual.value = true
}
function onQualFile(e: Event) {
  qualFile = (e.target as HTMLInputElement).files?.[0] ?? null
}
function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '_').slice(-80)
}
async function addQual() {
  if (!selected.value) return
  qualError.value = ''
  if (!qualForm.name.trim()) { qualError.value = t('settings.inspectors.errors.qNameRequired'); return }
  savingQual.value = true
  try {
    let storagePath: string | null = null
    if (qualFile) {
      storagePath = `${companyId.value}/${selected.value.id}/${crypto.randomUUID()}-${sanitize(qualFile.name)}`
      const { error: upErr } = await supabase.storage
        .from('qualifications')
        .upload(storagePath, qualFile, { contentType: qualFile.type || 'application/octet-stream', upsert: false })
      if (upErr) throw upErr
    }
    const { error: err } = await supabase.from('inspector_qualifications').insert({
      inspector_id: selected.value.id,
      name: qualForm.name.trim(),
      number: qualForm.number.trim() || null,
      valid_until: qualForm.valid_until || null,
      storage_path: storagePath,
    })
    if (err) throw err
    showQual.value = false
    await loadQuals(selected.value.id)
  } catch (e: any) {
    qualError.value = e.message
  } finally {
    savingQual.value = false
  }
}
async function removeQual(q: Qualification) {
  if (q.storage_path) await supabase.storage.from('qualifications').remove([q.storage_path])
  const { error: err } = await supabase.from('inspector_qualifications').delete().eq('id', q.id)
  if (err) { qualError.value = err.message; return }
  if (selected.value) await loadQuals(selected.value.id)
}
async function openFile(q: Qualification) {
  if (!q.storage_path) return
  opening.value = q.id
  const { data, error: err } = await supabase.storage.from('qualifications').createSignedUrl(q.storage_path, 120)
  opening.value = null
  if (err || !data) { qualError.value = err?.message ?? 'Kon bestand niet openen'; return }
  window.open(data.signedUrl, '_blank', 'noopener')
}

onMounted(load)
</script>

<style scoped>
.ins { margin-top: 0.25rem; }
.ins__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 1rem; }
.ins__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.ins__state--error { color: #dc2626; }

.ins__head, .ins__qhead { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.ins__head h2 { font-size: 1.05rem; margin: 0; }
.ins__qhead { margin-top: 1.5rem; }
.ins__qhead h3 { font-size: 0.95rem; margin: 0; color: #1a3a2a; }
.ins__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }

.ins__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ins__item, .ins__qitem { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-bottom: 1px solid #eee; }
.ins__item { cursor: pointer; }
.ins__item:last-child, .ins__qitem:last-child { border-bottom: none; }
.ins__item:active { background: #f9fafb; }
.ins__item--inactive { opacity: 0.55; }
.ins__body { flex: 1; min-width: 0; }
.ins__name { font-weight: 600; }
.ins__badges { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.2rem; }
.ins__badge { border-radius: 6px; padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 600; background: #f3f4f6; color: #6b7280; }
.ins__badge--admin { background: #dcfce7; color: #166534; }
.ins__badge--noacc { background: #fef3c7; color: #92400e; }
.ins__chev { color: #9ca3af; font-size: 1.4rem; }

.ins__back { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.9rem; cursor: pointer; padding: 0 0 0.75rem; }

.ins__card, .ins__form { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.ins__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.ins__field { display: flex; flex-direction: column; gap: 0.25rem; }
.ins__field > span { font-size: 0.8rem; color: #374151; font-weight: 600; }
.ins__input { padding: 0.65rem 0.75rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit; }
.ins__check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
.ins__note { font-size: 0.8rem; color: #6b7280; margin: 0; background: #f9fafb; border-radius: 8px; padding: 0.5rem 0.7rem; }
.ins__error { color: #dc2626; font-size: 0.9rem; margin: 0; }

.ins__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.ins__btn { flex: 1; padding: 0.8rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.ins__btn--cancel { background: #f3f4f6; color: #374151; }
.ins__btn--save { background: #16a34a; color: #fff; }
.ins__btn--danger { background: #dc2626; color: #fff; }
.ins__btn--danger-ghost { background: #fff; color: #dc2626; border: 1px solid #fecaca; }
.ins__btn:disabled { opacity: 0.6; }

.ins__qitem { gap: 0.5rem; }
.ins__qmeta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.82rem; color: #6b7280; margin-top: 0.2rem; }
.ins__valid--soon { color: #b45309; font-weight: 600; }
.ins__valid--expired { color: #b91c1c; font-weight: 600; }
.ins__qactions { display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-end; }
.ins__link { background: none; border: none; color: #2563eb; font-size: 0.82rem; font-weight: 600; cursor: pointer; padding: 0; white-space: nowrap; }
.ins__link--del { color: #dc2626; }
.ins__link:disabled { opacity: 0.6; }

.ins__overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100; }
.ins__dialog { background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 360px; }
.ins__dialog h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.ins__dialog p { margin: 0 0 0.5rem; color: #4b5563; }
</style>
