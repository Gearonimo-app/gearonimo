<template>
  <div class="imp">
    <header class="imp__header">
      <button class="imp__icon" @click="$router.back()">←</button>
      <h1>{{ $t('settings.import.menuTitle') }}</h1>
      <span class="imp__icon"></span>
    </header>

    <div class="imp__body">
      <ImportWizard />
    </div>
  </div>
</template>

<script setup lang="ts">
import ImportWizard from '../components/ImportWizard.vue'
</script>

<style scoped>
.imp { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.imp__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem;
}
.imp__header h1 { font-size: 1.2rem; margin: 0; }
.imp__icon { background: none; border: none; color: #fff; font-size: 1.3rem; cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem; }
.imp__body { padding: 1.25rem; }
</style>
