<template>
  <TabBar v-if="tabsEnabled" />
  <router-view v-slot="{ Component }">
    <!-- Werk-tabbladen: alleen het actieve tabblad wordt getekend, de rest
         blijft via keep-alive in leven zodat een halve keuring of een
         ingevuld formulier blijft staan als je even iets anders doet.
         De sleutel komt uit useTabs (tabId|fullPath) -- zie de uitleg daar.
         Op de losse schermen (inloggen, wachtwoord, publieke verificatie)
         staan geen tabbladen en dus ook geen keep-alive. -->
    <keep-alive v-if="tabsEnabled" :max="MAX_ALIVE">
      <component :is="Component" :key="viewKey" />
    </keep-alive>
    <component v-else :is="Component" />
  </router-view>
  <SyncStatusBar />
</template>

<script setup lang="ts">
import { onMounted, nextTick, watch } from 'vue'
import { supabase } from '@gearonimo/core'
import SyncStatusBar from './components/SyncStatusBar.vue'
import TabBar from './components/TabBar.vue'
import { useTabs, MAX_ALIVE } from './composables/useTabs'

const { enabled: tabsEnabled, viewKey } = useTabs()

// De strook ligt vast bovenaan (position: fixed) en mag de pagina's niet
// overlappen. Eén bron voor die hoogte: --tabbar-h. De paginahoogtes
// (min-height: var(--page-min-h, 100vh)) en de sticky AppHeader rekenen er
// allebei mee, dus dit hoeft nergens per pagina herhaald te worden.
watch(
  tabsEnabled,
  (on) => document.documentElement.style.setProperty('--tabbar-h', on ? '38px' : '0px'),
  { immediate: true },
)

// Scrollpositie per tabblad onthouden. keep-alive bewaart de DOM, maar de
// scrollpositie zit op window: zonder dit sprong je bij het terugwisselen naar
// een lange artikellijst weer bovenaan. De watcher draait vóór de DOM-update
// (flush 'pre'), dus window.scrollY is daar nog die van het oude tabblad.
const scrollTops = new Map<string, number>()
watch(viewKey, (next, prev) => {
  if (prev) scrollTops.set(prev, window.scrollY)
  nextTick(() => window.scrollTo(0, scrollTops.get(next) ?? 0))
})

// Platform-brede hero-foto als kopstrook (UX-FLOW §7): laadt de strook-foto +
// overlay-donkering en zet ze als CSS-variabelen op de document-root, zodat de
// globale header-regel in style.css ze op elke subpagina kan gebruiken.
// platform_settings vereist een ingelogde sessie (RLS), dus ook opnieuw laden
// bij een auth-wijziging -- anders verschijnt de strook pas na een herlaad.
async function loadHeroTheme() {
  const root = document.documentElement
  try {
    const { data } = await supabase
      .from('platform_settings')
      .select('hero_photo_strip_path, hero_overlay')
      .eq('id', true)
      .maybeSingle()
    if (data?.hero_photo_strip_path) {
      const url = supabase.storage.from('branding').getPublicUrl(data.hero_photo_strip_path).data.publicUrl
      root.style.setProperty('--hero-strip', `url("${url}")`)
    } else {
      root.style.removeProperty('--hero-strip')
    }
    if (typeof data?.hero_overlay === 'number') {
      root.style.setProperty('--hero-overlay', String(data.hero_overlay))
    }
  } catch {
    // Geen sessie / niet bereikbaar: laat de kopbalken gewoon donkergroen.
    root.style.removeProperty('--hero-strip')
  }
}

onMounted(loadHeroTheme)
// LET OP: nooit rechtstreeks supabase-aanroepen doen BINNEN de
// onAuthStateChange-callback -- die draait terwijl supabase-js zijn interne
// auth-vergrendeling vasthoudt, en elke query wacht op diezelfde
// vergrendeling. Dat blokkeerde de klant-app volledig op "Laden..." en
// hield hier de kopstrook-foto tegen (gevonden 2026-07-15). setTimeout
// plant de query buiten de callback-tick.
supabase.auth.onAuthStateChange(() => {
  setTimeout(loadHeroTheme, 0)
})
</script>
