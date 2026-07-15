<template>
  <router-view />
  <SyncStatusBar />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { supabase } from '@gearonimo/core'
import SyncStatusBar from './components/SyncStatusBar.vue'

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
