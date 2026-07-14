<template>
  <div class="home" :style="heroStyle">
    <div class="home__scrim"></div>

    <!-- Header -->
    <header class="home__header">
      <div class="home__header-row">
        <div class="home__identity">
          <h1 class="home__app-name">{{ $t('home.appName') }}</h1>
          <!-- Ingelogd account tonen: Jos miste tijdens het testen (stap 14)
               waar hij kon zien met welk account hij was ingelogd. -->
          <span v-if="user?.email" class="home__account" :title="user.email">👤 {{ user.email }}</span>
        </div>
        <button class="home__signout" @click="onSignOut">{{ $t('home.signOut') }}</button>
      </div>
      <!-- Eén melding, geen statistiek-etalage (UX-FLOW §4.4): certificaten
           die binnen 30 dagen verlopen, actionable i.p.v. een vanity-teller. -->
      <div class="home__status" :class="{ 'home__status--attention': upcomingReinspections > 0 }">
        <span class="home__status-dot" :class="{ 'home__status-dot--attention': upcomingReinspections > 0 }"></span>
        {{ statusText }}
      </div>
    </header>

    <!-- Klant-account in de Pro-app beland (zelfde domein, gedeelde sessie):
         duidelijk zeggen wat er aan de hand is i.p.v. lege lijsten en vage
         fouten -- met de weg naar de juiste app en een uitlogknop. -->
    <div v-if="notInspector" class="home__wrong-app">
      <p>{{ $t('home.notInspector') }}</p>
      <a class="home__wrong-app-link" href="/portal/">{{ $t('home.goToCustomerApp') }}</a>
    </div>

    <!-- Zoekbalk + tegelmenu: alleen voor een echt keurmeester-account.
         Een klant-account krijgt hierboven al de melding + link naar
         /portal/ -- de rest van de Pro-app hoeft dan niet zichtbaar te
         zijn (RLS blokkeerde de dáta al, maar de schermen zelf bleven
         klikbaar, wat een klant-account de indruk gaf hier iets te kunnen). -->
    <template v-if="!notInspector">
      <div class="home__body">
        <div class="home__search">
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="$t('home.searchPlaceholder')"
            class="home__search-input"
            @input="onSearch"
          />
        </div>

        <nav class="home__grid">
          <button
            v-for="tile in tiles"
            :key="tile.key"
            class="home__tile"
            @click="navigate(tile.route)"
          >
            <span v-if="tile.key === 'requests' && pendingRequests > 0" class="home__tile-badge">{{ pendingRequests }}</span>
            <span class="home__tile-icon">{{ tile.icon }}</span>
            <span class="home__tile-label">{{ $t(tile.label) }}</span>
          </button>
        </nav>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth, supabase } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'

const router = useRouter()
const { t } = useI18n()
const { signOut, user } = useAuth()
const searchQuery = ref('')

const notInspector = ref(false)
const pendingRequests = ref(0)

async function onSignOut() {
  await signOut()
  router.push('/login')
}

// Platform-brede hero-foto (UX-FLOW.md §7): crowdsourced sfeerfoto, wisselt
// per kwartaal via Instellingen -> Hero-foto (platform-admin only). Geen
// foto ingesteld = nette fallback op de bestaande donkergroene kleur.
const heroMobileUrl = ref<string | null>(null)
const heroDesktopUrl = ref<string | null>(null)

const heroStyle = computed(() => {
  const url = heroDesktopUrl.value ?? heroMobileUrl.value
  if (!url) return {}
  return { '--home-hero-mobile': `url("${heroMobileUrl.value ?? url}")`, '--home-hero-desktop': `url("${url}")` }
})

async function loadHeroPhoto() {
  const { data } = await supabase
    .from('platform_settings')
    .select('hero_photo_mobile_path, hero_photo_desktop_path')
    .eq('id', true)
    .maybeSingle()
  if (data?.hero_photo_mobile_path) {
    heroMobileUrl.value = supabase.storage.from('branding').getPublicUrl(data.hero_photo_mobile_path).data.publicUrl
  }
  if (data?.hero_photo_desktop_path) {
    heroDesktopUrl.value = supabase.storage.from('branding').getPublicUrl(data.hero_photo_desktop_path).data.publicUrl
  }
}

// Stil checken of dit account wel een keurmeester is: sinds de klant-app
// (zelfde domein, gedeelde sessie) kan een klant-account hier belanden en
// zag dan alleen lege lijsten. ensureInspector werpt dan een fout.
onMounted(async () => {
  loadHeroPhoto()
  try {
    await ensureInspector()
  } catch {
    notInspector.value = true
    return
  }
  // Openstaande keuring-aanvragen (leadmotor): tel ze voor de badge op de tegel.
  const { data } = await supabase.rpc('company_inspection_requests')
  pendingRequests.value = (data ?? []).length

  const { data: count } = await supabase.rpc('upcoming_reinspections_count', { days_ahead: 30 })
  upcomingReinspections.value = count ?? 0
})

