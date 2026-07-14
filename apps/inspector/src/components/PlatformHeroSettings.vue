<!-- Platform-brede hero-foto op het hoofdmenu (UX-FLOW.md §7): een
     crowdsourced sfeerfoto die periodiek wisselt (klantfoto's, social-media-
     contest). Deze tegel is alleen zichtbaar voor een platform-admin
     (Settings.vue gate); de RLS-policy op platform_settings dwingt het
     schrijven ook op databaseniveau af (is_platform_admin(), zie migratie
     20260714_platform_hero_and_dashboard_stat.sql). Twee losse crops omdat
     het hoofdmenu op mobiel/tablet en desktop een andere compositie toont. -->
<template>
  <section class="ph">
    <p class="ph__intro">{{ $t('settings.hero.intro') }}</p>

    <div v-if="loading" class="ph__state">{{ $t('common.loading') }}</div>
    <template v-else>
      <div class="ph__field">
        <label>{{ $t('settings.hero.mobileLabel') }}</label>
        <div v-if="mobilePreviewUrl" class="ph__preview ph__preview--mobile">
          <img :src="mobilePreviewUrl" alt="" />
        </div>
        <input type="file" accept="image/*" @change="onSelect('mobile', $event)" />
      </div>

      <div class="ph__field">
        <label>{{ $t('settings.hero.desktopLabel') }}</label>
        <div v-if="desktopPreviewUrl" class="ph__preview ph__preview--desktop">
          <img :src="desktopPreviewUrl" alt="" />
        </div>
        <input type="file" accept="image/*" @change="onSelect('desktop', $event)" />
      </div>

      <p v-if="error" class="ph__error">{{ error }}</p>
      <p v-if="saved" class="ph__saved">{{ $t('settings.hero.saved') }}</p>
      <button class="ph__btn" :disabled="saving" @click="save">
        {{ saving ? $t('common.saving') : $t('common.save') }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { supabase, errorMessage } from '@gearonimo/core'

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

const mobilePath = ref<string | null>(null)
const desktopPath = ref<string | null>(null)
const mobilePreviewUrl = ref<string | null>(null)
const desktopPreviewUrl = ref<string | null>(null)

let pendingMobileFile: File | null = null
let pendingDesktopFile: File | null = null

function publicUrl(path: string) {
  const { data } = supabase.storage.from('branding').getPublicUrl(path)
  return data.publicUrl
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase
      .from('platform_settings')
      .select('hero_photo_mobile_path, hero_photo_desktop_path')
      .eq('id', true)
      .maybeSingle()
    if (err) throw err
    mobilePath.value = data?.hero_photo_mobile_path ?? null
    desktopPath.value = data?.hero_photo_desktop_path ?? null
    if (mobilePath.value) mobilePreviewUrl.value = publicUrl(mobilePath.value)
    if (desktopPath.value) desktopPreviewUrl.value = publicUrl(desktopPath.value)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function onSelect(kind: 'mobile' | 'desktop', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  if (kind === 'mobile') {
    pendingMobileFile = file
    if (mobilePreviewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(mobilePreviewUrl.value)
    mobilePreviewUrl.value = url
  } else {
    pendingDesktopFile = file
    if (desktopPreviewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(desktopPreviewUrl.value)
    desktopPreviewUrl.value = url
  }
}

async function uploadIfPending(file: File | null, prefix: string): Promise<string | null> {
  if (!file) return null
  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const path = `platform/${prefix}-${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('branding')
    .upload(path, file, { contentType: file.type, upsert: true })
  if (upErr) throw upErr
  return path
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const newMobilePath = await uploadIfPending(pendingMobileFile, 'hero-mobile')
    const newDesktopPath = await uploadIfPending(pendingDesktopFile, 'hero-desktop')
    if (newMobilePath) mobilePath.value = newMobilePath
    if (newDesktopPath) desktopPath.value = newDesktopPath

    const { error: err } = await supabase
      .from('platform_settings')
      .update({
        hero_photo_mobile_path: mobilePath.value,
        hero_photo_desktop_path: desktopPath.value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true)
    if (err) throw err

    pendingMobileFile = null
    pendingDesktopFile = null
    saved.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.ph__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 1rem; }
.ph__state { color: #666; font-size: 0.9rem; }
.ph__field { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1.25rem; font-size: 0.85rem; color: #374151; }
.ph__preview { border-radius: 10px; overflow: hidden; border: 1px solid #ddd; background: #f0f4f8; }
.ph__preview img { width: 100%; display: block; object-fit: cover; }
.ph__preview--mobile { max-width: 160px; aspect-ratio: 9 / 16; }
.ph__preview--desktop { aspect-ratio: 16 / 6; }
.ph__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.5rem; }
.ph__saved { color: #16a34a; font-size: 0.9rem; margin: 0 0 0.5rem; }
.ph__btn { background: #16a34a; color: #fff; border: none; border-radius: 10px; padding: 0.75rem 1.25rem; font-weight: 700; cursor: pointer; }
.ph__btn:disabled { opacity: 0.6; }
</style>
