<template>
  <div class="lg">
    <div class="lg__lang"><LangToggle variant="light" /></div>
    <div class="lg__card">
      <h1 class="lg__brand">Gearonimo</h1>
      <div class="lg__applabel-wrap"><span class="lg__applabel">{{ $t('login.appLabel') }}</span></div>
      <p class="lg__sub">{{ $t('login.subtitle') }}</p>

      <div v-if="!sent">
        <!-- Alleen op een toestel dat hier al eerder een passkey op
             registreerde (settings.security in Instellingen of de prompt na
             de eerste login) -- op een nieuw toestel is er nog niets om mee
             in te loggen, dus dan tonen we alleen het mailformulier. -->
        <div v-if="showPasskeyButton" class="lg__passkey">
          <button type="button" class="lg__btn lg__btn--passkey" :disabled="passkeyBusy" @click="handlePasskeyLogin">
            <GIcon name="fingerprint" class="lg__passkey-icon" />
            {{ passkeyBusy ? $t('login.busy') : $t('passkey.loginButton') }}
          </button>
          <p v-if="passkeyError" class="lg__error">{{ passkeyError }}</p>
          <div class="lg__divider"><span>{{ $t('passkey.or') }}</span></div>
        </div>

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
import { ref, onMounted } from "vue";
import { useAuth, errorMessage, passkeySupported, isPasskeyCancelled, isPasskeyEnabledOnThisDevice } from "@gearonimo/core";
import { GIcon, LangToggle } from "@gearonimo/ui";

const { signInWithMagicLink, signInWithPasskey } = useAuth();

const email = ref("");
const error = ref("");
const busy = ref(false);
const sent = ref(false);

// Alleen tonen als dít toestel eerder al een passkey registreerde (zie
// PasskeyPrompt.vue / Members.vue) -- anders is er niets om mee in te
// loggen en zou de knop een doodlopend biometrie-schermpje openen.
const showPasskeyButton = ref(false);
const passkeyBusy = ref(false);
const passkeyError = ref("");

onMounted(() => {
  showPasskeyButton.value = passkeySupported() && isPasskeyEnabledOnThisDevice();
});

async function handlePasskeyLogin() {
  passkeyBusy.value = true;
  passkeyError.value = "";
  try {
    await signInWithPasskey();
    // Bij succes verwerkt de router-guard (main.ts) de nieuwe sessie en stuurt
    // vanzelf door -- geen router.push nodig.
  } catch (e) {
    if (!isPasskeyCancelled(e)) passkeyError.value = errorMessage(e);
  } finally {
    passkeyBusy.value = false;
  }
}

async function handleLogin() {
  busy.value = true;
  error.value = "";
  try {
    // Terug naar de klant-app (/portal/), niet naar de Site URL (de
    // inspector-app). Pathname i.p.v. hardcoded, zodat lokaal testen
    // (vite dev, base /portal/) hetzelfde werkt.
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
  position: relative;
}
.lg__lang { position: absolute; top: 1rem; right: 1rem; }
.lg__card {
  background: #fff; border-radius: 16px; padding: 2rem 1.5rem;
  width: 100%; max-width: 380px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.lg__brand { margin: 0 0 0.4rem; color: #1a3a2a; font-size: 1.6rem; text-align: center; }
.lg__applabel-wrap { text-align: center; margin: 0 0 0.6rem; }
.lg__applabel { display: inline-block; font-size: 0.78rem; font-weight: 600; border-radius: 999px; padding: 0.2rem 0.7rem; background: #dbeafe; color: #1e40af; }
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

.lg__passkey { margin-bottom: 1rem; }
.lg__btn--passkey {
  background: #1a3a2a; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
}
.lg__passkey-icon { width: 20px; height: 20px; flex: 0 0 auto; }
.lg__divider {
  display: flex; align-items: center; gap: 0.75rem; margin: 1rem 0;
  color: #9ca3af; font-size: 0.8rem;
}
.lg__divider::before, .lg__divider::after { content: ""; flex: 1; height: 1px; background: #e5e7eb; }
</style>
