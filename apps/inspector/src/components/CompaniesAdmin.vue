<!-- Platform-admin "Bedrijven"-beheer (besluit Jos 2026-07-19): keurbedrijven
     aanmaken en de eerste beheerder koppelen. Zodra een bedrijf één
     beheerder heeft, regelt dat bedrijf zijn eigen keurmeesters/klanten
     verder zelf via Instellingen -> Keurmeesters (InspectorsSettings.vue).
     Curator-rol (can_curate_catalog) staat hier ook: platform-brede
     vertrouwensbeslissing, los van welk bedrijf iemand bij zit.

     Let op, echte grens (zie migratie 20260740): inspectors.user_id is
     UNIQUE -- één account = één keurbedrijf tegelijk. Iemand koppelen aan
     bedrijf B verplaatst diegene weg van bedrijf A. -->
<template>
  <section class="ca">
    <div v-if="loading" class="ca__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ca__state ca__state--error">{{ error }}</div>

    <!-- ===================== LIJST ===================== -->
    <template v-else-if="!selected">
      <p class="ca__intro">{{ $t('settings.companies.intro') }}</p>

      <div class="ca__head">
        <h2>{{ $t('settings.companies.title') }}</h2>
        <button v-if="!showAdd" class="ca__add" @click="openAdd">+ {{ $t('settings.companies.add') }}</button>
      </div>

      <ul class="ca__list">
        <li v-for="c in companies" :key="c.id" class="ca__item" @click="select(c)">
          <div class="ca__body">
            <div class="ca__name">{{ c.name }}</div>
            <div class="ca__meta">{{ countryName(c.country_code) }} · {{ $t('settings.companies.inspectorCount', { n: c.inspector_count }) }}</div>
          </div>
          <span class="ca__chev">›</span>
        </li>
      </ul>

      <div v-if="showAdd" class="ca__form">
        <h3>{{ $t('settings.companies.add') }}</h3>
        <label class="ca__field"><span>{{ $t('settings.companies.fields.name') }}</span>
          <input v-model="addForm.name" class="ca__input" /></label>
        <label class="ca__field"><span>{{ $t('settings.companies.fields.country') }}</span>
          <select v-model="addForm.country_code" class="ca__input">
            <option v-for="c in COUNTRY_OPTIONS" :key="c" :value="c">{{ countryName(c) }}</option>
          </select>
        </label>
        <label class="ca__field"><span>{{ $t('settings.companies.fields.email') }}</span>
          <input v-model="addForm.email" type="email" class="ca__input" /></label>
        <label class="ca__field"><span>{{ $t('settings.companies.fields.phone') }}</span>
          <input v-model="addForm.phone" class="ca__input" /></label>
        <label class="ca__field"><span>{{ $t('settings.companies.fields.address') }}</span>
          <input v-model="addForm.address" class="ca__input" /></label>
        <div class="ca__row">
          <label class="ca__field"><span>{{ $t('settings.companies.fields.postalCode') }}</span>
            <input v-model="addForm.postal_code" class="ca__input" /></label>
          <label class="ca__field ca__field--grow"><span>{{ $t('settings.companies.fields.city') }}</span>
            <input v-model="addForm.city" class="ca__input" /></label>
        </div>
        <label class="ca__field"><span>{{ $t('settings.companies.fields.province') }}</span>
          <input v-model="addForm.province" class="ca__input" :placeholder="$t('settings.companies.fields.provincePh')" /></label>
        <div class="ca__row">
          <label class="ca__field ca__field--grow"><span>{{ $t('settings.companies.fields.registrationNumber') }}</span>
            <input v-model="addForm.registration_number" class="ca__input" /></label>
          <label class="ca__field ca__field--grow"><span>{{ $t('settings.companies.fields.vatNumber') }}</span>
            <input v-model="addForm.vat_number" class="ca__input" /></label>
        </div>
        <p class="ca__hint">{{ $t('settings.companies.logoHint') }}</p>
        <p v-if="formError" class="ca__error">{{ formError }}</p>
        <div class="ca__actions">
          <button class="ca__btn ca__btn--cancel" @click="showAdd = false">{{ $t('common.cancel') }}</button>
          <button class="ca__btn ca__btn--save" :disabled="saving" @click="createCompany">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </div>
    </template>

    <!-- ===================== DETAIL ===================== -->
    <template v-else>
      <button class="ca__back" @click="deselect">← {{ $t('settings.companies.backToList') }}</button>
      <h2 class="ca__title">{{ selected.name }}</h2>

      <div v-if="inspLoading" class="ca__state">{{ $t('common.loading') }}</div>
      <ul v-else class="ca__list">
        <li v-for="i in inspectors" :key="i.id" class="ca__item ca__item--static">
          <div class="ca__body">
            <div class="ca__name">{{ i.name || i.email || '—' }}</div>
            <div class="ca__meta">{{ i.email }}</div>
            <div class="ca__badges">
              <span v-if="i.is_admin" class="ca__badge ca__badge--admin">{{ $t('settings.inspectors.adminBadge') }}</span>
              <span v-if="!i.active" class="ca__badge">{{ $t('settings.inspectors.inactiveBadge') }}</span>
            </div>
          </div>
          <label class="ca__curator">
            <input type="checkbox" :checked="i.can_curate_catalog" @change="toggleCurator(i, $event)" />
            {{ $t('settings.companies.curator') }}
          </label>
        </li>
        <li v-if="inspectors.length === 0" class="ca__state">{{ $t('settings.companies.noInspectors') }}</li>
      </ul>

      <div class="ca__head">
        <h3>{{ $t('settings.companies.addInspector') }}</h3>
      </div>
      <div class="ca__form">
        <p class="ca__hint">{{ $t('settings.companies.addInspectorHint') }}</p>
        <label class="ca__field"><span>{{ $t('settings.companies.fields.email') }}</span>
          <input v-model="linkForm.email" type="email" class="ca__input" placeholder="naam@voorbeeld.nl" /></label>
        <label class="ca__check"><input type="checkbox" v-model="linkForm.is_admin" /> {{ $t('settings.inspectors.fields.admin') }}</label>
        <p v-if="linkError" class="ca__error">{{ linkError }}</p>
        <p v-if="inviteSent" class="ca__ok">{{ $t('settings.companies.inviteSent') }}</p>
        <div class="ca__actions">
          <button v-if="noAccountFound" class="ca__btn ca__btn--save" :disabled="linking" @click="inviteAndLink">
            {{ linking ? $t('common.saving') : $t('settings.companies.invite') }}
          </button>
          <button v-else class="ca__btn ca__btn--save" :disabled="linking" @click="addInspector">{{ linking ? $t('common.saving') : $t('settings.companies.link') }}</button>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, errorMessage, useAuth } from '@gearonimo/core'

