<template>
  <div class="customers">
    <header class="customers__header">
      <button class="customers__back" @click="$router.push('/')">← Terug</button>
      <h1>{{ $t('customers.title') }}</h1>
      <button class="customers__add" @click="showAdd = true">+</button>
    </header>

    <div class="customers__search">
      <input
        v-model="query"
        type="search"
        :placeholder="$t('customers.searchPlaceholder')"
        class="customers__search-input"
      />
    </div>

    <div v-if="loading" class="customers__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="customers__state customers__state--error">{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="customers__state">{{ $t('customers.empty') }}</div>

    <ul v-else class="customers__list">
      <li
        v-for="c in filtered"
        :key="c.id"
        class="customers__item"
        @click="$router.push(`/customers/${c.id}`)"
      >
        <div class="customers__name">{{ c.name }}</div>
        <div class="customers__meta">{{ c.city }} · {{ c.phone }}</div>
        <span class="customers__arrow">›</span>
      </li>
    </ul>

    <!-- Nieuw klant formulier -->
    <div v-if="showAdd" class="customers__overlay" @click.self="showAdd = false">
      <div class="customers__form">
        <h2>{{ $t('customers.addTitle') }}</h2>
        <input v-model="form.name"    :placeholder="$t('customers.fields.name')"    class="customers__input" />
        <input v-model="form.address" :placeholder="$t('customers.fields.address')" class="customers__input" />
        <input v-model="form.city"    :placeholder="$t('customers.fields.city')"    class="customers__input" />
        <input v-model="form.phone"   :placeholder="$t('customers.fields.phone')"   class="customers__input" type="tel" />
        <input v-model="form.email"   :placeholder="$t('customers.fields.email')"   class="customers__input" type="email" />
        <p v-if="formError" class="customers__form-error">{{ formError }}</p>
        <div class="customers__form-actions">
          <button class="customers__btn customers__btn--cancel" @click="showAdd = false">{{ $t('common.cancel') }}</button>
          <button class="customers__btn customers__btn--save" :disabled="saving" @click="saveCustomer">
            {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useSupabase } from '../composables/useSupabase'

const { supabase } = useSupabase()

interface Customer {
  id: string
  name: string
  city: string | null
  phone: string | null
  email: string | null
}

const customers = ref<Customer[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const showAdd = ref(false)
const saving = ref(false)
const formError = ref('')

const form = ref({ name: '', address: '', city: '', phone: '', email: '' })

const filtered = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return customers.value
  return customers.value.filter(c =>
    [c.name, c.city, c.phone, c.email].some(v => v?.toLowerCase().includes(q))
  )
})

async function load() {
  loading.value = true
  error.value = ''
  const { data, error: err } = await supabase
    .from('customers')
    .select('id, name, city, phone, email')
    .order('name')
  if (err) { error.value = err.message } else { customers.value = data ?? [] }
  loading.value = false
}

async function saveCustomer() {
  if (!form.value.name.trim()) { formError.value = 'Naam is verplicht'; return }
  saving.value = true
  formError.value = ''
  const { error: err } = await supabase.from('customers').insert({
    name: form.value.name.trim(),
    address: form.value.address || null,
    city: form.value.city || null,
    phone: form.value.phone || null,
    email: form.value.email || null,
  })
  saving.value = false
  if (err) { formError.value = err.message; return }
  showAdd.value = false
  form.value = { name: '', address: '', city: '', phone: '', email: '' }
  await load()
}

onMounted(load)
</script>

<style scoped>
.customers { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }

.customers__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
}
.customers__header h1 { font-size: 1.2rem; margin: 0; }
.customers__back, .customers__add {
  background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem;
}

.customers__search { padding: 1rem 1.25rem 0.5rem; }
.customers__search-input {
  width: 100%; padding: 0.75rem 1rem; border-radius: 10px;
  border: 1px solid #ddd; font-size: 1rem; box-sizing: border-box;
}

.customers__state { text-align: center; padding: 3rem 1rem; color: #666; }
.customers__state--error { color: #dc2626; }

.customers__list { list-style: none; margin: 0.5rem 0 0; padding: 0; }
.customers__item {
  background: #fff; border-bottom: 1px solid #eee;
  padding: 1rem 1.25rem; display: flex; align-items: center; cursor: pointer;
}
.customers__item:active { background: #f9fafb; }
.customers__name { font-weight: 600; flex: 1; }
.customers__meta { font-size: 0.85rem; color: #666; margin-top: 0.2rem; flex: 2; }
.customers__arrow { color: #999; font-size: 1.4rem; margin-left: 0.5rem; }

/* Overlay / formulier */
.customers__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: flex-end; z-index: 100;
}
.customers__form {
  background: #fff; width: 100%; border-radius: 16px 16px 0 0;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.customers__form h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.customers__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box;
}
.customers__form-error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.customers__form-actions { display: flex; gap: 0.75rem; margin-top: 0.5rem; }
.customers__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.customers__btn--cancel { background: #f3f4f6; color: #374151; }
.customers__btn--save { background: #16a34a; color: #fff; }
.customers__btn--save:disabled { opacity: 0.6; }
</style>
