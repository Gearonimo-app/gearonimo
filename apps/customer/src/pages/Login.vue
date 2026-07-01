<template>
  <div class="lg">
    <div class="lg__card">
      <h1 class="lg__brand">Gearonimo</h1>
      <p class="lg__sub">{{ $t('login.subtitle') }}</p>

      <div v-if="!sent">
        <form @submit.prevent="handleLogin">
          <label class="lg__label">{{ $t('login.email') }}</label>
          <input v-model="email" type="email" required autocomplete="email" class="lg__input" />

          <p v-if="error" class="lg__error">{{ error }}</p>

          <button type="submit" class="lg__btn" :disabled="busy">
            {{ busy ? $t('login.busy') : $t('login.submit') }}
          </button>
        </form>
        <p class="lg__hint">{{ $t('login.hint') }}</p>
      </div>

      <div v-else class="lg__sent">
        <p>✉️ {{ $t('login.check_email') }}</p>
        <button class="lg__again" @click="sent = false">{{ $t('login.again') }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAuth, errorMessage } from "@gearonimo/core";

const { signInWithMagicLink } = useAuth();

const email = ref("");
const error = ref("");
const busy = ref(false);
const sent = ref(false);

async function handleLogin() {
  busy.value = true;
  error.value = "";
  try {
    // Terug naar de klant-app (/klant/), niet naar de Site URL (de
    // inspector-app). Pathname i.p.v. hardcoded, zodat lokaal testen
    // (vite dev, base /klant/) hetzelfde werkt.
    await signInWithMagicLink(email.value, window.location.origin + window.location.pathname);
    sent.value = true;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.lg {
  min-height: 100vh; background: #f0f4f8;
  display: flex; align-items: center; justify-content: center; padding: 1.25rem;
}
.lg__card {
  background: #fff; border-radius: 16px; padding: 2rem 1.5rem;
  width: 100%; max-width: 380px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.lg__brand { margin: 0 0 0.25rem; color: #1a3a2a; font-size: 1.6rem; text-align: center; }
.lg__sub { margin: 0 0 1.5rem; color: #6b7280; text-align: center; }
.lg__label { display: block; font-size: 0.85rem; color: #6b7280; margin-bottom: 0.35rem; }
.lg__input {
  width: 100%; padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; margin-bottom: 1rem;
}
.lg__btn {
  width: 100%; padding: 0.9rem; border-radius: 10px; border: none;
  background: #16a34a; color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer;
}
.lg__btn:disabled { opacity: 0.6; }
.lg__hint { margin: 1rem 0 0; font-size: 0.85rem; color: #9ca3af; text-align: center; }
.lg__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.75rem; }
.lg__sent { text-align: center; color: #1a3a2a; }
.lg__again { background: none; border: none; color: #16a34a; font-weight: 600; cursor: pointer; margin-top: 0.75rem; }
</style>
