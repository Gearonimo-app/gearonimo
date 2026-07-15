<!-- Gedeelde paginakop voor de keurmeester-app: overal dezelfde opbouw --
     links back + home, titel gecentreerd, rechts een optionele actie-slot.
     Alleen de titel (en eventuele actieknop) verschilt per pagina. Vervangt
     de 12 losse, handgebouwde koppen die uit de pas liepen.

     De platform-hero-foto zit hier als donkere kopstrook: staat er een
     strook-foto ingesteld (--hero-strip, gezet in App.vue), dan verschijnt
     die achter de kop met de instelbare donkering (--hero-overlay); zo niet,
     dan valt de background-image-waarde ongeldig terug op de donkergroene
     balk. Geen globale !important-truc meer nodig -- dit is het enige
     component dat de kop tekent. -->
<template>
  <header class="apphdr">
    <div class="apphdr__side apphdr__side--left">
      <button v-if="showBack" class="apphdr__btn" :title="$t('common.back')" @click="onBack">←</button>
      <button v-if="showHome" class="apphdr__btn" :title="$t('common.home')" @click="router.push('/')">🏠</button>
    </div>
    <div class="apphdr__title">
      <h1>{{ title }}</h1>
      <span v-if="subtitle" class="apphdr__subtitle">{{ subtitle }}</span>
    </div>
    <div class="apphdr__side apphdr__side--right">
      <slot />
    </div>
  </header>
</template>

<script setup lang="ts">
import { getCurrentInstance } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const props = withDefaults(
  defineProps<{
    title?: string
    subtitle?: string
    backTo?: string
    showBack?: boolean
    showHome?: boolean
  }>(),
  { showBack: true, showHome: true },
)
defineEmits<{ back: [] }>()

// Back-gedrag: gebruikt de pagina @back (eigen logica, bv. Instellingen dat
// eerst een sub-tab sluit), dan die; anders een opgegeven backTo-route;
// anders terug naar het hoofdmenu.
const instance = getCurrentInstance()
function onBack() {
  if (instance?.vnode.props?.onBack) {
    instance.emit('back')
    return
  }
  if (props.backTo) {
    router.push(props.backTo)
    return
  }
  router.push('/')
}
</script>

<style scoped>
.apphdr {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem;
  min-height: 56px;
  box-sizing: border-box;
  color: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
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

.apphdr__side { display: flex; align-items: center; gap: 0.25rem; min-width: 0; }
.apphdr__side--left { justify-self: start; }
.apphdr__side--right { justify-self: end; }

.apphdr__title { justify-self: center; text-align: center; min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
.apphdr__title h1 {
  font-size: 1.15rem; font-weight: 700; margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55vw;
}
.apphdr__subtitle { font-size: 0.8rem; color: #cfe3d6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.apphdr__btn {
  background: none; border: none; color: #fff;
  font-size: 1.3rem; line-height: 1; cursor: pointer; padding: 0.1rem 0.4rem;
}
</style>
