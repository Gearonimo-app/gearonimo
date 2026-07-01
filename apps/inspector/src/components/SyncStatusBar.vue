<template>
  <div v-if="visible" class="ssb">
    <span class="ssb__icon">{{ isOnline ? '🔄' : '📴' }}</span>
    <span class="ssb__text">{{ statusText }}</span>
    <!-- Vergrendelde PIN-sessie: de offline-schermen kunnen de cache dan niet
         lezen, en de certificaat-stap van de sync kan niet draaien. Zonder
         deze knop was ontgrendelen alleen mogelijk via de pagina Offline
         downloads -- niet vindbaar als je gewoon een klant opent. -->
    <button
      v-if="needsUnlock"
      class="ssb__btn"
      @click="showPinDialog = true"
    >
      {{ $t('offline.locked.unlockButton') }}
    </button>
    <button
      v-if="isOnline && (pendingTotal > 0 || pendingCompletions > 0)"
      class="ssb__btn"
      :disabled="syncing"
      @click="runSync"
    >
      {{ syncing ? $t('sync.syncing') : $t('sync.syncNow') }}
    </button>

    <OfflinePinDialog v-if="showPinDialog" @unlocked="showPinDialog = false" @cancel="showPinDialog = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useOffline } from '../composables/useOffline'
import OfflinePinDialog from './OfflinePinDialog.vue'

const { t } = useI18n()
const { isOnline, pendingTotal, pendingCompletions, syncing, lastSyncError, session, runSync } = useOffline()

const showPinDialog = ref(false)

const needsUnlock = computed(() => session.pinConfigured.value && !session.isUnlocked.value)

// Alleen tonen als er iets te melden is: offline (en offline-opslag in
// gebruik), nog openstaande mutaties, of een offline afgeronde keuring die
// op haar certificaat wacht -- geen permanente balk die online,
// niets-te-doen gebruikers in de weg zit.
const visible = computed(
  () =>
    (!isOnline.value && session.pinConfigured.value) ||
    pendingTotal.value > 0 ||
    pendingCompletions.value > 0
)

const statusText = computed(() => {
  if (lastSyncError.value) return t('sync.errorShort')
  if (!isOnline.value) return t('sync.offline')
  if (pendingTotal.value > 0) return t('sync.pendingCount', { count: pendingTotal.value })
  if (pendingCompletions.value > 0) return t('sync.certificatesPending', { count: pendingCompletions.value })
  return t('sync.upToDate')
})
</script>

<style scoped>
.ssb {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 150;
  display: flex; align-items: center; gap: 0.6rem;
  background: #1a3a2a; color: #fff; padding: 0.6rem 1rem;
  font-size: 0.85rem;
  padding-bottom: calc(0.6rem + env(safe-area-inset-bottom));
}
.ssb__icon { font-size: 1rem; }
.ssb__text { flex: 1; }
.ssb__btn {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; cursor: pointer;
}
.ssb__btn:disabled { opacity: 0.6; }
</style>
