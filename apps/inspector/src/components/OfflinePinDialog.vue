<template>
  <div class="opd__overlay" @click.self="onCancel">
    <div class="opd__form">
      <template v-if="mode === 'setup'">
        <h2>{{ $t('offline.pin.setupTitle') }}</h2>
        <p class="opd__hint">{{ $t('offline.pin.setupHint') }}</p>
        <input
          v-model="pin"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          :placeholder="$t('offline.pin.pinPlaceholder')"
          class="opd__input"
        />
        <input
          v-model="pinConfirm"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          :placeholder="$t('offline.pin.pinConfirmPlaceholder')"
          class="opd__input"
        />
        <p class="opd__warning">{{ $t('offline.pin.deviceWarning') }}</p>
      </template>

      <template v-else-if="mode === 'unlock'">
        <h2>{{ $t('offline.pin.unlockTitle') }}</h2>
        <input
          v-model="pin"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          :placeholder="$t('offline.pin.pinPlaceholder')"
          class="opd__input"
          @keyup.enter="submit"
        />
        <button class="opd__forgot" @click="mode = 'reset'">{{ $t('offline.pin.forgot') }}</button>
      </template>

      <template v-else>
        <h2>{{ $t('offline.pin.resetTitle') }}</h2>
        <p class="opd__warning">{{ $t('offline.pin.resetWarning') }}</p>
        <input
          v-model="pin"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          :placeholder="$t('offline.pin.newPinPlaceholder')"
          class="opd__input"
        />
        <input
          v-model="pinConfirm"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          :placeholder="$t('offline.pin.pinConfirmPlaceholder')"
          class="opd__input"
        />
      </template>

      <p v-if="error" class="opd__error">{{ error }}</p>

      <div class="opd__actions">
        <button class="opd__btn opd__btn--cancel" @click="onCancel">{{ $t('common.cancel') }}</button>
        <button class="opd__btn opd__btn--confirm" :disabled="busy" @click="submit">
          {{ busy ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { errorMessage } from '@gearonimo/core'
import { useOffline } from '../composables/useOffline'

const emit = defineEmits<{ unlocked: []; cancel: [] }>()

const { session } = useOffline()
const { t } = useI18n()

const mode = ref<'setup' | 'unlock' | 'reset'>(session.pinConfigured.value ? 'unlock' : 'setup')
const pin = ref('')
const pinConfirm = ref('')
const error = ref('')
const busy = ref(false)

function onCancel() {
  emit('cancel')
}

async function submit() {
  error.value = ''
  if (mode.value === 'unlock') {
    if (!pin.value) return
    busy.value = true
    try {
      const ok = await session.unlock(pin.value)
      if (!ok) {
        error.value = t('offline.pin.wrongPin')
        pin.value = ''
        return
      }
      emit('unlocked')
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      busy.value = false
    }
    return
  }

  // setup of reset: PIN + bevestiging moeten gelijk zijn
  if (pin.value.length < 4) {
    error.value = t('offline.pin.tooShort')
    return
  }
  if (pin.value !== pinConfirm.value) {
    error.value = t('offline.pin.mismatch')
    return
  }
  busy.value = true
  try {
    if (mode.value === 'setup') {
      await session.setupPin(pin.value)
    } else {
      await session.resetPin(pin.value)
    }
    emit('unlocked')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.opd__overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; z-index: 200; padding: 1.25rem;
}
.opd__form {
  background: #fff; width: 100%; max-width: 360px; border-radius: 16px;
  padding: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;
}
.opd__form h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
.opd__hint { font-size: 0.85rem; color: #6b7280; margin: 0; }
.opd__warning { font-size: 0.8rem; color: #92400e; background: #fffbeb; border-radius: 8px; padding: 0.6rem 0.75rem; margin: 0; }
.opd__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1.1rem; letter-spacing: 0.15em; width: 100%; box-sizing: border-box;
}
.opd__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.opd__forgot { background: none; border: none; color: #2563eb; font-size: 0.85rem; cursor: pointer; padding: 0; text-align: left; }
.opd__actions { display: flex; gap: 0.6rem; margin-top: 0.25rem; }
.opd__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.opd__btn--cancel { background: #f3f4f6; color: #374151; }
.opd__btn--confirm { background: #16a34a; color: #fff; }
.opd__btn--confirm:disabled { opacity: 0.6; }
</style>
