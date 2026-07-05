<template>
  <div class="rp">
    <div class="rp__card">
      <h1 class="rp__brand">{{ $t("resetPassword.title") }}</h1>

      <div v-if="!done">
        <form @submit.prevent="handleSubmit">
          <label class="rp__label">{{ $t("resetPassword.newPassword") }}</label>
          <input v-model="password" type="password" required minlength="6" autocomplete="new-password" class="rp__input" />
          <label class="rp__label">{{ $t("resetPassword.confirmPassword") }}</label>
          <input v-model="confirm" type="password" required minlength="6" autocomplete="new-password" class="rp__input" />

          <p v-if="error" class="rp__error">{{ error }}</p>

          <button type="submit" class="rp__btn" :disabled="busy">
            {{ busy ? $t("login.busy") : $t("resetPassword.submit") }}
          </button>
        </form>
      </div>

      <div v-else class="rp__done">
        <p>✅ {{ $t("resetPassword.success") }}</p>
        <router-link class="rp__link" to="/">{{ $t("resetPassword.toHome") }}</router-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAuth, errorMessage } from "@gearonimo/core";

const { t } = useI18n();
const { updatePassword } = useAuth();

const password = ref("");
const confirm = ref("");
const error = ref("");
const busy = ref(false);
const done = ref(false);

async function handleSubmit() {
  error.value = "";
  if (password.value !== confirm.value) {
    error.value = t("resetPassword.mismatch");
    return;
  }
  busy.value = true;
  try {
    // De reset-link heeft supabase-js al vanzelf een tijdelijke sessie
    // laten opzetten (detectSessionInUrl); dit zet er meteen een nieuw
    // wachtwoord op.
    await updatePassword(password.value);
    done.value = true;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.rp {
  min-height: 100vh; background: #f0f4f8;
  display: flex; align-items: center; justify-content: center; padding: 1.25rem;
}
.rp__card {
  background: #fff; border-radius: 16px; padding: 2rem 1.5rem;
  width: 100%; max-width: 380px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.rp__brand { margin: 0 0 1.5rem; color: #1a3a2a; font-size: 1.4rem; text-align: center; }
.rp__label { display: block; font-size: 0.85rem; color: #6b7280; margin-bottom: 0.35rem; }
.rp__input {
  width: 100%; padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; margin-bottom: 1rem;
}
.rp__btn {
  width: 100%; padding: 0.9rem; border-radius: 10px; border: none;
  background: #16a34a; color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer;
}
.rp__btn:disabled { opacity: 0.6; }
.rp__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.75rem; }
.rp__done { text-align: center; color: #1a3a2a; }
.rp__link { color: #16a34a; font-weight: 700; }
</style>
