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
    <CustomerFormModal v-if="showAdd" @saved="onCustomerSaved" @cancel="showAdd = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@gearonimo/core'
import CustomerFormModal from '../components/CustomerFormModal.vue'

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

async function onCustomerSaved() {
  showAdd.value = false
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
</style>
