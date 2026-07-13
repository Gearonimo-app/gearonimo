<template>
  <div class="imp">
    <p class="imp__intro">{{ $t('settings.import.intro') }}</p>

    <!-- Stap 1: bestand kiezen -->
    <section v-if="step === 1" class="imp__step">
      <h2>{{ $t('settings.import.step1Title') }}</h2>
      <input type="file" accept=".xlsx,.xls,.csv" @change="onFileChange" />

      <div class="imp__or">{{ $t('settings.import.or') }}</div>

      <label class="imp__pastelabel">{{ $t('settings.import.pasteLabel') }}</label>
      <textarea
        class="imp__pastearea"
        :placeholder="$t('settings.import.pastePlaceholder')"
        @paste="onPaste"
      ></textarea>
      <p class="imp__hint">{{ $t('settings.import.pasteHint') }}</p>

      <p v-if="error" class="imp__error">{{ error }}</p>
      <div v-if="sheetNames.length > 1" class="imp__field">
        <label>{{ $t('settings.import.sheetLabel') }}</label>
        <select v-model="selectedSheet">
          <option v-for="name in sheetNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>
    </section>

    <!-- Stap 2: koprij aanwijzen -->
    <section v-else-if="step === 2" class="imp__step">
      <h2>{{ $t('settings.import.step2Title') }}</h2>
      <p v-if="profileApplied" class="imp__ok">{{ $t('settings.import.profileApplied') }}</p>
      <p class="imp__hint">{{ $t('settings.import.step2Hint') }}</p>
      <p class="imp__hint">{{ $t('settings.import.step2RangeHint') }}</p>
      <p class="imp__selinfo">
        {{ $t('settings.import.step2Selected', {
          header: headerRowIndex + 1,
          last: lastRowIndex === null ? $t('settings.import.toEnd') : (lastRowIndex + 1),
        }) }}
        <button v-if="lastRowIndex !== null" type="button" class="imp__linkbtn" @click="lastRowIndex = null">
          {{ $t('settings.import.clearLastRow') }}
        </button>
      </p>
      <div class="imp__tablewrap">
        <table class="imp__table">
          <tbody>
            <tr
              v-for="(row, i) in previewRows"
              :key="i"
              :class="{
                'imp__row--header': i === headerRowIndex,
                'imp__row--last': i === lastRowIndex,
                'imp__row--ignored': i < headerRowIndex || (lastRowIndex !== null && i > lastRowIndex),
              }"
            >
              <td class="imp__rownum">
                <button
                  type="button"
                  class="imp__pickbtn"
                  :class="{ 'imp__pickbtn--active': i === headerRowIndex }"
                  :title="$t('settings.import.markHeader')"
                  @click="setHeaderRow(i)"
                >{{ i + 1 }}</button>
                <button
                  v-if="i > headerRowIndex"
                  type="button"
                  class="imp__endbtn"
                  :class="{ 'imp__endbtn--active': i === lastRowIndex }"
                  :title="$t('settings.import.markLastRow')"
                  @click="setLastRow(i)"
                >⤓</button>
                <span v-if="i < headerRowIndex || (lastRowIndex !== null && i > lastRowIndex)" class="imp__rowtag">
                  {{ $t('settings.import.rowIgnored') }}
                </span>
              </td>
              <td v-for="(cell, j) in row" :key="j" class="imp__cell" :title="cell == null ? '' : String(cell)">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Stap 3: kolommen koppelen -->
    <section v-else-if="step === 3" class="imp__step">
      <h2>{{ $t('settings.import.step3Title') }}</h2>
      <p class="imp__hint">{{ $t('settings.import.step3Hint') }}</p>

      <div class="imp__field">
        <label>{{ $t('settings.import.fixedCustomerLabel') }}</label>
        <div v-if="selectedCustomer || fixedCustomerName" class="imp__customer-chosen">
          <span class="imp__ok">
            {{ selectedCustomer
              ? $t('settings.import.customerSelected', { name: selectedCustomer.name })
              : $t('settings.import.customerFromFile', { name: fixedCustomerName }) }}
          </span>
          <button type="button" class="imp__linkbtn" @click="clearCustomer">{{ $t('settings.import.customerChange') }}</button>
        </div>
        <div v-else class="imp__customerpick">
          <div class="imp__customerbox">
            <input
              type="text"
              v-model="customerSearch"
              :placeholder="$t('settings.import.fixedCustomerPlaceholder')"
              @focus="customerListOpen = true"
              @blur="closeCustomerListSoon"
            />
            <div v-if="customerListOpen && filteredCustomers.length" class="imp__customerlist">
              <button
                v-for="c in filteredCustomers"
                :key="c.id"
                type="button"
                class="imp__customeritem"
                @mousedown.prevent="selectCustomer(c)"
              >
                {{ c.name }}<span v-if="c.city" class="imp__customeritem-city"> · {{ c.city }}</span>
              </button>
            </div>
          </div>
          <button type="button" class="imp__btn imp__btn--ghost imp__newcustomer" @click="showNewCustomer = true">
            ＋ {{ $t('settings.import.newCustomer') }}
          </button>
        </div>
        <button
          v-if="!selectedCustomer && !fixedCustomerName && headerBlockCells.length"
          type="button"
          class="imp__linkbtn imp__linkbtn--block"
          @click="showCustomerPick = !showCustomerPick"
        >{{ $t('settings.import.pickFromFile') }}</button>
        <div v-if="showCustomerPick && !selectedCustomer && !fixedCustomerName" class="imp__chips">
          <button
            v-for="(c, i) in headerBlockCells"
            :key="i"
            type="button"
            class="imp__chip"
            :title="c.value"
            @click="pickCustomerFromFile(c.value)"
          ><span class="imp__chip-row">{{ $t('settings.import.rowN', { n: c.row }) }}</span>{{ c.value }}</button>
        </div>
        <p class="imp__hint">{{ $t('settings.import.fixedCustomerHint') }}</p>
      </div>

      <div class="imp__field">
        <label>{{ $t('settings.import.fixedDateLabel') }}</label>
        <input type="date" v-model="fixedInspectionDate" />
        <button
          v-if="dateBlockCells.length"
          type="button"
          class="imp__linkbtn imp__linkbtn--block"
          @click="showDatePick = !showDatePick"
        >{{ $t('settings.import.pickFromFile') }}</button>
        <div v-if="showDatePick" class="imp__chips">
          <button
            v-for="(c, i) in dateBlockCells"
            :key="i"
            type="button"
            class="imp__chip"
            :title="c.iso"
            @click="pickDateFromFile(c.iso)"
          ><span class="imp__chip-row">{{ $t('settings.import.rowN', { n: c.row }) }}</span>{{ c.value }}</button>
        </div>
        <p class="imp__hint">{{ $t('settings.import.fixedDateHint') }}</p>
      </div>

      <div v-if="inspectorOptions.length > 1" class="imp__field">
        <label>{{ $t('settings.import.inspectorLabel') }}</label>
        <select v-model="selectedInspectorId" class="imp__inspectorselect">
          <option v-for="i in inspectorOptions" :key="i.id" :value="i.id">
            {{ i.name }}<template v-if="!i.active"> — {{ $t('settings.inspectors.inactiveBadge') }}</template>
          </option>
        </select>
        <p class="imp__hint">{{ $t('settings.import.inspectorHint') }}</p>
      </div>

      <div class="imp__mapgrid">
        <div v-for="(col, colIndex) in headerRow" :key="colIndex" class="imp__mapcol">
          <div class="imp__colhead">{{ col || $t('settings.import.unnamedColumn', { n: colIndex + 1 }) }}</div>
          <select v-model="mapping[colIndex]">
            <optgroup v-for="g in fieldGroups" :key="g.key" :label="$t(`settings.import.groups.${g.key}`)">
              <option v-for="f in g.fields" :key="f.key" :value="f.key">
                {{ $t(`settings.import.fields.${f.key}`) }}<span v-if="f.required"> *</span>
              </option>
            </optgroup>
          </select>
          <div class="imp__samples">
            <div v-for="(r, i) in dataRows.slice(0, 3)" :key="i" class="imp__sample">{{ r[colIndex] }}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- Stap 4: preview + droogloop-validatie -->
    <section v-else-if="step === 4" class="imp__step">
      <h2>{{ $t('settings.import.step4Title') }}</h2>

      <div class="imp__validation" v-if="validation">
        <p v-if="validation.missingRequired.length" class="imp__error">
          {{ $t('settings.import.missingRequired') }}:
          {{ validation.missingRequired.map((f) => $t(`settings.import.fields.${f}`)).join(', ') }}
        </p>
        <p v-for="(count, field) in validation.emptyRequiredCount" :key="field" class="imp__warn">
          {{ $t('settings.import.emptyRequired', { field: $t(`settings.import.fields.${field}`), count }) }}
        </p>
        <p v-if="validation.duplicateSerials.length" class="imp__warn">
          {{ $t('settings.import.duplicateSerials', { count: validation.duplicateSerials.length }) }}
        </p>
        <p v-if="validation.unparsableDates" class="imp__warn">
          {{ $t('settings.import.unparsableDates', { count: validation.unparsableDates }) }}
        </p>
        <p v-if="validation.unparsableYears" class="imp__warn">
          {{ $t('settings.import.unparsableYears', { count: validation.unparsableYears }) }}
        </p>
        <p v-if="!validation.missingRequired.length && !Object.keys(validation.emptyRequiredCount).length && !validation.duplicateSerials.length && !validation.unparsableDates && !validation.unparsableYears" class="imp__ok">
          {{ $t('settings.import.allGood') }}
        </p>
        <p class="imp__hint">{{ $t('settings.import.rowCount', { count: validation.rowCount }) }}</p>
      </div>

      <div class="imp__tablewrap">
        <table class="imp__table">
          <thead>
            <tr>
              <th v-for="f in mappedFields" :key="f.colIndex">{{ $t(`settings.import.fields.${f.field}`) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in dataRows.slice(0, 10)" :key="i">
              <td v-for="f in mappedFields" :key="f.colIndex" class="imp__cell" :title="row[f.colIndex] == null ? '' : String(row[f.colIndex])">{{ row[f.colIndex] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <label class="imp__checkbox">
        <input type="checkbox" v-model="skipDuplicateSerials" />
        {{ $t('settings.import.skipDuplicates') }}
      </label>
      <label class="imp__checkbox">
        <input type="checkbox" v-model="saveProfile" />
        {{ $t('settings.import.saveProfile') }}
      </label>
    </section>

    <!-- Stap 5: importeren -->
    <section v-else-if="step === 5" class="imp__step">
      <h2>{{ $t('settings.import.step5Title') }}</h2>

      <div v-if="!commitResult && !committing">
        <p class="imp__hint">{{ $t('settings.import.step5Hint', { count: dataRows.length }) }}</p>
        <button class="imp__btn" @click="runCommit">{{ $t('settings.import.startImport') }}</button>
      </div>
      <p v-else-if="committing" class="imp__hint">{{ $t('settings.import.importing') }}</p>
      <div v-else-if="commitResult">
        <p class="imp__ok">{{ $t('settings.import.done') }}</p>
        <ul class="imp__summary">
          <li>{{ $t('settings.import.sumCustomers', { count: commitResult.customersCreated }) }}</li>
          <li>{{ $t('settings.import.sumArticlesCreated', { count: commitResult.articlesCreated }) }}</li>
          <li>{{ $t('settings.import.sumArticlesSkipped', { count: commitResult.articlesSkipped }) }}</li>
          <li>{{ $t('settings.import.sumInspections', { count: commitResult.inspectionsCreated }) }}</li>
          <li>{{ $t('settings.import.sumRowsSkipped', { count: commitResult.rowsSkipped }) }}</li>
          <li v-if="commitResult.rowsSkippedNoCustomer" class="imp__warn">
            {{ $t('settings.import.sumSkippedNoCustomer', { count: commitResult.rowsSkippedNoCustomer }) }}
          </li>
          <li v-if="commitResult.rowsSkippedNoDescription" class="imp__warn">
            {{ $t('settings.import.sumSkippedNoDescription', { count: commitResult.rowsSkippedNoDescription }) }}
          </li>
        </ul>
        <p v-for="(e, i) in commitResult.errors.slice(0, 5)" :key="i" class="imp__warn">{{ e }}</p>

        <div class="imp__afteractions">
          <button
            v-if="commitResult.inspectionIds.length === 1"
            class="imp__btn"
            @click="$router.push(`/inspections/${commitResult.inspectionIds[0]}`)"
          >{{ $t('settings.import.viewInspection') }}</button>
          <button
            v-else-if="commitResult.inspectionIds.length > 1"
            class="imp__btn"
            @click="$router.push('/inspections')"
          >{{ $t('settings.import.viewInspections') }}</button>
          <button
            v-if="commitResult.customerId"
            class="imp__btn imp__btn--ghost"
            @click="$router.push(`/customers/${commitResult.customerId}`)"
          >{{ $t('settings.import.toCustomer') }}</button>
          <button
            v-if="commitResult.customerId"
            class="imp__btn imp__btn--ghost"
            @click="$router.push(`/customers/${commitResult.customerId}?startInspection=1`)"
          >{{ $t('settings.import.startNewInspection') }}</button>
        </div>
      </div>
    </section>

    <div class="imp__nav">
      <button v-if="step > 1 && step < 5" class="imp__btn imp__btn--ghost" @click="step--">{{ $t('settings.import.back') }}</button>
      <button v-if="step < 5" class="imp__btn" :disabled="!canAdvance" @click="advance">{{ $t('settings.import.next') }}</button>
    </div>

    <CustomerFormModal v-if="showNewCustomer" @saved="onCustomerCreated" @cancel="showNewCustomer = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import * as XLSX from 'xlsx'
import {
  FIELD_DEFS,
  guessHeaderRow,
  guessMapping,
  validateRows,
  type FieldKey,
  type RawRow,
} from '../composables/useImportMapping'
import {
  commitImport,
  findImportProfile,
  parseToISODate,
  saveImportProfile,
  type CommitResult,
} from '../composables/useImportCommit'
import { listCustomers, type CustomerListItem } from '../composables/useCustomers'
import { ensureInspector } from '../composables/useInspections'
import { supabase } from '@gearonimo/core'
import CustomerFormModal from './CustomerFormModal.vue'

const { t } = useI18n()

const step = ref(1)
const error = ref('')
const file = ref<File | null>(null)
const profileApplied = ref(false)

const sheets = ref<Record<string, RawRow[]>>({})
const sheetNames = computed(() => Object.keys(sheets.value))
const selectedSheet = ref('')

const allRows = computed<RawRow[]>(() => sheets.value[selectedSheet.value] ?? [])
// In stap 2 mag de keurmeester de laatste rij van de tabel aanwijzen, dus tonen
// we ruim meer dan een handvol rijen (gecaptureerd certificaat heeft de tabel
// soms pas na tientallen rijen). Cap voor extreem grote bestanden.
const previewRows = computed(() => allRows.value.slice(0, 500))

const headerRowIndex = ref(0)
// null = tot het einde van het blad (gedrag van vóór de tabelselectie). Anders
// is dit de laatste rij die nog meegaat — alles eronder wordt genegeerd.
const lastRowIndex = ref<number | null>(null)
const headerRow = computed<RawRow>(() => allRows.value[headerRowIndex.value] ?? [])
const dataRows = computed<RawRow[]>(() =>
  allRows.value.slice(headerRowIndex.value + 1, lastRowIndex.value === null ? undefined : lastRowIndex.value + 1)
)

function setHeaderRow(i: number) {
  headerRowIndex.value = i
  // Laatste rij die nu boven (of op) de koprij ligt, is niet meer logisch.
  if (lastRowIndex.value !== null && lastRowIndex.value <= i) lastRowIndex.value = null
}
function setLastRow(i: number) {
  // Klik op dezelfde rij = weer 'tot het einde'.
  lastRowIndex.value = lastRowIndex.value === i ? null : i
}

const mapping = ref<Record<number, FieldKey>>({})
const fixedCustomerName = ref('')
const fixedInspectionDate = ref('')

// --- Waarden uit het kopblok boven de tabel -----------------------------------
// Klantnaam en keuringsdatum staan op certificaten vaak niet als kolom in de
// tabel maar in losse cellen erboven ("Klant: Jansen BV"). Die cellen bieden we
// hier klikbaar aan zodat de keurmeester niets hoeft over te typen. Een label
// vóór een dubbele punt ("Klant:", "Datum:") wordt daarbij weggeknipt.
const showCustomerPick = ref(false)
const showDatePick = ref(false)

function stripLabel(v: string): string {
  // alleen strippen als het deel vóór de dubbele punt op een label lijkt
  // (bevat letters) — anders knippen we tijden als "12:30" kapot
  const m = v.match(/^([^:]{1,30}):\s*(.+)$/)
  return m && /[a-zA-Z]/.test(m[1]) ? m[2].trim() : v
}

const headerBlockCells = computed(() => {
  const out: { row: number; value: string }[] = []
  const seen = new Set<string>()
  for (let i = 0; i < headerRowIndex.value && out.length < 40; i++) {
    for (const cell of allRows.value[i] ?? []) {
      const raw = cell === null ? '' : String(cell).trim()
      if (!raw) continue
      const value = stripLabel(raw)
      if (!value || seen.has(value)) continue
      seen.add(value)
      out.push({ row: i + 1, value })
      if (out.length >= 40) break
    }
  }
  return out
})

const dateBlockCells = computed(() =>
  headerBlockCells.value
    .map((c) => ({ ...c, iso: parseToISODate(c.value) as string }))
    // alleen cellen die echt als datum te lezen zijn; een los jaartal ("2021")
    // is te dubbelzinnig om als keuringsdatum aan te bieden
    .filter((c) => c.iso !== null && !/^\d{4}$/.test(c.value))
)

function pickCustomerFromFile(value: string) {
  selectedCustomerId.value = null
  fixedCustomerName.value = value
  customerSearch.value = value
  showCustomerPick.value = false
}

function pickDateFromFile(iso: string) {
  fixedInspectionDate.value = iso
  showDatePick.value = false
}

// Klant-dropdown (stap 3): kies een bestaande klant voor het hele bestand, of
// maak er meteen een aan. fixedCustomerId stuurt de import naar precies die klant.
const customers = ref<CustomerListItem[]>([])
const customerSearch = ref('')
const customerListOpen = ref(false)
const selectedCustomerId = ref<string | null>(null)
const showNewCustomer = ref(false)
const selectedCustomer = computed(() => customers.value.find((c) => c.id === selectedCustomerId.value) || null)
const filteredCustomers = computed(() => {
  const q = customerSearch.value.trim().toLowerCase()
  const list = q ? customers.value.filter((c) => c.name.toLowerCase().includes(q)) : customers.value
  return list.slice(0, 30)
})

async function loadCustomers() {
  try {
    customers.value = await listCustomers()
  } catch {
    // geen verbinding: dropdown blijft leeg, "Nieuwe klant" werkt nog wel
  }
}

// Keurmeester-dropdown: historische keuringen zijn vaak door een collega
// gedaan; kies hier op wiens naam ze komen. Ook inactieve keurmeesters staan
// erin (oud-collega's op oude certificaten). Standaard: de ingelogde gebruiker.
const inspectorOptions = ref<{ id: string; name: string; active: boolean }[]>([])
const selectedInspectorId = ref('')

async function loadInspectors() {
  try {
    const me = await ensureInspector()
    selectedInspectorId.value = me.id
    const { data } = await supabase
      .from('inspectors')
      .select('id, name, active')
      .eq('company_id', me.company_id)
      .order('name')
    inspectorOptions.value = (data ?? []) as { id: string; name: string; active: boolean }[]
  } catch {
    // geen verbinding: dropdown blijft verborgen, import valt terug op de ingelogde keurmeester
  }
}
onMounted(() => { loadCustomers(); loadInspectors() })

function selectCustomer(c: CustomerListItem) {
  selectedCustomerId.value = c.id
  fixedCustomerName.value = c.name
  customerSearch.value = c.name
  customerListOpen.value = false
}
function clearCustomer() {
  selectedCustomerId.value = null
  fixedCustomerName.value = ''
  customerSearch.value = ''
}
function closeCustomerListSoon() {
  // korte vertraging zodat een klik op een item nog telt (mousedown vóór blur)
  window.setTimeout(() => { customerListOpen.value = false }, 150)
}
async function onCustomerCreated(id: string) {
  showNewCustomer.value = false
  await loadCustomers()
  const created = customers.value.find((c) => c.id === id)
  if (created) selectCustomer(created)
}
const skipDuplicateSerials = ref(true)
const saveProfile = ref(true)
const committing = ref(false)
const commitResult = ref<CommitResult | null>(null)

// Tijdens het laden van een bestand zetten we koprij/mapping eerst op een gok en
// daarna mogelijk op een opgeslagen profiel. De onderstaande watchers her-gokken
// de mapping bij elke koprij-/bladwissel — wat we precies NIET willen tijdens dat
// laden, want dan overschrijven ze het zojuist toegepaste profiel. Deze vlag
// onderdrukt dat heratschen totdat het laden klaar is.
const applying = ref(false)

watch(headerRowIndex, () => {
  if (applying.value) return
  mapping.value = guessMapping(headerRow.value)
})

const fieldGroups = computed(() => {
  const groups: { key: string; fields: typeof FIELD_DEFS }[] = []
  for (const f of FIELD_DEFS) {
    if (f.key === 'ignore') continue
    let g = groups.find((g) => g.key === f.group)
    if (!g) {
      g = { key: f.group, fields: [] }
      groups.push(g)
    }
    g.fields.push(f)
  }
  groups.unshift({ key: 'ignore', fields: FIELD_DEFS.filter((f) => f.key === 'ignore') })
  return groups
})

const mappedFields = computed(() =>
  Object.entries(mapping.value)
    .filter(([, field]) => field !== 'ignore')
    .map(([colIndex, field]) => ({ colIndex: Number(colIndex), field }))
)

const validation = computed(() => {
  const result = validateRows(mapping.value, dataRows.value)
  if (fixedCustomerName.value.trim() || selectedCustomerId.value) {
    result.missingRequired = result.missingRequired.filter((f) => f !== 'customerName')
    delete result.emptyRequiredCount.customerName
  }
  if (fixedInspectionDate.value.trim()) {
    result.missingRequired = result.missingRequired.filter((f) => f !== 'inspectionDate')
    delete result.emptyRequiredCount.inspectionDate
    result.unparsableDates = 0
  }
  return result
})

const canAdvance = computed(() => {
  if (step.value === 1) return sheetNames.value.length > 0
  return true
})

function advance() {
  step.value++
  if (step.value === 5) commitResult.value = null
}

async function applyProfileIfAny() {
  profileApplied.value = false
  try {
    const profile = await findImportProfile(headerRow.value)
    if (profile) {
      headerRowIndex.value = profile.header_row_index
      mapping.value = profile.mapping
      profileApplied.value = true
    }
  } catch {
    // geen profiel gevonden of geen verbinding — gewoon doorgaan met de gok
  }
}

// Gedeelde inlees-stap voor zowel een geüpload bestand als een geplakte tabel:
// zet de bladen, gok koprij + mapping en pas een eventueel profiel toe. De
// `applying`-vlag voorkomt dat de watchers het profiel meteen weer overgokken.
async function ingest(parsed: Record<string, RawRow[]>, theFile: File) {
  file.value = theFile
  applying.value = true
  try {
    sheets.value = parsed
    const first = Object.keys(parsed)[0] ?? ''
    selectedSheet.value = first
    lastRowIndex.value = null
    headerRowIndex.value = guessHeaderRow(parsed[first] ?? [])
    mapping.value = guessMapping((parsed[first] ?? [])[headerRowIndex.value] ?? [])
    await applyProfileIfAny()
  } finally {
    // Wacht tot de onderdrukte watchers hun (overgeslagen) flush hebben gehad
    // vóór we de vlag weghalen, anders gokken ze het profiel alsnog over.
    await nextTick()
    applying.value = false
  }
}

async function onFileChange(e: Event) {
  error.value = ''
  const picked = (e.target as HTMLInputElement).files?.[0]
  if (!picked) return
  try {
    const buf = await picked.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const parsed: Record<string, RawRow[]> = {}
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[name], { header: 1, raw: false, defval: null })
      parsed[name] = rows as RawRow[]
    }
    await ingest(parsed, picked)
  } catch (err) {
    error.value = (err as Error).message
  }
}

// --- Tabel plakken (uit Word/Excel) ------------------------------------------
// Word/Excel zetten bij kopiëren een echte HTML-<table> op het klembord; die
// parsen we kolomgetrouw. Lukt dat niet, dan vallen we terug op de platte tekst
// (tab-gescheiden, zoals Excel/Word die ook meegeven).
function parseHtmlTable(html: string): RawRow[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) return []
  const rows: RawRow[] = []
  table.querySelectorAll('tr').forEach((tr) => {
    const cells: RawRow = []
    tr.querySelectorAll('th,td').forEach((td) => {
      const txt = (td.textContent ?? '').replace(/\s+/g, ' ').trim()
      cells.push(txt === '' ? null : txt)
    })
    if (cells.length) rows.push(cells)
  })
  return rows
}

function parsePlainTable(text: string): RawRow[] {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => line.split('\t').map((c) => {
      const v = c.trim()
      return v === '' ? null : v
    }))
}

