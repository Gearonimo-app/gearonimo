<template>
  <div class="set">
    <AppHeader :title="headerTitle" @back="back" />

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
      <CompanyListing v-else-if="section === 'listing'" />
      <CatalogSettings v-else-if="section === 'catalog'" />
      <PlatformHeroSettings v-else-if="section === 'hero'" />
      <CompaniesAdmin v-else-if="section === 'companies'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import RejectionCodes from '../components/RejectionCodes.vue'
import CertificateSettings from '../components/CertificateSettings.vue'
import InspectorsSettings from '../components/InspectorsSettings.vue'
import ImportWizard from '../components/ImportWizard.vue'
import CompanyListing from '../components/CompanyListing.vue'
import CatalogSettings from '../components/CatalogSettings.vue'
import PlatformHeroSettings from '../components/PlatformHeroSettings.vue'
import CompaniesAdmin from '../components/CompaniesAdmin.vue'
import { ensureInspector } from '../composables/useInspections'
import { supabase } from '@gearonimo/core'

const router = useRouter()
const { t } = useI18n()

type SectionKey = 'rejection' | 'certificate' | 'inspectors' | 'import' | 'listing' | 'catalog' | 'hero' | 'companies'
interface SectionDef {
  key: SectionKey
  icon: string
  title: string
  desc: string
  ready: boolean
}

// De Catalogus-tegel verschijnt alleen voor een aangewezen curator
// (inspectors.can_curate_catalog) -- Jos vertrouwt niet elke keurmeester om
// de productcatalogus zelf compleet en correct in te vullen (besluit
// 2026-07-03).
const canCurateCatalog = ref(false)

// De hero-foto-tegel is platform-breed (niet per bedrijf) en dus alleen
// voor de platform-admin -- zie migratie
// 20260714_platform_hero_and_dashboard_stat.sql.
const isPlatformAdmin = ref(false)

// Beheerdersrechten per keurbedrijf (besluit Jos 2026-07-18): de database
// dwingt dit af (migratie 20260739); hier verbergen we de menukeuzes zodat
// een gewone keurmeester geen deuren ziet die toch op slot zitten.
const isCompanyAdmin = ref(false)

// false = platform-admin zonder keurmeester-rij (mag hier wel komen via de
// router-uitzondering in main.ts, maar ziet alleen de platform-tegels).
const isInspector = ref(true)

const sections = computed<SectionDef[]>(() => {
  // Beheerder-secties (afkeurcodes, certificaat, keurmeesters, vermelding)
  // alleen tonen voor een beheerder; importeren mag elke keurmeester. Een
  // platform-admin zonder keurmeester-rij (besluit Jos 2026-07-19) ziet
  // alleen de platform-tegels: Catalogus, Hero-foto en Bedrijven.
  const base: SectionDef[] = [
    ...(isCompanyAdmin.value ? [
      { key: 'rejection',   icon: '⚖️', title: 'settings.rejection.menuTitle',   desc: 'settings.rejection.menuDesc',   ready: true },
      { key: 'certificate', icon: '📄', title: 'settings.certificate.menuTitle', desc: 'settings.certificate.menuDesc', ready: true },
      { key: 'inspectors',  icon: '👷', title: 'settings.inspectors.menuTitle',  desc: 'settings.inspectors.menuDesc',  ready: true },
      { key: 'listing',     icon: '📍', title: 'settings.listing.menuTitle',     desc: 'settings.listing.menuDesc',     ready: true },
    ] as SectionDef[] : []),
    ...(isInspector.value ? [
      { key: 'import',      icon: '📥', title: 'settings.import.menuTitle',      desc: 'settings.import.menuDesc',      ready: true },
    ] as SectionDef[] : []),
  ]
  if (canCurateCatalog.value || isPlatformAdmin.value) {
    base.push({ key: 'catalog', icon: '📚', title: 'settings.catalog.menuTitle', desc: 'settings.catalog.menuDesc', ready: true })
  }
  if (isPlatformAdmin.value) {
    base.push({ key: 'hero', icon: '🖼️', title: 'settings.hero.menuTitle', desc: 'settings.hero.menuDesc', ready: true })
    base.push({ key: 'companies', icon: '🏢', title: 'settings.companies.menuTitle', desc: 'settings.companies.menuDesc', ready: true })
  }
  return base
})

const section = ref<SectionKey | null>(null)

const headerTitle = computed(() => {
  if (section.value === 'rejection') return t('settings.rejection.menuTitle')
  if (section.value === 'certificate') return t('settings.certificate.menuTitle')
  if (section.value === 'inspectors') return t('settings.inspectors.menuTitle')
  if (section.value === 'import') return t('settings.import.menuTitle')
  if (section.value === 'listing') return t('settings.listing.menuTitle')
  if (section.value === 'catalog') return t('settings.catalog.menuTitle')
  if (section.value === 'hero') return t('settings.hero.menuTitle')
  if (section.value === 'companies') return t('settings.companies.menuTitle')
  return t('settings.title')
})

function open(s: SectionDef) {
  if (s.ready) section.value = s.key
}

onMounted(async () => {
  try {
    const inspector = await ensureInspector()
    isInspector.value = true
    canCurateCatalog.value = !!inspector.can_curate_catalog
    isCompanyAdmin.value = !!inspector.is_admin
  } catch {
    isInspector.value = false
  }
  const { data } = await supabase.rpc('is_platform_admin')
  isPlatformAdmin.value = !!data
})

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
