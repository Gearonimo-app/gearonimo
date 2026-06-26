<template>
  <div class="asd__overlay" @click.self="$emit('cancel')">
    <div class="asd__dialog">
      <h2>{{ title }}</h2>
      <p class="asd__hint">{{ hint }}</p>
      <div class="asd__options">
        <button type="button" class="asd__option" @click="$emit('choose', 'all')">
          <span class="asd__option-label">{{ $t('inspections.selectArticles.allOption') }}</span>
          <span class="asd__option-count">{{ allCount }}</span>
        </button>
        <button type="button" class="asd__option" :disabled="newCount === 0" @click="$emit('choose', 'new')">
          <span class="asd__option-label">{{ $t('inspections.selectArticles.newOption') }}</span>
          <span class="asd__option-count">{{ newCount }}</span>
        </button>
      </div>
      <button class="asd__btn asd__btn--cancel" @click="$emit('cancel')">{{ $t('common.cancel') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  hint: string
  allCount: number
  newCount: number
}>()
defineEmits<{ choose: ['all' | 'new']; cancel: [] }>()
</script>

<style scoped>
.asd__overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50;
}
.asd__dialog { background: #fff; border-radius: 12px; padding: 1.5rem; max-width: 24rem; width: 100%; }
.asd__dialog h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
.asd__hint { margin: 0 0 1rem; color: #666; font-size: 0.85rem; }
.asd__options { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1rem; }
.asd__option {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.9rem 1.1rem; border-radius: 10px; border: 1px solid #ddd; background: #fff;
  cursor: pointer; font-size: 1rem; font-family: inherit; text-align: left;
}
.asd__option:not(:disabled):active { background: #f0fdf4; border-color: #16a34a; }
.asd__option:disabled { opacity: 0.45; cursor: not-allowed; }
.asd__option-label { font-weight: 600; }
.asd__option-count {
  background: #f3f4f6; border-radius: 999px; padding: 0.15rem 0.6rem;
  font-size: 0.85rem; color: #374151; font-weight: 600;
}
.asd__btn { width: 100%; padding: 0.75rem; border-radius: 8px; border: none; cursor: pointer; font-size: 0.95rem; font-family: inherit; }
.asd__btn--cancel { background: #f3f4f6; color: #111827; }
</style>
