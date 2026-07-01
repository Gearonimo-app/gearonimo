<template>
  <section class="cm">
    <div class="cm__head">
      <h2>{{ $t('members.title') }}</h2>
      <button v-if="!showForm && isOnline" class="cm__add" @click="openAdd">+ {{ $t('members.add') }}</button>
    </div>

    <div v-if="loading" class="cm__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="cm__state cm__state--error">{{ error }}</div>
    <p v-else-if="members.length === 0 && !showForm" class="cm__state">{{ $t('members.empty') }}</p>

    <ul v-else-if="members.length && !showForm" class="cm__list">
      <li v-for="m in members" :key="m.id" class="cm__item" @click="isOnline && openEdit(m)">
        <div class="cm__name">
          {{ m.name }}
          <span v-if="!m.active" class="cm__badge">{{ $t('members.inactiveBadge') }}</span>
        </div>
        <div v-if="m.role" class="cm__meta">{{ m.role }}</div>
      </li>
    </ul>

    <div v-if="showForm" class="cm__form">
      <h3>{{ editingId ? $t('members.edit') : $t('members.add') }}</h3>
      <input v-model="form.name" :placeholder="$t('members.fields.name')" class="cm__input" />
      <input v-model="form.role" :placeholder="$t('members.fields.role')" class="cm__input" />
      <input v-model="form.phone" :placeholder="$t('members.fields.phone')" class="cm__input" />
      <input v-model="form.email" :placeholder="$t('members.fields.email')" class="cm__input" />
      <textarea v-model="form.notes" :placeholder="$t('members.fields.notes')" class="cm__input" rows="2"></textarea>
      <label class="cm__checkbox">
        <input type="checkbox" v-model="form.active" />
        {{ $t('members.fields.active') }}
      </label>

      <p v-if="formError" class="cm__error">{{ formError }}</p>
      <div class="cm__actions">
        <button class="cm__btn cm__btn--cancel" @click="closeForm">{{ $t('common.cancel') }}</button>
        <button class="cm__btn cm__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
      <button v-if="editingId" class="cm__delete" @click="showDelete = true">{{ $t('common.delete') }}</button>
    </div>

    <!-- Verwijderen bevestigen -->
    <div v-if="showDelete" class="cm__overlay" @click.self="showDelete = false">
      <div class="cm__dialog">
        <h2>{{ $t('members.detail.deleteTitle') }}</h2>
        <p>{{ $t('members.detail.deleteBody') }}</p>
        <div class="cm__actions">
          <button class="cm__btn cm__btn--cancel" @click="showDelete = false">{{ $t('common.cancel') }}</button>
          <button class="cm__btn cm__btn--danger" :disabled="deleting" @click="remove">{{ $t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, useOnline, useOfflineSession, getCustomerMembersForCustomer, errorMessage } from '@gearonimo/core'

const props = defineProps<{ customerId: string }>()
const { t } = useI18n()
const { isOnline } = useOnline()

interface Member {
  id: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  notes: string | null
  active: boolean
}

const members = ref<Member[]>([])
const loading = ref(true)
const error = ref('')

const showForm = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')
const showDelete = ref(false)
const deleting = ref(false)

function emptyForm() {
  return { name: '', role: '', phone: '', email: '', notes: '', active: true }
}
const form = ref(emptyForm())

async function load() {
  loading.value = true
  error.value = ''

  // Offline: uit de versleutelde cache (meegenomen in de klant-download);
  // bewerken blijft online-only, dus alleen lezen hier.
  if (!isOnline.value) {
    try {
      const key = useOfflineSession().getKey()
      members.value = await getCustomerMembersForCustomer<Member>(key, props.customerId)
    } catch (e) {
      error.value = errorMessage(e)
    }
    loading.value = false
    return
  }

  const { data, error: err } = await supabase
    .from('customer_members')
    .select('*')
    .eq('customer_id', props.customerId)
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else members.value = (data ?? []) as Member[]
  loading.value = false
}

function openAdd() {
  editingId.value = null
  form.value = emptyForm()
  formError.value = ''
  showForm.value = true
}

function openEdit(m: Member) {
  editingId.value = m.id
  form.value = {
    name: m.name, role: m.role ?? '', phone: m.phone ?? '',
    email: m.email ?? '', notes: m.notes ?? '', active: m.active,
  }
  formError.value = ''
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingId.value = null
  formError.value = ''
  form.value = emptyForm()
}

async function save() {
  formError.value = ''
  if (!form.value.name.trim()) { formError.value = t('members.errors.nameRequired'); return }

  saving.value = true
  const patch = {
    name: form.value.name.trim(),
    role: form.value.role.trim() || null,
    phone: form.value.phone.trim() || null,
    email: form.value.email.trim() || null,
    notes: form.value.notes.trim() || null,
    active: form.value.active,
  }

  const { error: err } = editingId.value
    ? await supabase.from('customer_members').update(patch).eq('id', editingId.value)
    : await supabase.from('customer_members').insert({ customer_id: props.customerId, ...patch })

  saving.value = false
  if (err) { formError.value = err.message; return }
  closeForm()
  await load()
}

async function remove() {
  if (!editingId.value) return
  deleting.value = true
  const { error: err } = await supabase.from('customer_members').delete().eq('id', editingId.value)
  deleting.value = false
  showDelete.value = false
  if (err) { formError.value = err.message; return }
  closeForm()
  await load()
}

onMounted(load)

// Na ontgrendelen via de statusbalk alsnog uit de cache laden (zie Customers.vue).
watch(useOfflineSession().isUnlocked, (unlocked) => {
  if (unlocked) void load()
})
</script>

<style scoped>
.cm { margin-top: 1.5rem; }
.cm__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.cm__head h2 { font-size: 1rem; margin: 0; }
.cm__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.cm__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.cm__state--error { color: #dc2626; }
.cm__list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.cm__item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.cm__item:last-child { border-bottom: none; }
.cm__name { font-weight: 600; }
.cm__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
.cm__badge {
  display: inline-block; margin-left: 0.5rem; background: #f3f4f6; color: #6b7280;
  border-radius: 6px; padding: 0.1rem 0.5rem; font-size: 0.75rem; font-weight: 600;
}

.cm__form { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.cm__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.cm__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
textarea.cm__input { resize: vertical; }
.cm__checkbox { display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; }
.cm__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.cm__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.cm__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.cm__btn--cancel { background: #f3f4f6; color: #374151; }
.cm__btn--save { background: #16a34a; color: #fff; }
.cm__btn--danger { background: #dc2626; color: #fff; }
.cm__btn:disabled { opacity: 0.6; }
.cm__delete {
  margin-top: 0.25rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: 1px solid #fecaca; background: #fff; color: #dc2626;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}

/* Dialoog */
.cm__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.cm__dialog { background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 360px; }
.cm__dialog h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.cm__dialog p { margin: 0 0 0.5rem; color: #4b5563; }
</style>
