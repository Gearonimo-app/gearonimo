<!-- SN-referentie per merk (voorbeeld + formaat, filterbaar) -- het
     deelcomponent van het spiekbriefje. Gebruikt in de keuring-wizard
     (uitklap op de dag/week-regel) en in SerialCheatSheet (SN zoeken). -->
<template>
  <div class="snp">
    <input v-model="filter" class="snp__input snp__filter" :placeholder="$t('cheatSheet.filterPh')" />
    <p class="snp__legend">{{ $t('cheatSheet.legend') }}</p>
    <div class="snp__cards">
      <div v-for="(s, i) in filtered" :key="i" class="snp__card">
        <div class="snp__brand">{{ s.brand }}</div>
        <div class="snp__line">{{ $t('cheatSheet.example') }}: <code>{{ s.example }}</code></div>
        <div v-if="s.format" class="snp__line">{{ $t('cheatSheet.format') }}: <code>{{ s.format }}</code></div>
        <div v-if="s.note" class="snp__note">{{ s.note }}</div>
        <a v-if="s.link" :href="s.link" target="_blank" rel="noopener" class="snp__link">{{ $t('cheatSheet.manualLink') }}</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { SN_REFERENCE } from '../data/snReference'

const filter = ref('')
const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return SN_REFERENCE
  return SN_REFERENCE.filter((s) => s.brand.toLowerCase().includes(q))
})
</script>

<style scoped>
.snp__input { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.88rem; font-family: inherit; }
.snp__filter { max-width: 16rem; margin-bottom: 0.6rem; display: block; }
.snp__legend { font-size: 0.75rem; color: #9ca3af; margin: 0 0 0.6rem; }
.snp__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.6rem; }
.snp__card { padding: 0.6rem 0.8rem; background: #f9fafb; border: 1px solid #eee; border-radius: 8px; }
.snp__brand { font-weight: 700; font-size: 0.88rem; color: #166534; margin-bottom: 0.2rem; }
.snp__line { font-size: 0.78rem; color: #6b7280; }
.snp__line code { font-family: ui-monospace, monospace; color: #111827; font-size: 0.78rem; }
.snp__note { font-size: 0.72rem; color: #b45309; margin-top: 0.25rem; }
.snp__link { display: inline-block; margin-top: 0.3rem; font-size: 0.75rem; color: #16a34a; font-weight: 600; }
</style>
