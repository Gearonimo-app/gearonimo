<!-- Keuring-aanvragen (leadmotor): klanten die zich via de openbare kaart of
     naam-zoeken bij dit keurbedrijf aanmelden. De keurmeester keurt goed
     (koppeling wordt actief, eventuele oude koppeling van de klant beëindigd)
     of af. Zie migratie 20260717_inspection_requests_leadmotor.sql. -->
<template>
  <div class="rq">
    <header class="rq__header">
      <button class="rq__home" :title="$t('common.back')" @click="$router.push('/')">🏠</button>
      <h1>{{ $t('requests.title') }}</h1>
    </header>

    <div v-if="loading" class="rq__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="rq__state rq__state--error">{{ error }}</div>
    <p v-else-if="!items.length" class="rq__state">{{ $t('requests.empty') }}</p>

    <ul v-else class="rq__list">
      <li v-for="r in items" :key="r.id" class="rq__item">
        <div class="rq__body">
          <div class="rq__name">{{ r.customer_name }}</div>
          <div class="rq__meta">
            {{ $t(`requests.source.${r.source}`) }} · {{ formatDate(r.created_at) }}
          </div>
          <p v-if="r.message" class="rq__message">“{{ r.message }}”</p>
        </div>
        <div class="rq__actions">
          <button class="rq__btn rq__btn--decline" :disabled="busyId === r.id" @click="decline(r)">
            {{ $t('requests.decline') }}
          </button>
          <button class="rq__btn rq__btn--accept" :disabled="busyId === r.id" @click="accept(r)">
            {{ $t('requests.accept') }}
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, errorMessage } from '@gearonimo/core'

const { t } = useI18n()

interface RequestRow {
  id: string
  customer_id: string
  customer_name: string
  source: string
  message: string | null
  created_at: string
}

const items = ref<RequestRow[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<string | null>(null)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase.rpc('company_inspection_requests')
    if (err) throw err
    items.value = (data ?? []) as RequestRow[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

async function accept(r: RequestRow) {
  if (!confirm(t('requests.acceptConfirm', { customer: r.customer_name }))) return
  busyId.value = r.id
  try {
    const { error: err } = await supabase.rpc('accept_inspection_request', { p_request_id: r.id })
    if (err) throw err
    items.value = items.value.filter((x) => x.id !== r.id)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busyId.value = null
  }
}

async function decline(r: RequestRow) {
  busyId.value = r.id
  try {
    const { error: err } = await supabase.rpc('decline_inspection_request', { p_request_id: r.id })
    if (err) throw err
    items.value = items.value.filter((x) => x.id !== r.id)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busyId.value = null
  }
}

onMounted(load)
</script>

<style scoped>
.rq { min-height: 100vh; background: #f0f4f8; }
.rq__header {
  background: #1a3a2a; color: #fff; display: flex; align-items: center; gap: 0.75rem;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.rq__header h1 { font-size: 1.15rem; margin: 0; }
.rq__home { background: none; border: none; color: #fff; font-size: 1.2rem; cursor: pointer; }
.rq__state { text-align: center; padding: 2.5rem 1rem; color: #666; }
.rq__state--error { color: #dc2626; }
.rq__list { list-style: none; margin: 0; padding: 1.25rem; max-width: 640px; margin-inline: auto; display: flex; flex-direction: column; gap: 0.75rem; }
.rq__item { background: #fff; border-radius: 12px; padding: 1rem; }
.rq__name { font-weight: 700; font-size: 1.05rem; }
.rq__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
.rq__message { margin: 0.5rem 0 0; color: #374151; font-style: italic; }
.rq__actions { display: flex; gap: 0.6rem; margin-top: 0.85rem; }
.rq__btn { flex: 1; padding: 0.7rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 700; cursor: pointer; }
.rq__btn--decline { background: #f3f4f6; color: #6b7280; }
.rq__btn--accept { background: #16a34a; color: #fff; }
.rq__btn:disabled { opacity: 0.6; }
</style>