const { t, locale } = useI18n()
const { signInWithMagicLink } = useAuth()

// Alle ISO 3166-1 alpha-2 landcodes; de uitgeschreven namen komen uit de
// ingebouwde browservertaling (Intl.DisplayNames) in de taal van de app --
// geen eigen vertaaltabel nodig. Elk land is kiesbaar (wens Jos 2026-07-19:
// geen beperkte lijst, Spanje/Luxemburg/... moeten gewoon kunnen).
// Wettelijke keurtermijn-regimes bestaan alleen voor NL/GB
// (packages/core/regimes.ts); elders valt de termijn terug op 12 maanden of
// de eigen bedrijfsinstelling en blijft de wetsverwijzing op het certificaat
// leeg tot dat regime gebouwd is (BOUWPLAN fase 5). Het PDF is bovendien
// nog Nederlandstalig (En-GB-vertaling = fase 5).
const ISO_COUNTRIES = ['AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH','ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT','JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG','SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU','WF','WS','YE','YT','ZA','ZM','ZW']

const regionNames = computed(() => new Intl.DisplayNames([locale.value], { type: 'region' }))

function countryName(code: string): string {
  try {
    return regionNames.value.of(code) ?? code
  } catch {
    return code
  }
}

// Gesorteerd op de vertaalde naam; de bouwplan-markten (NL/BE/DE/GB/CA)
// staan bovenaan voor snel kiezen.
const PRIORITY = ['NL', 'BE', 'DE', 'GB', 'CA']
const COUNTRY_OPTIONS = computed(() => {
  const rest = ISO_COUNTRIES.filter((c) => !PRIORITY.includes(c))
    .sort((a, b) => countryName(a).localeCompare(countryName(b), locale.value))
  return [...PRIORITY, ...rest]
})

