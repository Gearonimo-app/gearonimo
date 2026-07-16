<!-- Aanbod om vingerafdruk/Face ID te activeren, automatisch getoond op het
     dashboard zolang dit toestel nog geen passkey heeft en de prompt nog
     niet is weggeklikt (besluit Jos, 2026-07-16: automatisch na de eerste
     login, i.p.v. verstopt in Instellingen). Geen aparte pagina/route --
     verschijnt gewoon boven de rest van Home.vue en verdwijnt na een keuze. -->
<template>
  <div v-if="visible" class="pp">
    <GIcon name="fingerprint" class="pp__icon" />
    <div class="pp__text">
      <strong>{{ $t('passkey.promptTitle') }}</strong>
      <p>{{ $t('passkey.promptBody') }}</p>
      <p v-if="error" class="pp__error">{{ error }}</p>
    </div>
    <div class="pp__actions">
      <button class="pp__accept" :disabled="busy" @click="accept">
        {{ busy ? $t('login.busy') : $t('passkey.promptAccept') }}
      </button>
      <button class="pp__decline" :disabled="busy" @click="decline">{{ $t('passkey.promptDecline') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import {
  useAuth,
  errorMessage,
  isPasskeyCancelled,
  passkeySupported,
  platformAuthenticatorAvailable,
  isPasskeyEnabledOnThisDevice,
  isPasskeyPromptDismissed,
  markPasskeyEnabledOnThisDevice,
  markPasskeyPromptDismissed,
} from "@gearonimo/core";
import { GIcon } from "@gearonimo/ui";

const { registerPasskey } = useAuth();

const visible = ref(false);
const busy = ref(false);
const error = ref("");

onMounted(async () => {
  if (isPasskeyEnabledOnThisDevice() || isPasskeyPromptDismissed()) return;
  if (!passkeySupported()) return;
  visible.value = await platformAuthenticatorAvailable();
});

async function accept() {
  busy.value = true;
  error.value = "";
  try {
    await registerPasskey();
    markPasskeyEnabledOnThisDevice();
    markPasskeyPromptDismissed();
    visible.value = false;
  } catch (e) {
    if (isPasskeyCancelled(e)) {
      // Weggeklikt in de OS-prompt zelf: net als "niet nu", niet blijven
      // aanbieden bij elke login.
      markPasskeyPromptDismissed();
      visible.value = false;
    } else {
      error.value = errorMessage(e);
    }
  } finally {
    busy.value = false;
  }
}

function decline() {
  markPasskeyPromptDismissed();
  visible.value = false;
}
</script>

<style scoped>
/* Zelfde glas-opmaak als de stoplichtkaart/tegels op dit dashboard. */
.pp {
  display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.75rem;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 1.25rem;
  color: #fff;
}
.pp__icon { width: 28px; height: 28px; flex: 0 0 auto; margin-top: 0.1rem; }
.pp__text { flex: 1; min-width: 200px; }
.pp__text strong { display: block; font-size: 0.95rem; }
.pp__text p { margin: 0.25rem 0 0; font-size: 0.85rem; color: rgba(255, 255, 255, 0.8); }
.pp__text .pp__error { color: #fca5a5; }
.pp__actions { display: flex; gap: 0.5rem; flex: 0 0 100%; justify-content: flex-end; }
.pp__accept {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.45rem 0.9rem; font-weight: 700; cursor: pointer; font-size: 0.85rem;
}
.pp__decline {
  background: none; border: none; color: rgba(255, 255, 255, 0.75);
  cursor: pointer; font-size: 0.85rem;
}
.pp__accept:disabled, .pp__decline:disabled { opacity: 0.6; }
</style>
