<template>
  <div class="home">
    <!-- Header -->
    <header class="home__header">
      <div class="home__header-row">
        <h1 class="home__app-name">{{ $t('home.appName') }}</h1>
        <button class="home__signout" @click="onSignOut">{{ $t('home.signOut') }}</button>
      </div>
      <div class="home__status">
        <span class="home__status-dot" :class="statusClass"></span>
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
          :class="`home__tile--${tile.color}`"
          @click="navigate(tile.route)"
        >
          <span class="home__tile-icon">{{ tile.icon }}</span>
          <span class="home__tile-label">{{ $t(tile.label) }}</span>
        </button>
      </nav>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'

const router = useRouter()
const { signOut } = useAuth()
const searchQuery = ref('')

const notInspector = ref(false)

async function onSignOut() {
  await signOut()
  router.push('/login')
}

// Stil checken of dit account wel een keurmeester is: sinds de klant-app
// (zelfde domein, gedeelde sessie) kan een klant-account hier belanden en
// zag dan alleen lege lijsten. ensureInspector werpt dan een fout.
onMounted(async () => {
  try {
    await ensureInspector()
  } catch {
    notInspector.value = true
  }
})

const tiles = [
  { key: 'inspections',      icon: '📋', label: 'home.tiles.inspections',      route: '/inspections',      color: 'green'  },
  { key: 'customers',        icon: '👥', label: 'home.tiles.customers',        route: '/customers',        color: 'orange' },
  { key: 'offline',          icon: '⬇️', label: 'home.tiles.offline',          route: '/offline',          color: 'blue'   },
  { key: 'serial-search',    icon: '🔎', label: 'home.tiles.serialSearch',     route: '/serial-search',    color: 'purple' },
  { key: 'settings',         icon: '⚙️', label: 'home.tiles.settings',         route: '/settings',         color: 'gray'   },
]

// Placeholder — wordt in fase 2 gevuld vanuit Supabase
const itemsApprovedToday = ref(0)

const statusClass = computed(() =>
  itemsApprovedToday.value > 0 ? 'home__status-dot--active' : ''
)
const statusText = computed(() =>
  itemsApprovedToday.value > 0
    ? `✅ ${itemsApprovedToday.value} items goed gekeurd vandaag`
    : '—'
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
  background: #f0f4f8;
  display: flex;
  flex-direction: column;
  padding: 0;
}

/* Header */
.home__header {
  background: #1a3a2a;
  color: #fff;
  padding: 1.25rem 1.5rem 1rem;
}
.home__header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.4rem;
}
.home__app-name {
  font-size: 1.4rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.01em;
}
.home__signout {
  background: none;
  border: none;
  color: #a7c4b0;
  cursor: pointer;
  font-size: 0.9rem;
}
.home__wrong-app {
  margin: 1.25rem 1.25rem 0;
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  color: #92400e;
}
.home__wrong-app p { margin: 0 0 0.5rem; }
.home__wrong-app-link { color: #16a34a; font-weight: 700; }
.home__status {
  font-size: 0.9rem;
  opacity: 0.85;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.home__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #666;
  display: inline-block;
}
.home__status-dot--active {
  background: #4ade80;
}

/* Zoekbalk */
.home__search {
  padding: 1rem 1.25rem 0.5rem;
  background: #1a3a2a;
}
.home__search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  border: none;
  font-size: 1rem;
  background: rgba(255,255,255,0.15);
  color: #fff;
  box-sizing: border-box;
}
.home__search-input::placeholder {
  color: rgba(255,255,255,0.6);
}
.home__search-input:focus {
  outline: none;
  background: rgba(255,255,255,0.25);
}

/* Tegel-grid */
.home__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding: 1.25rem;
  flex: 1;
}

.home__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 1.75rem 1rem;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: transform 0.1s, box-shadow 0.1s;
  min-height: 110px;
}
.home__tile:active {
  transform: scale(0.97);
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}

.home__tile-icon { font-size: 2rem; line-height: 1; }
.home__tile-label { font-size: 0.9rem; text-align: center; line-height: 1.2; }

/* Kleuren */
.home__tile--green  { background: #16a34a; }
.home__tile--blue   { background: #2563eb; }
.home__tile--orange { background: #ea580c; }
.home__tile--purple { background: #7c3aed; }
.home__tile--gray   { background: #4b5563; }
.home__tile--light  { background: #9ca3af; cursor: default; }
</style>
