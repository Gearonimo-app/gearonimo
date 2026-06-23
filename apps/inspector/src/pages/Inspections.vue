<template>
  <div class="il">
    <header class="il__header">
      <button class="il__icon" @click="$router.push('/')">←</button>
      <h1>{{ $t('inspections.listTitle') }}</h1>
      <span class="il__icon"></span>
    </header>

    <div v-if="loading" class="il__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="il__state il__state--error">{{ error }}</div>

    <template v-else>
      <section v-if="drafts.length" class="il__section">
        <h2>{{ $t('inspections.drafts') }}</h2>
        <ul class="il__list">
          <li v-for="i in drafts" :key="i.id" class="il__item" @click="$router.push(`/inspections/${i.id}`)">
            <div class="il__name">{{ i.customer?.name }}</div>
            <div class="il__meta">{{ formatDate(i.inspection_date) }}</div>
            <span class="il__arrow">›</span>
          </li>
        </ul>
      </section>

      <section class="il__section">
        <h2>{{ $t('inspections.completed') }}</h2>
        <p v-if="!completed.length" class="il__state">{{ $t('inspections.empty') }}</p>
        <ul v-else class="il__list">
          <li v-for="i in completed" :key="i.id" class="il__item" @click="$router.push(`/customers/${i.customer_id}`)">
            <div class="il__name">{{ i.customer?.name }}</div>
            <div class="il__meta">{{ formatDate(i.inspection_date) }}</div>
            <span class="il__arrow">›</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'

interface InspectionRow {
  id: string
  customer_id: string
  inspection_date: string
  status: string
  customer: { name: string } | null
}

const inspections = ref<InspectionRow[]>([])
const loading = ref(true)
const error = ref('')

const drafts = computed(() => inspections.value.filter(i => i.status === 'draft'))
const completed = computed(() => inspections.value.filter(i => i.status === 'completed'))

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const inspector = await ensureInspector()
    const { data, error: err } = await supabase
      .from('inspections')
      .select('id, customer_id, inspection_date, status, customer:customers(name)')
      .eq('company_id', inspector.company_id)
      .order('inspection_date', { ascending: false })
    if (err) throw err
    inspections.value = (data ?? []) as unknown as InspectionRow[]
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.il { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.il__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
}
.il__header h1 { font-size: 1.2rem; margin: 0; }
.il__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }
.il__state { text-align: center; padding: 2rem 1rem; color: #666; }
.il__state--error { color: #dc2626; }
.il__section { padding: 1rem 1.25rem 0; }
.il__section h2 { font-size: 0.95rem; color: #374151; margin: 0.5rem 0; }
.il__list { list-style: none; margin: 0 0 0.5rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.il__item { padding: 1rem 1.25rem; display: flex; align-items: center; border-bottom: 1px solid #eee; cursor: pointer; }
.il__item:last-child { border-bottom: none; }
.il__item:active { background: #f9fafb; }
.il__name { font-weight: 600; flex: 1; }
.il__meta { font-size: 0.85rem; color: #666; flex: 1; }
.il__arrow { color: #999; font-size: 1.4rem; margin-left: 0.5rem; }
</style>
