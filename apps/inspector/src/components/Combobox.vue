<!--
  Herbruikbare combobox met toetsenbordbediening (↑/↓/Enter/Esc).
  "Dom" component: de parent levert de zichtbare items aan en reageert op
  select/enterNew. Zo bruikbaar voor zowel statische lijsten (merk, categorie,
  met vrije invoer) als async zoeken (catalogus via search_products).
-->
<template>
  <div class="cb" @keydown="onKeydown">
    <input
      ref="inputEl"
      :value="modelValue"
      type="search"
      class="cb__input"
      :class="inputClass"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="onBlur"
    />
    <ul v-if="open && items.length" class="cb__list">
      <li
        v-for="(item, i) in items"
        :key="item.key"
        class="cb__item"
        :class="{ 'cb__item--active': i === highlighted }"
        @mousedown.prevent="choose(item)"
        @mouseenter="highlighted = i"
      >
        {{ item.label }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

export interface ComboItem {
  key: string
  label: string
  raw?: any
}

const props = defineProps<{
  modelValue: string
  items: ComboItem[]
  placeholder?: string
  disabled?: boolean
  allowNew?: boolean
  inputClass?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'select', item: ComboItem): void
  (e: 'enterNew', text: string): void
}>()

const open = ref(false)
const highlighted = ref(-1)
const inputEl = ref<HTMLInputElement | null>(null)

function onInput(ev: Event) {
  emit('update:modelValue', (ev.target as HTMLInputElement).value)
  open.value = true
  highlighted.value = -1
}

function onFocus() {
  open.value = true
}

function onBlur() {
  // mousedown op een item vuurt vóór blur (preventDefault), dus selectie blijft werken
  setTimeout(() => { open.value = false }, 0)
}

function choose(item: ComboItem) {
  emit('update:modelValue', item.label)
  emit('select', item)
  open.value = false
  highlighted.value = -1
}

function onKeydown(ev: KeyboardEvent) {
  if (ev.key === 'ArrowDown') {
    ev.preventDefault()
    open.value = true
    if (props.items.length) highlighted.value = (highlighted.value + 1) % props.items.length
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault()
    if (props.items.length) highlighted.value = (highlighted.value - 1 + props.items.length) % props.items.length
  } else if (ev.key === 'Enter') {
    ev.preventDefault()
    if (highlighted.value >= 0 && props.items[highlighted.value]) {
      choose(props.items[highlighted.value])
    } else if (props.allowNew && props.modelValue.trim()) {
      emit('enterNew', props.modelValue.trim())
      open.value = false
    }
  } else if (ev.key === 'Escape') {
    open.value = false
    highlighted.value = -1
  }
}
</script>

<style scoped>
.cb { position: relative; flex: 1; min-width: 7rem; }
.cb__input {
  width: 100%; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; box-sizing: border-box; font-family: inherit;
}
.cb__input:disabled { background: #f3f4f6; color: #6b7280; }
.cb__list {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 30;
  background: #fff; border: 1px solid #ddd; border-radius: 8px; margin: 0.25rem 0 0; padding: 0;
  list-style: none; max-height: 240px; overflow-y: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.08);
}
.cb__item { padding: 0.55rem 0.85rem; cursor: pointer; }
.cb__item--active { background: #e0f2e9; }
</style>
