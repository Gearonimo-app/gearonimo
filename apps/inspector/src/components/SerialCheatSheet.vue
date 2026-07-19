<!-- Spiekbriefje (uit klimkeurpro, wens Jos 2026-07-19): inklapbaar paneel
     met twee tabs -- (1) dag-/weeknummer omrekenen naar een datum (voor het
     aflezen van bouwjaren uit serienummers als Petzl YYDDD), (2) de
     SN-referentie per merk (voorbeeld + formaat). Zit in de keuring-wizard
     en op de SN-zoeken-pagina; dit component is de ene gedeelde bron. -->
<template>
  <details class="scs">
    <summary class="scs__summary">{{ $t('cheatSheet.title') }}</summary>
    <div class="scs__body">
      <div class="scs__tabs">
        <button class="scs__tab" :class="{ 'scs__tab--active': tab === 'dayweek' }" @click="tab = 'dayweek'">
          {{ $t('cheatSheet.tabDayWeek') }}
        </button>
        <button class="scs__tab" :class="{ 'scs__tab--active': tab === 'snref' }" @click="tab = 'snref'">
          {{ $t('cheatSheet.tabSnRef') }}
        </button>
      </div>

      <!-- Tab 1: dag/week omrekenen -->
      <div v-if="tab === 'dayweek'" class="scs__panel scs__panel--conv">
        <div class="scs__conv">
          <label class="scs__label">{{ $t('cheatSheet.dayToDate') }}</label>
          <div class="scs__row">
            <input v-model.number="day" type="number" min="1" max="366" :placeholder="$t('cheatSheet.dayPh')" class="scs__input scs__input--num" />
            <input v-model.number="dayYear" type="number" class="scs__input scs__input--year" />
            <span class="scs__eq">=</span>
            <span class="scs__result">{{ dayResult }}</span>
          </div>
        </div>
        <div class="scs__conv">
          <label class="scs__label">{{ $t('cheatSheet.weekToRange') }}</label>
          <div class="scs__row">
            <input v-model.number="week" type="number" min="1" max="53" :placeholder="$t('cheatSheet.weekPh')" class="scs__input scs__input--num" />
            <input v-model.number="weekYear" type="number" class="scs__input scs__input--year" />
            <span class="scs__eq">=</span>
            <span class="scs__result">{{ weekResult }}</span>
          </div>
        </div>
      </div>

      <!-- Tab 2: SN-referentie per merk -->
      <div v-else class="scs__panel">
        <input v-model="filter" class="scs__input scs__filter" :placeholder="$t('cheatSheet.filterPh')" />
        <p class="scs__legend">{{ $t('cheatSheet.legend') }}</p>
        <div class="scs__cards">
          <div v-for="(s, i) in filtered" :key="i" class="scs__card">
            <div class="scs__brand">{{ s.brand }}</div>
            <div class="scs__line">{{ $t('cheatSheet.example') }}: <code>{{ s.example }}</code></div>
            <div v-if="s.format" class="scs__line">{{ $t('cheatSheet.format') }}: <code>{{ s.format }}</code></div>
            <div v-if="s.note" class="scs__note">{{ s.note }}</div>
            <a v-if="s.link" :href="s.link" target="_blank" rel="noopener" class="scs__link">{{ $t('cheatSheet.manualLink') }}</a>
          </div>
        </div>
      </div>
    </div>
  </details>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { SN_REFERENCE } from '../data/snReference'

const { t, locale } = useI18n()

const tab = ref<'dayweek' | 'snref'>('dayweek')

// ---- dag/week omrekenen ----
const day = ref<number | null>(null)
const dayYear = ref<number>(new Date().getFullYear())
const week = ref<number | null>(null)
const weekYear = ref<number>(new Date().getFullYear())

function fmt(d: Date): string {
  return d.toLocaleDateString(locale.value === 'en' ? 'en-GB' : 'nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const dayResult = computed(() => {
  if (!day.value || day.value < 1 || day.value > 366 || !dayYear.value) return '—'
  const d = new Date(dayYear.value, 0, day.value)
  if (d.getFullYear() !== dayYear.value) return t('cheatSheet.invalidDay')
  return fmt(d)
})

// ISO-weekbereik (ma t/m zo): week 1 = de week met 4 januari erin.
const weekResult = computed(() => {
  if (!week.value || week.value < 1 || week.value > 53 || !weekYear.value) return '—'
  const jan4 = new Date(weekYear.value, 0, 4)
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (week.value - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${fmt(monday)} – ${fmt(sunday)}`
})

// ---- SN-referentie ----
const filter = ref('')
const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return SN_REFERENCE
  return SN_REFERENCE.filter((s) => s.brand.toLowerCase().includes(q))
})
</script>

<style scoped>
.scs { margin-bottom: 1rem; }
.scs__summary {
  cursor: pointer; user-select: none;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
  padding: 0.6rem 1rem; font-size: 0.88rem; color: #4b5563; font-weight: 600;
}
.scs[open] .scs__summary { border-radius: 10px 10px 0 0; border-bottom: none; }
.scs__body { background: #fff; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }

.scs__tabs { display: flex; border-bottom: 1px solid #e5e7eb; }
.scs__tab {
  flex: 1; border: none; background: none; cursor: pointer;
  padding: 0.55rem 1rem; font-size: 0.85rem; font-weight: 600; color: #6b7280;
  border-bottom: 2px solid transparent;
}
.scs__tab--active { color: #16a34a; border-bottom-color: #16a34a; }

.scs__panel { padding: 0.9rem 1rem; }
.scs__panel--conv { display: flex; gap: 1.25rem; flex-wrap: wrap; }
.scs__conv { flex: 1; min-width: 240px; }
.scs__label { display: block; font-size: 0.8rem; font-weight: 600; color: #374151; margin-bottom: 0.35rem; }
.scs__row { display: flex; align-items: center; gap: 0.4rem; }
.scs__input { padding: 0.45rem 0.6rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.88rem; font-family: inherit; }
.scs__input--num { width: 6.2rem; }
.scs__input--year { width: 5rem; }
.scs__eq { color: #9ca3af; font-size: 0.85rem; }
.scs__result { font-size: 0.9rem; font-weight: 700; color: #16a34a; min-width: 7rem; }

.scs__filter { max-width: 16rem; margin-bottom: 0.6rem; display: block; }
.scs__legend { font-size: 0.75rem; color: #9ca3af; margin: 0 0 0.6rem; }
.scs__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 0.6rem; }
.scs__card { padding: 0.6rem 0.8rem; background: #f9fafb; border: 1px solid #eee; border-radius: 8px; }
.scs__brand { font-weight: 700; font-size: 0.88rem; color: #166534; margin-bottom: 0.2rem; }
.scs__line { font-size: 0.78rem; color: #6b7280; }
.scs__line code { font-family: ui-monospace, monospace; color: #111827; font-size: 0.78rem; }
.scs__note { font-size: 0.72rem; color: #b45309; margin-top: 0.25rem; }
.scs__link { display: inline-block; margin-top: 0.3rem; font-size: 0.75rem; color: #16a34a; font-weight: 600; }
</style>
