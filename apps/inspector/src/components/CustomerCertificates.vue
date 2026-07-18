<template>
  <!-- Certificatenoverzicht per klant (wens Jos 2026-07-18): alle uitgegeven
       certificaten van deze klant op één plek, zonder langs artikelen en
       medewerkers te hoeven scrollen. Inklapbaar, standaard dicht -- zelfde
       patroon als de blokken Medewerkers en Artikelen op deze pagina. -->
  <section class="cc">
    <button type="button" class="cc__head" @click="open = !open">
      <span class="cc__chev">{{ open ? '▾' : '▸' }}</span>
      <h2>{{ $t('certList.title') }}<span v-if="!loading && !error" class="cc__count">({{ certs.length }})</span></h2>
    </button>

    <template v-if="open">
      <div v-if="!isOnline" class="cc__state">{{ $t('certList.onlineOnly') }}</div>
      <div v-else-if="loading" class="cc__state">{{ $t('common.loading') }}</div>
      <div v-else-if="error" class="cc__state cc__state--error">{{ error }}</div>
      <p v-else-if="!certs.length" class="cc__state">{{ $t('certList.empty') }}</p>

      <ul v-else class="cc__list">
        <!-- Rij klikt door naar de keuring (zelfde gedrag als de keuringen-
             lijst); de PDF-knop opent het certificaat direct. -->
        <li v-for="c in certs" :key="c.inspection_id" class="cc__item" @click="$router.push(`/inspections/${c.inspection_id}`)">
          <div class="cc__number">{{ c.number }}</div>
          <div class="cc__date">{{ formatDate(c.inspection.inspection_date) }}</div>
          <button type="button" class="cc__pdf" :title="$t('certList.openPdf')" @click.stop="openPdf(c)">PDF</button>
          <span class="cc__arrow">›</span>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase, errorMessage, useOnline } from '@gearonimo/core'

const props = defineProps<{ customerId: string }>()
const { isOnline } = useOnline()

interface CertRow {
  number: string
  storage_path: string
  inspection_id: string
  inspection: { inspection_date: string }
}

const certs = ref<CertRow[]>([])
const loading = ref(true)
const error = ref('')
const open = ref(false)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })
}

function openPdf(c: CertRow) {
  const { data } = supabase.storage.from('certificates').getPublicUrl(c.storage_path)
  window.open(data.publicUrl, '_blank')
}

onMounted(async () => {
  if (!isOnline.value) {
    loading.value = false
    return
  }
  try {
    // !inner zodat de customer_id-filter op de gejoinde keuring werkt en
    // certificaten zonder (leesbare) keuring niet als losse rijen verschijnen.
    const { data, error: err } = await supabase
      .from('certificates')
      .select('number, storage_path, inspection_id, inspection:inspections!inner(customer_id, inspection_date)')
      .eq('inspection.customer_id', props.customerId)
      .order('issued_at', { ascending: false })
    if (err) throw err
    certs.value = (data ?? []) as unknown as CertRow[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.cc { margin-top: 1.25rem; }
.cc__head {
  display: flex; align-items: center; gap: 0.4rem; width: 100%;
  background: none; border: none; padding: 0; cursor: pointer; text-align: left;
}
.cc__head h2 { font-size: 1rem; margin: 0; }
.cc__chev { font-size: 0.9rem; color: #888; width: 1rem; }
.cc__count { font-weight: normal; color: #888; margin-left: 0.35rem; }
.cc__state { padding: 0.75rem 0; color: #666; font-size: 0.9rem; }
.cc__state--error { color: #b00020; }
.cc__list { list-style: none; margin: 0.5rem 0 0; padding: 0; }
.cc__item {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.25rem; border-bottom: 1px solid #eee; cursor: pointer;
}
.cc__number { font-family: ui-monospace, monospace; font-size: 0.85rem; flex: 1; }
.cc__date { font-size: 0.85rem; color: #666; }
.cc__pdf {
  border: 1px solid #ccc; background: #fff; border-radius: 6px;
  padding: 0.25rem 0.55rem; font-size: 0.8rem; cursor: pointer;
}
.cc__arrow { color: #bbb; }
</style>
