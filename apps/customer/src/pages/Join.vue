<template>
  <div class="jn">
    <div class="jn__card">
      <h1 class="jn__title">{{ $t('join.title') }}</h1>
      <p class="jn__sub">{{ $t('join.subtitle') }}</p>

      <form @submit.prevent="handleJoin">
        <label class="jn__label">{{ $t('join.code') }}</label>
        <input
          v-model="code"
          class="jn__input jn__input--code"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          placeholder="bv. 3F8A2C1D"
          required
        />

        <label class="jn__label">{{ $t('join.name') }}</label>
        <input v-model="name" class="jn__input" :placeholder="$t('join.namePlaceholder')" />

        <p v-if="error" class="jn__error">{{ error }}</p>

        <button type="submit" class="jn__btn" :disabled="busy">
          {{ busy ? $t('common.busy') : $t('join.submit') }}
        </button>
      </form>

      <button class="jn__signout" @click="onSignOut">{{ $t('common.signOut') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { supabase, useAuth, errorMessage } from "@gearonimo/core";

const router = useRouter();
const { signOut } = useAuth();

const code = ref("");
const name = ref("");
const error = ref("");
const busy = ref(false);

async function handleJoin() {
  busy.value = true;
  error.value = "";
  try {
    const { error: err } = await supabase.rpc("join_customer_by_invite", {
      p_code: code.value.trim(),
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
.jn {
  min-height: 100vh; background: #f0f4f8;
  display: flex; align-items: center; justify-content: center; padding: 1.25rem;
}
.jn__card {
  background: #fff; border-radius: 16px; padding: 2rem 1.5rem;
  width: 100%; max-width: 380px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.jn__title { margin: 0 0 0.25rem; color: #1a3a2a; font-size: 1.3rem; }
.jn__sub { margin: 0 0 1.5rem; color: #6b7280; }
.jn__label { display: block; font-size: 0.85rem; color: #6b7280; margin-bottom: 0.35rem; }
.jn__input {
  width: 100%; padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; margin-bottom: 1rem;
}
.jn__input--code { letter-spacing: 0.15em; font-weight: 700; text-transform: uppercase; }
.jn__btn {
  width: 100%; padding: 0.9rem; border-radius: 10px; border: none;
  background: #16a34a; color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer;
}
.jn__btn:disabled { opacity: 0.6; }
.jn__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.75rem; }
.jn__signout {
  width: 100%; background: none; border: none; color: #9ca3af;
  font-size: 0.9rem; cursor: pointer; margin-top: 1rem;
}
</style>
