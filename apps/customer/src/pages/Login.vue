<template>
  <div class="login">
    <h1>{{ $t("login.title") }}</h1>

    <div v-if="!sent">
      <form @submit.prevent="handleLogin">
        <div>
          <label>{{ $t("login.email") }}</label>
          <input v-model="email" type="email" required autocomplete="email" />
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" :disabled="busy">
          {{ busy ? $t("login.busy") : $t("login.submit") }}
        </button>
      </form>
    </div>

    <div v-else>
      <p>{{ $t("login.check_email") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAuth } from "../composables/useAuth";

const { signInWithMagicLink } = useAuth();

const email = ref("");
const error = ref("");
const busy = ref(false);
const sent = ref(false);

async function handleLogin() {
  busy.value = true;
  error.value = "";
  try {
    await signInWithMagicLink(email.value);
    sent.value = true;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