interface Company {
  id: string
  name: string
  country_code: string
  created_at: string
  inspector_count: number
}
interface CompanyInspector {
  id: string
  name: string | null
  email: string | null
  is_admin: boolean
  active: boolean
  can_curate_catalog: boolean
}

const loading = ref(true)
const error = ref('')
const companies = ref<Company[]>([])
const selected = ref<Company | null>(null)

const showAdd = ref(false)
const saving = ref(false)
const formError = ref('')
const addForm = reactive({
  name: '', country_code: 'NL',
  email: '', phone: '', address: '', postal_code: '', city: '',
  province: '', registration_number: '', vat_number: '',
})

const inspectors = ref<CompanyInspector[]>([])
const inspLoading = ref(false)
const linking = ref(false)
const linkError = ref('')
const linkForm = reactive({ email: '', is_admin: true })
const noAccountFound = ref(false)
const inviteSent = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const { data, error: err } = await supabase.rpc('platform_admin_list_companies')
    if (err) throw err
    companies.value = (data ?? []) as Company[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}

function openAdd() {
  addForm.name = ''
  addForm.country_code = 'NL'
  addForm.email = ''
  addForm.phone = ''
  addForm.address = ''
  addForm.postal_code = ''
  addForm.city = ''
  addForm.province = ''
  addForm.registration_number = ''
  addForm.vat_number = ''
  formError.value = ''
  showAdd.value = true
}
async function createCompany() {
  formError.value = ''
  if (!addForm.name.trim()) { formError.value = t('settings.companies.errors.nameRequired'); return }
  saving.value = true
  try {
    const { error: err } = await supabase.rpc('platform_admin_create_company', {
      p_name: addForm.name.trim(),
      p_country_code: addForm.country_code,
      p_email: addForm.email.trim() || null,
      p_phone: addForm.phone.trim() || null,
      p_address: addForm.address.trim() || null,
      p_postal_code: addForm.postal_code.trim() || null,
      p_city: addForm.city.trim() || null,
      p_province: addForm.province.trim() || null,
      p_registration_number: addForm.registration_number.trim() || null,
      p_vat_number: addForm.vat_number.trim() || null,
    })
    if (err) throw err
    showAdd.value = false
    await load()
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}

async function select(c: Company) {
  selected.value = c
  linkForm.email = ''
  linkForm.is_admin = true
  linkError.value = ''
  noAccountFound.value = false
  inviteSent.value = false
  await loadInspectors()
}
function deselect() {
  selected.value = null
  inspectors.value = []
}

async function loadInspectors() {
  if (!selected.value) return
  inspLoading.value = true
  try {
    const { data, error: err } = await supabase.rpc('platform_admin_list_inspectors', { p_company_id: selected.value.id })
    if (err) throw err
    inspectors.value = (data ?? []) as CompanyInspector[]
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    inspLoading.value = false
  }
}

async function addInspector() {
  if (!selected.value) return
  linkError.value = ''
  noAccountFound.value = false
  inviteSent.value = false
  if (!linkForm.email.trim()) { linkError.value = t('settings.companies.errors.emailRequired'); return }
  linking.value = true
  try {
    const { error: err } = await supabase.rpc('platform_admin_add_inspector', {
      p_company_id: selected.value.id,
      p_email: linkForm.email.trim(),
      p_is_admin: linkForm.is_admin,
    })
    if (err) throw err
    linkForm.email = ''
    await loadInspectors()
    await load()
  } catch (e) {
    const msg = errorMessage(e)
    // Herkenbaar aan de tekst uit platform_admin_add_inspector (20260740):
    // geen account = nog geen auth.users-rij, dan bieden we uitnodigen aan
    // i.p.v. alleen een doodlopende foutmelding.
    if (msg.includes('Geen account gevonden')) {
      noAccountFound.value = true
    } else {
      linkError.value = msg
    }
  } finally {
    linking.value = false
  }
}

// Stuurt een magic-link (maakt meteen een auth.users-rij aan, ook vóórdat
// de uitnodiging is aangeklikt -- zelfde mechanisme als de bestaande
// klant-onboarding). Probeert daarna meteen te koppelen; lukt dat nog niet
// (race condition met de e-mail-verwerking), dan blijft de "Uitnodigen"-knop
// staan zodat het opnieuw geprobeerd kan worden.
async function inviteAndLink() {
  if (!selected.value) return
  linkError.value = ''
  inviteSent.value = false
  linking.value = true
  try {
    await signInWithMagicLink(linkForm.email.trim())
    inviteSent.value = true
    const { error: err } = await supabase.rpc('platform_admin_add_inspector', {
      p_company_id: selected.value.id,
      p_email: linkForm.email.trim(),
      p_is_admin: linkForm.is_admin,
    })
    if (!err) {
      noAccountFound.value = false
      linkForm.email = ''
      await loadInspectors()
      await load()
    }
  } catch (e) {
    linkError.value = errorMessage(e)
  } finally {
    linking.value = false
  }
}

async function toggleCurator(i: CompanyInspector, e: Event) {
  const value = (e.target as HTMLInputElement).checked
  const prev = i.can_curate_catalog
  i.can_curate_catalog = value
  const { error: err } = await supabase.rpc('platform_admin_set_curator', { p_inspector_id: i.id, p_value: value })
  if (err) {
    i.can_curate_catalog = prev
    error.value = errorMessage(err)
  }
}

onMounted(load)
</script>

<style scoped>
.ca { margin-top: 0.25rem; }
.ca__intro { font-size: 0.85rem; color: #6b7280; margin: 0 0 1rem; }
.ca__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.ca__state--error { color: #dc2626; }

.ca__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem; }
.ca__head h2, .ca__head h3 { font-size: 1.05rem; margin: 0; }
.ca__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }

.ca__title { font-size: 1.1rem; margin: 0 0 0.75rem; }
.ca__back { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.9rem; cursor: pointer; padding: 0 0 0.75rem; }

.ca__list { list-style: none; margin: 0 0 1rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ca__item { display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.ca__item--static { cursor: default; }
.ca__item:last-child { border-bottom: none; }
.ca__item:active { background: #f9fafb; }
.ca__body { flex: 1; min-width: 0; }
.ca__name { font-weight: 600; }
.ca__meta { font-size: 0.82rem; color: #6b7280; margin-top: 0.1rem; }
.ca__badges { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.25rem; }
.ca__badge { border-radius: 6px; padding: 0.1rem 0.5rem; font-size: 0.72rem; font-weight: 600; background: #f3f4f6; color: #6b7280; }
.ca__badge--admin { background: #dcfce7; color: #166534; }
.ca__chev { color: #9ca3af; font-size: 1.4rem; }
.ca__curator { display: flex; align-items: center; gap: 0.4rem; font-size: 0.82rem; color: #374151; white-space: nowrap; }

.ca__form { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.ca__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.ca__hint { font-size: 0.82rem; color: #6b7280; margin: 0; }
.ca__field { display: flex; flex-direction: column; gap: 0.25rem; }
.ca__field > span { font-size: 0.8rem; color: #374151; font-weight: 600; }
.ca__field--grow { flex: 1; }
.ca__row { display: flex; gap: 0.6rem; }
.ca__input { padding: 0.65rem 0.75rem; border-radius: 8px; border: 1px solid #ddd; font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit; }
.ca__check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; }
.ca__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.ca__ok { color: #16a34a; font-size: 0.9rem; margin: 0; }

.ca__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.ca__btn { flex: 1; padding: 0.8rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.ca__btn--cancel { background: #f3f4f6; color: #374151; }
.ca__btn--save { background: #16a34a; color: #fff; }
.ca__btn:disabled { opacity: 0.6; }
</style>
