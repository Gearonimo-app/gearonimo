<!-- Gedeelde paginakop (dashboard-model "optie A", besloten met Jos
     2026-07-13): de app-naam in het midden is overal de home-knop terug naar
     het dashboard. Subpagina's krijgen daarnaast een expliciete ←, omdat niet
     iedereen weet dat een logo klikbaar is. Rechts staat de paginatitel, of
     (op het dashboard) een slot voor bv. de uitlogknop.

     De platform-hero-foto zit hier als donkere kopstrook: staat er een
     strook-foto ingesteld (--hero-strip, gezet in App.vue), dan verschijnt
     die achter de kop met de instelbare donkering (--hero-overlay); zo niet,
     dan valt de background-image-waarde ongeldig terug op de donkergroene
     balk. Zelfde patroon als apps/inspector/src/components/AppHeader.vue --
     geen globale !important-truc nodig, dit is het enige component dat de
     kop tekent (code review 2026-09-15: er stond hier eerder wél zo'n
     !important-blok in style.css, dat is nu verwijderd). -->
<template>
  <!-- plain = effen groene kop zonder hero-strook. Op het dashboard (dat al de
       volledige hero-achtergrond heeft) voorkomt dat een dubbel fotobeeld. -->
  <header class="ph" :class="{ 'ph--plain': plain }">
    <button v-if="back" class="ph__back" :title="$t('common.back')" @click="router.push('/')"><GIcon name="back" class="ph__glyph" /></button>
    <span v-else></span>
    <router-link to="/" class="ph__brand">{{ $t('home.title') }}</router-link>
    <span class="ph__side"><slot>{{ title }}</slot><LangToggle /></span>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { GIcon, LangToggle } from "@gearonimo/ui";

const router = useRouter();
defineProps<{ title?: string; back?: boolean; plain?: boolean }>();
</script>

<style scoped>
.ph {
  color: #fff;
  /* minmax(0, ...) i.p.v. kaal 1fr: anders kan een lange titel de kolom
     breder duwen dan het scherm (bekend CSS Grid-probleem), gevonden bij het
     testen van een idee dat uiteindelijk niet in de kop kwam (2026-09-25). */
  display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 0.5rem;
  padding: 0.85rem 1.25rem; position: sticky; top: 0; z-index: 10;
  /* Donkergroene basis; de hero-strook (indien ingesteld) komt erbovenop met
     de instelbare donkering. Zonder --hero-strip is deze background-image
     ongeldig en blijft de effen groene balk staan. */
  background-color: #1a3a2a;
  background-image:
    linear-gradient(rgba(10, 26, 18, var(--hero-overlay, 0.55)), rgba(10, 26, 18, var(--hero-overlay, 0.55))),
    var(--hero-strip);
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
/* Effen kop (dashboard, dat al de volledige hero heeft): geen strook. */
.ph--plain {
  background-image: none;
  background-color: #1a3a2a;
}
.ph__back {
  justify-self: start; background: none; border: none; color: #fff;
  line-height: 1; cursor: pointer; padding: 0.1rem 0.4rem;
  display: grid; place-items: center;
}
.ph__glyph { width: 22px; height: 22px; }
.ph__brand {
  justify-self: center; color: #fff; text-decoration: none;
  font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; font-size: 1.05rem;
}
.ph__side {
  justify-self: end; font-size: 0.85rem; color: #a7c4b0;
  display: flex; align-items: center; gap: 0.6rem; text-align: right;
  min-width: 0; overflow: hidden;
}
</style>
