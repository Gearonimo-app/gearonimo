<!-- Zelf-service wachtwoord voor een ingelogde keurmeester. Nodig omdat een via
     magic-link uitgenodigd account nog geen wachtwoord heeft: na de eerste
     login kan diegene hier zelf een wachtwoord kiezen en daarna gewoon met
     e-mail+wachtwoord inloggen (handig op laptop/desktop zonder vingerafdruk).
     Gebruikt de bestaande updatePassword() -- werkt op de actieve sessie, geen
     e-mail nodig. -->
<template>
  <section class="pw">
    <p class="pw__intro">{{ $t('settings.security.intro') }}</p>

    <label class="pw__field"><span>{{ $t('settings.security.newPassword') }}</span>
      <input v-model="pw1" type="password" class="pw__input" autocomplete="new-password" /></label>
    <label class="pw__field"><span>{{ $t('settings.security.confirm') }}</span>
      <input v-model="pw2" type="password" class="pw__input" autocomplete="new-password" /></label>

    <p v-if="error" class="pw__error">{{ error }}</p>
    <p v-if="done" class="pw__ok">{{ $t('settings.security.saved') }}</p>

    <button class="pw__btn" :disabled="busy" @click="save">
      {{ busy ? $t('common.saving') : $t('settings.security.save') }}
    </button>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth, errorMessage } from '@gearonimo/core'

const { t } = useI18n()
const { updatePassword } = useAuth()

const pw1 = ref('')
const pw2 = ref('')
const busy = ref(false)
const error = ref('')
const done = ref(false)

async function save() {
  error.value = ''
  done.value = false
  if (pw1.value.length < 8) { error.value = t('settings.security.tooShort'); return }
  if (pw1.value !== pw2.value) { error.value = t('settings.security.mismatch'); return }
  busy.value = true
  try {
    await updatePassword(pw1.value)
    done.value = true
    pw1.value = ''
    pw2.value = ''
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.pw { margin-top: 0.25rem; display: flex; flex-direction: column; gap: 0.6rem; background: #fff; border-radius: 12px; padding: 1rem; }
.pw__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 0.25rem; }
.pw__field { display: flex; flex-direction: column; gap: 0.25rem; }
.pw__field > span { font-size: 0.8rem; color: #374151; font-weight: 600; }
.pw__input { padding: 0.65rem 0.75rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit; }
.pw__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.pw__ok { color: #16a34a; font-size: 0.9rem; margin: 0; }
.pw__btn { margin-top: 0.25rem; padding: 0.8rem; border-radius: 10px; border: none; background: #16a34a; color: #fff; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.pw__btn:disabled { opacity: 0.6; }
</style>