// Bewaar de geplakte tabel als echt .xlsx zodat de import hetzelfde "origineel
// bewaren in Storage" gebruikt als bij een geüpload bestand (juridisch anker).
function rowsToXlsxFile(rows: RawRow[]): File {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Geplakt')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new File([out], `geplakte-tabel-${Date.now()}.xlsx`, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

async function onPaste(e: ClipboardEvent) {
  error.value = ''
  const html = e.clipboardData?.getData('text/html') ?? ''
  const text = e.clipboardData?.getData('text/plain') ?? ''
  let rows: RawRow[] = []
  if (/<table/i.test(html)) rows = parseHtmlTable(html)
  if (rows.length === 0) rows = parsePlainTable(text)
  if (rows.length === 0) {
    error.value = t('settings.import.pasteNoTable')
    return
  }
  e.preventDefault()
  await ingest({ Geplakt: rows }, rowsToXlsxFile(rows))
  step.value = 2
}

watch(selectedSheet, () => {
  if (applying.value) return
  lastRowIndex.value = null
  headerRowIndex.value = guessHeaderRow(allRows.value)
  mapping.value = guessMapping(headerRow.value)
})

async function runCommit() {
  if (!file.value) return
  committing.value = true
  try {
    if (saveProfile.value) {
      await saveImportProfile(headerRow.value, headerRowIndex.value, mapping.value)
    }
    commitResult.value = await commitImport({
      rows: dataRows.value,
      mapping: mapping.value,
      file: file.value,
      sheetName: selectedSheet.value,
      skipDuplicateSerials: skipDuplicateSerials.value,
      fixedCustomerName: fixedCustomerName.value,
      fixedCustomerId: selectedCustomerId.value ?? undefined,
      fixedInspectionDate: fixedInspectionDate.value,
      inspectorId: selectedInspectorId.value || undefined,
    })
  } finally {
    committing.value = false
  }
}
</script>

<style scoped>
.imp__intro { color: #6b7280; font-size: 0.9rem; margin: 0 0 1rem; }
.imp__step h2 { font-size: 1rem; margin: 0 0 0.5rem; }
.imp__hint { color: #6b7280; font-size: 0.85rem; margin: 0.25rem 0 0.75rem; }
.imp__error { color: #b91c1c; font-size: 0.85rem; }
.imp__warn { color: #92400e; font-size: 0.85rem; }
.imp__ok { color: #166534; font-size: 0.85rem; }
.imp__field { margin-top: 0.75rem; }
.imp__field label { display: block; font-size: 0.85rem; margin-bottom: 0.25rem; }

.imp__or { display: flex; align-items: center; gap: 0.6rem; color: #9ca3af; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; margin: 1rem 0 0.75rem; }
.imp__or::before, .imp__or::after { content: ""; flex: 1; height: 1px; background: #e5e7eb; }
.imp__pastelabel { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem; }
.imp__pastearea { width: 100%; min-height: 90px; box-sizing: border-box; padding: 0.6rem; border: 1px dashed #9ca3af; border-radius: 8px; font-family: inherit; font-size: 0.85rem; resize: vertical; }
.imp__pastearea:focus { outline: none; border-color: #1a3a2a; border-style: solid; }

.imp__tablewrap { overflow: auto; max-height: 360px; border: 1px solid #e5e7eb; border-radius: 8px; }
.imp__table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.imp__table td, .imp__table th { padding: 0.35rem 0.5rem; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
/* Lange celtekst (bijv. juridische regels boven de tabel) afkappen met "…",
   anders wordt één kolom zó breed dat de rest buiten beeld valt. Hele tekst
   blijft beschikbaar via de tooltip (title) bij hover. */
.imp__cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.imp__table th { background: #f9fafb; text-align: left; position: sticky; top: 0; }
.imp__rownum { color: #9ca3af; white-space: nowrap; }
.imp__row--header { background: #d1fae5; }
.imp__row--last { background: #fef3c7; }
.imp__row--ignored { opacity: 0.45; background: #f9fafb; }
.imp__row--ignored td { color: #9ca3af; }
.imp__rowtag { display: inline-block; margin-left: 0.4rem; font-size: 0.65rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.03em; }
.imp__table tbody tr:hover { background: #f3f4f6; }
.imp__pickbtn { background: none; border: 1px solid #d1d5db; border-radius: 5px; padding: 0.1rem 0.4rem; font: inherit; font-size: 0.75rem; color: #6b7280; cursor: pointer; }
.imp__pickbtn--active { background: #059669; border-color: #059669; color: #fff; font-weight: 700; }
.imp__endbtn { margin-left: 0.25rem; background: none; border: 1px solid #d1d5db; border-radius: 5px; padding: 0.1rem 0.35rem; cursor: pointer; color: #92400e; }
.imp__endbtn--active { background: #f59e0b; border-color: #f59e0b; color: #fff; }
.imp__selinfo { font-size: 0.85rem; color: #374151; margin: 0.25rem 0 0.6rem; }
.imp__linkbtn { background: none; border: none; color: #1a3a2a; text-decoration: underline; cursor: pointer; font-size: 0.8rem; padding: 0 0 0 0.4rem; }
.imp__linkbtn--block { display: block; padding: 0.35rem 0 0; }

.imp__chips { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.4rem 0; max-height: 170px; overflow-y: auto; }
.imp__chip { background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 999px; padding: 0.25rem 0.7rem; font: inherit; font-size: 0.8rem; cursor: pointer; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.imp__chip:hover { background: #e5e7eb; border-color: #9ca3af; }
.imp__chip-row { color: #9ca3af; margin-right: 0.4rem; font-size: 0.7rem; }

.imp__customerpick { display: flex; gap: 0.5rem; align-items: flex-start; }
.imp__customerbox { position: relative; flex: 1; }
.imp__customerbox input { width: 100%; padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid #d1d5db; box-sizing: border-box; }
.imp__customerlist { position: absolute; z-index: 5; left: 0; right: 0; top: 100%; background: #fff; border: 1px solid #d1d5db; border-radius: 0 0 6px 6px; max-height: 220px; overflow-y: auto; box-shadow: 0 6px 18px rgba(0,0,0,0.08); }
.imp__customeritem { display: block; width: 100%; text-align: left; background: none; border: none; padding: 0.5rem 0.6rem; cursor: pointer; font-size: 0.9rem; }
.imp__customeritem:hover { background: #f3f4f6; }
.imp__customeritem-city { color: #9ca3af; }
.imp__newcustomer { white-space: nowrap; }
.imp__customer-chosen { display: flex; align-items: center; gap: 0.5rem; }
.imp__field input[type="text"], .imp__field input[type="date"] { padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid #d1d5db; box-sizing: border-box; }
.imp__inspectorselect { padding: 0.5rem 0.6rem; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; }

.imp__mapgrid { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; }
.imp__mapcol { min-width: 160px; flex: 0 0 auto; }
.imp__colhead { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; }
.imp__mapcol select { width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid #d1d5db; }
.imp__samples { margin-top: 0.4rem; font-size: 0.75rem; color: #6b7280; }
/* min-height: een lege cel moet een lege regel blijven, anders klapt de div
   dicht en schuiven de voorbeeldwaarden eronder een regel omhoog — dan lijkt
   bijv. een "X" (goedgekeurd) bij het verkeerde artikel te horen. */
.imp__sample { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 1.2em; }

.imp__checkbox { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; margin-top: 0.6rem; }
.imp__summary { font-size: 0.9rem; padding-left: 1.2rem; }
.imp__afteractions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }

.imp__nav { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
.imp__btn { background: #1a3a2a; color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.2rem; font-weight: 600; cursor: pointer; }
.imp__btn:disabled { opacity: 0.5; cursor: default; }
.imp__btn--ghost { background: none; color: #1a3a2a; border: 1px solid #1a3a2a; }
</style>
