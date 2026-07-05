<!-- Startkeuze voor een account dat nog geen klant is. Twee wegen:
     1. Een uitnodigingscode van een keurbedrijf (bestaande flow, /join).
     2. Zelf beginnen: maak je eigen klant aan (zonder keurbedrijf) en vraag
        later een keuring aan. Dit is de gratis leadmotor (BLAUWDRUK §7):
        iemand voert eerst zijn materiaal in en kiest daarna zelf een
        keurbedrijf op de kaart. -->
<template>
  <div class="st">
    <div class="st__card">
      <h1 class="st__title">{{ $t('start.title') }}</h1>
      <p class="st__sub">{{ $t('start.subtitle') }}</p>

      <div class="st__options">
        <button class="st__option" @click="router.push('/join')">
          <span class="st__option-title">{{ $t('start.haveCode.title') }}</span>
          <span class="st__option-desc">{{ $t('start.haveCode.desc') }}</span>
        </button>

        <div class="st__option st__option--self" :class="{ 'st__option--open': selfOpen }">
          <button v-if="!selfOpen" class="st__option-btn" @click="selfOpen = true">
            <span class="st__option-title">{{ $t('start.self.title') }}</span>
            <span class="st__option-desc">{{ $t('start.self.desc') }}</span>
          </button>
          <form v-else @submit.prevent="handleSelf">
            <label class="st__label">{{ $t('start.self.nameLabel') }}</label>
            <input
              v-model="name"
              class="st__input"
              :placeholder="$t('start.self.namePlaceholder')"
              autofocus
              required
            />
            <p v-if="error" class="st__error">{{ error }}</p>
            <div class="st__actions">
              <button type="button" class="st__btn st__btn--ghost" @click="selfOpen = false">
                {{ $t('common.cancel') }}
              </button>
              <button type="submit" class="st__btn st__btn--go" :disabled="busy">
                {{ busy ? $t('common.busy') : $t('start.self.submit') }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <button class="st__signout" @click="onSignOut">{{ $t('common.signOut') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { supabase, useAuth, errorMessage } from "@gearonimo/core";

const router = useRouter();
const { signOut } = useAuth();

const selfOpen = ref(false);
const name = ref("");
const error = ref("");
const busy = ref(false);

async function handleSelf() {
  busy.value = true;
  error.value = "";
  try {
    const { error: err } = await supabase.rpc("self_register_customer", {
      p_name: name.value.trim() || null,
    });
    if (err) throw err;
    router.push("/");
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function onSignOut() {
  await signOut();
  router.push("/login");
}
</script>

<style scoped>
.st {
  min-height: 100vh; background: #f0f4f8;
  display: flex; align-items: center; justify-content: center; padding: 1.25rem;
}
.st__card {
  background: #fff; border-radius: 16px; padding: 2rem 1.5rem;
  width: 100%; max-width: 420px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}
.st__title { margin: 0 0 0.25rem; color: #1a3a2a; font-size: 1.3rem; }
.st__sub { margin: 0 0 1.5rem; color: #6b7280; }
.st__options { display: flex; flex-direction: column; gap: 0.85rem; }
.st__option {
  display: block; width: 100%; text-align: left; cursor: pointer;
  background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1rem;
}
.st__option--self { padding: 0; overflow: hidden; }
.st__option-btn {
  display: block; width: 100%; text-align: left; cursor: pointer;
  background: none; border: none; padding: 1rem; font-family: inherit;
}
.st__option-title { display: block; font-weight: 700; color: #1a3a2a; font-size: 1rem; }
.st__option-desc { display: block; color: #6b7280; font-size: 0.85rem; margin-top: 0.2rem; }
.st__option--open { padding: 1rem; background: #fff; }
.st__label { display: block; font-size: 0.85rem; color: #6b7280; margin-bottom: 0.35rem; }
.st__input {
  width: 100%; padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; margin-bottom: 0.75rem;
}
.st__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.75rem; }
.st__actions { display: flex; gap: 0.6rem; }
.st__btn {
  flex: 1; padding: 0.85rem; border-radius: 10px; border: none;
  font-size: 0.95rem; font-weight: 700; cursor: pointer;
}
.st__btn--ghost { background: #f3f4f6; color: #374151; }
.st__btn--go { background: #16a34a; color: #fff; }
.st__btn:disabled { opacity: 0.6; }
.st__signout {
  width: 100%; background: none; border: none; color: #9ca3af;
  font-size: 0.9rem; cursor: pointer; margin-top: 1.25rem;
}
</style>
