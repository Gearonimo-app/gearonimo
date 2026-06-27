<template>
  <div class="login">
    <h1>{{ $t("login.title") }}</h1>

    <form @submit.prevent="handleLogin">
      <div>
        <label>{{ $t("login.email") }}</label>
        <input v-model="email" type="email" required autocomplete="email" />
      </div>
      <div>
        <label>{{ $t("login.password") }}</label>
        <input v-model="password" type="password" required />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <button type="submit" :disabled="busy">
        {{ busy ? $t("login.busy") : $t("login.submit") }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth, errorMessage } from "@gearonimo/core";

const { signInWithEmail } = useAuth();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);

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
</script>
