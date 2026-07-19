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
        <div v-if="data.inspector_name"><dt>{{ $t('verify.inspector') }}</dt><dd>{{ data.inspector_name }}</dd></div>
      </dl>

      <!-- Alleen bewust gedeelde kwalificaties (public_path gezet) komen uit
           de RPC; de privé-bucket blijft dicht. -->
      <template v-if="data.qualifications?.length">
        <h2>{{ $t('verify.qualifications') }}</h2>
        <ul class="vc__quals">
          <li v-for="(q, i) in data.qualifications" :key="i">
            <span class="vc__qual-name">{{ q.name }}</span>
            <span v-if="q.number" class="vc__qual-meta">{{ $t('verify.qualNumber') }}: {{ q.number }}</span>
            <span v-if="q.valid_until" class="vc__qual-meta">{{ $t('verify.qualValidUntil') }}: {{ formatDate(q.valid_until) }}</span>
            <a :href="qualUrl(q)" target="_blank" rel="noopener" class="vc__qual-link">{{ $t('verify.qualView') }}</a>
          </li>
        </ul>
      </template>

      <h2>{{ $t('verify.items') }}</h2>
      <!-- Expliciet op 'rejected' toetsen i.p.v. "alles wat niet passed is":
           de RPC laat 'not_assessed'-items al weg (zelfde regel als de PDF),
           maar dit voorkomt dat een onverwachte/toekomstige statuswaarde hier
           alsnog als "afgekeurd" oogt. -->
      <ul class="vc__items">
        <li v-for="(it, i) in data.items" :key="i" :class="it.result === 'rejected' ? 'vc__item--fail' : 'vc__item--pass'">
          {{ it.result === 'rejected' ? '❌' : '✅' }} {{ it.label }}
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

interface VerifyQualification {
  name: string
  number: string | null
  valid_until: string | null
  public_path: string
}

interface VerifyResult {
  number: string
  issued_at: string
  pdf_hash: string
  storage_path: string
  company_name: string
  customer_name: string
  inspection_date: string
  inspector_name: string | null
  qualifications: VerifyQualification[] | null
  items: { label: string; serial_number: string | null; result: string; next_due: string | null }[]
}

const data = ref<VerifyResult | null>(null)
const loading = ref(true)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function qualUrl(q: VerifyQualification): string {
  return supabase.storage.from('branding').getPublicUrl(q.public_path).data.publicUrl
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
.vc__quals { list-style: none; margin: 0; padding: 0; }
.vc__quals li { padding: 0.5rem 0; border-bottom: 1px solid #eee; display: flex; flex-wrap: wrap; gap: 0.35rem 0.75rem; align-items: baseline; }
.vc__qual-name { font-weight: 600; }
.vc__qual-meta { color: #6b7280; font-size: 0.82rem; }
.vc__qual-link { color: #16a34a; font-weight: 600; font-size: 0.85rem; margin-left: auto; white-space: nowrap; }
</style>
