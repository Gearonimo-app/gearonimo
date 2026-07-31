<!-- Strook met de open werk-tabbladen (wens Jos 2026-07-31: multitasken tussen
     een lopende keuring, een klant en de catalogus). Ligt vast bovenaan het
     scherm; de AppHeader van de pagina schuift eronder door (die zet zijn
     sticky-top op --tabbar-h). Bewust géén onderdeel van de documentstroom
     (position: fixed) zodat de bestaande paginahoogtes ongemoeid blijven --
     de compensatie zit in één plek: --tabbar-h in style.css.

     De strook staat er ook met één tabblad: anders is de plus-knop (de enige
     manier om een tweede tabblad te openen) nergens te vinden. -->
<template>
  <div class="tabbar" role="tablist" :aria-label="$t('tabs.ariaLabel')">
    <div class="tabbar__strip">
      <div
        v-for="tab in tabs"
        :key="tab.id"
        :ref="(el) => setTabEl(tab.id, el as HTMLElement | null)"
        class="tabbar__tab"
        :class="{ 'tabbar__tab--active': tab.id === activeId }"
        role="tab"
        tabindex="0"
        :aria-selected="tab.id === activeId"
        :title="tab.label || $t(tab.fallbackKey)"
        @click="selectTab(tab.id)"
        @keydown.enter.prevent="selectTab(tab.id)"
        @keydown.space.prevent="selectTab(tab.id)"
        @mousedown.middle.prevent="closeTab(tab.id)"
      >
        <!-- title op de tegel zelf: de naam wordt bij weinig ruimte afgekapt. -->
        <span class="tabbar__label">{{ tab.label || $t(tab.fallbackKey) }}</span>
        <button
          v-if="tabs.length > 1"
          class="tabbar__close"
          :title="$t('tabs.close')"
          :aria-label="$t('tabs.close')"
          @click.stop="closeTab(tab.id)"
        >
          <GIcon name="close" class="tabbar__close-glyph" />
        </button>
      </div>
    </div>

    <button
      class="tabbar__add"
      :disabled="!canOpen"
      :title="canOpen ? $t('tabs.new') : $t('tabs.max', { count: MAX_TABS })"
      :aria-label="$t('tabs.new')"
      @click="openTab('/')"
    >
      <GIcon name="plus" class="tabbar__add-glyph" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { GIcon } from '@gearonimo/ui'
import { useTabs, MAX_TABS } from '../composables/useTabs'

// Sluiten vraagt bewust niet om bevestiging: keurresultaten gaan per regel
// direct naar de database (saveRow in InspectionWizard), dus een gesloten
// tabblad kost geen ingevulde keuring -- je pakt de concept-keuring gewoon
// weer op bij de klant.
const { tabs, activeId, canOpen, openTab, closeTab, selectTab } = useTabs()

// Op een telefoon passen er maar twee, drie tabbladen naast elkaar; de strook
// schuift dan horizontaal. Zonder dit kon het net geopende tabblad buiten
// beeld staan -- je opent iets en ziet niet waar je bent.
const tabEls = new Map<string, HTMLElement>()
function setTabEl(id: string, el: HTMLElement | null) {
  if (el) tabEls.set(id, el)
  else tabEls.delete(id)
}
watch(
  activeId,
  (id) => nextTick(() => tabEls.get(id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })),
  { immediate: true },
)
</script>

<style scoped>
.tabbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  height: var(--tabbar-h);
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  padding: 0 0.35rem;
  /* Iets donkerder dan de kopbalk (#1a3a2a) zodat het actieve tabblad
     visueel in de kopbalk eronder overloopt -- het klassieke tabblad-beeld. */
  background: #0d1f16;
  padding-top: env(safe-area-inset-top);
}

.tabbar__strip {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: none;
}
.tabbar__strip::-webkit-scrollbar { display: none; }

.tabbar__tab {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  flex: 0 1 auto;
  min-width: 5.5rem;
  max-width: 12rem;
  padding: 0 0.15rem 0 0.6rem;
  border-radius: 10px 10px 0 0;
  color: #9fb8aa;
  cursor: pointer;
  user-select: none;
  font-size: 0.82rem;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
}
.tabbar__tab:hover { background: rgba(255, 255, 255, 0.07); }
.tabbar__tab--active {
  background: #1a3a2a;
  color: #fff;
}

.tabbar__label {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabbar__close,
.tabbar__add {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0.25rem;
  border-radius: 8px;
  flex: 0 0 auto;
}
.tabbar__close { opacity: 0.7; }
.tabbar__close:hover { opacity: 1; background: rgba(255, 255, 255, 0.14); }
.tabbar__close-glyph { width: 14px; height: 14px; }

.tabbar__add {
  color: #cfe3d6;
  align-self: center;
  padding: 0.3rem;
}
.tabbar__add:hover:not(:disabled) { background: rgba(255, 255, 255, 0.12); color: #fff; }
.tabbar__add:disabled { opacity: 0.35; cursor: default; }
.tabbar__add-glyph { width: 18px; height: 18px; }
</style>
