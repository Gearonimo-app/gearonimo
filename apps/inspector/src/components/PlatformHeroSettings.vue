<!-- Platform-brede hero-foto op het hoofdmenu + kopstrook (UX-FLOW.md §7):
     een crowdsourced sfeerfoto die periodiek wisselt. Alleen zichtbaar voor
     een platform-admin (Settings.vue gate); de RLS-policy op platform_settings
     dwingt het schrijven ook op databaseniveau af (is_platform_admin()).

     Eén gekozen foto wordt voor drie vormen uitgesneden -- mobiel/tablet
     (staand), desktop (breed) en de kopstrook op de subpagina's (breed/laag)
     -- elk met eigen inzoomen + uitlijnen. Een overlay-schuif regelt hoe
     donker de foto onder de tekst wordt (drukke foto = donkerder = leesbaar);
     de voorbeelden tonen die donkering live. Uitgesneden beeld wordt
     client-side naar een canvas gerenderd en als JPEG naar de publieke
     branding-bucket geupload. -->
<template>
  <section class="ph">
    <p class="ph__intro">{{ $t('settings.hero.intro') }}</p>

    <div v-if="loading" class="ph__state">{{ $t('common.loading') }}</div>
    <template v-else>
      <label class="ph__file">
        <span class="ph__file-btn">{{ $t('settings.hero.chooseFile') }}</span>
        <input type="file" accept="image/*" @change="onSelect" />
      </label>

      <div class="ph__crops">
        <div v-for="t in targets" :key="t.key" class="ph__crop">
          <div class="ph__crop-title">{{ $t(t.label) }}</div>

          <!-- Live voorbeeld met dezelfde donkere overlay als straks in de app. -->
          <div class="ph__frame" :style="frameStyle(t)">
            <div class="ph__frame-scrim" :style="{ background: `rgba(10,26,18,${overlay})` }"></div>
            <span v-if="!sourceUrl && !existingUrl(t)" class="ph__frame-empty">{{ $t('settings.hero.noPhoto') }}</span>
          </div>

          <template v-if="sourceUrl">
            <label class="ph__slider">
              <span>{{ $t('settings.hero.zoom') }}</span>
              <input type="range" min="1" max="4" step="0.01" v-model.number="crop[t.key].zoom" />
            </label>
            <label class="ph__slider">
              <span>{{ $t('settings.hero.horizontal') }}</span>
              <input type="range" min="0" max="100" step="1" v-model.number="crop[t.key].posX" />
            </label>
            <label class="ph__slider">
              <span>{{ $t('settings.hero.vertical') }}</span>
              <input type="range" min="0" max="100" step="1" v-model.number="crop[t.key].posY" />
            </label>
          </template>
        </div>
      </div>

      <!-- Overlay-donkering: geldt voor het hoofdmenu én de kopstrook. -->
      <label class="ph__overlay">
        <span class="ph__overlay-label">{{ $t('settings.hero.overlay') }}</span>
        <input type="range" min="0.2" max="0.85" step="0.05" v-model.number="overlay" />
        <span class="ph__overlay-val">{{ Math.round(overlay * 100) }}%</span>
      </label>
      <p class="ph__overlay-hint">{{ $t('settings.hero.overlayHint') }}</p>

      <p v-if="error" class="ph__error">{{ error }}</p>
      <p v-if="saved" class="ph__saved">{{ $t('settings.hero.saved') }}</p>
      <button class="ph__btn" :disabled="saving" @click="save">
        {{ saving ? $t('common.saving') : $t('common.save') }}
      </button>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { supabase, errorMessage } from '@gearonimo/core'

type TargetKey = 'mobile' | 'desktop' | 'strip'
interface Target {
  key: TargetKey
  label: string
  outW: number
  outH: number
  cw: number // voorbeeldbreedte in CSS-px
  ch: number // voorbeeldhoogte in CSS-px (zelfde aspect als out)
}

// Output-resoluties + voorbeeldformaten (zelfde beeldverhouding).
const targets: Target[] = [
  { key: 'mobile',  label: 'settings.hero.mobileLabel',  outW: 720,  outH: 1280, cw: 150, ch: 267 },
  { key: 'desktop', label: 'settings.hero.desktopLabel', outW: 1280, outH: 480,  cw: 320, ch: 120 },
  { key: 'strip',   label: 'settings.hero.stripLabel',   outW: 1600, outH: 200,  cw: 320, ch: 40  },
]

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')
const overlay = ref(0.55)

// Bestaande, al opgeslagen paden (blijven staan als er geen nieuwe foto is).
const paths = reactive<Record<TargetKey, string | null>>({ mobile: null, desktop: null, strip: null })
const existingUrls = reactive<Record<TargetKey, string | null>>({ mobile: null, desktop: null, strip: null })

// Nieuw gekozen bronfoto.
const sourceUrl = ref<string | null>(null)
let sourceImg: HTMLImageElement | null = null

const crop = reactive<Record<TargetKey, { zoom: number; posX: number; posY: number }>>({
  mobile:  { zoom: 1, posX: 50, posY: 50 },
  desktop: { zoom: 1, posX: 50, posY: 50 },
  strip:   { zoom: 1, posX: 50, posY: 50 },
})

function existingUrl(t: Target): string | null {
  return existingUrls[t.key]
}

function publicUrl(path: string) {
  return supabase.storage.from('branding').getPublicUrl(path).data.publicUrl
}

// Cover-schaal zodat de foto het frame vult, maal de zoom. Zelfde formule in
// het voorbeeld (CSS-px) en bij het renderen (output-px), zodat wat je ziet
// exact is wat wordt opgeslagen.
function coverScale(imgW: number, imgH: number, w: number, h: number, zoom: number) {
  return Math.max(w / imgW, h / imgH) * zoom
}

