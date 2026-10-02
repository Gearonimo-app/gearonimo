<template>
  <!-- PBM | Rigging voor een vrij artikel; logica in useFreeType.ts. -->
  <div class="ftt" role="group" :title="$t('inspections.freeType.tooltip')">
    <button type="button" :class="{ 'ftt--active': modelValue === 'ppe' }" :aria-pressed="modelValue === 'ppe'"
            @click="emit('update:modelValue', 'ppe')">{{ $t('inspections.freeType.ppe') }}</button>
    <button type="button" :class="{ 'ftt--active': modelValue === 'rigging' }" :aria-pressed="modelValue === 'rigging'"
            @click="emit('update:modelValue', 'rigging')">{{ $t('inspections.freeType.rigging') }}</button>
  </div>
</template>

<script setup lang="ts">
import type { FreeType } from '../composables/useFreeType'

defineProps<{ modelValue: FreeType }>()
const emit = defineEmits<{ 'update:modelValue': [value: FreeType] }>()
</script>

<style scoped>
.ftt { display: inline-flex; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; flex-shrink: 0; }
.ftt button {
  border: none; background: #fff; padding: 0.6rem 0.7rem; font-size: 0.85rem;
  font-family: inherit; color: #374151; cursor: pointer;
}
.ftt button + button { border-left: 1px solid #ddd; }
.ftt .ftt--active { background: #1a3a2a; color: #fff; }
</style>