const tiles = [
  { key: 'inspections',      icon: '📋', label: 'home.tiles.inspections',      route: '/inspections' },
  { key: 'customers',        icon: '👥', label: 'home.tiles.customers',        route: '/customers' },
  { key: 'requests',         icon: '📨', label: 'home.tiles.requests',         route: '/requests' },
  { key: 'offline',          icon: '⬇️', label: 'home.tiles.offline',          route: '/offline' },
  { key: 'serial-search',    icon: '🔎', label: 'home.tiles.serialSearch',     route: '/serial-search' },
  { key: 'settings',         icon: '⚙️', label: 'home.tiles.settings',         route: '/settings' },
]

const upcomingReinspections = ref(0)

const statusText = computed(() =>
  upcomingReinspections.value > 0
    ? t('home.upcomingReinspections', { count: upcomingReinspections.value })
    : t('home.allGood')
)


function navigate(route: string | null) {
  if (route) router.push(route)
}

function onSearch() {
  if (searchQuery.value.trim()) {
    router.push({ path: '/serial-search', query: { q: searchQuery.value.trim() } })
    searchQuery.value = ''
  }
}
</script>

<style scoped>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 0;
  position: relative;
  background-color: #142a1f;
  background-image: var(--home-hero-mobile, none);
  background-size: cover;
  background-position: center;
}
@media (min-width: 900px) {
  .home { background-image: var(--home-hero-desktop, var(--home-hero-mobile, none)); }
}

/* Vaste overlay boven de foto: garandeert leesbare tekst/tegels ongeacht
   welke sfeerfoto er per kwartaal onder staat (i.p.v. per foto handmatig
   contrast tunen). */
.home__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10, 26, 18, 0.82) 0%, rgba(10, 26, 18, 0.55) 40%, rgba(10, 26, 18, 0.88) 100%);
  pointer-events: none;
}

.home__header, .home__body { position: relative; z-index: 1; }

/* Header */
.home__header {
  padding: 1.25rem 1.5rem 1rem;
  color: #fff;
}
.home__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}
.home__identity {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}
.home__app-name {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.01em;
}
.home__account {
  font-size: 0.82rem;
  color: #cfe3d6;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__signout {
  background: none;
  border: none;
  color: #cfe3d6;
  cursor: pointer;
  font-size: 0.9rem;
  flex-shrink: 0;
  align-self: flex-start;
}
.home__wrong-app {
  position: relative;
  z-index: 1;
  margin: 1.25rem 1.25rem 0;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  color: #92400e;
}
.home__wrong-app p { margin: 0 0 0.5rem; }
.home__wrong-app-link { color: #16a34a; font-weight: 700; }

/* Statusmelding: witte kaart met accentrand, ingetogen, geen rood
   geschreeuw (UX-FLOW §8, "stoplichtkaart"-principe hergebruikt). */
.home__status {
  font-size: 0.9rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.95);
  color: #1a3a2a;
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.home__status--attention { border-color: #f59e0b; }
.home__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #16a34a;
  display: inline-block;
  flex-shrink: 0;
}
.home__status-dot--attention { background: #f59e0b; }

.home__body { flex: 1; display: flex; flex-direction: column; }

/* Zoekbalk */
.home__search {
  padding: 1.25rem 1.25rem 0.5rem;
}
.home__search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.3);
  font-size: 1rem;
  background: rgba(255,255,255,0.18);
  color: #fff;
  box-sizing: border-box;
  backdrop-filter: blur(6px);
}
.home__search-input::placeholder {
  color: rgba(255,255,255,0.75);
}
.home__search-input:focus {
  outline: none;
  background: rgba(255,255,255,0.28);
}

/* Tegel-grid: één consistente glas-stijl i.p.v. losse regenboogkleuren --
   het icoon onderscheidt de tegels, niet de kleur. */
.home__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1.25rem;
  flex: 1;
}

.home__tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.75rem 1rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  transition: transform 0.1s, box-shadow 0.1s, background 0.15s;
  min-height: 110px;
}
.home__tile:active {
  transform: scale(0.97);
  background: rgba(255, 255, 255, 0.22);
}
.home__tile-badge {
  position: absolute; top: 0.6rem; right: 0.6rem;
  min-width: 1.4rem; height: 1.4rem; padding: 0 0.35rem;
  background: #dc2626; color: #fff; border-radius: 999px;
  font-size: 0.8rem; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
}

.home__tile-icon { font-size: 2rem; line-height: 1; }
.home__tile-label { font-size: 0.9rem; text-align: center; line-height: 1.2; }

/* Desktop: statusmelding + zoekbalk links, tegels rechts in een bredere grid. */
@media (min-width: 900px) {
  .home__body {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 1.5rem;
    padding: 0 1.5rem 1.5rem;
    align-items: start;
  }
  .home__search { padding: 0; }
  .home__grid {
    grid-template-columns: repeat(3, 1fr);
    padding: 0;
  }
}
</style>
