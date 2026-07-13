<!-- Gedeelde paginakop (dashboard-model "optie A", besloten met Jos
     2026-07-13): de app-naam in het midden is overal de home-knop terug naar
     het dashboard. Subpagina's krijgen daarnaast een expliciete ←, omdat niet
     iedereen weet dat een logo klikbaar is. Rechts staat de paginatitel, of
     (op het dashboard) een slot voor bv. de uitlogknop. -->
<template>
  <header class="ph">
    <button v-if="back" class="ph__back" :title="$t('common.back')" @click="router.push('/')">←</button>
    <span v-else></span>
    <router-link to="/" class="ph__brand">{{ $t('home.title') }}</router-link>
    <span class="ph__side"><slot>{{ title }}</slot></span>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const router = useRouter();
defineProps<{ title?: string; back?: boolean }>();
</script>

<style scoped>
.ph {
  background: #1a3a2a; color: #fff;
  display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 0.5rem;
  padding: 0.85rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.ph__back {
  justify-self: start; background: none; border: none; color: #a7c4b0;
  font-size: 1.3rem; line-height: 1; cursor: pointer; padding: 0.1rem 0.4rem;
}
.ph__brand {
  justify-self: center; color: #fff; text-decoration: none;
  font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; font-size: 1.05rem;
}
.ph__side {
  justify-self: end; font-size: 0.85rem; color: #a7c4b0;
  display: flex; align-items: center; gap: 0.6rem; text-align: right;
}
</style>