function frameStyle(t: Target) {
  const base: Record<string, string> = { width: `${t.cw}px`, height: `${t.ch}px` }
  if (sourceUrl.value && sourceImg) {
    const c = crop[t.key]
    const s = coverScale(sourceImg.naturalWidth, sourceImg.naturalHeight, t.cw, t.ch, c.zoom)
    const bw = sourceImg.naturalWidth * s
    const bh = sourceImg.naturalHeight * s
    const bx = (t.cw - bw) * (c.posX / 100)
    const by = (t.ch - bh) * (c.posY / 100)
    return {
      ...base,
      backgroundImage: `url("${sourceUrl.value}")`,
      backgroundSize: `${bw}px ${bh}px`,
      backgroundPosition: `${bx}px ${by}px`,
      backgroundRepeat: 'no-repeat',
    }
  }
  const ex = existingUrl(t)
  if (ex) {
    return { ...base, backgroundImage: `url("${ex}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  return base
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase
      .from('platform_settings')
      .select('hero_photo_mobile_path, hero_photo_desktop_path, hero_photo_strip_path, hero_overlay')
      .eq('id', true)
      .maybeSingle()
    if (err) throw err
    paths.mobile = data?.hero_photo_mobile_path ?? null
    paths.desktop = data?.hero_photo_desktop_path ?? null
    paths.strip = data?.hero_photo_strip_path ?? null
    if (typeof data?.hero_overlay === 'number') overlay.value = data.hero_overlay
    for (const key of ['mobile', 'desktop', 'strip'] as TargetKey[]) {
      if (paths[key]) existingUrls[key] = publicUrl(paths[key] as string)
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function onSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    sourceImg = img
    crop.mobile = { zoom: 1, posX: 50, posY: 50 }
    crop.desktop = { zoom: 1, posX: 50, posY: 50 }
    crop.strip = { zoom: 1, posX: 50, posY: 50 }
  }
  img.src = sourceUrl.value
}

// Snijdt de bronfoto uit naar de output-resolutie van dit target en levert
// een JPEG-blob. Zelfde cover+zoom+positie-formule als het voorbeeld.
function renderCrop(t: Target): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!sourceImg) return reject(new Error('geen bronfoto'))
    const canvas = document.createElement('canvas')
    canvas.width = t.outW
    canvas.height = t.outH
    const ctx = canvas.getContext('2d')
    if (!ctx) return reject(new Error('geen canvas-context'))
    const c = crop[t.key]
    const s = coverScale(sourceImg.naturalWidth, sourceImg.naturalHeight, t.outW, t.outH, c.zoom)
    const sw = sourceImg.naturalWidth * s
    const sh = sourceImg.naturalHeight * s
    const ox = (t.outW - sw) * (c.posX / 100)
    const oy = (t.outH - sh) * (c.posY / 100)
    ctx.drawImage(sourceImg, ox, oy, sw, sh)
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('render mislukt'))),
      'image/jpeg',
      0.85,
    )
  })
}

async function uploadCrop(t: Target): Promise<string> {
  const blob = await renderCrop(t)
  const path = `platform/hero-${t.key}-${Date.now()}.jpg`
  const { error: upErr } = await supabase.storage
    .from('branding')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (upErr) throw upErr
  return path
}

async function save() {
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    if (sourceImg) {
      for (const t of targets) {
        paths[t.key] = await uploadCrop(t)
      }
    }
    const { error: err } = await supabase
      .from('platform_settings')
      .update({
        hero_photo_mobile_path: paths.mobile,
        hero_photo_desktop_path: paths.desktop,
        hero_photo_strip_path: paths.strip,
        hero_overlay: overlay.value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true)
    if (err) throw err
    saved.value = true
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
})
</script>

<style scoped>
.ph__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 1rem; }
.ph__state { color: #666; font-size: 0.9rem; }

.ph__file { display: inline-block; margin-bottom: 1.25rem; }
.ph__file input { display: none; }
.ph__file-btn {
  display: inline-block; background: #1a3a2a; color: #fff;
  padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.9rem; cursor: pointer;
}

.ph__crops { display: flex; flex-wrap: wrap; gap: 1.5rem; margin-bottom: 1.25rem; }
.ph__crop { display: flex; flex-direction: column; gap: 0.5rem; }
.ph__crop-title { font-size: 0.85rem; font-weight: 600; color: #374151; }

.ph__frame {
  position: relative;
  border-radius: 10px;
  border: 1px solid #ddd;
  background-color: #eef2f5;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
}
.ph__frame-scrim { position: absolute; inset: 0; pointer-events: none; }
.ph__frame-empty { position: relative; font-size: 0.75rem; color: #9ca3af; }

.ph__slider { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: #6b7280; }
.ph__slider span { width: 70px; flex-shrink: 0; }
.ph__slider input { flex: 1; }

.ph__overlay { display: flex; align-items: center; gap: 0.6rem; font-size: 0.85rem; color: #374151; margin-bottom: 0.2rem; max-width: 420px; }
.ph__overlay-label { flex-shrink: 0; }
.ph__overlay input { flex: 1; }
.ph__overlay-val { width: 3rem; text-align: right; flex-shrink: 0; color: #6b7280; }
.ph__overlay-hint { font-size: 0.78rem; color: #9ca3af; margin: 0 0 1.25rem; }

.ph__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.5rem; }
.ph__saved { color: #16a34a; font-size: 0.9rem; margin: 0 0 0.5rem; }
.ph__btn { background: #16a34a; color: #fff; border: none; border-radius: 10px; padding: 0.75rem 1.25rem; font-weight: 700; cursor: pointer; }
.ph__btn:disabled { opacity: 0.6; }
</style>
