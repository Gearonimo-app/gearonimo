<template>
  <div class="imp">
    <p class="imp__intro">{{ $t('settings.import.intro') }}</p>

    <!-- Stap 1: bestand kiezen -->
    <section v-if="step === 1" class="imp__step">
      <h2>{{ $t('settings.import.step1Title') }}</h2>
      <input type="file" accept=".xlsx,.xls,.csv" @change="onFileChange" />
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
      <div class="imp__tablewrap">
        <table class="imp__table">
          <tbody>
            <tr
              v-for="(row, i) in previewRows"
              :key="i"
              :class="{ 'imp__row--header': i === headerRowIndex }"
              @click="headerRowIndex = i"
            >
              <td class="imp__rownum">{{ i + 1 }}</td>
              <td v-for="(cell, j) in row" :key="j">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Stap 3: kolommen koppelen -->
    <section v-else-if="step === 3" class="imp__step">
      <h2>{{ $t('settings.import.step3Title') }}</h2>
      <p class="imp__hint">{{ $t('settings.import.step3Hint') }}</p>
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
        <p v-if="!validation.missingRequired.length && !Object.keys(validation.emptyRequiredCount).length && !validation.duplicateSerials.length && !validation.unparsableDates" class="imp__ok">
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
              <td v-for="f in mappedFields" :key="f.colIndex">{{ row[f.colIndex] }}</td>
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
        </ul>
        <p v-for="(e, i) in commitResult.errors.slice(0, 5)" :key="i" class="imp__warn">{{ e }}</p>
      </div>
    </section>

    <div class="imp__nav">
      <button v-if="step > 1 && step < 5" class="imp__btn imp__btn--ghost" @click="step--">{{ $t('settings.import.back') }}</button>
      <button v-if="step < 5" class="imp__btn" :disabled="!canAdvance" @click="advance">{{ $t('settings.import.next') }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
  saveImportProfile,
  type CommitResult,
} from '../composables/useImportCommit'

const step = ref(1)
const error = ref('')
const file = ref<File | null>(null)
const profileApplied = ref(false)

const sheets = ref<Record<string, RawRow[]>>({})
const sheetNames = computed(() => Object.keys(sheets.value))
const selectedSheet = ref('')

const allRows = computed<RawRow[]>(() => sheets.value[selectedSheet.value] ?? [])
const previewRows = computed(() => allRows.value.slice(0, 25))

const headerRowIndex = ref(0)
const headerRow = computed<RawRow>(() => allRows.value[headerRowIndex.value] ?? [])
const dataRows = computed<RawRow[]>(() => allRows.value.slice(headerRowIndex.value + 1))

const mapping = ref<Record<number, FieldKey>>({})
const skipDuplicateSerials = ref(true)
const saveProfile = ref(true)
const committing = ref(false)
const commitResult = ref<CommitResult | null>(null)

watch(headerRowIndex, () => {
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

const validation = computed(() => validateRows(mapping.value, dataRows.value))

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

async function onFileChange(e: Event) {
  error.value = ''
  const picked = (e.target as HTMLInputElement).files?.[0]
  if (!picked) return
  file.value = picked
  try {
    const buf = await picked.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: true })
    const parsed: Record<string, RawRow[]> = {}
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<RawRow>(wb.Sheets[name], { header: 1, raw: false, defval: null })
      parsed[name] = rows as RawRow[]
    }
    sheets.value = parsed
    selectedSheet.value = wb.SheetNames[0]
    headerRowIndex.value = guessHeaderRow(parsed[wb.SheetNames[0]] ?? [])
    mapping.value = guessMapping((parsed[wb.SheetNames[0]] ?? [])[headerRowIndex.value] ?? [])
    await applyProfileIfAny()
  } catch (err) {
    error.value = (err as Error).message
  }
}

watch(selectedSheet, () => {
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

.imp__tablewrap { overflow: auto; max-height: 360px; border: 1px solid #e5e7eb; border-radius: 8px; }
.imp__table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.imp__table td, .imp__table th { padding: 0.35rem 0.5rem; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
.imp__table th { background: #f9fafb; text-align: left; position: sticky; top: 0; }
.imp__rownum { color: #9ca3af; }
.imp__row--header { background: #d1fae5; cursor: pointer; }
.imp__table tbody tr { cursor: pointer; }
.imp__table tbody tr:hover { background: #f3f4f6; }

.imp__mapgrid { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; }
.imp__mapcol { min-width: 160px; flex: 0 0 auto; }
.imp__colhead { font-weight: 600; font-size: 0.85rem; margin-bottom: 0.35rem; }
.imp__mapcol select { width: 100%; padding: 0.4rem; border-radius: 6px; border: 1px solid #d1d5db; }
.imp__samples { margin-top: 0.4rem; font-size: 0.75rem; color: #6b7280; }
.imp__sample { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.imp__checkbox { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; margin-top: 0.6rem; }
.imp__summary { font-size: 0.9rem; padding-left: 1.2rem; }

.imp__nav { display: flex; gap: 0.5rem; margin-top: 1.25rem; }
.imp__btn { background: #1a3a2a; color: #fff; border: none; border-radius: 8px; padding: 0.6rem 1.2rem; font-weight: 600; cursor: pointer; }
.imp__btn:disabled { opacity: 0.5; cursor: default; }
.imp__btn--ghost { background: none; color: #1a3a2a; border: 1px solid #1a3a2a; }
</style>
