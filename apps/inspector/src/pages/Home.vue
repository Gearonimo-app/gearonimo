<template>
  <div class="home" :style="heroStyle">
    <div class="home__scrim"></div>

    <!-- Header: app-naam groot en gecentreerd (UX-FLOW §7, de app-naam is
         overal de home-knop). Uitloggen rechtsboven, account eronder klein. -->
    <header class="home__header">
      <button class="home__signout" @click="onSignOut">{{ $t('home.signOut') }}</button>
      <h1 class="home__app-name">{{ $t('home.appName') }}</h1>
      <span v-if="user?.email" class="home__account" :title="user.email">👤 {{ user.email }}</span>
    </header>

    <!-- Klant-account in de Pro-app beland (zelfde domein, gedeelde sessie):
         duidelijk zeggen wat er aan de hand is i.p.v. lege lijsten en vage
         fouten -- met de weg naar de juiste app en een uitlogknop. -->
    <div v-if="notInspector" class="home__wrong-app">
      <p>{{ $t('home.notInspector') }}</p>
      <a class="home__wrong-app-link" href="/portal/">{{ $t('home.goToCustomerApp') }}</a>
    </div>

    <!-- Melding + tegelmenu: alleen voor een echt keurmeester-account. Een
         klant-account krijgt hierboven al de melding + link naar /portal/. -->
    <template v-if="!notInspector">
      <div class="home__body">
        <!-- Statkaart links: het aantal artikelen dat binnen 30 dagen
             herkeurd moet worden. Bewust altijd het getal (ook 0) i.p.v. een
             "alles op orde"-boodschap -- 0 verlopende keuringen zegt niets
             over of het bestand op orde is (besluit Jos 2026-07-14). -->
        <div class="home__stat" :class="{ 'home__stat--attention': upcomingReinspections > 0 }">
          <span class="home__stat-value">{{ upcomingReinspections }}</span>
          <span class="home__stat-label">{{ $t('home.reinspectionStatLabel') }}</span>
        </div>

        <!-- Tegels rechts: 2 naast elkaar, 3 onder elkaar. Eén consistente
             glas-stijl i.p.v. losse regenboogkleuren -- het icoon
             onderscheidt de tegels, niet de kleur. Geen aparte zoekbalk: die
             was dubbelop met Klanten en SN zoeken/Recall (UX-FLOW §1.1). -->
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
import { useAuth, supabase } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'

const router = useRouter()
const { signOut, user } = useAuth()
const notInspector = ref(false)
const pendingRequests = ref(0)
const upcomingReinspections = ref(0)

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

function navigate(route: string | null) {
  if (route) router.push(route)
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
  background: linear-gradient(180deg, rgba(10, 26, 18, 0.82) 0%, rgba(10, 26, 18, 0.5) 45%, rgba(10, 26, 18, 0.85) 100%);
  pointer-events: none;
}

.home__header, .home__body { position: relative; z-index: 1; }

/* Header: gecentreerde, grote app-naam. Uitloggen absoluut rechtsboven zodat
   de titel echt gecentreerd blijft. */
.home__header {
  padding: 1.5rem 1.5rem 0.5rem;
  color: #fff;
  text-align: center;
  position: relative;
}
.home__app-name {
  font-size: 2rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: 0.01em;
}
.home__account {
  display: inline-block;
  font-size: 0.82rem;
  color: #cfe3d6;
  margin-top: 0.2rem;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.home__signout {
  position: absolute;
  top: 1.25rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: #cfe3d6;
  cursor: pointer;
  font-size: 0.9rem;
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

.home__body { flex: 1; display: flex; flex-direction: column; padding: 1.25rem; gap: 1.25rem; }

/* Gedeelde glas-stijl voor statkaart én tegels. */
.home__stat,
.home__tile {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.18);
  color: #fff;
}

/* Statkaart: groot getal + label. Amber randje zodra er iets te herkeuren is
   (ingetogen, geen rood geschreeuw -- UX-FLOW §8). */
.home__stat {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
}
.home__stat--attention { border-color: #f59e0b; }
.home__stat-value { font-size: 3rem; font-weight: 800; line-height: 1; }
.home__stat-label { font-size: 0.95rem; font-weight: 600; opacity: 0.95; }

/* Tegels: vierkant (1:1) i.p.v. platte balken. */
.home__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.home__tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  aspect-ratio: 1 / 1;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: transform 0.1s, background 0.15s;
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

/* Desktop: grote titel, statkaart links van het midden (vierkant, iets
   groter dan de tegels), 6 tegels rechts als 2 x 3. Als groep gecentreerd. */
@media (min-width: 900px) {
  .home__app-name { font-size: 2.8rem; }
  .home__body {
    flex-direction: row;
    justify-content: center;
    align-items: center;
    gap: 2rem;
    padding: 2rem 1.5rem 3rem;
  }
  .home__stat {
    width: 280px;
    height: 280px;
    flex: 0 0 auto;
  }
  .home__stat-value { font-size: 4rem; }
  .home__grid {
    grid-template-columns: repeat(2, 170px);
    grid-auto-rows: 170px;
    flex: 0 0 auto;
  }
}
</style>
