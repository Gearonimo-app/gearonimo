<template>
  <section class="cs">
    <div class="cs__tabs">
      <button class="cs__tab" :class="{ 'cs__tab--active': tab === 'queue' }" @click="tab = 'queue'">
        {{ $t('settings.catalog.tabs.queue') }}
      </button>
      <button class="cs__tab" :class="{ 'cs__tab--active': tab === 'manage' }" @click="tab = 'manage'">
        {{ $t('settings.catalog.tabs.manage') }}
      </button>
    </div>
    <CatalogQueue v-if="tab === 'queue'" />
    <CatalogManager v-else />
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CatalogQueue from './CatalogQueue.vue'
import CatalogManager from './CatalogManager.vue'

const tab = ref<'queue' | 'manage'>('queue')
</script>

<style scoped>
.cs__tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
.cs__tab {
  flex: 1; border: none; background: #f3f4f6; color: #374151; border-radius: 8px;
  padding: 0.6rem; font-size: 0.9rem; font-weight: 600; cursor: pointer;
}
.cs__tab--active { background: #16a34a; color: #fff; }
</style>
