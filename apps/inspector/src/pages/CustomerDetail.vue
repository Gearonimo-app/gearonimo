<template>
  <div class="customer-detail">
    <header class="customer-detail__header">
      <button class="customer-detail__back" @click="$router.push('/customers')">← {{ $t('common.back') }}</button>
      <h1>{{ customer?.name }}</h1>
    </header>

    <div v-if="loading" class="customer-detail__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="customer-detail__state customer-detail__state--error">{{ error }}</div>

    <template v-else-if="customer">
      <div class="customer-detail__contact">
        <p v-if="customer.address || customer.city">📍 {{ [customer.address, customer.city].filter(Boolean).join(', ') }}</p>
        <p v-if="customer.phone">📞 {{ customer.phone }}</p>
        <p v-if="customer.email">✉️ {{ customer.email }}</p>
      </div>

      <button class="customer-detail__primary" @click="startOrResume">
        ▶ {{ $t('customerDetail.startInspection') }}
      </button>

      <nav class="customer-detail__tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="customer-detail__tab"
          :class="{ 'customer-detail__tab--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ $t(tab.label) }}
        </button>
      </nav>

      <section v-if="activeTab === 'articles'" class="customer-detail__panel">
        <p class="customer-detail__empty">{{ $t('customerDetail.articlesEmpty') }}</p>
      </section>

      <section v-else-if="activeTab === 'history'" class="customer-detail__panel">
        <p class="customer-detail__empty">{{ $t('customerDetail.historyEmpty') }}</p>
      </section>

      <section v-else class="customer-detail__panel">
        <dl class="customer-detail__data">
          <dt>{{ $t('customers.fields.name') }}</dt><dd>{{ customer.name }}</dd>
          <dt>{{ $t('customers.fields.address') }}</dt><dd>{{ customer.address || '—' }}</dd>
          <dt>{{ $t('customers.fields.city') }}</dt><dd>{{ customer.city || '—' }}</dd>
          <dt>{{ $t('customers.fields.phone') }}</dt><dd>{{ customer.phone || '—' }}</dd>
          <dt>{{ $t('customers.fields.email') }}</dt><dd>{{ customer.email || '—' }}</dd>
        </dl>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '@gearonimo/core'

interface Customer {
  id: string
  name: string
  address: string | null
  city: string | null
  phone: string | null
  email: string | null
}

const route = useRoute()
const router = useRouter()

const customer = ref<Customer | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref<'articles' | 'history' | 'data'>('articles')

const tabs = [
  { key: 'articles', label: 'customerDetail.tabs.articles' },
  { key: 'history', label: 'customerDetail.tabs.history' },
  { key: 'data', label: 'customerDetail.tabs.data' },
] as const

async function load() {
  loading.value = true
  error.value = ''
  const id = route.params.id as string
  const { data, error: err } = await supabase
    .from('customers')
    .select('id, name, address, city, phone, email')
    .eq('id', id)
    .single()
  if (err) { error.value = err.message } else { customer.value = data }
  loading.value = false
}

function startOrResume() {
  // Keuring-wizard volgt in een volgende stap (BOUWPLAN fase 2).
  router.push(`/inspection/new?customer=${route.params.id}`)
}

onMounted(load)
</script>

<style scoped>
.customer-detail { min-height: 100vh; background: #f0f4f8; }
.customer-detail__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; gap: 1rem;
  padding: 1rem 1.25rem;
}
.customer-detail__header h1 { font-size: 1.2rem; margin: 0; flex: 1; }
.customer-detail__back { background: none; border: none; color: #fff; font-size: 1rem; cursor: pointer; padding: 0.25rem 0.5rem; }
.customer-detail__state { text-align: center; padding: 3rem 1rem; color: #666; }
.customer-detail__state--error { color: #dc2626; }
.customer-detail__contact { padding: 1rem 1.25rem 0; color: #444; font-size: 0.95rem; }
.customer-detail__contact p { margin: 0.25rem 0; }
.customer-detail__primary {
  display: block; width: calc(100% - 2.5rem); margin: 1rem 1.25rem;
  background: #16a34a; color: #fff; border: none; border-radius: 12px;
  padding: 1rem; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.customer-detail__primary:active { transform: scale(0.99); }
.customer-detail__tabs { display: flex; border-bottom: 1px solid #ddd; padding: 0 1.25rem; gap: 1.5rem; }
.customer-detail__tab {
  background: none; border: none; padding: 0.75rem 0; font-size: 0.95rem; color: #666; cursor: pointer;
  border-bottom: 2px solid transparent;
}
.customer-detail__tab--active { color: #1a3a2a; font-weight: 600; border-bottom-color: #16a34a; }
.customer-detail__panel { padding: 1.25rem; }
.customer-detail__empty { color: #888; text-align: center; padding: 2rem 0; }
.customer-detail__data { margin: 0; }
.customer-detail__data dt { font-size: 0.8rem; color: #888; margin-top: 0.75rem; }
.customer-detail__data dd { margin: 0.1rem 0 0; font-size: 1rem; color: #222; }
</style>
