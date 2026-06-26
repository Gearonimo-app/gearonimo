<template>
  <div class="set">
    <header class="set__header">
      <button class="set__icon" @click="back">←</button>
      <h1>{{ headerTitle }}</h1>
      <span class="set__icon"></span>
    </header>

    <!-- Overzicht van instellingen-onderdelen -->
    <ul v-if="section === null" class="set__menu">
      <li
        v-for="s in sections"
        :key="s.key"
        class="set__row"
        :class="{ 'set__row--disabled': !s.ready }"
        @click="open(s)"
      >
        <span class="set__row-icon">{{ s.icon }}</span>
        <div class="set__row-body">
          <div class="set__row-title">{{ $t(s.title) }}</div>
          <div class="set__row-desc">{{ $t(s.desc) }}</div>
        </div>
        <span v-if="!s.ready" class="set__soon">{{ $t('settings.soon') }}</span>
        <span v-else class="set__chev">›</span>
      </li>
    </ul>

    <!-- Gekozen onderdeel -->
    <div v-else class="set__section">
      <RejectionCodes v-if="section === 'rejection'" />
      <CertificateSettings v-else-if="section === 'certificate'" />
      <InspectorsSettings v-else-if="section === 'inspectors'" />
      <ImportWizard v-else-if="section === 'import'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import RejectionCodes from '../components/RejectionCodes.vue'
import CertificateSettings from '../components/CertificateSettings.vue'
import InspectorsSettings from '../components/InspectorsSettings.vue'
import ImportWizard from '../components/ImportWizard.vue'

const router = useRouter()
const { t } = useI18n()

type SectionKey = 'rejection' | 'certificate' | 'inspectors' | 'import'
interface SectionDef {
  key: SectionKey
  icon: string
  title: string
  desc: string
  ready: boolean
}

const sections: SectionDef[] = [
  { key: 'rejection',   icon: '⚖️', title: 'settings.rejection.menuTitle',   desc: 'settings.rejection.menuDesc',   ready: true  },
  { key: 'certificate', icon: '📄', title: 'settings.certificate.menuTitle', desc: 'settings.certificate.menuDesc', ready: true  },
  { key: 'inspectors',  icon: '👷', title: 'settings.inspectors.menuTitle',  desc: 'settings.inspectors.menuDesc',  ready: true  },
  { key: 'import',      icon: '📥', title: 'settings.import.menuTitle',      desc: 'settings.import.menuDesc',      ready: true  },
]

const section = ref<SectionKey | null>(null)

const headerTitle = computed(() => {
  if (section.value === 'rejection') return t('settings.rejection.menuTitle')
  if (section.value === 'certificate') return t('settings.certificate.menuTitle')
  if (section.value === 'inspectors') return t('settings.inspectors.menuTitle')
  if (section.value === 'import') return t('settings.import.menuTitle')
  return t('settings.title')
})

function open(s: SectionDef) {
  if (s.ready) section.value = s.key
}

function back() {
  if (section.value !== null) section.value = null
  else router.push('/')
}
</script>

<style scoped>
.set { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.set__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem;
}
.set__header h1 { font-size: 1.2rem; margin: 0; }
.set__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }

.set__menu { list-style: none; margin: 1.25rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.set__row {
  display: flex; align-items: center; gap: 0.9rem;
  padding: 1rem; border-bottom: 1px solid #eee; cursor: pointer;
}
.set__row:last-child { border-bottom: none; }
.set__row:active { background: #f9fafb; }
.set__row--disabled { cursor: default; }
.set__row--disabled:active { background: none; }
.set__row-icon { font-size: 1.5rem; line-height: 1; }
.set__row-body { flex: 1; min-width: 0; }
.set__row-title { font-weight: 600; }
.set__row-desc { font-size: 0.85rem; color: #6b7280; margin-top: 0.1rem; }
.set__chev { color: #9ca3af; font-size: 1.4rem; }
.set__soon {
  font-size: 0.72rem; font-weight: 600; color: #6b7280;
  background: #f3f4f6; border-radius: 6px; padding: 0.15rem 0.5rem;
}

.set__section { padding: 1.25rem; }
</style>
