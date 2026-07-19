<template>
  <div class="lg">
    <div class="lg__lang"><LangToggle variant="light" /></div>
    <div class="lg__card">
      <h1 class="lg__brand">{{ $t("login.title") }}</h1>

      <form v-if="mode === 'login'" @submit.prevent="handleLogin">
        <label class="lg__label">{{ $t("login.email") }}</label>
        <input v-model="email" type="email" required autocomplete="email" class="lg__input" />
        <label class="lg__label">{{ $t("login.password") }}</label>
        <input v-model="password" type="password" required autocomplete="current-password" class="lg__input" />

        <p v-if="error" class="lg__error">{{ error }}</p>

        <button type="submit" class="lg__btn" :disabled="busy">
          {{ busy ? $t("login.busy") : $t("login.submit") }}
        </button>
        <button type="button" class="lg__link" @click="switchToForgot">
          {{ $t("login.forgotPassword") }}
        </button>
      </form>

      <div v-else-if="mode === 'forgot' && !resetSent">
        <p class="lg__sub">{{ $t("login.forgotHint") }}</p>
        <form @submit.prevent="handleForgot">
          <label class="lg__label">{{ $t("login.email") }}</label>
          <input v-model="email" type="email" required autocomplete="email" class="lg__input" />

          <p v-if="error" class="lg__error">{{ error }}</p>

          <button type="submit" class="lg__btn" :disabled="busy">
            {{ busy ? $t("login.busy") : $t("login.sendReset") }}
          </button>
        </form>
        <button class="lg__link" @click="mode = 'login'">{{ $t("login.backToLogin") }}</button>
      </div>

      <div v-else class="lg__sent">
        <p>✉️ {{ $t("login.resetSent") }}</p>
        <button class="lg__link" @click="mode = 'login'">{{ $t("login.backToLogin") }}</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth, errorMessage } from "@gearonimo/core";
import { LangToggle } from "@gearonimo/ui";

const { signInWithEmail, resetPasswordForEmail } = useAuth();
const router = useRouter();

const mode = ref<"login" | "forgot">("login");
const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
const resetSent = ref(false);

function switchToForgot() {
  mode.value = "forgot";
  error.value = "";
}

async function handleLogin() {
  busy.value = true;
  error.value = "";
  try {
    await signInWithEmail(email.value, password.value);
    router.push("/");
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function handleForgot() {
  busy.value = true;
  error.value = "";
  try {
    await resetPasswordForEmail(email.value, window.location.origin + "/reset-password");
    resetSent.value = true;
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
  position: relative;
}
.lg__lang { position: absolute; top: 1rem; right: 1rem; }
.lg__card {
  background: #fff; border-radius: 16px; padding: 2rem 1.5rem;
  width: 100%; max-width: 380px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.lg__brand { margin: 0 0 1.5rem; color: #1a3a2a; font-size: 1.6rem; text-align: center; }
.lg__sub { margin: 0 0 1.25rem; color: #6b7280; text-align: center; font-size: 0.9rem; }
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
.lg__link {
  display: block; width: 100%; text-align: center; background: none; border: none;
  color: #16a34a; font-weight: 600; cursor: pointer; margin-top: 0.85rem; font-size: 0.9rem;
}
.lg__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.75rem; }
.lg__sent { text-align: center; color: #1a3a2a; }
</style>
