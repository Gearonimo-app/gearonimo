<template>
  <div class="vc">
    <div v-if="loading" class="vc__state">{{ $t('common.loading') }}</div>
    <div v-else-if="!data" class="vc__state vc__state--error">{{ $t('verify.notFound') }}</div>

    <div v-else class="vc__card">
      <p class="vc__badge">✅ {{ $t('verify.authentic') }}</p>
      <h1>{{ data.company_name }}</h1>
      <dl class="vc__details">
        <div><dt>{{ $t('verify.number') }}</dt><dd>{{ data.number }}</dd></div>
        <div><dt>{{ $t('verify.customer') }}</dt><dd>{{ data.customer_name }}</dd></div>
        <div><dt>{{ $t('verify.date') }}</dt><dd>{{ formatDate(data.inspection_date) }}</dd></div>
        <div><dt>{{ $t('verify.issuedAt') }}</dt><dd>{{ formatDate(data.issued_at) }}</dd></div>
      </dl>

      <h2>{{ $t('verify.items') }}</h2>
      <ul class="vc__items">
        <li v-for="(it, i) in data.items" :key="i" :class="it.result === 'passed' ? 'vc__item--pass' : 'vc__item--fail'">
          {{ it.result === 'passed' ? '✅' : '❌' }} {{ it.label }}
          <span v-if="it.serial_number" class="vc__sn">SN {{ it.serial_number }}</span>
        </li>
      </ul>

      <p class="vc__hash">{{ $t('verify.hash') }}: <code>{{ data.pdf_hash.slice(0, 16) }}…</code></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '@gearonimo/core'

const route = useRoute()
const token = route.params.token as string

interface VerifyResult {
  number: string
  issued_at: string
  pdf_hash: string
  storage_path: string
  company_name: string
  customer_name: string
  inspection_date: string
  items: { label: string; serial_number: string | null; result: string; next_due: string | null }[]
}

const data = ref<VerifyResult | null>(null)
const loading = ref(true)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

onMounted(async () => {
  const { data: result } = await supabase.rpc('verify_certificate', { token })
  data.value = (result as VerifyResult) ?? null
  loading.value = false
})
</script>

<style scoped>
.vc { min-height: 100vh; background: #f0f4f8; display: flex; justify-content: center; padding: 2rem 1rem; }
.vc__state { padding: 3rem 1rem; color: #666; text-align: center; }
.vc__state--error { color: #dc2626; }
.vc__card { background: #fff; border-radius: 14px; padding: 1.5rem; max-width: 480px; width: 100%; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }
.vc__badge { color: #16a34a; font-weight: 700; margin: 0 0 0.5rem; }
.vc__card h1 { margin: 0 0 1rem; font-size: 1.2rem; }
.vc__card h2 { font-size: 1rem; margin: 1.25rem 0 0.5rem; }
.vc__details { margin: 0; }
.vc__details div { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #eee; }
.vc__details dt { color: #6b7280; }
.vc__items { list-style: none; margin: 0; padding: 0; }
.vc__items li { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
.vc__item--fail { color: #b91c1c; }
.vc__sn { color: #6b7280; font-size: 0.85rem; margin-left: 0.5rem; }
.vc__hash { color: #9ca3af; font-size: 0.8rem; margin-top: 1.25rem; }
</style>
