<template>
  <div class="ad">
    <AppHeader :title="articleLabel || $t('articles.title')" :subtitle="customerName || undefined" @back="back">
      <button v-if="article && !editMode && isOnline" class="ad__icon" :title="$t('common.edit')" @click="startEdit"><GIcon name="edit" class="hdr-glyph" /></button>
    </AppHeader>

    <div v-if="loading" class="ad__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ad__state ad__state--error">{{ error }}</div>
    <div v-else-if="!article" class="ad__state">{{ $t('articles.detail.notFound') }}</div>

    <!-- Bekijken -->
    <div v-else-if="!editMode" class="ad__body">
      <span v-if="article.retired" class="ad__retired-badge">
        {{ $t('articles.detail.retiredBadge') }}{{ article.retired_reason ? ` (${article.retired_reason})` : '' }}
      </span>
      <dl class="ad__list">
        <div class="ad__view-row">
          <dt>{{ $t('articles.fields.brand') }}</dt>
          <dd>{{ brandLabel }}</dd>
        </div>
        <template v-for="f in viewFieldDefs" :key="f.col">
          <div v-if="article[f.col] !== null && article[f.col] !== ''" class="ad__view-row">
            <dt>{{ label(f.label) }}</dt>
            <dd>{{ displayValue(f, article[f.col]) }}</dd>
          </div>
        </template>
      </dl>
      <!-- Opmerkingen: bewust altijd in beeld en meteen typbaar (Jos
           2026-07-29). Het stond wel in de gegevenslijst, maar alleen als er
           al iets ingevuld was -- precies dan zoek je het veld dus niet. -->
      <section v-if="isOnline && !article.retired" class="ad__notes">
        <label class="ad__notes-label" for="ad-notes">{{ $t('articles.fields.notes') }}</label>
        <textarea
          id="ad-notes"
          v-model="notesDraft"
          class="ad__input"
          rows="2"
          :placeholder="$t('articles.detail.notesPlaceholder')"
        ></textarea>
        <div v-if="notesDirty" class="ad__notes-actions">
          <button class="ad__walk-btn" :disabled="savingNotes" @click="resetNotes">
            {{ $t('common.cancel') }}
          </button>
          <button class="ad__notes-save" :disabled="savingNotes" @click="saveNotes">
            {{ savingNotes ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </section>

      <!-- Al gekoppeld: laten zien wááraan, en dat kunnen herzien. Een misklik
           in de "bedoelt u"-lijst was tot nu toe niet meer terug te draaien
           (Jos 2026-07-28: "ik wil de naam eigenlijk aanpassen naar oranje
           carbon"). -->
      <section v-if="!isFreeArticle && !relinking && isOnline && !article.retired" class="ad__link">
        <h2 class="ad__link-title">{{ $t('articles.detail.linkedTitle') }}</h2>
        <p class="ad__link-original">
          <span class="ad__link-original-label">{{ $t('articles.detail.linkedProduct') }}</span>
          <span class="ad__link-original-value">{{ brandLabel }}</span>
        </p>
        <div class="ad__link-actions">
          <button class="ad__walk-btn" @click="startRelink">{{ $t('articles.detail.relink') }}</button>
          <button class="ad__walk-btn" :disabled="linking" @click="unlinkProduct">
            {{ $t('articles.detail.unlink') }}
          </button>
        </div>
      </section>

      <!-- Vrij artikel koppelen aan een catalogusproduct ("bedoelt u: …") -->
      <section v-if="(isFreeArticle || relinking) && isOnline && !article.retired" class="ad__link">
        <h2 class="ad__link-title">{{ $t('articles.detail.linkTitle') }}</h2>
        <p class="ad__link-hint">{{ $t('articles.detail.linkHint') }}</p>
        <!-- De originele (vrije) schrijfwijze blijft als referentie in beeld, ook
             terwijl de keurmeester in het zoekveld typt om het juiste product te
             vinden (wens Jos 2026-07-27). -->
        <p class="ad__link-original">
          <span class="ad__link-original-label">{{ $t('articles.detail.linkOriginal') }}</span>
          <span class="ad__link-original-value">{{ brandLabel || '—' }}</span>
        </p>
        <label class="ad__link-suggest-label">{{ $t('articles.detail.linkSuggest') }}</label>
        <!-- Zoek-dropdown zoals elders in de app (klant-/serienummer-picker):
             typen filtert, de lijst klapt onder het veld uit. mousedown.prevent
             zodat de keuze telt vóór blur de lijst sluit. -->
        <div class="ad__combo">
          <input
            v-model="productQuery"
            class="ad__input"
            :placeholder="$t('articles.detail.linkPlaceholder')"
            @focus="productListOpen = true"
            @blur="closeProductListSoon"
          />
          <div v-if="productListOpen && productSuggestions.length" class="ad__combolist">
            <button
              v-for="p in productSuggestions"
              :key="p.id"
              type="button"
              class="ad__comboitem"
              :disabled="linking"
              @mousedown.prevent="linkProduct(p)"
            >
              <span class="ad__suggest-name">{{ productLabel(p) }}</span>
              <!-- Code erbij: op oude certificaten staat vaak alleen die code,
                   dus zo zie je meteen dát het de juiste variant is. -->
              <span v-if="p.manufacturer_code || p.category" class="ad__suggest-cat">
                {{ [p.manufacturer_code, p.category].filter(Boolean).join(' · ') }}
              </span>
            </button>
          </div>
        </div>
        <!-- Een mislukte catalogus-aanroep zag er tot nu toe uit als "niets
             gevonden"; die twee zijn nu uit elkaar te houden. -->
        <p v-if="productsError" class="ad__error">{{ productsError }}</p>
        <p v-else-if="productListOpen && productQuery.trim() && !productSuggestions.length" class="ad__link-none">
          {{ $t('articles.detail.linkNone') }}
        </p>

        <!-- Staat het product niet in de catalogus? Dan hoort het op de
             wachtrij, zónder eerst naar het klantdetail terug te moeten
             (wens Jos 2026-07-28). Alleen voor vrije artikelen: de wachtrij
             toont uitsluitend artikelen zonder product (CatalogQueue.vue). -->
        <button v-if="isFreeArticle" type="button" class="ad__queue" @click="suggestOpen = true">
          <GIcon name="plus" class="ad__queue-icon" />
          {{ article.suggest_for_catalog
            ? $t('articles.detail.queueEdit')
            : $t('articles.suggestForCatalog') }}
        </button>
        <button v-if="relinking" type="button" class="ad__link-cancel" @click="cancelRelink">
          {{ $t('common.cancel') }}
        </button>
      </section>

      <!-- Doorklikken binnen de artikellijst van deze klant: na een import zijn
           dit er honderden achter elkaar (wens Jos 2026-07-28). -->
      <nav v-if="siblings.length > 1" class="ad__walk">
        <button class="ad__walk-btn" :disabled="!prevId" @click="prevId && goTo(prevId)">
          ← {{ $t('articles.detail.prev') }}
        </button>
        <span class="ad__walk-pos">{{ currentIndex + 1 }} / {{ siblings.length }}</span>
        <button class="ad__walk-btn" :disabled="!nextId" @click="nextId && goTo(nextId)">
          {{ $t('articles.detail.next') }} →
        </button>
      </nav>
      <button v-if="nextFreeId" class="ad__walk-free" @click="goTo(nextFreeId)">
        {{ $t('articles.detail.nextFree', { count: freeCount }) }} →
      </button>

      <button v-if="!article.retired && isOnline" class="ad__retire" @click="openRetire">
        {{ $t('articles.detail.retire') }}
      </button>
      <!-- Weer in gebruik nemen: bestond tot nu toe alleen binnen een lopende
           keuring (SN-zoeken in InspectionWizard) -- Jos, 2026-07-13: vanuit
           het klantdetail (nieuw "Afgevoerd materiaal"-overzicht) was een
           afgevoerd artikel een doodlopend pad. Zelfde simpele veldreset,
           zonder het meteen aan een keuring te koppelen. -->
      <button v-if="article.retired && isOnline" class="ad__reinstate" :disabled="reinstating" @click="reinstate">
        {{ reinstating ? $t('common.busy') : $t('articles.reinstate') }}
      </button>
    </div>

    <!-- Bewerken -->
    <div v-else class="ad__body">
      <div v-for="f in fieldDefs" :key="f.col" class="ad__field">
        <label class="ad__field-label">{{ label(f.label) }}</label>
        <textarea v-if="f.textarea" v-model="form[f.col]" class="ad__input" rows="3"></textarea>
        <input v-else-if="f.type === 'checkbox'" type="checkbox" v-model="form[f.col]" class="ad__checkbox" />
        <!-- Geen veld op slot: de keurmeester mag alles (ook de ingebruikname)
             altijd corrigeren -- typefouten/misklikken moeten herstelbaar
             blijven. (Een eventuele beperking hoort in de klant-app, niet hier.) -->
        <input
          v-else
          v-model="form[f.col]"
          :type="f.type || 'text'"
          class="ad__input"
        />
      </div>
      <p v-if="formError" class="ad__error">{{ formError }}</p>
      <div class="ad__actions">
        <button class="ad__btn ad__btn--cancel" @click="editMode = false">{{ $t('common.cancel') }}</button>
        <button class="ad__btn ad__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>

    <!-- Aanmelden voor de catalogus-wachtrij: hetzelfde dialoog als op het
         klantdetail en in de keuring-wizard (schrijft zelf weg). -->
    <CatalogSuggestDialog
      v-if="suggestOpen && article"
      :article-id="id"
      :label="articleLabel"
      @saved="onSuggestSaved"
      @close="suggestOpen = false"
    />

    <!-- Afvoeren/verwijderen bevestigen -->
    <div v-if="showRetire" class="ad__overlay" @click.self="showRetire = false">
      <div class="ad__dialog">
        <h2>{{ everCertified ? $t('articles.detail.retireTitle') : $t('articles.detail.deleteTitle') }}</h2>
        <p>{{ everCertified ? $t('articles.detail.retireBody') : $t('articles.detail.deleteNeverInspectedBody') }}</p>
        <div class="ad__actions">
          <button class="ad__btn ad__btn--cancel" @click="showRetire = false">{{ $t('common.cancel') }}</button>
          <button class="ad__btn ad__btn--danger" :disabled="retiring" @click="everCertified ? retire() : remove()">
            {{ everCertified ? $t('articles.detail.retire') : $t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// Buiten <script setup>: dit staat één keer in de app, niet per pagina.
//
// De buurlijst hoort bij de klant, niet bij één artikel. Sinds de
// werk-tabbladen krijgt élk artikel een eigen, verse component (de
// keep-alive-sleutel bevat het pad), dus zonder deze cache zou doorlopen door
// 278 geïmporteerde artikelen 278 keer de hele lijst ophalen -- juist tijdens
// het koppelen, vaak op mobiel internet.
export interface Sibling { id: string; product_id: string | null }
let siblingCache: { customerId: string; rows: Sibling[] } | null = null
/** Aanroepen zodra de samenstelling van de lijst verandert (afvoeren/terugzetten/wissen). */
function clearSiblingCache() {
  siblingCache = null
}
</script>

<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import CatalogSuggestDialog from '../components/CatalogSuggestDialog.vue'
import { GIcon, fuzzySearch } from '@gearonimo/ui'
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  supabase,
  useOnline,
  useOfflineSession,
  getArticle,
  getProducts,
  getCustomer,
  errorMessage,
  fetchAllRows,
} from '@gearonimo/core'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
// Eén keer uitlezen bij het opbouwen van de pagina. Blijft een ref (hij wordt
// door de hele pagina als id.value gelezen), maar hij verandert niet meer:
// 'vorige/volgende artikel' levert sinds de werk-tabbladen een verse component
// per artikel -- zie de LET OP-notitie onderaan.
const id = ref(route.params.id as string)
const { isOnline } = useOnline()

interface FieldDef { col: string; label: string; textarea?: boolean; type?: string }

const fieldDefs: FieldDef[] = [
  { col: 'serial_number', label: 'articles.fields.serial' },
  { col: 'assigned_user_name', label: 'articles.fields.user' },
  { col: 'first_use_date', label: 'articles.fields.firstUse', type: 'date' },
  { col: 'set_label', label: 'articles.fields.set' },
  { col: 'manufacture_year', label: 'articles.detail.fields.manufactureYear', type: 'number' },
  { col: 'manufacture_month', label: 'articles.detail.fields.manufactureMonth', type: 'number' },
  { col: 'purchase_date', label: 'articles.detail.fields.purchaseDate', type: 'date' },
  { col: 'severe_use', label: 'articles.detail.fields.severeUse', type: 'checkbox' },
  { col: 'interval_override_months', label: 'articles.detail.fields.intervalOverride', type: 'number' },
  { col: 'notes', label: 'articles.fields.notes', textarea: true },
]

// Een artikelrij met de paar genest gelezen velden expliciet getypeerd; de
// overige DB-kolommen worden generiek via de fieldDefs benaderd (index-sig).
interface ArticleRecord {
  product: { brand: string | null; name: string | null } | null
  free_brand: string | null
  free_description: string | null
  [key: string]: unknown
}

const article = ref<ArticleRecord | null>(null)
// Los van `article` bijgehouden (i.p.v. via een genest `customer`-veld op
// ArticleRecord): zo hoeft het bewerk-/afvoer-pad de join niet elke keer
// opnieuw mee te selecteren, en werkt de offline-tak (die geen join kan doen)
// op dezelfde manier.
const customerName = ref<string | null>(null)
const loading = ref(true)
const error = ref('')
const editMode = ref(false)
const saving = ref(false)
const retiring = ref(false)
const reinstating = ref(false)
const formError = ref('')
const showRetire = ref(false)
const everCertified = ref(true)
// Bewerk-formulier wordt dynamisch uit fieldDefs opgebouwd (tekst, getal,
// checkbox door elkaar) en via v-model gebonden; één concreet type past hier
// niet, vandaar bewust Record<string, any> voor alleen dit formulierobject.
const form = ref<Record<string, any>>({})

// Opmerkingen krijgen een eigen blok; hier weglaten voorkomt dat ze dubbel
// in beeld staan zodra ze gevuld zijn.
const viewFieldDefs = fieldDefs.filter((f) => f.col !== 'notes')

const notesDraft = ref('')
const savingNotes = ref(false)
const notesDirty = computed(() => notesDraft.value !== ((article.value?.notes as string | null) ?? ''))

function resetNotes() {
  notesDraft.value = (article.value?.notes as string | null) ?? ''
}

async function saveNotes() {
  savingNotes.value = true
  const { data, error: err } = await supabase
    .from('articles')
    .update({ notes: notesDraft.value.trim() || null })
    .eq('id', id.value)
    .select('*, customer:customers(name), product:products(id, brand, name)')
    .single()
  savingNotes.value = false
  if (err) { error.value = err.message; return }
  article.value = data
  notesDraft.value = data.notes ?? ''
}

const brandLabel = computed(() => {
  const a = article.value
  if (!a) return ''
  return a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
})
const articleLabel = computed(() => brandLabel.value || t('articles.untitled'))

// --- Koppelen aan een catalogusproduct ---------------------------------------
// Geïmporteerde artikelen komen bijna altijd binnen als "vrij artikel": de
// schrijfwijze op het oude certificaat ("distel alu kort") matcht niet exact
// een catalogusnaam. Hier bieden we een fuzzy "bedoelt u"-lijst aan zodat de
// keurmeester het vrije artikel met één klik aan het echte product koppelt —
// dan kloppen keurtermijn (regime), recall en handleiding vanzelf.
interface CatalogProduct {
  id: string; brand: string | null; name: string | null
  category: string | null; product_type: string | null; manufacturer_code: string | null
}
const products = ref<CatalogProduct[]>([])
const productQuery = ref('')
const productListOpen = ref(false)
const productsError = ref('')
const linking = ref(false)
const isFreeArticle = computed(() => !!article.value && !article.value.product_id)

function closeProductListSoon() {
  // Korte vertraging zodat een klik op een item nog telt (mousedown vóór blur),
  // net als de klant-picker in de importwizard.
  window.setTimeout(() => { productListOpen.value = false }, 150)
}

function productLabel(p: CatalogProduct): string {
  return [p.brand, p.name].filter(Boolean).join(' ')
}

/**
 * Waarop gezocht wordt. Naast merk + naam ook de artikelcode van de fabrikant:
 * op oude certificaten staat vaak alleen die code ("Fallsafe FS242-L-XL"),
 * terwijl het product in de catalogus "FALL SAFE LITE HARNESS L/XL" heet
 * (Jos 2026-07-28). Zonder de code leverde zoeken op "242" niets op.
 */
function productSearchText(p: CatalogProduct): string {
  return [p.brand, p.name, p.manufacturer_code].filter(Boolean).join(' ')
}

const productSuggestions = computed(() => {
  if (!productQuery.value.trim()) return [] as CatalogProduct[]
  // fuzzySearch valt terug op steeds minder zoekwoorden, zodat de voorgevulde
  // vrije schrijfwijze ("Distel Alu kort") niet in een lege lijst eindigt.
  return fuzzySearch(products.value, productQuery.value, productSearchText)
})

// --- Doorklikken naar het volgende artikel van dezelfde klant ---------------
// Na de import staan er honderden vrije artikelen klaar om gekoppeld te worden
// (Weijtmans: 278). Terug naar het klantdetail en dáár de volgende opzoeken is
// dan de traagste stap; deze knoppen houden je in de artikelpagina (wens Jos,
// 2026-07-28). Zelfde volgorde als de artikellijst op het klantdetail
// (created_at desc), zodat "volgende" is wat je in die lijst verwacht.
const siblings = ref<Sibling[]>([])

const currentIndex = computed(() => siblings.value.findIndex((s) => s.id === id.value))
const prevId = computed(() => (currentIndex.value > 0 ? siblings.value[currentIndex.value - 1].id : null))
const nextId = computed(() => {
  const i = currentIndex.value
  return i >= 0 && i < siblings.value.length - 1 ? siblings.value[i + 1].id : null
})
/**
 * Het eerstvolgende artikel dat nog niet aan de catalogus hangt. Zoekt vooruit
 * en loopt daarna door vanaf het begin, zodat je met één knop de hele lijst
 * rond kunt tot alles gekoppeld is.
 */
const nextFreeId = computed(() => {
  const n = siblings.value.length
  if (currentIndex.value < 0 || n === 0) return null
  for (let k = 1; k < n; k++) {
    const s = siblings.value[(currentIndex.value + k) % n]
    if (!s.product_id) return s.id
  }
  return null
})
const freeCount = computed(() => siblings.value.filter((s) => !s.product_id).length)

async function loadSiblings() {
  // ArticleRecord is een losse index-signature (de kolommen komen uit de
  // veldendefinities), dus het type hier vastleggen voor de cache-sleutel.
  const customerId = article.value?.customer_id as string | undefined
  if (!customerId || !isOnline.value) { siblings.value = []; return }
  // Zit dit artikel al in de gecachete lijst van deze klant, dan die gebruiken:
  // bewust dezelfde array (geen kopie), zodat het bijwerken van product_id bij
  // koppelen/ontkoppelen ook in de cache landt en "volgend vrij artikel" blijft
  // kloppen terwijl je doorloopt.
  if (siblingCache?.customerId === customerId && siblingCache.rows.some((r) => r.id === id.value)) {
    siblings.value = siblingCache.rows
    return
  }
  try {
    const rows = await fetchAllRows<Sibling>((from, to) =>
      supabase
        .from('articles')
        .select('id, product_id')
        .eq('customer_id', customerId)
        .eq('retired', false)
        .order('created_at', { ascending: false })
        .range(from, to),
    )
    siblingCache = { customerId, rows }
    siblings.value = rows
  } catch {
    siblingCache = null
    siblings.value = [] // navigatie valt weg, de pagina zelf blijft werken
  }
}

function goTo(articleId: string) {
  router.push(`/articles/${articleId}`)
}

// Een al gekoppeld artikel opnieuw koppelen of losmaken. Zonder dit was een
// misklik in de "bedoelt u"-lijst definitief.
const relinking = ref(false)
const suggestOpen = ref(false)

function startRelink() {
  relinking.value = true
  // Voorgevuld met de huidige productnaam: meestal zit de juiste variant er
  // vlak naast ("Oranje-grijs" → "Oranje carbon").
  productQuery.value = brandLabel.value
  productListOpen.value = true
}

function cancelRelink() {
  relinking.value = false
  productQuery.value = ''
  productListOpen.value = false
}

/** Terug naar vrij artikel; merk/naam van het product blijven als vrije tekst
 *  staan, anders houd je een artikel zonder omschrijving over. */
async function unlinkProduct() {
  const p = article.value?.product
  linking.value = true
  const { data, error: err } = await supabase
    .from('articles')
    .update({
      product_id: null,
      free_brand: p?.brand ?? null,
      free_description: p?.name ?? null,
    })
    .eq('id', id.value)
    .select('*, customer:customers(name), product:products(id, brand, name)')
    .single()
  linking.value = false
  if (err) { error.value = err.message; return }
  article.value = data
  const s = siblings.value.find((x) => x.id === id.value)
  if (s) s.product_id = null
  startRelink()
}

function onSuggestSaved(suggested: boolean) {
  if (article.value) article.value.suggest_for_catalog = suggested
}

async function linkProduct(p: CatalogProduct) {
  linking.value = true
  const { data, error: err } = await supabase
    .from('articles')
    // Bij het koppelen vervallen de vrije velden: het product is nu de bron
    // van merk/omschrijving/categorie (voorkomt dat oude vrije tekst blijft
    // "spoken" naast de catalogusnaam).
    .update({ product_id: p.id, free_brand: null, free_description: null, free_category: null })
    .eq('id', id.value)
    .select('*, customer:customers(name), product:products(id, brand, name)')
    .single()
  linking.value = false
  if (err) { error.value = err.message; return }
  article.value = data
  productQuery.value = ''
  productListOpen.value = false
  relinking.value = false
  // Dit artikel telt niet meer als "vrij", zodat de knop meteen naar het
  // volgende ongekoppelde artikel wijst zonder de hele lijst opnieuw te halen.
  const s = siblings.value.find((x) => x.id === id.value)
  if (s) s.product_id = p.id
}

function label(key: string) {
  return t(key).replace(' *', '')
}

function displayValue(f: FieldDef, v: unknown) {
  if (f.type === 'checkbox') return v ? t('common.save') : ''
  return v
}

async function load() {
  loading.value = true
  error.value = ''

  // Offline: uit de versleutelde cache (alleen-lezen; bewerken/afvoeren zijn
  // offline verborgen). Dit was het laatste doodlopende pad vanuit de
  // klant-artikellijst: die werkte al offline, maar doorklikken gaf een
  // kale fetch-fout.
  if (!isOnline.value) {
    try {
      const key = useOfflineSession().getKey()
      const cached = await getArticle<ArticleRecord & { product_id: string | null; customer_id: string | null }>(key, id.value)
      if (cached) {
        const product = cached.product_id
          ? ((await getProducts<{ id: string; brand: string | null; name: string | null }>(key, [cached.product_id]))[0] ?? null)
          : null
        article.value = { ...cached, product }
        notesDraft.value = (cached.notes as string | null) ?? ''
        const customer = cached.customer_id
          ? await getCustomer<{ name: string | null }>(key, cached.customer_id)
          : null
        customerName.value = customer?.name ?? null
      } else {
        article.value = null
        customerName.value = null
      }
    } catch (e) {
      error.value = errorMessage(e)
    }
    loading.value = false
    return
  }

  const { data, error: err } = await supabase
    .from('articles')
    .select('*, customer:customers(name), product:products(id, brand, name)')
    .eq('id', id.value)
    .maybeSingle()
  if (err) error.value = err.message
  else {
    article.value = data
    customerName.value = (data?.customer as { name: string | null } | null)?.name ?? null
    notesDraft.value = (data?.notes as string | null) ?? ''
    // Zoekterm alvast vullen met de vrije schrijfwijze, zodat de "bedoelt
    // u"-lijst meteen relevante producten toont zonder overtypen.
    if (isFreeArticle.value && !productQuery.value) productQuery.value = brandLabel.value
  }
  loading.value = false
}

// Catalogus (bedrijfsbreed via RLS) voor de "bedoelt u"-koppeling. Online-only:
// offline is koppelen sowieso niet aan de orde (net als bewerken/afvoeren).
//
// Gepagineerd via fetchAllRows: de catalogus is inmiddels groter dan Supabase's
// "Max rows" (1000). Zonder paginering kwam er stil een willekeurige 1000 terug
// en vond dit veld "Distel …" helemaal niet, terwijl het catalogusoverzicht die
// producten wél toonde (Jos, 2026-07-28).
async function loadProducts() {
  if (!isOnline.value) return
  productsError.value = ''
  try {
    products.value = await fetchAllRows<CatalogProduct>((from, to) =>
      supabase
        .from('products')
        .select('id, brand, name, category, product_type, manufacturer_code')
        .order('brand')
        .order('name')
        .range(from, to),
    )
  } catch (e) {
    // Niet stil slikken: zonder catalogus lijkt het veld "niets te vinden".
    productsError.value = errorMessage(e)
  }
}

function startEdit() {
  const f: Record<string, unknown> = {}
  for (const def of fieldDefs) {
    const v = article.value?.[def.col]
    f[def.col] = def.type === 'checkbox' ? !!v : (v ?? '')
  }
  form.value = f
  formError.value = ''
  editMode.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  const patch: Record<string, unknown> = {}
  for (const def of fieldDefs) {
    const v = form.value[def.col]
    if (def.type === 'checkbox') patch[def.col] = !!v
    else if (def.type === 'number') patch[def.col] = v === '' ? null : Number(v)
    else patch[def.col] = typeof v === 'string' ? (v.trim() || null) : v
  }
  const { data, error: err } = await supabase
    .from('articles')
    .update(patch)
    .eq('id', id.value)
    .select('*, product:products(id, brand, name)')
    .single()
  saving.value = false
  if (err) { formError.value = err.message; return }
  article.value = data
  editMode.value = false
}

// Heeft dit artikel nog nooit op een afgerond certificaat gestaan, dan mag
// het écht weg; staat het er al op, dan voorkomen we dat dat certificaat zou
// "veranderen" en voeren we alleen zacht af (retired).
async function openRetire() {
  const { data } = await supabase
    .from('inspection_items')
    .select('id, inspections!inner(status)')
    .eq('article_id', id.value)
    .eq('inspections.status', 'completed')
    .limit(1)
  everCertified.value = !!(data && data.length)
  showRetire.value = true
}

async function remove() {
  retiring.value = true
  const { error: err } = await supabase.from('articles').delete().eq('id', id.value)
  retiring.value = false
  showRetire.value = false
  if (err) { error.value = err.message; return }
  clearSiblingCache() // dit artikel valt uit de buurlijst van deze klant
  back()
}

async function retire() {
  retiring.value = true
  const { data, error: err } = await supabase
    .from('articles')
    .update({ retired: true, retired_at: new Date().toISOString() })
    .eq('id', id.value)
    .select('*, product:products(id, brand, name)')
    .single()
  retiring.value = false
  showRetire.value = false
  if (err) { error.value = err.message; return }
  clearSiblingCache() // afgevoerd = uit de buurlijst (die filtert op retired)
  article.value = data
}

// Zelfde simpele veldreset als InspectionWizard.reinstateAndAdd (SN-zoeken
// binnen een keuring), maar dan zonder het artikel meteen aan een lopende
// keuring te koppelen -- dit scherm staat daar los van.
async function reinstate() {
  reinstating.value = true
  const { data, error: err } = await supabase
    .from('articles')
    .update({ retired: false, retired_at: null, retired_reason: null })
    .eq('id', id.value)
    .select('*, product:products(id, brand, name)')
    .single()
  reinstating.value = false
  if (err) { error.value = err.message; return }
  clearSiblingCache() // staat weer in de buurlijst
  article.value = data
  await loadSiblings()
}

function back() {
  // Gaat terug naar waar je vandaan kwam (serienummer-/recall-zoeken,
  // setdetail, ...) als die geschiedenis er is -- Vue Router (createWebHistory)
  // zet history.state.back op elke navigatie, null bij de eerste pagina in dit
  // tabblad. Jos liep hier tegen aan: vanuit recall-zoeken belandde je altijd
  // op het klantdetail, niet terug bij de zoekresultaten. Alleen zonder
  // navigatiegeschiedenis (direct geopende link, pagina ververst) valt dit
  // terug op het klantdetail, of anders het hoofdmenu.
  if (window.history.state?.back) {
    router.back()
  } else if (article.value?.customer_id) {
    router.push(`/customers/${article.value.customer_id}`)
  } else {
    router.push('/')
  }
}

onMounted(async () => { await load(); loadSiblings(); loadProducts() })

// LET OP -- hier stond een watcher op route.params.id die de pagina zelf
// herlaadde bij "volgende artikel". Die was nodig toen Vue dit component bij
// een ander :id hergebruikte, maar met de werk-tabbladen mag hij NIET
// terugkomen (2026-07-31):
//   1. Overbodig: de keep-alive-sleutel bevat het volledige pad, dus een ander
//      artikel geeft altijd een verse component die zichzelf via onMounted
//      laadt (inclusief schone bewerk-/koppelstand en scroll naar boven).
//   2. Schadelijk: de route is gedeeld door álle tabbladen. Een watcher draait
//      vóór de DOM-update, dus de wégklikkende pagina laadde nog snel het
//      NIEUWE artikel in en werd daarna in die staat bewaard onder haar oude
//      sleutel -- ga je terug (of stond dit artikel in een ander tabblad), dan
//      keek je naar het verkeerde artikel.
// Doorklikken zelf loopt gewoon via goTo() -> router.push.

// Na ontgrendelen via de statusbalk alsnog uit de cache laden (zie Customers.vue).
watch(useOfflineSession().isUnlocked, (unlocked) => {
  if (unlocked) void load()
})
</script>

<style scoped>
.ad { min-height: var(--page-min-h, 100vh); background: #f0f4f8; display: flex; flex-direction: column; }
.ad__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.ad__nav { display: flex; align-items: center; gap: 0.15rem; }
.ad__title { flex: 1; min-width: 0; text-align: center; }
.ad__header h1 { font-size: 1.2rem; margin: 0; }
.ad__customer { display: block; font-size: 0.8rem; color: #a7c4b0; margin-top: 0.1rem; }
.ad__icon {
  background: none; border: none; color: #fff; font-size: 1.3rem;
  cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem;
}
.ad__state { text-align: center; padding: 3rem 1rem; color: #666; }
.ad__state--error { color: #dc2626; }
.ad__body { padding: 1.25rem; }

.ad__retired-badge {
  display: inline-block; margin-bottom: 0.75rem; background: #fef3c7; color: #92400e;
  border-radius: 6px; padding: 0.15rem 0.6rem; font-size: 0.8rem; font-weight: 600;
}

/* Bekijken */
.ad__list { margin: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ad__view-row {
  display: flex; justify-content: space-between; gap: 1rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.ad__view-row:last-child { border-bottom: none; }
.ad__view-row dt { color: #6b7280; font-size: 0.85rem; }
.ad__view-row dd { margin: 0; font-weight: 600; text-align: right; word-break: break-word; }
/* Koppelblok voor vrije artikelen */
.ad__link {
  margin-top: 1.25rem; background: #fff; border-radius: 12px; padding: 1rem;
  border: 1px solid #e5e7eb;
}
.ad__link-title { font-size: 1rem; margin: 0 0 0.25rem; }
.ad__link-hint { color: #6b7280; font-size: 0.85rem; margin: 0 0 0.75rem; }
/* Originele schrijfwijze als vaste referentie boven het zoekveld */
.ad__link-original {
  display: flex; flex-direction: column; gap: 0.15rem; margin: 0 0 0.75rem;
  background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 0.6rem 0.75rem;
}
.ad__link-original-label { font-size: 0.75rem; color: #6b7280; }
.ad__link-original-value { font-weight: 600; word-break: break-word; }
.ad__link-suggest-label { display: block; font-size: 0.8rem; color: #6b7280; margin: 0 0 0.35rem; }
/* Zoek-dropdown */
.ad__combo { position: relative; }
.ad__combolist {
  position: absolute; z-index: 5; left: 0; right: 0; top: 100%;
  background: #fff; border: 1px solid #d1d5db; border-radius: 0 0 8px 8px;
  max-height: 260px; overflow-y: auto; box-shadow: 0 6px 18px rgba(0,0,0,0.08);
}
.ad__comboitem {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  width: 100%; text-align: left; padding: 0.7rem 0.85rem;
  border: none; border-bottom: 1px solid #f0f0f0; background: none; cursor: pointer; font: inherit;
}
.ad__comboitem:last-child { border-bottom: none; }
.ad__comboitem:hover { background: #ecfdf5; }
.ad__comboitem:disabled { opacity: 0.6; cursor: default; }
.ad__suggest-name { font-weight: 600; }
.ad__suggest-cat { font-size: 0.75rem; color: #6b7280; white-space: nowrap; }
.ad__link-none { color: #6b7280; font-size: 0.85rem; margin: 0.5rem 0 0; }
.ad__link-actions { display: flex; gap: 0.5rem; margin-top: 0.75rem; }
.ad__queue {
  margin-top: 0.75rem; width: 100%; padding: 0.7rem; border-radius: 10px;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  border: 1px dashed #9ca3af; background: #fff; color: #374151;
  font-size: 0.9rem; font-weight: 600; cursor: pointer;
}
.ad__queue-icon { width: 1.1em; height: 1.1em; }
.ad__link-cancel {
  margin-top: 0.5rem; width: 100%; padding: 0.6rem; border-radius: 10px;
  border: none; background: #f3f4f6; color: #374151; font-size: 0.9rem; cursor: pointer;
}

/* Doorklikken door de artikellijst van de klant. */
.ad__notes { background: #fff; border-radius: 12px; padding: 1rem; margin-top: 0.75rem; }
.ad__notes-label { display: block; font-size: 0.8rem; color: #6b7280; margin: 0 0 0.35rem; }
.ad__notes-actions { display: flex; gap: 0.5rem; margin-top: 0.6rem; }
.ad__notes-save {
  flex: 1; padding: 0.7rem 0.5rem; border-radius: 10px; border: none;
  background: #16a34a; color: #fff; font-size: 0.95rem; font-weight: 600; cursor: pointer;
}
.ad__notes-save:disabled { opacity: 0.6; }

.ad__walk { display: flex; align-items: center; gap: 0.5rem; margin-top: 1.25rem; }
.ad__walk-btn {
  flex: 1; padding: 0.7rem 0.5rem; border-radius: 10px; border: 1px solid #d1d5db;
  background: #fff; color: #374151; font-size: 0.95rem; font-weight: 600; cursor: pointer;
}
.ad__walk-btn:disabled { opacity: 0.45; cursor: default; }
.ad__walk-pos { font-size: 0.8rem; color: #6b7280; white-space: nowrap; }
.ad__walk-free {
  margin-top: 0.5rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: none; background: #16a34a; color: #fff;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}

.ad__retire {
  margin-top: 1.5rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: 1px solid #fecaca; background: #fff; color: #dc2626;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}
.ad__reinstate {
  margin-top: 1.5rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: none; background: #16a34a; color: #fff;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}
.ad__reinstate:disabled { opacity: 0.6; }

/* Bewerken */
.ad__field { margin-bottom: 0.85rem; }
.ad__field-label { display: block; font-size: 0.8rem; color: #6b7280; margin-bottom: 0.25rem; }
.ad__input {
  width: 100%; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; font-family: inherit;
}
.ad__input:disabled { background: #f3f4f6; color: #9ca3af; }
.ad__checkbox { width: 1.2rem; height: 1.2rem; }
textarea.ad__input { resize: vertical; }
.ad__error { color: #dc2626; font-size: 0.9rem; margin: 0.5rem 0; }
.ad__actions { display: flex; gap: 0.75rem; margin-top: 1rem; }
.ad__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.ad__btn--cancel { background: #f3f4f6; color: #374151; }
.ad__btn--save { background: #16a34a; color: #fff; }
.ad__btn--danger { background: #dc2626; color: #fff; }
.ad__btn:disabled { opacity: 0.6; }

/* Dialoog */
.ad__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.ad__dialog { background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 360px; }
.ad__dialog h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.ad__dialog p { margin: 0 0 0.5rem; color: #4b5563; }
</style>
