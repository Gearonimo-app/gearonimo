<template>
  <section class="cs">
    <p class="cs__intro">{{ $t('settings.certificate.intro') }}</p>

    <div v-if="loading" class="cs__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="cs__state cs__state--error">{{ error }}</div>

    <template v-else>
      <div class="cs__cols">
        <!-- ===== Linkerkolom: instellingen ===== -->
        <div class="cs__form">
          <h3>{{ $t('settings.certificate.companyData') }}</h3>
          <label class="cs__field"><span>{{ $t('settings.certificate.fields.name') }}</span>
            <input v-model="form.name" class="cs__input" /></label>
          <label class="cs__field"><span>{{ $t('settings.certificate.fields.address') }}</span>
            <input v-model="form.address" class="cs__input" /></label>
          <div class="cs__row">
            <label class="cs__field"><span>{{ $t('settings.certificate.fields.postal') }}</span>
              <input v-model="form.postal_code" class="cs__input" /></label>
            <label class="cs__field cs__field--grow"><span>{{ $t('settings.certificate.fields.city') }}</span>
              <input v-model="form.city" class="cs__input" /></label>
          </div>
          <label class="cs__field"><span>{{ $t('settings.certificate.fields.province') }}</span>
            <input v-model="form.province" class="cs__input" :placeholder="$t('settings.certificate.fields.provincePh')" /></label>
          <div class="cs__row">
            <label class="cs__field cs__field--grow"><span>{{ $t('settings.certificate.fields.email') }}</span>
              <input v-model="form.email" class="cs__input" /></label>
            <label class="cs__field"><span>{{ $t('settings.certificate.fields.phone') }}</span>
              <input v-model="form.phone" class="cs__input" /></label>
          </div>
          <div class="cs__row">
            <label class="cs__field cs__field--grow"><span>{{ $t('settings.certificate.fields.kvk') }}</span>
              <input v-model="form.registration_number" class="cs__input" /></label>
            <label class="cs__field cs__field--grow"><span>{{ $t('settings.certificate.fields.vat') }}</span>
              <input v-model="form.vat_number" class="cs__input" /></label>
          </div>

          <h3>{{ $t('settings.certificate.logo') }}</h3>
          <div class="cs__logo">
            <div class="cs__logo-preview">
              <img v-if="logoPreviewUrl" :src="logoPreviewUrl" alt="logo" />
              <span v-else class="cs__logo-empty">{{ $t('settings.certificate.noLogo') }}</span>
            </div>
            <div class="cs__logo-actions">
              <label class="cs__btn cs__btn--ghost">
                {{ $t('settings.certificate.uploadLogo') }}
                <input type="file" accept="image/png,image/jpeg" class="cs__file" @change="onLogoSelect" />
              </label>
              <button v-if="logoPreviewUrl" class="cs__btn cs__btn--ghost" @click="removeLogo">
                {{ $t('settings.certificate.removeLogo') }}
              </button>
            </div>
          </div>

          <h3>{{ $t('settings.certificate.layout') }}</h3>
          <label class="cs__field"><span>{{ $t('settings.certificate.orientation') }}</span>
            <select v-model="layout.orientation" class="cs__input">
              <option value="auto">{{ $t('settings.certificate.orientAuto') }}</option>
              <option value="portrait">{{ $t('settings.certificate.orientPortrait') }}</option>
              <option value="landscape">{{ $t('settings.certificate.orientLandscape') }}</option>
            </select>
          </label>

          <label class="cs__field"><span>{{ $t('settings.certificate.logoSize') }} ({{ Math.round(layout.logoScale * 100) }}%)</span>
            <input v-model.number="layout.logoScale" type="range" min="0.3" max="2.5" step="0.05" class="cs__range" /></label>

          <label class="cs__field"><span>{{ $t('settings.certificate.logoAlign') }}</span>
            <select v-model="layout.logoAlign" class="cs__input">
              <option value="left">{{ $t('settings.certificate.alignLeft') }}</option>
              <option value="center">{{ $t('settings.certificate.alignCenter') }}</option>
              <option value="right">{{ $t('settings.certificate.alignRight') }}</option>
            </select>
          </label>

          <label class="cs__field"><span>{{ $t('settings.certificate.logoNudge') }} ({{ layout.logoOffsetX }})</span>
            <input v-model.number="layout.logoOffsetX" type="range" min="-120" max="120" step="2" class="cs__range" /></label>

          <label class="cs__field"><span>{{ $t('settings.certificate.logoNudgeY') }} ({{ layout.logoOffsetY }})</span>
            <input v-model.number="layout.logoOffsetY" type="range" min="0" max="160" step="2" class="cs__range" /></label>

          <label class="cs__field"><span>{{ $t('settings.certificate.companyPos') }}</span>
            <select v-model="layout.companyInfo" class="cs__input">
              <option value="left">{{ $t('settings.certificate.alignLeft') }}</option>
              <option value="right">{{ $t('settings.certificate.alignRight') }}</option>
            </select>
          </label>

          <label class="cs__field"><span>{{ $t('settings.certificate.headerNudgeY') }} ({{ layout.headerOffsetY }})</span>
            <input v-model.number="layout.headerOffsetY" type="range" min="0" max="200" step="2" class="cs__range" /></label>

          <label class="cs__check"><input type="checkbox" v-model="layout.showAddress" /> {{ $t('settings.certificate.showAddress') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.showContact" /> {{ $t('settings.certificate.showContact') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.showRegistration" /> {{ $t('settings.certificate.showRegistration') }}</label>

          <label class="cs__field cs__field--color"><span>{{ $t('settings.certificate.accent') }}</span>
            <input v-model="layout.accent" type="color" class="cs__color" /></label>

          <h3>{{ $t('settings.certificate.columns.title') }}</h3>
          <p class="cs__hint">{{ $t('settings.certificate.columns.hint') }}</p>
          <label class="cs__check cs__check--fixed">{{ $t('settings.certificate.columns.fixed') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.year" /> {{ $t('settings.certificate.columns.year') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.category" /> {{ $t('settings.certificate.columns.category') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.norm" /> {{ $t('settings.certificate.columns.norm') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.mbs" /> {{ $t('settings.certificate.columns.mbs') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.user" /> {{ $t('settings.certificate.columns.user') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.next" /> {{ $t('settings.certificate.columns.next') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.note" /> {{ $t('settings.certificate.columns.note') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.swl" /> {{ $t('settings.certificate.columns.swl') }}</label>
          <label class="cs__check"><input type="checkbox" v-model="layout.columns.previous" /> {{ $t('settings.certificate.columns.previous') }}</label>
          <p v-if="countryCode === 'GB'" class="cs__hint">{{ $t('settings.certificate.columns.gbForced') }}</p>

          <h3>{{ $t('settings.certificate.texts') }}</h3>
          <p v-if="countryCode === 'GB'" class="cs__hint">{{ $t('settings.certificate.legalReferenceTip') }}</p>
          <label class="cs__field">
            <span>
              {{ $t('settings.certificate.fields.header') }}
              <button v-if="!form.cert_header" class="cs__inline" @click="form.cert_header = defaultHeader">{{ $t('settings.certificate.insertDefault') }}</button>
            </span>
            <textarea v-model="form.cert_header" rows="4" class="cs__input"></textarea>
          </label>
          <label class="cs__field">
            <span>
              {{ $t('settings.certificate.fields.footer') }}
              <button v-if="!form.cert_footer" class="cs__inline" @click="form.cert_footer = defaultFooter">{{ $t('settings.certificate.insertDefault') }}</button>
            </span>
            <textarea v-model="form.cert_footer" rows="3" class="cs__input"></textarea>
          </label>

          <p v-if="saveError" class="cs__error">{{ saveError }}</p>
          <div class="cs__actions">
            <button class="cs__btn cs__btn--save" :disabled="saving" @click="save">
              {{ saving ? $t('common.saving') : $t('common.save') }}
            </button>
          </div>
        </div>

        <!-- ===== Rechterkolom: live preview ===== -->
        <div class="cs__preview">
          <div class="cs__preview-head">
            <span>{{ $t('settings.certificate.preview') }}</span>
            <span v-if="rendering" class="cs__preview-busy">{{ $t('settings.certificate.rendering') }}</span>
          </div>
          <iframe v-if="previewUrl" :src="previewUrl" class="cs__frame" title="preview"></iframe>
          <div v-else class="cs__frame cs__frame--empty">{{ $t('common.loading') }}</div>
          <p class="cs__note">{{ $t('settings.certificate.previewNote') }}</p>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, errorMessage } from '@gearonimo/core'
import { ensureInspector } from '../composables/useInspections'
import {
  renderCertificatePdf,
  resolveLayout,
  fetchLogoBytes,
  certLanguageForCountry,
  type CertLayout,
  type CertData,
} from '../composables/useCertificate'

const { t } = useI18n()

const loading = ref(true)
const error = ref('')
const saving = ref(false)
const saveError = ref('')
const rendering = ref(false)

const companyId = ref('')
const countryCode = ref('NL')
const form = reactive({
  name: '',
  address: '',
  postal_code: '',
  city: '',
  province: '',
  email: '',
  phone: '',
  registration_number: '',
  vat_number: '',
  cert_header: '',
  cert_footer: '',
})
const layout = reactive<CertLayout>(resolveLayout(null))

const logoPath = ref<string | null>(null)
const logoBytes = ref<Uint8Array | null>(null)
const logoPreviewUrl = ref<string | null>(null)
let pendingLogoFile: File | null = null
let logoRemoved = false

const previewUrl = ref<string | null>(null)

const defaultHeader = t('settings.certificate.defaultHeader')
const defaultFooter = t('settings.certificate.defaultFooter')

async function load() {
  loading.value = true
  error.value = ''
  try {
    const inspector = await ensureInspector()
    companyId.value = inspector.company_id
    const { data, error: err } = await supabase
      .from('inspection_companies')
      .select('name, country_code, address, postal_code, city, province, email, phone, registration_number, vat_number, cert_header, cert_footer, logo_path, cert_layout')
      .eq('id', inspector.company_id)
      .single()
    if (err) throw err
    form.name = data.name ?? ''
    form.address = data.address ?? ''
    form.postal_code = data.postal_code ?? ''
    form.city = data.city ?? ''
    form.province = data.province ?? ''
    form.email = data.email ?? ''
    form.phone = data.phone ?? ''
    form.registration_number = data.registration_number ?? ''
    form.vat_number = data.vat_number ?? ''
    form.cert_header = data.cert_header ?? ''
    form.cert_footer = data.cert_footer ?? ''
    countryCode.value = data.country_code ?? 'NL'
    Object.assign(layout, resolveLayout(data.cert_layout))
    logoPath.value = data.logo_path ?? null
    if (logoPath.value) {
      logoBytes.value = await fetchLogoBytes(logoPath.value)
      const { data: pub } = supabase.storage.from('branding').getPublicUrl(logoPath.value)
      logoPreviewUrl.value = pub.publicUrl
    }
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function onLogoSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  pendingLogoFile = file
  logoRemoved = false
  file.arrayBuffer().then((buf) => {
    logoBytes.value = new Uint8Array(buf)
  })
  if (logoPreviewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(logoPreviewUrl.value)
  logoPreviewUrl.value = URL.createObjectURL(file)
}

function removeLogo() {
  pendingLogoFile = null
  logoRemoved = true
  logoBytes.value = null
  if (logoPreviewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(logoPreviewUrl.value)
  logoPreviewUrl.value = null
  logoPath.value = null
}

// ---- Live preview ----
function sampleData(): CertData {
  return {
    company: {
      name: form.name || t('settings.certificate.sampleCompany'),
      address: form.address || null,
      postal_code: form.postal_code || null,
      city: form.city || null,
      province: form.province || null,
      email: form.email || null,
      phone: form.phone || null,
      registration_number: form.registration_number || null,
      vat_number: form.vat_number || null,
      cert_header: form.cert_header || null,
      cert_footer: form.cert_footer || null,
    },
    customerName: t('settings.certificate.sampleCustomer'),
    inspectionDate: new Date().toISOString().slice(0, 10),
    inspectorName: t('settings.certificate.sampleInspector'),
    number: '20260625-VOORBEELD',
    verifyUrl: window.location.origin + '/verify/voorbeeld',
    // Preview in dezelfde taal als het echte certificaat (land van het bedrijf).
    language: certLanguageForCountry(countryCode.value),
    items: [
      { result: 'passed', brand: 'Petzl', name: 'Avao Bod Fast harnasgordel', serial_number: '21A0001234', manufacture_year: 2021, manufacture_month: 3, category: 'Harnasgordel', norm: 'EN 361', mbs: '15 kN', user: 'Jan Jansen', next_due: '2027-06-25', rejection_code_label: null, comment: null },
      { result: 'passed', brand: 'Petzl', name: 'Astro Bod Fast', serial_number: '20B0007777', manufacture_year: 2020, manufacture_month: null, category: 'Harnasgordel', norm: 'EN 813', mbs: '15 kN', user: 'Jan Jansen', next_due: '2027-06-25', rejection_code_label: null, comment: null },
      { result: 'failed', brand: 'Edelrid', name: 'Karabiner staal met schroefsluiting', serial_number: '19C0042000', manufacture_year: 2019, manufacture_month: 7, category: 'Karabiner', norm: 'EN 362', mbs: '25 kN', user: 'Piet de Vries', next_due: null, rejection_code_label: 'Slijtage, opgebruikt', comment: 'Sluiting loopt stroef, zichtbare slijtage aan de poort.' },
      { result: 'passed', brand: 'Camp Safety', name: 'Helm Titan', serial_number: '22D0005555', manufacture_year: 2022, manufacture_month: 1, category: 'Helm', norm: 'EN 397', mbs: null, user: null, next_due: '2027-06-25', rejection_code_label: null, comment: null },
      { result: 'passed', brand: 'Beal', name: 'Touw 11mm 50m', serial_number: '21E0009999', manufacture_year: 2021, manufacture_month: null, category: 'Touw', norm: 'EN 1891', mbs: '22 kN', user: null, next_due: '2027-06-25', rejection_code_label: null, comment: null },
    ],
    // De handtekening is per keurmeester (Instellingen → Keurmeesters), niet
    // per bedrijf; in deze bedrijfsbrede voorbeeldweergave tonen we 'm niet.
    signature: null,
  }
}

let renderTimer: ReturnType<typeof setTimeout> | undefined
async function refreshPreview() {
  rendering.value = true
  try {
    const bytes = await renderCertificatePdf(sampleData(), { ...layout }, logoBytes.value)
    // Uint8Array → Blob (kopie via slice voorkomt detached-buffer-issues).
    const blob = new Blob([bytes.slice()], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = url
  } catch {
    // preview-fout stil; instellingen blijven bruikbaar
  } finally {
    rendering.value = false
  }
}
function schedulePreview() {
  clearTimeout(renderTimer)
  renderTimer = setTimeout(refreshPreview, 350)
}

watch([() => ({ ...form }), () => ({ ...layout }), logoBytes], schedulePreview, { deep: true })

async function save() {
  saveError.value = ''
  saving.value = true
  try {
    // Logo eerst verwerken zodat logo_path klopt vóór de update.
    if (pendingLogoFile) {
      const ext = pendingLogoFile.type === 'image/png' ? 'png' : 'jpg'
      const path = `${companyId.value}/logo-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('branding')
        .upload(path, pendingLogoFile, { contentType: pendingLogoFile.type, upsert: true })
      if (upErr) throw upErr
      logoPath.value = path
      pendingLogoFile = null
    }

    const { error: err } = await supabase
      .from('inspection_companies')
      .update({
        name: form.name.trim() || null,
        address: form.address.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        province: form.province.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        registration_number: form.registration_number.trim() || null,
        vat_number: form.vat_number.trim() || null,
        cert_header: form.cert_header.trim() || null,
        cert_footer: form.cert_footer.trim() || null,
        cert_layout: { ...layout },
        logo_path: logoRemoved ? null : logoPath.value,
      })
      .eq('id', companyId.value)
    if (err) throw err
    logoRemoved = false
  } catch (e) {
    saveError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await load()
  refreshPreview()
})
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  if (logoPreviewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(logoPreviewUrl.value)
})
</script>

<style scoped>
.cs { margin-top: 0.25rem; }
.cs__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 1rem; }
.cs__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.cs__state--error { color: #dc2626; }

.cs__cols { display: flex; gap: 1.25rem; align-items: flex-start; }
.cs__form { flex: 1 1 340px; min-width: 300px; display: flex; flex-direction: column; gap: 0.6rem; }
.cs__form h3 { margin: 0.75rem 0 0; font-size: 0.95rem; color: #1a3a2a; }
.cs__form h3:first-child { margin-top: 0; }

.cs__field { display: flex; flex-direction: column; gap: 0.25rem; }
.cs__field > span { font-size: 0.8rem; color: #374151; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.cs__field--grow { flex: 1; }
.cs__field--color { max-width: 160px; }
.cs__row { display: flex; gap: 0.6rem; }
.cs__row .cs__field { flex: 1; }
.cs__input {
  padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
textarea.cs__input { resize: vertical; }
.cs__range { width: 100%; }
.cs__color { width: 100%; height: 38px; padding: 2px; border: 1px solid #ddd; border-radius: 8px; background: #fff; }
.cs__check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
.cs__check--fixed { color: #6b7280; font-size: 0.82rem; font-style: italic; }
.cs__hint { font-size: 0.78rem; color: #6b7280; margin: 0 0 0.2rem; }
.cs__inline { background: none; border: none; color: #16a34a; font-size: 0.78rem; font-weight: 600; cursor: pointer; padding: 0; }

.cs__logo { display: flex; gap: 0.75rem; align-items: center; }
.cs__logo-preview {
  width: 120px; height: 72px; border: 1px dashed #cbd5e1; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; background: #fff; overflow: hidden;
}
.cs__logo-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
.cs__logo-empty { font-size: 0.75rem; color: #9ca3af; }
.cs__logo-actions { display: flex; flex-direction: column; gap: 0.4rem; }
.cs__file { display: none; }

.cs__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.cs__actions { margin-top: 0.5rem; }
.cs__btn { padding: 0.7rem 1.1rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.cs__btn--save { background: #16a34a; color: #fff; width: 100%; padding: 0.85rem; }
.cs__btn--ghost { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; text-align: center; }
.cs__btn:disabled { opacity: 0.6; }

.cs__preview { flex: 1 1 360px; min-width: 300px; position: sticky; top: 1rem; }
.cs__preview-head { display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; font-weight: 600; color: #374151; margin-bottom: 0.4rem; }
.cs__preview-busy { font-size: 0.78rem; color: #2563eb; font-weight: 500; }
.cs__frame { width: 100%; height: 620px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; }
.cs__frame--empty { display: flex; align-items: center; justify-content: center; color: #9ca3af; }
.cs__note { font-size: 0.78rem; color: #6b7280; margin: 0.5rem 0 0; }

@media (max-width: 760px) {
  .cs__cols { flex-direction: column; }
  .cs__preview { position: static; width: 100%; }
}
</style>
