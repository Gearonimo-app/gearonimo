<template>
  <section class="ca">
    <div class="ca__head">
      <h2>{{ $t('articles.title') }}</h2>
      <div class="ca__head-actions">
        <button v-if="articles.length > 1 && !showAdd" class="ca__select-toggle" @click="toggleSelectMode">
          {{ selectMode ? $t('common.cancel') : $t('sets.group.selectButton') }}
        </button>
        <button v-if="!showAdd && !selectMode" class="ca__add" @click="openAdd">+ {{ $t('articles.add') }}</button>
      </div>
    </div>

    <!-- Samenstellen vanuit de lijst: artikelen aanvinken en in één stap
         groeperen, i.p.v. eerst een lege set aan te maken (besluit Jos
         2026-07-11). -->
    <div v-if="selectMode" class="ca__group-bar">
      <span>{{ $t('sets.group.selectedCount', { count: selectedIds.length }) }}</span>
      <button class="ca__group-btn" :disabled="selectedIds.length === 0" @click="openGroupDialog">
        {{ $t('sets.group.action') }}
      </button>
    </div>

    <div v-if="loading" class="ca__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ca__state ca__state--error">{{ error }}</div>
    <p v-else-if="articles.length === 0 && !showAdd" class="ca__state">{{ $t('articles.empty') }}</p>

    <ul v-else-if="articles.length" class="ca__list">
      <template v-for="row in displayRows" :key="row.article.id">
        <li v-if="row.isFirstInGroup" class="ca__group-head">🔗 {{ row.groupName }}</li>
        <li class="ca__item" :class="{ 'ca__item--grouped': row.groupId }">
          <input
            v-if="selectMode"
            type="checkbox"
            class="ca__checkbox"
            :checked="selectedIds.includes(row.article.id)"
            @change="toggleSelect(row.article.id)"
          />
          <div class="ca__item-main" @click="selectMode ? toggleSelect(row.article.id) : $router.push(`/articles/${row.article.id}`)">
            <div class="ca__desc">{{ articleLabel(row.article) }}</div>
            <div class="ca__meta">
              <span v-if="row.article.serial_number">SN {{ row.article.serial_number }}</span>
              <span v-if="!row.article.product_id" class="ca__badge">{{ $t('articles.freeBadge') }}</span>
            </div>
          </div>
          <template v-if="!selectMode">
            <!-- Onderdeel toevoegen aan dit artikel (bv. een vervangen brug op
                 een klimgordel) -- koppelt in één stap aan (of maakt) de set. -->
            <button type="button" class="ca__part-btn" :title="$t('sets.addPart.title')" @click.stop="partFor = row.article">🔗+</button>
            <!-- Alleen bij vrije artikelen: aanmelden voor de catalogus-wachtrij.
                 Geen kaal vinkje meer: de knop opent een productformulier dat de
                 keurmeester zelf invult vóór het op de wachtrij komt (besluit Jos
                 2026-07-05). @click.stop zodat het niet doorklikt naar het
                 artikeldetail. Actief = al aangemeld. -->
            <button v-if="!row.article.product_id" type="button" class="ca__catalog-toggle"
                    :class="{ 'ca__catalog-toggle--on': row.article.suggest_for_catalog }"
                    :title="$t('articles.suggestForCatalog')"
                    @click.stop="suggestFor = row.article">
              📚
            </button>
          </template>
        </li>
      </template>
    </ul>

    <!-- Toevoegen (inline) -->
    <div v-if="showAdd" class="ca__form">
      <h3>{{ $t('articles.add') }}</h3>

      <!-- Standaardflow: eerst het Artikel/omschrijving -- je typt wat er op het
           artikel staat (naam of fabrikant-artikelcode) en zoekt in de HELE
           catalogus. Matcht dat exact een catalogusproduct, dan vullen Merk en
           Categorie zich vanzelf. Alleen als je het artikel zo niet vindt, neem
           je de moeite om eerst het Merk (en eventueel Categorie) op te zoeken
           -- die twee filteren de artikel-suggesties dan verder in. Geen match
           = vrij artikel. `ref="itemRefs"` + scrollToActive laten de
           gemarkeerde suggestie meescrollen bij ↑/↓. -->
      <div class="ca__field">
        <input
          v-model="newDescription"
          class="ca__input"
          :placeholder="$t('inspections.table.article')"
          @focus="activeField = 'article'"
          @blur="closeSuggest"
          @keydown="onSuggestKeydown"
        />
        <div v-if="activeField === 'article' && fieldSuggestions.length" class="ca__suggest">
          <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" ref="itemRefs"
                  class="ca__suggest-item" :class="{ 'ca__suggest-item--active': i === suggestIndex }"
                  @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
        </div>
      </div>
      <div class="ca__field">
        <input
          v-model="newBrand"
          class="ca__input"
          :placeholder="$t('inspections.table.brand')"
          @focus="activeField = 'brand'"
          @blur="closeSuggest"
          @keydown="onSuggestKeydown"
        />
        <div v-if="activeField === 'brand' && fieldSuggestions.length" class="ca__suggest">
          <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" ref="itemRefs"
                  class="ca__suggest-item" :class="{ 'ca__suggest-item--active': i === suggestIndex }"
                  @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
        </div>
      </div>
      <div class="ca__field">
        <input
          v-model="newCategory"
          class="ca__input"
          :placeholder="$t('inspections.table.category')"
          @focus="activeField = 'category'"
          @blur="closeSuggest"
          @keydown="onSuggestKeydown"
        />
        <div v-if="activeField === 'category' && fieldSuggestions.length" class="ca__suggest">
          <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" ref="itemRefs"
                  class="ca__suggest-item" :class="{ 'ca__suggest-item--active': i === suggestIndex }"
                  @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
        </div>
      </div>

      <!-- Vrij artikel: alleen de extra velden die het keurbedrijf aanzet
           (Norm/MBS). Het aanbieden voor de catalogus staat bewust niet hier
           maar per rij in de artikellijst hierboven. -->
      <template v-if="willBeFreeArticle && (freeFields.norm || freeFields.mbs)">
        <input v-if="freeFields.norm" v-model="form.free_norm" :placeholder="$t('inspections.table.norm')" class="ca__input" />
        <input v-if="freeFields.mbs"  v-model="form.free_mbs"  :placeholder="$t('inspections.table.mbs')"  class="ca__input" />
      </template>

      <hr class="ca__sep" />
      <!-- Volgorde volgt de invulflow bij het artikel in de hand: eerst het
           serienummer (staat op het artikel), dán bouwjaar/-maand. -->
      <input v-model="form.serial_number"      :placeholder="$t('articles.fields.serial')" class="ca__input" />
      <div class="ca__row">
        <input v-model="newYear" type="number" class="ca__input ca__input--sm" :placeholder="$t('inspections.table.year')" />
        <select v-model="newMonth" class="ca__input ca__input--sm">
          <option :value="null">{{ $t('inspections.table.month') }}</option>
          <option v-for="m in 12" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
      <input v-model="form.assigned_user_name" :placeholder="$t('articles.fields.user')"   class="ca__input" />
      <!-- Aankoop-/verkoopdatum is leidend: dat is wat de winkel/keurmeester bij
           verkoop invult. De ingebruikname (wanneer de klant 'm echt gaat
           gebruiken) weet de keurmeester meestal niet, dus die spiegelt
           standaard de aankoopdatum en blijft daarna aanpasbaar. -->
      <label class="ca__date-label">
        {{ $t('articles.detail.fields.purchaseDate') }}
        <input v-model="form.purchase_date" type="date" class="ca__input" />
      </label>
      <label class="ca__date-label">
        {{ $t('articles.fields.firstUse') }}
        <input v-model="form.first_use_date" type="date" class="ca__input" @input="firstUseTouched = true" />
      </label>
      <input v-model="form.set_label" :placeholder="$t('articles.fields.set')" class="ca__input" />
      <textarea v-model="form.notes" :placeholder="$t('articles.fields.notes')" class="ca__input" rows="2"></textarea>

      <p v-if="formError" class="ca__error">{{ formError }}</p>
      <div class="ca__actions">
        <button class="ca__btn ca__btn--cancel" @click="closeAdd">{{ $t('common.cancel') }}</button>
        <button class="ca__btn ca__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>

    <CatalogSuggestDialog
      v-if="suggestFor"
      :article-id="suggestFor.id"
      :label="articleLabel(suggestFor)"
      @saved="onSuggestSaved"
      @close="suggestFor = null"
    />

    <AddPartDialog
      v-if="partFor"
      :customer-id="props.customerId"
      :main-article-id="partFor.id"
      :main-label="articleLabel(partFor)"
      :products="products"
      @saved="onPartSaved"
      @close="partFor = null"
    />

    <div v-if="showGroupDialog" class="ca__overlay" @click.self="showGroupDialog = false">
      <div class="ca__dialog">
        <h2>{{ $t('sets.group.dialogTitle') }}</h2>
        <input v-model="groupName" class="ca__input" :placeholder="$t('sets.fields.name')" />
        <p v-if="groupError" class="ca__error">{{ groupError }}</p>
        <div class="ca__actions">
          <button class="ca__btn ca__btn--cancel" @click="showGroupDialog = false">{{ $t('common.cancel') }}</button>
          <button class="ca__btn ca__btn--save" :disabled="groupSaving" @click="saveGroup">
            {{ groupSaving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, useOnline, useOfflineSession, getArticlesForCustomer, getProducts } from '@gearonimo/core'
import { useFieldSuggest, fuzzyFilter } from '@gearonimo/ui'
import { fetchFreeInputFields } from '../composables/useInspections'
import CatalogSuggestDialog from './CatalogSuggestDialog.vue'
import AddPartDialog from './AddPartDialog.vue'

const { isOnline } = useOnline()

const props = defineProps<{ customerId: string }>()
const { t } = useI18n()

interface Product { id: string; brand: string | null; name: string | null; category: string | null; manufacturer_code: string | null }
interface ProductMatch { id: string; brand: string | null; name: string | null; product_type?: string | null }
interface Article {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_description: string | null
  product_id: string | null
  suggest_for_catalog: boolean
  product: ProductMatch | null
}

const articles = ref<Article[]>([])
const loading = ref(true)
const error = ref('')

const showAdd = ref(false)
const saving = ref(false)
const formError = ref('')

// Hele catalogus één keer geladen, zelfde aanpak als in InspectionWizard.vue:
// voedt de Artikel/Merk/Categorie-typeaheads en laat een getypt artikel
// terugkoppelen aan een catalogusproduct.
const products = ref<Product[]>([])
const allBrands = computed(() => unique(products.value.map(p => p.brand)))
const allCategories = computed(() => unique(products.value.map(p => p.category)))
// Producten die binnen de gekozen trechter (merk + categorie) vallen.
const matchingProducts = computed(() =>
  products.value.filter(p =>
    p.name &&
    (!newBrand.value.trim()    || (p.brand ?? '').toLowerCase() === newBrand.value.trim().toLowerCase()) &&
    (!newCategory.value.trim() || (p.category ?? '').toLowerCase() === newCategory.value.trim().toLowerCase())
  )
)

// De artikel-suggestie toont naam én (indien aanwezig) de fabrikant-artikelcode.
// De code staat in het label, zodat op code zoeken vanzelf meelift in dezelfde
// fuzzy-filter (typ je "M33", dan matcht de code). Bij het kiezen knippen we de
// code er weer af, zodat alleen de nette naam in het omschrijvingsveld komt.
const CODE_SEP = '  ·  '
function productLabel(p: Product): string {
  return p.manufacturer_code ? `${p.name}${CODE_SEP}${p.manufacturer_code}` : (p.name ?? '')
}
function stripCode(label: string): string {
  return label.split(CODE_SEP)[0].trim()
}
const matchingArticleLabels = computed(() => unique(matchingProducts.value.map(productLabel)))

// Categorie-suggesties: beperkt tot het gekozen merk (trechter-flow). Heeft dat
// merk in de catalogus geen enkele categorie, dan tonen we toch de volledige
// lijst i.p.v. een lege dropdown -- de catalogus vult `category` niet overal.
const matchingCategories = computed(() => {
  const b = newBrand.value.trim().toLowerCase()
  if (!b) return allCategories.value
  const forBrand = unique(products.value.filter(p => (p.brand ?? '').toLowerCase() === b).map(p => p.category))
  return forBrand.length ? forBrand : allCategories.value
})

function unique(arr: (string | null)[]): string[] {
  return Array.from(new Set(arr.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
}

const newDescription = ref('')
const newBrand = ref('')
const newCategory = ref('')
const newYear = ref<number | null>(null)
const newMonth = ref<number | null>(null)

type SuggestField = 'article' | 'brand' | 'category'

// Tolerante matching uit @gearonimo/ui: vindt ook "OK TriactLock" bij "ok tl"
// (acroniem van woord-initialen), niet alleen bij een aaneengesloten "ok t".
function suggestFilter(list: string[], typed: string): string[] {
  return fuzzyFilter(list, typed, 30)
}
function setFieldValue(field: SuggestField, val: string) {
  switch (field) {
    case 'article': newDescription.value = stripCode(val); break
    case 'brand': newBrand.value = val; break
    case 'category': newCategory.value = val; break
  }
}

// Gedeelde typeahead-besturing (zie @gearonimo/ui). De template gebruikt de
// vertrouwde namen via aliassen.
const {
  activeField,
  suggestIndex,
  suggestions: fieldSuggestions,
  itemRefs,
  pick: pickSuggestion,
  close: closeSuggest,
  onKeydown: onSuggestKeydown,
} = useFieldSuggest<SuggestField>({
  scrollToActive: true,
  resolve: (field) => {
    switch (field) {
      case 'article': return suggestFilter(matchingArticleLabels.value, newDescription.value)
      case 'brand': return suggestFilter(allBrands.value, newBrand.value)
      case 'category': return suggestFilter(matchingCategories.value, newCategory.value)
      default: return []
    }
  },
  select: setFieldValue,
})

// Zodra het getypte artikel exact een catalogusproduct matcht, merk en
// categorie meteen invullen. Vrije tekst laat de velden met rust.
watch(newDescription, (name) => {
  const n = name.trim().toLowerCase()
  if (!n) return
  const p = products.value.find(p => (p.name ?? '').toLowerCase() === n)
  if (p) {
    if (p.brand) newBrand.value = p.brand
    if (p.category) newCategory.value = p.category
  }
})

function matchProduct(): Product | null {
  const name = newDescription.value.trim().toLowerCase()
  const brand = newBrand.value.trim().toLowerCase()
  if (!name) return null
  const matches = products.value.filter(p => (p.name ?? '').toLowerCase() === name)
  if (!matches.length) return null
  if (brand) {
    const withBrand = matches.find(p => (p.brand ?? '').toLowerCase() === brand)
    if (withBrand) return withBrand
  }
  return matches[0]
}
const willBeFreeArticle = computed(() => !!newDescription.value.trim() && !matchProduct())

function emptyForm() {
  return {
    free_norm: '', free_mbs: '',
    serial_number: '', assigned_user_name: '', first_use_date: '', purchase_date: '', set_label: '', notes: '',
  }
}

// Ingebruikname spiegelt de aankoopdatum zolang de keurmeester 'm niet zelf
// heeft aangepast (zie de toelichting in de template).
const firstUseTouched = ref(false)

// Aanmelden voor de catalogus via het gedeelde formulier-dialoog (zie ook
// InspectionWizard). De dialoog schrijft zelf weg; hier alleen de lokale
// rij-status bijwerken zodat het 📚-icoon meteen klopt.
const suggestFor = ref<Article | null>(null)
function onSuggestSaved(suggested: boolean) {
  if (suggestFor.value) suggestFor.value.suggest_for_catalog = suggested
}
const form = ref(emptyForm())

// Sets: samenstellen vanuit de artikellijst (besloten met Jos 2026-07-11) --
// i.p.v. eerst een lege set aanmaken en er dan artikelen bij zoeken, vink je
// hier artikelen aan die je al voor je hebt en groepeer je ze in één stap.
// Badges tonen meteen welke artikelen al bij een set horen.
const selectMode = ref(false)
const selectedIds = ref<string[]>([])
const showGroupDialog = ref(false)
const groupName = ref('')
const groupSaving = ref(false)
const groupError = ref('')
// article_id -> zijn (eerste) set. Voedt zowel de groepering in de lijst
// hieronder als het setdetail-overzicht.
const setInfo = ref<Record<string, { setId: string; setName: string }>>({})
const partFor = ref<Article | null>(null)

// Setleden bij elkaar tonen i.p.v. los verspreid over de lijst (besloten met
// Jos 2026-07-11: "als ik de Nomad vasthou wil ik de Fidus er meteen naast
// zien staan"). Eén groepskop per set, gevolgd door zijn leden; artikelen
// zonder set blijven gewoon los, op hun eigen plek in de bestaande volgorde.
interface DisplayRow { article: Article; groupId: string | null; groupName: string | null; isFirstInGroup: boolean }
const displayRows = computed<DisplayRow[]>(() => {
  const seen = new Set<string>()
  const result: DisplayRow[] = []
  for (const a of articles.value) {
    if (seen.has(a.id)) continue
    const info = setInfo.value[a.id]
    if (info) {
      const members = articles.value.filter((x) => setInfo.value[x.id]?.setId === info.setId)
      members.forEach((m, idx) => {
        seen.add(m.id)
        result.push({ article: m, groupId: info.setId, groupName: info.setName, isFirstInGroup: idx === 0 })
      })
    } else {
      seen.add(a.id)
      result.push({ article: a, groupId: null, groupName: null, isFirstInGroup: false })
    }
  }
  return result
})

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  selectedIds.value = []
}
function toggleSelect(id: string) {
  const i = selectedIds.value.indexOf(id)
  if (i === -1) selectedIds.value.push(id)
  else selectedIds.value.splice(i, 1)
}
function openGroupDialog() {
  groupError.value = ''
  const first = articles.value.find((a) => a.id === selectedIds.value[0])
  groupName.value = first ? articleLabel(first) : ''
  showGroupDialog.value = true
}
async function saveGroup() {
  groupError.value = ''
  if (!groupName.value.trim()) { groupError.value = t('sets.errors.nameRequired'); return }
  groupSaving.value = true
  const { data: set, error: setErr } = await supabase
    .from('article_sets')
    .insert({ customer_id: props.customerId, name: groupName.value.trim() })
    .select('id')
    .single()
  if (setErr) { groupSaving.value = false; groupError.value = setErr.message; return }

  const { error: membersErr } = await supabase
    .from('article_set_members')
    .insert(selectedIds.value.map((article_id) => ({ set_id: set.id, article_id })))
  groupSaving.value = false
  if (membersErr) { groupError.value = membersErr.message; return }

  showGroupDialog.value = false
  selectMode.value = false
  selectedIds.value = []
  await loadSets()
}

async function loadSets() {
  if (!isOnline.value) return
  const { data } = await supabase
    .from('article_set_members')
    .select('article_id, set_id, article_sets!inner(name, customer_id)')
    .eq('article_sets.customer_id', props.customerId)
  type Row = { article_id: string; set_id: string; article_sets: { name: string } }
  const map: Record<string, { setId: string; setName: string }> = {}
  for (const row of (data ?? []) as unknown as Row[]) {
    // Eerste gevonden set wint (een artikel in meerdere sets is een
    // uitzondering; voor de groepering in de lijst kiezen we er één).
    if (!map[row.article_id]) map[row.article_id] = { setId: row.set_id, setName: row.article_sets.name }
  }
  setInfo.value = map
}

function onPartSaved() {
  partFor.value = null
  load()
  loadSets()
}

watch(() => form.value.purchase_date, (v) => {
  if (!firstUseTouched.value) form.value.first_use_date = v
})

// Extra vrije-invoervelden die het keurbedrijf heeft aangezet (Norm/MBS).
const freeFields = ref<{ norm: boolean; mbs: boolean }>({ norm: false, mbs: false })

function articleLabel(a: Article) {
  const s = a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  return s || t('articles.untitled')
}

async function load() {
  loading.value = true
  error.value = ''

  if (!isOnline.value) {
    try {
      const key = useOfflineSession().getKey()
      const cached = await getArticlesForCustomer<
        { id: string; serial_number: string | null; free_brand: string | null; free_description: string | null; product_id: string | null; suggest_for_catalog: boolean; retired: boolean }
      >(key, props.customerId)
      const productIds = [...new Set(cached.map((a) => a.product_id).filter((v): v is string => !!v))]
      const cachedProducts = productIds.length ? await getProducts<ProductMatch>(key, productIds) : []
      const productById = new Map(cachedProducts.map((p) => [p.id, p]))
      articles.value = cached
        .filter((a) => !a.retired)
        .map((a) => ({
          id: a.id,
          serial_number: a.serial_number,
          free_brand: a.free_brand,
          free_description: a.free_description,
          product_id: a.product_id,
          suggest_for_catalog: a.suggest_for_catalog,
          product: a.product_id ? productById.get(a.product_id) ?? null : null,
        }))
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
    loading.value = false
    return
  }

  const { data, error: err } = await supabase
    .from('articles')
    .select('id, serial_number, free_brand, free_description, product_id, suggest_for_catalog, product:products(id, brand, name)')
    .eq('customer_id', props.customerId)
    .eq('retired', false)
    .order('created_at', { ascending: false })
  if (err) error.value = err.message
  else articles.value = (data ?? []) as unknown as Article[]
  loading.value = false
}

function openAdd() { showAdd.value = true }
function closeAdd() {
  showAdd.value = false
  newDescription.value = ''; newBrand.value = ''; newCategory.value = ''
  newYear.value = null; newMonth.value = null
  activeField.value = null; suggestIndex.value = -1
  formError.value = ''
  firstUseTouched.value = false
  form.value = emptyForm()
}

async function save() {
  formError.value = ''
  if (!newDescription.value.trim()) {
    formError.value = t('articles.errors.chooseOrDescribe'); return
  }
  const product = matchProduct()
  saving.value = true
  const { error: err } = await supabase.from('articles').insert({
    customer_id: props.customerId,
    product_id: product?.id ?? null,
    free_brand: product ? null : (newBrand.value.trim() || null),
    free_category: product ? null : (newCategory.value.trim() || null),
    free_description: product ? null : (newDescription.value.trim() || null),
    free_norm: product ? null : (form.value.free_norm.trim() || null),
    free_mbs: product ? null : (form.value.free_mbs.trim() || null),
    serial_number: form.value.serial_number.trim() || null,
    assigned_user_name: form.value.assigned_user_name.trim() || null,
    first_use_date: form.value.first_use_date || null,
    purchase_date: form.value.purchase_date || null,
    set_label: form.value.set_label.trim() || null,
    notes: form.value.notes.trim() || null,
    manufacture_year: newYear.value || null,
    manufacture_month: newMonth.value || null,
    // Aanbieden voor de catalogus gebeurt nu per rij in de lijst, niet bij toevoegen.
    suggest_for_catalog: false,
    retired: false,
  })
  saving.value = false
  if (err) { formError.value = err.message; return }
  closeAdd()
  await load()
}

onMounted(async () => {
  fetchFreeInputFields().then((f) => { freeFields.value = f })
  // Offline: geen volledige catalogusaanroep (die is sowieso te groot om
  // mee te downloaden, zie slice 2) -- de typeaheads voor een nieuw artikel
  // blijven dan leeg (toevoegen is al online-only), maar de bestaande
  // artikellijst (load() hieronder) blijft wel gewoon werken uit de cache.
  if (isOnline.value) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, brand, name, category, manufacturer_code')
    products.value = (prods ?? []) as Product[]
  }
  await load()
  await loadSets()
})

// Na ontgrendelen via de statusbalk alsnog uit de cache laden (zie Customers.vue).
watch(useOfflineSession().isUnlocked, (unlocked) => {
  if (unlocked) void load()
})
</script>

<style scoped>
.ca { margin-top: 1.5rem; }
.ca__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.ca__head h2 { font-size: 1rem; margin: 0; }
.ca__head-actions { display: flex; align-items: center; gap: 0.85rem; }
.ca__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.ca__select-toggle { background: none; border: none; color: #2563eb; font-weight: 600; font-size: 0.9rem; cursor: pointer; }
.ca__group-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  background: #eff6ff; border-radius: 10px; padding: 0.6rem 0.85rem; margin-bottom: 0.5rem;
  font-size: 0.9rem; color: #1e40af;
}
.ca__group-btn {
  background: #2563eb; color: #fff; border: none; border-radius: 8px;
  padding: 0.45rem 0.85rem; font-weight: 600; cursor: pointer; font-size: 0.85rem;
}
.ca__group-btn:disabled { opacity: 0.5; cursor: default; }
.ca__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.ca__state--error { color: #dc2626; }
.ca__list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ca__item { display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1rem; border-bottom: 1px solid #eee; }
.ca__item:last-child { border-bottom: none; }
.ca__group-head {
  padding: 0.4rem 1rem; font-size: 0.75rem; font-weight: 700; color: #1e40af;
  background: #eff6ff; border-bottom: 1px solid #dbeafe;
}
.ca__item--grouped { border-left: 3px solid #93c5fd; padding-left: calc(1rem - 3px); background: #f8fafc; }
.ca__item-main { flex: 1; min-width: 0; cursor: pointer; }
.ca__checkbox { flex: 0 0 auto; width: 1.15rem; height: 1.15rem; }
.ca__part-btn {
  flex: 0 0 auto; border: none; background: transparent; cursor: pointer;
  font-size: 0.95rem; opacity: 0.45; padding: 0.2rem;
}
.ca__part-btn:hover { opacity: 1; }
.ca__catalog-toggle {
  display: inline-flex; align-items: center; cursor: pointer;
  border: none; background: none; font-size: 1.05rem; padding: 0.2rem;
  opacity: 0.4; filter: grayscale(1);
}
.ca__catalog-toggle--on { opacity: 1; filter: none; }
.ca__desc { font-weight: 600; }
.ca__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.ca__badge { background: #fef3c7; color: #92400e; border-radius: 6px; padding: 0.05rem 0.4rem; font-size: 0.75rem; }
.ca__set-badge { background: #eff6ff; color: #1e40af; border-radius: 6px; padding: 0.05rem 0.4rem; font-size: 0.75rem; }
.ca__overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.ca__dialog { background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 0.6rem; }
.ca__dialog h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }

.ca__form {
  background: #fff; border-radius: 12px; padding: 1rem;
  display: flex; flex-direction: column; gap: 0.6rem;
}
.ca__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.ca__field { position: relative; }
.ca__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
.ca__results {
  list-style: none; margin: 0.25rem 0 0; padding: 0;
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #fff;
}
.ca__results li { padding: 0.6rem 0.85rem; cursor: pointer; border-bottom: 1px solid #f3f4f6; }
.ca__results li:last-child { border-bottom: none; }
.ca__results-item--active { background: #16a34a; color: #fff; }
.ca__results-item--active strong { color: #fff; }
.ca__suggest {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 5;
  background: #fff; border: 1px solid #ddd; border-radius: 8px;
  margin-top: 0.25rem; padding: 0.3rem;
  display: flex; flex-direction: column; gap: 0.1rem;
  max-height: 240px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.ca__suggest-item {
  text-align: left; border: none; background: transparent; cursor: pointer;
  padding: 0.45rem 0.6rem; border-radius: 6px; font-size: 0.9rem;
  color: #111827; font-family: inherit;
}
.ca__suggest-item:hover { background: #f3f4f6; }
.ca__suggest-item--active { background: #e0e7ff; }
.ca__row { display: flex; gap: 0.6rem; }
.ca__input--sm { flex: 1; }
.ca__sep { border: none; border-top: 1px solid #eee; margin: 0.4rem 0; }
.ca__date-label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8rem; color: #6b7280; }
.ca__selected { margin: 0.35rem 0 0; color: #16a34a; font-weight: 600; display: flex; align-items: center; gap: 0.4rem; }
.ca__clear { background: none; border: none; color: #6b7280; font-size: 1.1rem; cursor: pointer; }
.ca__link { background: none; border: none; color: #2563eb; text-align: left; padding: 0; font-size: 0.9rem; cursor: pointer; }
.ca__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.ca__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.ca__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.ca__btn--cancel { background: #f3f4f6; color: #374151; }
.ca__btn--save { background: #16a34a; color: #fff; }
.ca__btn:disabled { opacity: 0.6; }
</style>
