<template>
  <div class="asd__overlay" @click.self="$emit('cancel')">
    <div class="asd__dialog">
      <h2>{{ title }}</h2>
      <p class="asd__hint">{{ hint }}</p>
      <div class="asd__toolbar">
        <button type="button" class="asd__link" @click="selected = new Set(articles.map(a => a.id))">{{ $t('inspections.selectArticles.selectAll') }}</button>
        <button type="button" class="asd__link" @click="selected = new Set()">{{ $t('inspections.selectArticles.selectNone') }}</button>
      </div>
      <ul class="asd__list">
        <li v-for="a in articles" :key="a.id" class="asd__item">
          <label>
            <input type="checkbox" :checked="selected.has(a.id)" @change="toggle(a.id)" />
            {{ a.label }}
          </label>
        </li>
      </ul>
      <div class="asd__actions">
        <button class="asd__btn asd__btn--cancel" @click="$emit('cancel')">{{ $t('common.cancel') }}</button>
        <button class="asd__btn asd__btn--save" @click="$emit('confirm', Array.from(selected))">
          {{ confirmLabel(selected.size) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    articles: { id: string; label: string }[]
    title: string
    hint: string
    confirmLabel: (count: number) => string
    defaultChecked?: boolean
  }>(),
  { defaultChecked: true }
)
defineEmits<{ confirm: [string[]]; cancel: [] }>()

// Bij het starten van een nieuwe keuring staat standaard alles aangevinkt
// (uitvinken wat niet meegaat); bij het aanbieden van extra artikelen voor
// een al openstaande keuring staat standaard niets aangevinkt (de
// keurmeester koos eerder al bewust om ze niet mee te nemen).
const selected = ref(new Set(props.defaultChecked ? props.articles.map((a) => a.id) : []))

function toggle(id: string) {
  if (selected.value.has(id)) selected.value.delete(id)
  else selected.value.add(id)
  selected.value = new Set(selected.value)
}
</script>

<style scoped>
.asd__overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50;
}
.asd__dialog {
  background: #fff; border-radius: 12px; padding: 1.5rem; max-width: 28rem; width: 100%;
  max-height: 80vh; display: flex; flex-direction: column;
}
.asd__dialog h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
.asd__hint { margin: 0 0 0.75rem; color: #666; font-size: 0.85rem; }
.asd__toolbar { display: flex; gap: 1rem; margin-bottom: 0.5rem; }
.asd__link { background: none; border: none; color: #16a34a; cursor: pointer; padding: 0; font-size: 0.85rem; font-family: inherit; }
.asd__list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; border-top: 1px solid #eee; }
.asd__item { border-bottom: 1px solid #eee; padding: 0.6rem 0; }
.asd__item label { display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.95rem; }
.asd__actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem; }
.asd__btn { padding: 0.6rem 1.1rem; border-radius: 8px; border: none; cursor: pointer; font-size: 0.95rem; font-family: inherit; }
.asd__btn--cancel { background: #f3f4f6; color: #111827; }
.asd__btn--save { background: #16a34a; color: #fff; }
</style>
