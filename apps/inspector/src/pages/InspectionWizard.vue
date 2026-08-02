<template>
  <div class="iw">
    <AppHeader :title="inspection?.customer?.name" @back="$router.push(`/customers/${inspection?.customer_id}`)">
      <span class="iw__totals">{{ $t('inspections.table.totals', { passed: passedCount, rejected: rejectedCount, open: notAssessedCount }) }}</span>
    </AppHeader>

    <div v-if="loading" class="iw__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="iw__state iw__state--error">{{ error }}</div>

    <template v-else-if="finished">
      <div class="iw__body iw__cert-done">
        <p v-if="awaitingSync" class="iw__cert-pending">⏳ {{ $t('inspections.certificateAwaitingSync') }}</p>
        <!-- Geïmporteerde keuring: er is bewust nooit een certificaat-PDF voor
             gegenereerd (het originele document is de bron). Zonder deze tak
             claimde het scherm ten onrechte "Certificaat gegenereerd en
             gearchiveerd" terwijl er geen certificaat bestaat. -->
        <p v-else-if="isImported" class="iw__cert-imported">📄 {{ $t('inspections.certificateImported') }}</p>
        <p v-else class="iw__cert-ok">✅ {{ $t('inspections.certificateReady') }}</p>
        <a v-if="certificateUrl" :href="certificateUrl" target="_blank" class="iw__btn iw__btn--save iw__cert-link">
          {{ $t('inspections.downloadCertificate') }}
        </a>
        <button class="iw__btn iw__btn--cancel" @click="$router.push(`/customers/${inspection?.customer_id}`)">
          {{ $t('inspections.backToCustomer') }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="iw__body">
        <!-- Zoek én toevoegen in één: deze velden filteren meteen de tabel
             hieronder; staat een artikel er niet bij, vul de overige velden
             aan en klik op Toevoegen. De velden staan bovenaan zodat invoer
             altijd in beeld blijft. -->
        <!-- "Onderdeel toevoegen aan dit artikel": zichtbare bevestiging + rol-
             en vervangt-velden, zodat duidelijk is dat het volgende toegevoegde
             artikel gekoppeld wordt in plaats van los te blijven. -->
        <div v-if="linkTo" class="iw__link-bar">
          <span>{{ $t('sets.addPart.linkedTo', { name: linkTo.label }) }}</span>
          <input v-model="linkRole" class="iw__input iw__input--sm" :placeholder="$t('sets.addPart.rolePlaceholder')" />
          <select v-if="linkCandidates.length" v-model="linkReplaceId" class="iw__select iw__select--sm">
            <option :value="null">{{ $t('sets.addPart.replacesNone') }}</option>
            <option v-for="c in linkCandidates" :key="c.article_id" :value="c.article_id">{{ c.label }}</option>
          </select>
          <button type="button" class="iw__link-cancel" @click="cancelLinkPart">✕</button>
        </div>

        <div class="iw__add">
          <input
            v-model="newDescription"
            class="iw__input"
            :placeholder="$t('inspections.table.article')"
            @focus="activeField = 'article'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <!-- Telefoon/tablet: suggesties direct onder het actieve veld (anders
               vallen ze onderaan, achter het toetsenbord). Op desktop verborgen;
               daar staat de gedeelde lijst onder de hele rij (iw__suggest--main). -->
          <div v-if="activeField === 'article' && fieldSuggestions.length" class="iw__suggest iw__suggest--field">
            <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" class="iw__suggest-item"
              :class="{ 'iw__suggest-item--active': i === suggestIndex }"
              @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
          </div>
          <input
            v-model="newBrand"
            ref="brandRef"
            class="iw__input iw__input--sm"
            :placeholder="$t('inspections.table.brand')"
            @focus="activeField = 'brand'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <div v-if="activeField === 'brand' && fieldSuggestions.length" class="iw__suggest iw__suggest--field">
            <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" class="iw__suggest-item"
              :class="{ 'iw__suggest-item--active': i === suggestIndex }"
              @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
          </div>
          <input
            v-model="newCategory"
            ref="categoryRef"
            class="iw__input iw__input--sm"
            :placeholder="$t('inspections.table.category')"
            @focus="activeField = 'category'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <div v-if="activeField === 'category' && fieldSuggestions.length" class="iw__suggest iw__suggest--field">
            <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" class="iw__suggest-item"
              :class="{ 'iw__suggest-item--active': i === suggestIndex }"
              @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
          </div>
          <input
            v-model="newSerial"
            ref="serialRef"
            class="iw__input iw__input--sm"
            :placeholder="$t('inspections.table.serial')"
            @focus="activeField = 'serial'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <div v-if="activeField === 'serial' && snResults.length" class="iw__suggest iw__suggest--field iw__sn-list">
            <button v-for="r in snResults" :key="r.id" type="button" class="iw__sn-item" @mousedown.prevent="pickSnResult(r)">
              <span class="iw__sn-serial">{{ r.serial || '—' }}</span>
              <span class="iw__sn-meta">{{ snMeta(r) }}</span>
              <span class="iw__sn-badge" :class="r.retired ? 'iw__sn-badge--retired' : (r.inKeuring ? 'iw__sn-badge--in' : 'iw__sn-badge--add')">{{ snBadgeText(r) }}</span>
            </button>
          </div>
          <input v-model="newYear" ref="yearRef" type="number" class="iw__input iw__input--xs iw__input--nospin" :placeholder="$t('inspections.table.year')" />
          <select v-model="newMonth" class="iw__select iw__select--xs">
            <option :value="null">{{ $t('inspections.table.month') }}</option>
            <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
          </select>
          <!-- Gebruiker meteen bij het toevoegen invullen (wens Jos 2026-07-02),
               met suggesties uit eerder gebruikte namen bij deze klant: een
               paar letters typen volstaat. -->
          <input
            v-model="newUser"
            class="iw__input iw__input--sm"
            :placeholder="$t('articles.fields.user')"
            @focus="activeField = 'user'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <div v-if="activeField === 'user' && fieldSuggestions.length" class="iw__suggest iw__suggest--field">
            <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" class="iw__suggest-item"
              :class="{ 'iw__suggest-item--active': i === suggestIndex }"
              @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
          </div>
          <div class="iw__result-buttons">
            <button
              class="iw__result-btn iw__result-btn--pass"
              :class="{ 'iw__result-btn--active': newResult === 'passed' }"
              @click="newResult = newResult === 'passed' ? 'not_assessed' : 'passed'"
            >✅</button>
            <button
              class="iw__result-btn iw__result-btn--fail"
              :class="{ 'iw__result-btn--active': newResult === 'rejected' }"
              @click="newResult = newResult === 'rejected' ? 'not_assessed' : 'rejected'"
            >❌</button>
          </div>
          <select v-if="newResult === 'rejected'" v-model="newRejectionCodeId" class="iw__select iw__select--sm">
            <option :value="null">{{ $t('inspections.noCode') }}</option>
            <option v-for="c in rejectionCodes" :key="c.id" :value="c.id">{{ c.code }} — {{ c.label }}</option>
          </select>
          <input
            v-model="newComment"
            class="iw__input iw__input--sm iw__comment-input"
            :placeholder="$t('inspections.commentPlaceholder')"
          />
          <button class="iw__btn iw__btn--save" :disabled="!canAdd" @click="addRow">{{ $t('inspections.table.add') }}</button>
          <button
            v-if="lastArticle"
            class="iw__btn iw__btn--copy"
            type="button"
            :title="$t('inspections.table.copyLastTooltip')"
            @click="copyLastArticle"
          >{{ $t('inspections.table.copyLast') }}</button>
        </div>

        <!-- Subtiele melding tijdens het invullen (geen rood blok, gewoon een
             klein regeltje): het getypte artikel heeft een bekende recall of
             inspection notice, zodat je dat al ziet vóór je op Toevoegen klikt. -->
        <p v-if="addRowRecallInfo" class="iw__add-recall-hint">
          🚩
          <a :href="addRowRecallInfo.url" target="_blank">
            {{ addRowRecallInfo.kind === 'recall' ? $t('inspections.table.recallHint') : $t('inspections.table.noticeHint') }}
          </a>
        </p>

        <!-- Vrij artikel (geen catalogusmatch): extra velden die het keurbedrijf
             heeft aangezet (Norm/MBS). Het aanbieden voor de catalogus-wachtlijst
             staat bewust niet hier maar per rij in de tabel hieronder (laatste
             kolom, helemaal rechts) — dan kan de keurmeester het artikel eerst
             toevoegen en pas daarna rustig markeren. -->
        <div v-if="willBeFreeArticle && (freeFields.norm || freeFields.mbs)" class="iw__free-extras">
          <input v-if="freeFields.norm" v-model="newNorm" class="iw__input iw__input--sm"
                 :placeholder="$t('inspections.table.norm')" />
          <input v-if="freeFields.mbs" v-model="newMbs" class="iw__input iw__input--sm"
                 :placeholder="$t('inspections.table.mbs')" />
        </div>

        <!-- Eigen, niet-zwevende suggestielijst (i.p.v. native datalist): duwt
             de tabel naar beneden i.p.v. eroverheen te vallen. Artikel/Merk/
             Categorie zoeken in de catalogus; Serienummer heeft hieronder z'n
             eigen dropdown die in álle artikelen van de klant zoekt. -->
        <div v-if="activeField && fieldSuggestions.length" class="iw__suggest iw__suggest--main">
          <button
            v-for="(s, i) in fieldSuggestions"
            :key="s"
            type="button"
            ref="suggestItemRefs"
            class="iw__suggest-item"
            :class="{ 'iw__suggest-item--active': i === suggestIndex }"
            @mousedown.prevent="pickSuggestion(s)"
            @mouseenter="suggestIndex = i"
          >{{ s }}</button>
        </div>
        <!-- SN-zoekresultaten (desktop): bestaande artikelen van de klant. -->
        <div v-if="activeField === 'serial' && snResults.length" class="iw__suggest iw__suggest--main iw__sn-list">
          <button v-for="r in snResults" :key="r.id" type="button" class="iw__sn-item" @mousedown.prevent="pickSnResult(r)">
            <span class="iw__sn-serial">{{ r.serial || '—' }}</span>
            <span class="iw__sn-meta">{{ snMeta(r) }}</span>
            <span class="iw__sn-badge" :class="r.retired ? 'iw__sn-badge--retired' : (r.inKeuring ? 'iw__sn-badge--in' : 'iw__sn-badge--add')">{{ snBadgeText(r) }}</span>
          </button>
        </div>

        <!-- Spiekbriefje: productiedag (uit SN) of weeknummer naar maand. Past
             niets automatisch toe — alleen op klik, om verwarring tussen
             dag-van-jaar en datum te voorkomen. -->
        <div class="iw__cheatsheet">
          <span class="iw__cheatsheet-label" :title="$t('inspections.table.dayHelperTooltip')">{{ $t('inspections.table.dayHelper') }} ⓘ</span>
          <input
            v-model="dayHint"
            type="number"
            min="1"
            max="366"
            class="iw__input iw__input--xs iw__input--nospin"
            :placeholder="$t('inspections.table.dayPlaceholder')"
            :title="$t('inspections.table.dayHelperTooltip')"
          />
          <template v-if="dayHintMonth">
            <span class="iw__cheatsheet-result">→ {{ monthName(dayHintMonth) }}</span>
            <button class="iw__cheatsheet-apply" @click="newMonth = dayHintMonth">{{ $t('inspections.table.useMonth') }}</button>
          </template>
          <span class="iw__cheatsheet-sep">·</span>
          <span class="iw__cheatsheet-label" :title="$t('inspections.table.weekHelperTooltip')">{{ $t('inspections.table.weekHelper') }} ⓘ</span>
          <input
            v-model="weekHint"
            type="number"
            min="1"
            max="53"
            class="iw__input iw__input--xs iw__input--nospin"
            :placeholder="$t('inspections.table.weekPlaceholder')"
            :title="$t('inspections.table.weekHelperTooltip')"
          />
          <span v-if="weekHintMonth" class="iw__cheatsheet-result">→ {{ monthName(weekHintMonth) }}</span>
          <button v-if="weekHintMonth" class="iw__cheatsheet-apply" @click="newMonth = weekHintMonth">{{ $t('inspections.table.useMonth') }}</button>
          <span class="iw__cheatsheet-sep">·</span>
          <!-- SN-referentie per merk als uitklap op deze zelfde regel
               (besluit Jos 2026-07-19; de dag/week-invoer hierboven bestond
               al en blijft zoals hij was). -->
          <button class="iw__cheatsheet-toggle" @click="showSnRef = !showSnRef">
            {{ $t('cheatSheet.tabSnRef') }} {{ showSnRef ? '▴' : '▾' }}
          </button>
        </div>
        <div v-if="showSnRef" class="iw__snref">
          <SnReferencePanel />
        </div>

        <div class="iw__table-wrap">
          <table class="iw__table">
            <thead>
              <tr>
                <th></th>
                <th class="iw__sortable" @click="toggleSort('category')">{{ $t('inspections.table.colCategory') }}</th>
                <th class="iw__sortable" @click="toggleSort('brand')">{{ $t('inspections.table.colBrand') }}</th>
                <th class="iw__sortable" @click="toggleSort('label')">{{ $t('inspections.table.colDescription') }}</th>
                <th class="iw__sortable" @click="toggleSort('serial')">{{ $t('inspections.table.colSerial') }}</th>
                <th class="iw__sortable" @click="toggleSort('year')">{{ $t('inspections.table.colYear') }}</th>
                <th>{{ $t('inspections.table.colFirstUse') }}</th>
                <th>{{ $t('inspections.table.colUser') }}</th>
                <th>{{ $t('inspections.table.colPrevious') }}</th>
                <th>{{ $t('inspections.table.colResult') }}</th>
                <th class="iw__sortable" @click="toggleSort('nextDue')">{{ $t('inspections.table.colNextDue') }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <!-- Eén regel = één component. Dat is een prestatiekeuze, geen
                   opmaakkeuze: zolang de props van een regel gelijk blijven,
                   slaat Vue hem over bij het typen in de toevoegrij. Bij 260
                   artikelen scheelt dat ~57 ms per toetsaanslag (zie
                   InspectionRow.vue).

                   Daarom hieronder uitsluitend primitieven en stabiele
                   verwijzingen als prop, en `@gebeurtenis="functienaam"` zonder
                   argumenten -- een inline `() => ...` of een `:foo="{ ... }"`
                   is per render een nieuwe waarde en haalt het effect meteen
                   onderuit. -->
              <InspectionRow
                v-for="row in groupedSortedRows"
                :key="row.it.id"
                :item="row.it"
                :label="row.label"
                :brand="row.brand"
                :category="row.category"
                :warning-icon="row.warning ? row.warning.icon : null"
                :warning-text="row.warning ? row.warning.text : null"
                :previous-result="row.previous ? row.previous.result : null"
                :previous-date="row.previousDate"
                :highlighted="highlightId === row.it.id"
                :group-head="row.isFirstInGroup ? row.groupName ?? '' : null"
                :in-set="!!articleSetInfo[row.it.article_id]"
                :set-name="articleSetInfo[row.it.article_id] ? articleSetInfo[row.it.article_id].setName : null"
                :notes-open="openNotesId === row.it.id"
                :rejection-codes="rejectionCodes"
                :match-active="matchingRowId === row.it.id"
                :match-search="matchingRowId === row.it.id ? matchSearch : ''"
                :match-suggestions="matchingRowId === row.it.id && activeField === 'rowMatch' ? fieldSuggestions : GEEN_SUGGESTIES"
                :match-index="matchingRowId === row.it.id ? suggestIndex : -1"
                @edit-manual-url="editManualUrl"
                @clear-recall="clearRecallFlag"
                @clear-notice="clearNoticeFlag"
                @toggle-notes="toggleNotes"
                @start-match="startMatch"
                @save-article="saveArticle"
                @save-row="saveRow"
                @set-result="setResult"
                @suggest-catalog="startSuggestCatalog"
                @link-part="startLinkPart"
                @retire="retireArticle"
                @update:match-search="setMatchSearch"
                @match-blur="closeSuggest"
                @match-keydown="onSuggestKeydown"
                @pick-suggestion="pickSuggestion"
                @hover-suggestion="setSuggestIndex"
              />
              <tr v-if="!sortedRows.length">
                <!-- Met actieve zoekvelden is "geen match" iets anders dan "geen
                     artikelen": de lijst is er nog, alleen verborgen door het
                     filter. Zeg dat, en wijs meteen de weg naar + Toevoegen. -->
                <td colspan="12" class="iw__empty">{{ hasFilter ? $t('inspections.table.noMatchesFiltered') : $t('inspections.table.noMatches') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="addError" class="iw__error">{{ addError }}</p>

        <p v-if="rowSaveError" class="iw__error">{{ rowSaveError }}</p>

        <p v-if="completeError" class="iw__error">{{ completeError }}</p>
        <button class="iw__next" :disabled="completing" @click="finish">
          {{ completing ? $t('common.saving') : $t('inspections.table.finish') }}
        </button>
      </div>
    </template>

    <CatalogSuggestDialog
      v-if="suggestFor"
      :article-id="suggestFor.id"
      :label="suggestLabel"
      @saved="onSuggestSaved"
      @close="suggestFor = null"
    />
  </div>
</template>

<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import SnReferencePanel from '../components/SnReferencePanel.vue'
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  supabase,
  errorMessage,
  useOnline,
  useOfflineSession,
  getInspection,
  getCustomer,
  getCompanySettings,
  getInspectionItems,
  getArticlesForCustomer,
  getArticle,
  getProducts,
  patchInspectionItem,
  putArticles,
  putInspectionItems,
  enqueueMutation,
  touchDownloadActivity,
  markInspectionPendingCompletion,
  getRegime,
  isUnlimitedAge,
  type ProductType,
  type CountryCode,
} from '@gearonimo/core'
import { useFieldSuggest, fuzzyFilter } from '@gearonimo/ui'
import { fetchRejectionCodes, findPreviousResult, findPreviousResults, fetchFreeInputFields } from '../composables/useInspections'
import { generateCertificate } from '../composables/useCertificate'
import { useOffline } from '../composables/useOffline'
import CatalogSuggestDialog from '../components/CatalogSuggestDialog.vue'
import InspectionRow from '../components/InspectionRow.vue'
import {
  itemBrand,
  itemName,
  itemCategory,
  itemRecallUrl,
  itemNoticeUrl,
  monthName,
  type Product,
  type Article,
  type Item,
} from '../composables/inspectionItem'
import '../styles/inspection-table.css'

/**
 * Stabiele lege lijst voor de suggestie-prop van niet-actieve regels.
 *
 * Een verse `[]` per render zou voor Vue een gewijzigde prop zijn, waardoor
 * élke regel opnieuw getekend wordt en het hele nut van InspectionRow als
 * eigen component vervalt. Eén gedeelde constante blijft identiek.
 */
const GEEN_SUGGESTIES: string[] = []

const route = useRoute()
const { t } = useI18n()
const id = route.params.id as string
const { isOnline } = useOnline()

// Product/Article/Item + de pure afleidingen staan in
// ../composables/inspectionItem.ts, gedeeld met InspectionRow.vue.
interface InspectionRecord {
  id: string
  customer_id: string
  company_id: string
  // 'import' = uit een oud certificaat geïmporteerd (geen eigen certificaat-PDF).
  source: string | null
  customer: { name: string } | null
  company: {
    country_code: string | null
    default_interval_ppe_months: number | null
    default_interval_rigging_months: number | null
  } | null
}
const inspection = ref<InspectionRecord | null>(null)
const items = ref<Item[]>([])
const loading = ref(true)
const error = ref('')

// Aanmelden voor de catalogus via het gedeelde formulier-dialoog. De dialoog
// schrijft zelf weg; hier alleen de lokale rij-status bijwerken zodat het
// 📚-icoon meteen klopt.
const suggestFor = ref<Article | null>(null)
const suggestLabel = computed(() => {
  const a = suggestFor.value
  if (!a) return ''
  return [a.free_brand, a.free_description].filter(Boolean).join(' ') || t('articles.untitled')
})
function onSuggestSaved(suggested: boolean) {
  if (suggestFor.value) suggestFor.value.suggest_for_catalog = suggested
}

// "Onderdeel toevoegen aan dit artikel" (besloten met Jos 2026-07-11): een
// hoofdartikel (bv. een klimgordel) krijgt vaak een vervangen onderdeel met
// een eigen SN (bv. een nieuwe brug). In plaats van dat onderdeel los toe te
// voegen en daarna apart op te zoeken om te groeperen, start je de link hier
// vanuit de rij zelf: het bestaande "nieuw artikel"-formulier bovenaan krijgt
// een rol-veld + duidelijke "gekoppeld aan"-indicator, en addRow() koppelt na
// het aanmaken in één moeite door via get_or_create_article_set. Bewust
// online-only (net als andere set-acties).
interface LinkTarget { id: string; label: string }
const linkTo = ref<LinkTarget | null>(null)
const linkRole = ref('')
const linkReplaceId = ref<string | null>(null)
const linkCandidates = ref<{ article_id: string; label: string }[]>([])

async function startLinkPart(it: Item) {
  if (!isOnline.value) {
    addError.value = t('offline.onlineOnlyAction')
    return
  }
  linkTo.value = { id: it.article_id, label: itemLabel(it) }
  linkRole.value = ''
  linkReplaceId.value = null
  linkCandidates.value = []

  const { data: memberRow } = await supabase
    .from('article_set_members')
    .select('set_id, article_sets!inner(customer_id)')
    .eq('article_id', it.article_id)
    .eq('article_sets.customer_id', inspection.value!.customer_id)
    .maybeSingle()
  if (!memberRow) return

  const { data: members } = await supabase
    .from('article_set_members')
    .select('article_id, article:articles(serial_number, free_brand, free_description, retired, product:products(brand, name))')
    .eq('set_id', (memberRow as { set_id: string }).set_id)
    .neq('article_id', it.article_id)
  type RawMember = { article_id: string; article: { serial_number: string | null; free_brand: string | null; free_description: string | null; retired: boolean; product: { brand: string | null; name: string | null } | null } }
  linkCandidates.value = ((members ?? []) as unknown as RawMember[])
    .filter((m) => !m.article.retired)
    .map((m) => {
      const a = m.article
      const s = a.product ? [a.product.brand, a.product.name].filter(Boolean).join(' ') : [a.free_brand, a.free_description].filter(Boolean).join(' ')
      const sn = a.serial_number ? ` (SN ${a.serial_number})` : ''
      return { article_id: m.article_id, label: (s || '?') + sn }
    })
}
function cancelLinkPart() {
  linkTo.value = null
  linkRole.value = ''
  linkReplaceId.value = null
  linkCandidates.value = []
}

const previousResults = ref<Record<string, { result: string; comment: string | null; inspection_date: string } | null>>({})
const rejectionCodes = ref<{ id: string; code: number; label: string | null }[]>([])

const completing = ref(false)
const completeError = ref('')
const finished = ref(false)
const certificateUrl = ref('')
// Offline afgerond, certificaat volgt pas na synchronisatie (zie finish()).
const awaitingSync = ref(false)
// Geïmporteerde keuring (uit een oud certificaat): heeft géén eigen
// certificaat-PDF, dus het afrondscherm mag niet claimen dat er een certificaat
// is aangemaakt.
const isImported = computed(() => inspection.value?.source === 'import')
const addError = ref('')
// Fout bij het opslaan van een keurresultaat (saveRow, online). Los van
// addError: wordt leeggemaakt zodra een volgende save slaagt.
const rowSaveError = ref('')

const sortKey = ref<'category' | 'brand' | 'label' | 'serial' | 'year' | 'nextDue'>('label')
const sortDir = ref<1 | -1>(1)

// Setleden bij elkaar in de tabel i.p.v. los verspreid (besloten met Jos
// 2026-07-11: "als ik de Nomad vasthou wil ik de Fidus er meteen naast zien
// staan, ga goedkeuren wil ik hier snel doorheen kunnen klikken"). article_id
// -> zijn (eerste) set; voedt de groepering in sortedRows hieronder.
const articleSetInfo = ref<Record<string, { setId: string; setName: string; role: string | null }>>({})
async function loadArticleSetInfo(customerId: string) {
  const { data } = await supabase
    .from('article_set_members')
    .select('article_id, set_id, role, article_sets!inner(name, customer_id)')
    .eq('article_sets.customer_id', customerId)
  type Row = { article_id: string; set_id: string; role: string | null; article_sets: { name: string } }
  const map: Record<string, { setId: string; setName: string; role: string | null }> = {}
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!map[row.article_id]) map[row.article_id] = { setId: row.set_id, setName: row.article_sets.name, role: row.role }
  }
  articleSetInfo.value = map
}

// Hele catalogus één keer geladen; voedt de datalists (zoeken + vrije invoer)
// en laat ons een getypt artikel terugkoppelen aan een productrij (product_id),
// zodat levensduur/recall/interval-data meekomen.
const products = ref<Product[]>([])
const allArticleNames = computed(() => unique(products.value.map(p => p.name)))

// Suggestiebron voor Artikel/Merk/Categorie: de globale catalogus én de al
// bekende artikelen van deze klant. Dat laatste is belangrijk zolang de
// catalogus nog groeit (BLAUWDRUK §3): vaak staat een merk/categorie/
// omschrijving alleen bij de (bv. zojuist geïmporteerde) artikelen van de
// klant en nog niet in de catalogus. Zonder die bron blijven de dropdowns leeg.
interface CatalogEntry { brand: string | null; name: string | null; category: string | null }
const customerEntries = ref<CatalogEntry[]>([])
const catalogEntries = computed<CatalogEntry[]>(() => [
  ...products.value.map(p => ({ brand: p.brand, name: p.name, category: p.category })),
  ...customerEntries.value,
])

// Alle artikelen van de klant — de bron voor de SN-zoekdropdown. Bevat ook
// artikelen die (nog) niet in deze keuring zitten, zodat we ze kunnen
// terugvinden en toevoegen i.p.v. een duplicaat aan te maken. Afgevoerde
// artikelen doen bewust mee (verzoek Jos 2026-07-02): wie een SN intypt van
// een verloren/gestolen/vervangen artikel moet "Afgevoerd (reden)" zien —
// plus het laatste keuringsresultaat — i.p.v. een spoorloos artikel.
interface CustArticle {
  id: string
  serial: string
  brand: string
  name: string
  category: string
  user: string
  retired: boolean
  retiredReason: string | null
  last: { result: string; date: string } | null
}

// Suggestiebron voor het Gebruiker-veld: alle eerder ingevulde gebruikers bij
// deze klant ("onthoud de vorige"), plus wat er in deze keuring al staat.
const knownUsers = computed(() => unique([
  ...customerArticles.value.map((a) => a.user || null),
  ...items.value.map((i) => i.article.assigned_user_name),
]))
const customerArticles = ref<CustArticle[]>([])

// Artikel, Merk en Categorie filteren elkaar wederzijds: wat al is ingevuld
// bepaalt wat er in de andere twee dropdowns nog overblijft. Kies je "FALL
// SAFE" als merk, dan toont Categorie alleen nog categorieën die FALL SAFE
// voert en Artikel alleen FALL SAFE-artikelen. Het veld dat je zelf invult
// filtert niet op zichzelf (anders verdween je eigen keuze); op de andere
// velden matchen we op deeltekst, zodat de lijst al meekrimpt terwijl je typt.
function catalogMatches(self: 'brand' | 'category' | 'name'): CatalogEntry[] {
  const b = newBrand.value.trim().toLowerCase()
  const c = newCategory.value.trim().toLowerCase()
  const n = newDescription.value.trim().toLowerCase()
  return catalogEntries.value.filter(e =>
    (self === 'brand'    || !b || (e.brand ?? '').toLowerCase().includes(b)) &&
    (self === 'category' || !c || (e.category ?? '').toLowerCase().includes(c)) &&
    (self === 'name'     || !n || (e.name ?? '').toLowerCase().includes(n))
  )
}
const matchingBrands = computed(() => unique(catalogMatches('brand').map(e => e.brand)))
const matchingCategories = computed(() => unique(catalogMatches('category').map(e => e.category)))
const matchingArticleNames = computed(() => unique(catalogMatches('name').map(e => e.name)))

function unique(arr: (string | null)[]): string[] {
  return Array.from(new Set(arr.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
}

// Eigen suggestielijst (Optie A): in plaats van de native <datalist> die over
// de tabel heen viel, tonen we een inline lijst onder de toevoegrij. Artikel/
// Merk/Categorie zoeken in de catalogus; Serienummer heeft een eigen, rijkere
// dropdown (snResults) die in álle artikelen van de klant zoekt.
type WizardField = 'article' | 'brand' | 'category' | 'serial' | 'user' | 'rowMatch'

// Tolerante matching uit @gearonimo/ui: vindt ook "OK TriactLock" bij "ok tl"
// (acroniem van woord-initialen), niet alleen bij een aaneengesloten "ok t".
function suggestFilter(list: string[], typed: string): string[] {
  return fuzzyFilter(list, typed, 30)
}

function setFieldValue(field: string | null, val: string) {
  switch (field) {
    case 'article': newDescription.value = val; break
    case 'brand': newBrand.value = val; break
    case 'category': newCategory.value = val; break
    case 'serial': newSerial.value = val; break
    case 'user': newUser.value = val; break
  }
}

// "Match aan bestaand artikel": een vrij (import-)artikel alsnog koppelen aan
// een catalogusproduct, zonder dat het automatisch gokt. De keurmeester klikt
// op de naam, krijgt dezelfde zoeklijst als bij het toevoegen van een nieuw
// artikel, en kiest er zelf één uit — pas dan vullen merk/categorie/etc. zich.
const matchingRowId = ref<string | null>(null)
const matchSearch = ref('')

// InspectionRow houdt zelf geen staat bij: het meldt wat de keurmeester deed en
// de wizard verwerkt het. Bewust benoemde functies (geen inline `() => ...` in
// de template), want alleen zo blijft de gebeurtenis-binding per render
// dezelfde waarde en slaat Vue ongewijzigde regels over.
function setMatchSearch(value: string) {
  matchSearch.value = value
}
function setSuggestIndex(index: number) {
  suggestIndex.value = index
}
function startSuggestCatalog(article: Article) {
  suggestFor.value = article
}

function startMatch(it: Item) {
  matchingRowId.value = it.id
  // Behoud de oude schrijfwijze als startwaarde: zo verdwijnt de tekst niet
  // (de keurmeester ziet nog wat er stond én kan met backspace bijschaven), en
  // de suggestielijst toont meteen de "bedoelt u …?"-treffers voor die tekst.
  matchSearch.value = itemName(it)
  activeField.value = 'rowMatch'
}

async function applyRowMatch(it: Item, name: string) {
  const p = products.value.find((p) => (p.name ?? '').toLowerCase() === name.trim().toLowerCase())
  matchingRowId.value = null
  activeField.value = null
  if (!p) return
  if (!isOnline.value) {
    addError.value = t('offline.onlineOnlyAction')
    return
  }
  const { error: err } = await supabase
    .from('articles')
    .update({
      product_id: p.id,
      free_brand: null,
      free_category: null,
      free_description: null,
      free_norm: null,
      free_mbs: null,
    })
    .eq('id', it.article.id)
  if (err) { addError.value = err.message; return }
  it.article.product = p
  it.article.free_brand = null
  it.article.free_category = null
  it.article.free_description = null
}

// Verplaats de focus naar het volgende invoerveld (artikel → merk → categorie
// → serienummer → bouwjaar). Gebruikt door Enter; Tab doet dit van nature.
const brandRef = ref<HTMLInputElement | null>(null)
const categoryRef = ref<HTMLInputElement | null>(null)
const serialRef = ref<HTMLInputElement | null>(null)
const yearRef = ref<HTMLInputElement | null>(null)
function focusNextField(cur: string | null) {
  const order = ['article', 'brand', 'category', 'serial']
  const nextRefs = [brandRef, categoryRef, serialRef, yearRef]
  const i = order.indexOf(cur || '')
  if (i < 0) return
  const el = nextRefs[i].value
  nextTick(() => el?.focus())
}

// Gedeelde typeahead-besturing (zie @gearonimo/ui). De velddefinities en de
// rowMatch-/setFieldValue-logica blijven hier; de besturing (actief veld,
// suggestielijst, toetsenbordnavigatie) komt uit de composable. De template
// gebruikt de vertrouwde namen via aliassen.
const {
  activeField,
  suggestIndex,
  suggestions: fieldSuggestions,
  itemRefs: suggestItemRefs,
  pick: pickSuggestion,
  close: rawCloseSuggest,
  onKeydown: onSuggestKeydown,
} = useFieldSuggest<WizardField>({
  scrollToActive: true,
  resolve: (field) => {
    switch (field) {
      case 'article': return suggestFilter(matchingArticleNames.value, newDescription.value)
      case 'brand': return suggestFilter(matchingBrands.value, newBrand.value)
      case 'category': return suggestFilter(matchingCategories.value, newCategory.value)
      case 'serial': return [] // Serienummer heeft een eigen dropdown (snResults)
      case 'user': return suggestFilter(knownUsers.value, newUser.value)
      case 'rowMatch': return suggestFilter(allArticleNames.value, matchSearch.value)
      default: return []
    }
  },
  select: (field, value) => {
    if (field === 'rowMatch' && matchingRowId.value) {
      const it = items.value.find((i) => i.id === matchingRowId.value)
      if (it) applyRowMatch(it, value)
      return
    }
    setFieldValue(field, value)
  },
  onEnter: (field) => focusNextField(field),
})

// Bij blur ook een lopende rij-match sluiten (extra t.o.v. de generieke close).
function closeSuggest() {
  rawCloseSuggest()
  window.setTimeout(() => { matchingRowId.value = null }, 120)
}

// Toevoegrij
const newBrand = ref('')
const newCategory = ref('')
const newDescription = ref('')
const newSerial = ref('')
const newYear = ref<number | null>(null)
const newMonth = ref<number | null>(null)
const newUser = ref('')
const newResult = ref<'not_assessed' | 'passed' | 'rejected'>('not_assessed')
const newRejectionCodeId = ref<string | null>(null)
const newNorm = ref('')
const newMbs = ref('')
const newComment = ref('')
// Welke extra velden het keurbedrijf bij vrije invoer wil (uit cert-kolommen).
const freeFields = ref<{ norm: boolean; mbs: boolean }>({ norm: false, mbs: false })
const canAdd = computed(() => !!newDescription.value.trim() || !!newCategory.value.trim())
// Het getypte artikel wordt een vrij artikel (geen catalogusmatch) → dan kan
// het naar de catalogus-wachtlijst voor de curator.
const willBeFreeArticle = computed(() => !!newDescription.value.trim() && !matchProduct())
// Subtiele melding tijdens het invullen zelf, niet pas nadat het artikel al
// aan de tabel is toegevoegd (feedback Jos 2026-07-11): zodra het getypte
// artikel een catalogusproduct met een recall of inspection notice matcht.
const addRowRecallInfo = computed<{ url: string; kind: 'recall' | 'notice' } | null>(() => {
  const p = matchProduct()
  if (!p) return null
  if (p.recall_url) return { url: p.recall_url, kind: 'recall' }
  if (p.inspection_notice_url) return { url: p.inspection_notice_url, kind: 'notice' }
  return null
})

// Onthoudt het laatst toegevoegde artikel zodat een serie identieke
// exemplaren (bv. 10 karabiners) snel achter elkaar in te voeren is: alles
// kopiëren behalve het serienummer.
const lastArticle = ref<{ description: string; brand: string; category: string; year: number | null; month: number | null; user: string } | null>(null)
function copyLastArticle() {
  if (!lastArticle.value) return
  newDescription.value = lastArticle.value.description
  newBrand.value = lastArticle.value.brand
  newCategory.value = lastArticle.value.category
  newYear.value = lastArticle.value.year
  newMonth.value = lastArticle.value.month
  newUser.value = lastArticle.value.user
  newSerial.value = ''
}

// Spiekbriefje: dag-van-jaar (Juliaanse dag, vaak 3 cijfers in het SN
// verwerkt) of weeknummer naar maand. Levert alleen een suggestie — de
// keurmeester past 'm zelf toe op Maand, zodat "3" nooit stilzwijgend als
// "3 juni" wordt opgeslagen.
const dayHint = ref<number | null>(null)
const showSnRef = ref(false)
const weekHint = ref<number | null>(null)
const dayHintMonth = computed<number | null>(() => {
  const d = dayHint.value
  if (!d || d < 1 || d > 366) return null
  const y = newYear.value || new Date().getFullYear()
  return new Date(y, 0, d).getMonth() + 1
})
// Een week kan over twee maanden lopen; we pakken bewust altijd de laagste
// (vroegste) maand. Dat scheelt iemand hooguit een paar dagen levensduur,
// in plaats van een artikel per ongeluk weken te lang "goedgekeurd" te laten.
const weekHintMonth = computed<number | null>(() => {
  const w = weekHint.value
  if (!w || w < 1 || w > 53) return null
  const y = newYear.value || new Date().getFullYear()
  const start = new Date(y, 0, 1 + (w - 1) * 7)
  return start.getMonth() + 1
})

// ── Zoeken op serienummer ─────────────────────────────────────────────────
// De keurmeester zoekt meestal eerst een bestaand artikel op SN. We matchen op
// deeltekst (de cijfers mogen overal in het SN zitten — zo werkt zowel "van
// vooraan" als "de laatste 3 cijfers"), en sorteren exact → eindigt-op → bevat.
// Doorzoekt álle artikelen van de klant, zodat een artikel dat nog niet in de
// keuring zit teruggevonden en toegevoegd kan worden i.p.v. gedupliceerd.
interface SnResult {
  id: string
  serial: string
  name: string
  brand: string
  inKeuring: boolean
  retired: boolean
  retiredReason: string | null
  last: { result: string; date: string } | null
  rank: number
}
const snResults = computed<SnResult[]>(() => {
  const q = newSerial.value.trim().toLowerCase()
  if (!q) return []
  const inSet = new Set(items.value.map((i) => i.article.id))
  return customerArticles.value
    .filter((a) => a.serial && a.serial.toLowerCase().includes(q))
    .map((a) => {
      const sn = a.serial.toLowerCase()
      return {
        id: a.id, serial: a.serial, name: a.name, brand: a.brand,
        inKeuring: inSet.has(a.id),
        retired: a.retired,
        retiredReason: a.retiredReason,
        last: a.last,
        // Afgevoerde artikelen achteraan (rank +10): wel vindbaar, niet in de weg.
        rank: (sn === q ? 0 : sn.endsWith(q) ? 1 : 2) + (a.retired ? 10 : 0),
      }
    })
    .sort((x, y) => x.rank - y.rank || x.serial.localeCompare(y.serial))
    .slice(0, 30)
})

// Metaregel in de SN-dropdown: artikel/merk + laatste keuringsresultaat, zodat
// "vorig jaar afgekeurd" direct zichtbaar is bij het intypen van een SN.
function snMeta(r: SnResult): string {
  const parts = [r.name, r.brand].filter(Boolean)
  if (r.last) {
    parts.push(
      r.last.result === 'rejected'
        ? '❌ ' + t('inspections.table.snLastRejected', { date: formatDate(r.last.date) })
        : '✅ ' + t('inspections.table.snLastPassed', { date: formatDate(r.last.date) })
    )
  }
  return parts.join(' · ')
}

function snBadgeText(r: SnResult): string {
  if (r.retired) return t('inspections.table.snRetired') + (r.retiredReason ? ` (${r.retiredReason})` : '')
  return r.inKeuring ? t('inspections.table.snInInspection') : t('inspections.table.snAdd')
}

// Korte oplichting van de rij waar we naartoe springen, zodat duidelijk is welk
// artikel bedoeld wordt nadat het zoekveld is leeggemaakt.
const highlightId = ref<string | null>(null)
function revealItem(itemId: string) {
  highlightId.value = itemId
  nextTick(() => {
    document.getElementById('iw-row-' + itemId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => { if (highlightId.value === itemId) highlightId.value = null }, 2000)
  })
}

// Een al bestaand klant-artikel dat nog niet in deze keuring zit toevoegen als
// nog onbeoordeeld item — geen nieuw/duplicaat artikel.
async function addCustomerArticle(articleId: string) {
  addError.value = ''
  if (!isOnline.value) {
    await addCustomerArticleOffline(articleId)
    return
  }
  const { data: article, error: artErr } = await supabase
    .from('articles').select('*, product:products(*)').eq('id', articleId).single()
  if (artErr || !article) { addError.value = artErr?.message ?? ''; return }
  const { data: item, error: itemErr } = await supabase
    .from('inspection_items')
    .insert({ inspection_id: id, article_id: articleId, article_snapshot: article, result: 'not_assessed' })
    .select('id, article_id, result, next_due, rejection_code_id, comment')
    .single()
  if (itemErr || !item) { addError.value = itemErr?.message ?? ''; return }
  const newItem = { ...item, article } as Item
  items.value.push(newItem)
  previousResults.value[articleId] = await findPreviousResult(articleId, id)
  revealItem(newItem.id)
}

async function addCustomerArticleOffline(articleId: string) {
  try {
    const key = useOfflineSession().getKey()
    const customerId = inspection.value!.customer_id
    const articleRow = await getArticle<Record<string, unknown> & { id: string; product_id: string | null }>(
      key,
      articleId
    )
    if (!articleRow) {
      addError.value = t('offline.notCachedInspection')
      return
    }
    const product = articleRow.product_id
      ? (await getProducts<Product>(key, [articleRow.product_id]))[0] ?? null
      : null
    const article = { ...articleRow, product } as unknown as Article

    const itemId = crypto.randomUUID()
    const itemRow = {
      id: itemId,
      inspection_id: id,
      article_id: articleId,
      article_snapshot: articleRow,
      result: 'not_assessed',
      next_due: null,
      rejection_code_id: null,
      comment: null,
    }
    await putInspectionItems(key, id, [itemRow])
    await enqueueMutation({ customerId, table: 'inspection_items', op: 'insert', payload: itemRow })

    const newItem: Item = {
      id: itemId,
      article_id: articleId,
      result: itemRow.result,
      next_due: itemRow.next_due,
      rejection_code_id: itemRow.rejection_code_id,
      comment: itemRow.comment,
      article,
    }
    items.value.push(newItem)
    previousResults.value[articleId] = await findPreviousResult(articleId, id)
    await touchDownloadActivity(customerId)
    revealItem(newItem.id)
  } catch (e) {
    addError.value = errorMessage(e)
  }
}

// Klik op een SN-zoekresultaat: zit het al in de keuring → erheen springen;
// staat het er nog niet in → toevoegen. Afgevoerd artikel → eerst vragen of
// het weer in gebruik genomen moet worden (klant vond het terug / afvoer was
// een vergissing); zo ja: retired-vlag eraf en toevoegen. Daarna de
// zoekvelden leegmaken.
function pickSnResult(r: SnResult) {
  activeField.value = null
  if (r.retired) {
    void reinstateAndAdd(r)
    return
  }
  const existing = r.inKeuring ? items.value.find((i) => i.article.id === r.id) : null
  resetAddRow()
  if (existing) revealItem(existing.id)
  else if (!r.inKeuring) void addCustomerArticle(r.id)
}

async function reinstateAndAdd(r: SnResult) {
  addError.value = ''
  if (!isOnline.value) {
    addError.value = t('offline.onlineOnlyAction')
    return
  }
  const info = r.retiredReason ? ` (${r.retiredReason})` : ''
  if (!confirm(t('inspections.table.snReinstateConfirm', { name: [r.name, r.brand].filter(Boolean).join(' '), info }))) return
  const { error: err } = await supabase
    .from('articles')
    .update({ retired: false, retired_at: null, retired_reason: null })
    .eq('id', r.id)
  if (err) { addError.value = err.message; return }
  const art = customerArticles.value.find((a) => a.id === r.id)
  if (art) { art.retired = false; art.retiredReason = null }
  resetAddRow()
  await addCustomerArticle(r.id)
}

// Zodra een artikel uit de catalogus gekozen wordt (naam matcht exact een
// product), meteen merk en categorie invullen. Vrije tekst laat de velden met
// rust.
watch(newDescription, (name) => {
  const n = name.trim().toLowerCase()
  if (!n) return
  const p = products.value.find(p => (p.name ?? '').toLowerCase() === n)
  if (p) {
    if (p.brand) newBrand.value = p.brand
    if (p.category) newCategory.value = p.category
  }
})

function itemLabel(it: Item) { return itemName(it) || t('articles.untitled') }
async function clearRecallFlag(it: Item) {
  if (!isOnline.value) { addError.value = t('offline.onlineOnlyAction'); return }
  const url = itemRecallUrl(it)
  if (!url) return
  const note = window.prompt(t('inspections.table.clearFlagPrompt'), '')
  if (!note?.trim()) return
  const patch = { recall_cleared_url: url, recall_cleared_note: note.trim() }
  const { error: err } = await supabase.from('articles').update(patch).eq('id', it.article.id)
  if (!err) Object.assign(it.article, patch)
}
/** Welke rij zijn opmerking uitgeklapt heeft. Er staat er hooguit één open. */
const openNotesId = ref<string | null>(null);
function toggleNotes(it: Item) {
  openNotesId.value = openNotesId.value === it.id ? null : it.id;
}

async function clearNoticeFlag(it: Item) {
  if (!isOnline.value) { addError.value = t('offline.onlineOnlyAction'); return }
  const url = itemNoticeUrl(it)
  if (!url) return
  const note = window.prompt(t('inspections.table.clearFlagPrompt'), '')
  if (!note?.trim()) return
  const patch = { notice_cleared_url: url, notice_cleared_note: note.trim() }
  const { error: err } = await supabase.from('articles').update(patch).eq('id', it.article.id)
  if (!err) Object.assign(it.article, patch)
}

async function editManualUrl(it: Item) {
  if (it.article.product) return
  if (!isOnline.value) {
    addError.value = t('offline.onlineOnlyAction')
    return
  }
  const url = window.prompt(t('inspections.table.manualUrlPrompt'), it.article.free_manual_url ?? '')
  if (url === null) return
  const value = url.trim() || null
  const { error: err } = await supabase.from('articles').update({ free_manual_url: value }).eq('id', it.article.id)
  if (!err) it.article.free_manual_url = value
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
}

const passedCount = computed(() => items.value.filter(i => i.result === 'passed').length)
const rejectedCount = computed(() => items.value.filter(i => i.result === 'rejected').length)
const notAssessedCount = computed(() => items.value.filter(i => i.result === 'not_assessed').length)

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

// Standaard keuringsinterval: artikel-override > product-override >
// bedrijfsinstelling per producttype (PPE/rigging) > wettelijk regime van
// het land van het keurbedrijf (VK-regime geactiveerd 2026-07-19, fase 5:
// GB = 6 mnd voor PBM/hijsmateriaal per LOLER/PUWER; NL = 12 mnd;
// onbekend land/type valt in getRegime terug op 12). Bewust NIET gekapt op
// de levensduur — de keurmeester bepaalt zelf de datum; de levensduur-
// waarschuwing (zie rowWarning) is alleen advies.
function defaultIntervalMonths(it: Item): number {
  const a = it.article
  if (a.interval_override_months != null) return a.interval_override_months
  if (a.product?.interval_override_months != null) return a.product.interval_override_months
  const type = a.product?.product_type
  const company = inspection.value?.company
  if (type === 'rigging' && company?.default_interval_rigging_months != null) {
    return company.default_interval_rigging_months
  }
  if (type !== 'rigging' && company?.default_interval_ppe_months != null) {
    return company.default_interval_ppe_months
  }
  return getRegime(
    (type as ProductType | undefined) ?? 'ppe',
    (company?.country_code as CountryCode | null) ?? 'NL'
  )
}

function suggestedNextDue(it: Item): Date {
  return addMonths(new Date(), defaultIntervalMonths(it))
}

function endOfLife(it: Item): Date | null {
  const a = it.article
  let eol: Date | null = null
  // 999 (isUnlimitedAge) = onbeperkte levensduur: bewust ingevuld, maar géén
  // afkeurdatum — anders zou er een leeftijdswaarschuwing voor het jaar 3025
  // uitrollen.
  if (a.manufacture_year != null && a.product?.max_age_mfr_years != null && !isUnlimitedAge(a.product.max_age_mfr_years)) {
    eol = new Date(a.manufacture_year + a.product.max_age_mfr_years, (a.manufacture_month ?? 1) - 1, 1)
  }
  if (a.first_use_date && a.product?.max_age_use_years != null && !isUnlimitedAge(a.product.max_age_use_years)) {
    const eolUse = addMonths(new Date(a.first_use_date), a.product.max_age_use_years * 12)
    if (!eol || eolUse < eol) eol = eolUse
  }
  return eol
}

// Levensduur-waarschuwing voor de keurmeester (advies, geen blokkade — de
// keurmeester bepaalt goed/afgekeurd). Verschijnt bewust niet op het
// certificaat (useCertificate.ts gebruikt deze data niet).
function rowWarning(it: Item): { icon: string; text: string } | null {
  const eol = endOfLife(it)
  if (!eol) return null
  const now = Date.now()
  if (eol.getTime() <= now) return { icon: '⛔', text: t('inspections.table.ageWarningOverdue') }
  if (eol.getTime() <= suggestedNextDue(it).getTime()) {
    const months = Math.max(1, Math.round((eol.getTime() - now) / (1000 * 60 * 60 * 24 * 30)))
    return { icon: '⚠', text: t('inspections.table.ageWarningSoon', { months }) }
  }
  return null
}

function toIsoDate(d: Date) {
  // Lokale datum, niet toISOString() (code review 2026-07-18): die rekent om
  // naar UTC, waardoor een voorgestelde next_due tussen middernacht en de
  // NL-tijdzoneverschuiving één dag te vroeg op het certificaat kon komen.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

interface Row {
  it: Item
  label: string
  brand: string
  category: string
  year: string
  previous: { result: string; comment: string | null; inspection_date: string } | null
  // Al opgemaakt, zodat InspectionRow er geen eigen formatDate voor nodig heeft.
  previousDate: string | null
  warning: { icon: string; text: string } | null
  score: number
}

// De toevoegvelden filteren meteen de tabel: elk ingevuld veld moet matchen
// (AND), zo niet dan blijft de getypte tekst gewoon staan om als nieuw
// (vrij) artikel te kunnen toevoegen.
const hasFilter = computed(() =>
  !!(newDescription.value.trim() || newBrand.value.trim() || newCategory.value.trim() || newSerial.value.trim())
)

function matchesFilters(it: Item): boolean {
  const d = newDescription.value.trim().toLowerCase()
  const b = newBrand.value.trim().toLowerCase()
  const c = newCategory.value.trim().toLowerCase()
  const s = newSerial.value.trim().toLowerCase()
  if (d && !itemName(it).toLowerCase().includes(d)) return false
  if (b && !itemBrand(it).toLowerCase().includes(b)) return false
  if (c && !itemCategory(it).toLowerCase().includes(c)) return false
  if (s && !(it.article.serial_number || '').toLowerCase().includes(s)) return false
  return true
}

function matchScore(it: Item): number {
  const s = newSerial.value.trim().toLowerCase()
  if (s) {
    const sn = (it.article.serial_number || '').toLowerCase()
    if (sn === s) return 0
    if (sn.endsWith(s)) return 1
    return 2
  }
  const d = newDescription.value.trim().toLowerCase()
  if (d && itemName(it).toLowerCase().startsWith(d)) return 1
  return 3
}

const rows = computed<Row[]>(() => {
  const result: Row[] = []
  for (const it of items.value) {
    if (it.article.retired) continue
    if (hasFilter.value && !matchesFilters(it)) continue
    const y = it.article.manufacture_year
    const previous = previousResults.value[it.article_id] ?? null
    result.push({
      it,
      label: itemLabel(it),
      brand: itemBrand(it),
      category: itemCategory(it),
      year: y ? String(y) + (it.article.manufacture_month ? '/' + String(it.article.manufacture_month).padStart(2, '0') : '') : '',
      previous,
      previousDate: previous ? formatDate(previous.inspection_date) : null,
      warning: rowWarning(it),
      score: matchScore(it),
    })
  }
  return result
})

function compareRows(a: Row, b: Row): number {
  let cmp = 0
  if (sortKey.value === 'category') cmp = a.category.localeCompare(b.category)
  else if (sortKey.value === 'brand') cmp = a.brand.localeCompare(b.brand)
  else if (sortKey.value === 'label') cmp = a.label.localeCompare(b.label)
  else if (sortKey.value === 'serial') cmp = (a.it.article.serial_number || '').localeCompare(b.it.article.serial_number || '')
  else if (sortKey.value === 'year') cmp = (a.it.article.manufacture_year ?? 0) - (b.it.article.manufacture_year ?? 0)
  else if (sortKey.value === 'nextDue') cmp = (a.it.next_due || '').localeCompare(b.it.next_due || '')
  return cmp * sortDir.value
}
function rowSetId(r: Row): string | null {
  return articleSetInfo.value[r.it.article_id]?.setId ?? null
}

const sortedRows = computed(() => {
  const list = [...rows.value]
  if (hasFilter.value) {
    list.sort((a, b) => a.score - b.score)
    return list
  }
  // Setleden blijven aaneengesloten: een set sorteert op zijn beste lid
  // (volgens de gekozen kolom), en de leden zelf staan daarbinnen met het
  // hoofdartikel voorop.
  const groupKey = (r: Row) => rowSetId(r) ?? `single:${r.it.article_id}`
  const groupBest = new Map<string, Row>()
  for (const r of list) {
    const g = groupKey(r)
    const cur = groupBest.get(g)
    if (!cur || compareRows(r, cur) < 0) groupBest.set(g, r)
  }
  list.sort((a, b) => {
    const ga = groupKey(a)
    const gb = groupKey(b)
    if (ga !== gb) return compareRows(groupBest.get(ga)!, groupBest.get(gb)!)
    const aRole = articleSetInfo.value[a.it.article_id]?.role
    const bRole = articleSetInfo.value[b.it.article_id]?.role
    if (aRole === 'hoofdartikel' && bRole !== 'hoofdartikel') return -1
    if (bRole === 'hoofdartikel' && aRole !== 'hoofdartikel') return 1
    return compareRows(a, b)
  })
  return list
})

// Net als bij de artikellijsten: een duidelijke groepskop boven het eerste
// lid, i.p.v. alleen een klein vlaggetje per rij (dat bleek in de tabel niet
// duidelijk genoeg -- feedback Jos 2026-07-11).
interface GroupedRow extends Row { isFirstInGroup: boolean; groupName: string | null }
const groupedSortedRows = computed<GroupedRow[]>(() => {
  const list = sortedRows.value
  if (hasFilter.value) return list.map((r) => ({ ...r, isFirstInGroup: false, groupName: null }))
  let prevGroup: string | null = null
  return list.map((r) => {
    const g = rowSetId(r)
    const isFirst = g !== null && g !== prevGroup
    prevGroup = g
    return { ...r, isFirstInGroup: isFirst, groupName: g ? articleSetInfo.value[r.it.article_id]?.setName ?? null : null }
  })
})

function toggleSort(key: typeof sortKey.value) {
  if (sortKey.value === key) sortDir.value = (sortDir.value * -1) as 1 | -1
  else { sortKey.value = key; sortDir.value = 1 }
}

async function load() {
  loading.value = true
  error.value = ''

  if (!isOnline.value) {
    await loadOffline()
    return
  }

  const { data: insp, error: insErr } = await supabase
    .from('inspections')
    .select('*, customer:customers(name), company:inspection_companies(country_code, default_interval_ppe_months, default_interval_rigging_months)')
    .eq('id', id)
    .maybeSingle()
  if (insErr) { error.value = insErr.message; loading.value = false; return }
  if (!insp) { error.value = t('inspections.notFound'); loading.value = false; return }
  inspection.value = insp as unknown as InspectionRecord

  const { data: rowsData, error: itemsErr } = await supabase
    .from('inspection_items')
    .select('id, article_id, result, next_due, rejection_code_id, comment, article:articles(*, product:products(*))')
    .eq('inspection_id', id)
    .order('created_at')
  if (itemsErr) { error.value = itemsErr.message; loading.value = false; return }
  items.value = (rowsData ?? []) as unknown as Item[]

  rejectionCodes.value = await fetchRejectionCodes(insp.company_id)
  freeFields.value = await fetchFreeInputFields()

  previousResults.value = await findPreviousResults(items.value.map((it) => it.article_id), id)

  // Hele catalogus laden in pagina's van 1000: PostgREST kapt een query
  // standaard op 1000 rijen, en de catalogus is groter. Zonder paginering zou
  // een deel van de producten nooit in de suggesties verschijnen.
  const PAGE = 1000
  const allProducts: Product[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data: page, error: prodErr } = await supabase
      .from('products')
      .select('id, brand, name, category, product_type, interval_override_months, max_age_mfr_years, max_age_use_years, recall_url, inspection_notice_url, manual_url')
      .order('id')
      .range(offset, offset + PAGE - 1)
    if (prodErr) break
    allProducts.push(...((page ?? []) as Product[]))
    if (!page || page.length < PAGE) break
  }
  products.value = allProducts

  // Al bekende artikelen van deze klant als extra suggestiebron (zie
  // catalogEntries): zo zijn de dropdowns ook bruikbaar als de globale
  // catalogus nog (vrijwel) leeg is.
  const { data: custArts } = await supabase
    .from('articles')
    .select('id, serial_number, free_brand, free_category, free_description, assigned_user_name, retired, retired_reason, product:products(brand, name, category)')
    .eq('customer_id', insp.customer_id)
  customerArticles.value = (custArts ?? []).map((a: any) => ({
    id: a.id,
    serial: a.serial_number ?? '',
    brand: (a.product?.brand ?? a.free_brand) ?? '',
    name: (a.product?.name ?? a.free_description) ?? '',
    category: (a.product?.category ?? a.free_category) ?? '',
    user: a.assigned_user_name ?? '',
    retired: !!a.retired,
    retiredReason: a.retired_reason ?? null,
    last: null,
  }))
  // Laatste afgeronde keuringsresultaat per klant-artikel, voor de
  // SN-dropdown ("afgekeurd 26 jun 2026"). Eén query voor alle artikelen.
  const custIds = customerArticles.value.map((a) => a.id)
  if (custIds.length) {
    const { data: lastRows } = await supabase
      .from('inspection_items')
      .select('article_id, result, inspection:inspections!inner(inspection_date, status)')
      .in('article_id', custIds)
      .eq('inspection.status', 'completed')
      .in('result', ['passed', 'rejected'])
    const latest = new Map<string, { result: string; date: string }>()
    for (const r of (lastRows ?? []) as any[]) {
      const date = r.inspection?.inspection_date
      if (!date) continue
      const cur = latest.get(r.article_id)
      if (!cur || date > cur.date) latest.set(r.article_id, { result: r.result, date })
    }
    for (const a of customerArticles.value) a.last = latest.get(a.id) ?? null
  }
  // Suggestiebron (merk/artikel/categorie) alleen uit actief materiaal.
  customerEntries.value = customerArticles.value.filter((a) => !a.retired).map((a) => ({
    brand: a.brand || null, name: a.name || null, category: a.category || null,
  }))

  await loadArticleSetInfo(insp.customer_id)

  if (insp.status === 'completed') {
    finished.value = true
    // De downloadlink ook bij het heropenen tonen, niet alleen direct na het
    // afronden. Voor offline afgeronde keuringen is dit de enige route: het
    // certificaat wordt daar pas tijdens de sync op de achtergrond
    // gegenereerd, dus de keurmeester heeft de link nooit gezien.
    const { data: cert } = await supabase
      .from('certificates')
      .select('storage_path')
      .eq('inspection_id', id)
      .maybeSingle()
    if (cert?.storage_path) {
      // download-optie: attachment-header zodat de PDF echt in Downloads
      // belandt i.p.v. alleen in een browsertab te openen.
      certificateUrl.value = supabase.storage
        .from('certificates')
        .getPublicUrl(cert.storage_path, { download: true }).data.publicUrl
    }
  }
  loading.value = false
}

// Offline-tak van load(): leest alles uit de lokale, versleutelde cache i.p.v.
// Supabase. Bewust een apart pad i.p.v. de online-query's overal met
// if/else te doorspekken -- zo blijft de online-code (hierboven, getest en
// in productie) volledig onaangeroerd. Dekt het kernscenario "keuring
// hervatten/invullen offline"; de catalogus-zoeksuggesties zijn offline
// beperkt tot wat voor déze klant gedownload is (zie BOUWPLAN, slice 3).
async function loadOffline() {
  try {
    const key = useOfflineSession().getKey()
    const insp = await getInspection<{
      id: string
      customer_id: string
      company_id: string
      status: string
      source: string | null
    }>(key, id)
    if (!insp) {
      error.value = t('offline.notCachedInspection')
      loading.value = false
      return
    }
    await touchDownloadActivity(insp.customer_id)

    const customer = await getCustomer<{ name: string }>(key, insp.customer_id)
    const company = await getCompanySettings<{
      country_code: string | null
      default_interval_ppe_months: number | null
      default_interval_rigging_months: number | null
    }>(key, insp.company_id)

    inspection.value = {
      id: insp.id,
      customer_id: insp.customer_id,
      company_id: insp.company_id,
      source: insp.source ?? null,
      customer: customer ? { name: customer.name } : null,
      company: company
        ? {
            country_code: company.country_code ?? null,
            default_interval_ppe_months: company.default_interval_ppe_months ?? null,
            default_interval_rigging_months: company.default_interval_rigging_months ?? null,
          }
        : null,
    }

    const rawItems = await getInspectionItems<{
      id: string
      article_id: string
      result: string
      next_due: string | null
      rejection_code_id: string | null
      comment: string | null
    }>(key, id)
    const cachedArticles = await getArticlesForCustomer<Article & { product_id: string | null }>(key, insp.customer_id)
    const articleById = new Map(cachedArticles.map((a) => [a.id, a]))
    const productIds = [...new Set(cachedArticles.map((a) => a.product_id).filter((p): p is string => !!p))]
    const cachedProducts = await getProducts<Product>(key, productIds)
    const productById = new Map(cachedProducts.map((p) => [p.id, p]))

    items.value = rawItems.map((it) => {
      const article = articleById.get(it.article_id)
      const product = article?.product_id ? productById.get(article.product_id) ?? null : null
      return {
        id: it.id,
        article_id: it.article_id,
        result: it.result,
        next_due: it.next_due,
        rejection_code_id: it.rejection_code_id,
        comment: it.comment,
        article: { ...(article as Article), product },
      }
    }) as Item[]

    rejectionCodes.value = await fetchRejectionCodes(insp.company_id)
    freeFields.value = await fetchFreeInputFields()

    previousResults.value = await findPreviousResults(items.value.map((it) => it.article_id), id)

    // Offline beperkt tot wat voor déze klant gedownload is, i.p.v. de hele
    // globale catalogus (die wordt online sowieso al per 1000 gepagineerd
    // geladen en is voor offline gebruik te groot om in zijn geheel mee te
    // nemen -- zie de "download per klant"-keuze in slice 2).
    products.value = cachedProducts
    // Offline bevat de cache alleen niet-afgevoerde artikelen (de download
    // filtert op retired=false), dus geen afgevoerd-badge/laatste-resultaat
    // hier -- dat is online-verrijking.
    customerArticles.value = cachedArticles.map((a) => ({
      id: a.id,
      serial: a.serial_number ?? '',
      brand: (productById.get(a.product_id ?? '')?.brand ?? a.free_brand) ?? '',
      name: (productById.get(a.product_id ?? '')?.name ?? a.free_description) ?? '',
      category: (productById.get(a.product_id ?? '')?.category ?? a.free_category) ?? '',
      user: a.assigned_user_name ?? '',
      retired: false,
      retiredReason: null,
      last: null,
    }))
    customerEntries.value = customerArticles.value.map((a) => ({
      brand: a.brand || null, name: a.name || null, category: a.category || null,
    }))

    if (insp.status === 'completed') finished.value = true
    if (insp.status === 'pending_completion') {
      finished.value = true
      awaitingSync.value = true
    }
    loading.value = false
  } catch (e) {
    error.value = errorMessage(e)
    loading.value = false
  }
}

// Koppel een getypt artikel aan een catalogusproduct (op naam, en als er een
// merk is ingevuld ook op merk). Niet gevonden = vrij artikel.
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

// Maakt de toevoeg-/zoekvelden leeg (na toevoegen of na een SN-keuze).
function resetAddRow() {
  newBrand.value = ''
  newCategory.value = ''
  newDescription.value = ''
  newSerial.value = ''
  newYear.value = null
  newMonth.value = null
  newUser.value = ''
  newResult.value = 'not_assessed'
  newRejectionCodeId.value = null
  newNorm.value = ''
  newMbs.value = ''
  newComment.value = ''
  dayHint.value = null
  weekHint.value = null
}

async function addRow() {
  addError.value = ''
  try {
    if (!isOnline.value) {
      await addRowOffline()
      return
    }
    const product = matchProduct()
    const { data: article, error: artErr } = await supabase
      .from('articles')
      .insert({
        customer_id: inspection.value!.customer_id,
        product_id: product?.id ?? null,
        free_brand: product ? null : (newBrand.value.trim() || null),
        free_category: product ? null : (newCategory.value.trim() || null),
        free_description: product ? null : (newDescription.value.trim() || null),
        free_norm: product ? null : (newNorm.value.trim() || null),
        free_mbs: product ? null : (newMbs.value.trim() || null),
        serial_number: newSerial.value.trim() || null,
        manufacture_year: newYear.value || null,
        manufacture_month: newMonth.value || null,
        assigned_user_name: newUser.value.trim() || null,
        suggest_for_catalog: false,
        retired: false,
      })
      .select('*, product:products(*)')
      .single()
    if (artErr) throw artErr

    const initialNextDue = newResult.value === 'passed' ? toIsoDate(suggestedNextDue({ article } as Item)) : null
    const { data: item, error: itemErr } = await supabase
      .from('inspection_items')
      .insert({
        inspection_id: id,
        article_id: article.id,
        article_snapshot: article,
        result: newResult.value,
        next_due: initialNextDue,
        rejection_code_id: newResult.value === 'rejected' ? newRejectionCodeId.value : null,
        comment: newComment.value.trim() || null,
      })
      .select('id, article_id, result, next_due, rejection_code_id, comment')
      .single()
    if (itemErr) throw itemErr

    items.value.push({ ...item, article } as Item)
    previousResults.value[article.id] = null
    // Ook in de SN-zoekbron opnemen, zodat een net toegevoegd artikel meteen via
    // het serienummer terugvindbaar is (en niet per ongeluk gedupliceerd wordt).
    customerArticles.value.push({
      id: article.id,
      serial: article.serial_number ?? '',
      brand: (article.product?.brand ?? article.free_brand) ?? '',
      name: (article.product?.name ?? article.free_description) ?? '',
      category: (article.product?.category ?? article.free_category) ?? '',
      user: article.assigned_user_name ?? '',
      retired: false,
      retiredReason: null,
      last: null,
    })

    lastArticle.value = {
      description: newDescription.value.trim(),
      brand: newBrand.value.trim(),
      category: newCategory.value.trim(),
      year: newYear.value,
      month: newMonth.value,
      user: newUser.value.trim(),
    }

    if (linkTo.value) {
      const { error: linkErr } = await supabase.rpc('get_or_create_article_set', {
        p_customer_id: inspection.value!.customer_id,
        p_primary_article_id: linkTo.value.id,
        p_primary_label: linkTo.value.label,
        p_new_article_id: article.id,
        p_role: linkRole.value.trim() || null,
        p_retire_article_id: linkReplaceId.value,
      })
      if (linkErr) throw linkErr
      cancelLinkPart()
    }

    resetAddRow()
  } catch (e) {
    addError.value = errorMessage(e)
  }
}

// Offline-tak van addRow(): was in slice 3 bewust nog online-only (secundaire
// actie) -- alsnog toegevoegd na live testen (2026-07-01): zonder dit bleef
// een mislukte offline-poging de toevoegvelden gevuld staan, en omdat
// diezelfde velden ook de tabel filteren (zie hasFilter/matchesFilters)
// leek de hele artikellijst dan te "verdwijnen". Zelfde opzet als de rest
// van de offline-schrijfacties: client-side id's, lokale cache bijwerken,
// mutatie in de wachtrij (artikel vóór item, i.v.m. de foreign key).
async function addRowOffline() {
  const key = useOfflineSession().getKey()
  const customerId = inspection.value!.customer_id
  const product = matchProduct()
  const articleId = crypto.randomUUID()
  const articleRow = {
    id: articleId,
    customer_id: customerId,
    product_id: product?.id ?? null,
    free_brand: product ? null : (newBrand.value.trim() || null),
    free_category: product ? null : (newCategory.value.trim() || null),
    free_description: product ? null : (newDescription.value.trim() || null),
    free_norm: product ? null : (newNorm.value.trim() || null),
    free_mbs: product ? null : (newMbs.value.trim() || null),
    serial_number: newSerial.value.trim() || null,
    manufacture_year: newYear.value || null,
    manufacture_month: newMonth.value || null,
    assigned_user_name: newUser.value.trim() || null,
    suggest_for_catalog: false,
    retired: false,
  }
  await putArticles(key, customerId, [articleRow])
  await enqueueMutation({ customerId, table: 'articles', op: 'insert', payload: articleRow })

  const articleWithProduct = { ...articleRow, product: product ?? null } as unknown as Article
  const initialNextDue =
    newResult.value === 'passed' ? toIsoDate(suggestedNextDue({ article: articleWithProduct } as Item)) : null
  const itemId = crypto.randomUUID()
  const itemRow = {
    id: itemId,
    inspection_id: id,
    article_id: articleId,
    article_snapshot: articleRow,
    result: newResult.value,
    next_due: initialNextDue,
    rejection_code_id: newResult.value === 'rejected' ? newRejectionCodeId.value : null,
    comment: newComment.value.trim() || null,
  }
  await putInspectionItems(key, id, [itemRow])
  await enqueueMutation({ customerId, table: 'inspection_items', op: 'insert', payload: itemRow })

  items.value.push({
    id: itemId,
    article_id: articleId,
    result: itemRow.result,
    next_due: itemRow.next_due,
    rejection_code_id: itemRow.rejection_code_id,
    comment: itemRow.comment,
    article: articleWithProduct,
  })
  previousResults.value[articleId] = null
  customerArticles.value.push({
    id: articleId,
    serial: articleRow.serial_number ?? '',
    brand: (product?.brand ?? articleRow.free_brand) ?? '',
    name: (product?.name ?? articleRow.free_description) ?? '',
    category: (product?.category ?? articleRow.free_category) ?? '',
    user: articleRow.assigned_user_name ?? '',
    retired: false,
    retiredReason: null,
    last: null,
  })

  lastArticle.value = {
    description: newDescription.value.trim(),
    brand: newBrand.value.trim(),
    category: newCategory.value.trim(),
    year: newYear.value,
    month: newMonth.value,
    user: newUser.value.trim(),
  }

  await touchDownloadActivity(customerId)
  resetAddRow()
}

// Klik op een al actief resultaat zet 'm terug naar niet-beoordeeld (herstel
// van een misklik); opmerking blijft altijd staan, ook bij goedkeur.
function setResult(it: Item, result: 'passed' | 'rejected') {
  if (it.result === result) {
    it.result = 'not_assessed'
    it.next_due = null
  } else {
    it.result = result
    it.next_due = result === 'passed' ? toIsoDate(suggestedNextDue(it)) : null
    if (result === 'passed') it.rejection_code_id = null
  }
  saveRow(it)
}

// Prullenbak op een rij: heeft dit artikel nog nooit op een afgerond
// certificaat gestaan, dan mag het écht weg (geen historie om te bewaren).
// Staat het al op minstens één eerder certificaat, dan voorkomen we dat die
// certificaten zouden "veranderen" door alleen zacht af te voeren (retired):
// het artikel blijft bestaan, telt niet meer mee voor nieuwe keuringen.
async function retireArticle(it: Item) {
  // Bewust (nog) online-only: of een artikel echt weg mag hangt af van de
  // volledige servergeschiedenis (stond het ooit op een certificaat?), en die
  // is offline niet te zien. Nette melding i.p.v. stil niets doen.
  if (!isOnline.value) {
    addError.value = t('offline.onlineOnlyAction')
    return
  }
  const { data: certified, error: checkErr } = await supabase
    .from('inspection_items')
    .select('id, inspections!inner(status)')
    .eq('article_id', it.article.id)
    .eq('inspections.status', 'completed')
    .limit(1)
  if (checkErr) return

  if (certified && certified.length) {
    if (!confirm(t('articles.detail.retireBody'))) return
    const { error: err } = await supabase
      .from('articles')
      .update({ retired: true, retired_at: new Date().toISOString() })
      .eq('id', it.article.id)
    if (!err) it.article.retired = true
    return
  }

  if (!confirm(t('articles.detail.deleteNeverInspectedBody'))) return
  const { error: itemErr } = await supabase.from('inspection_items').delete().eq('id', it.id)
  if (itemErr) return
  await supabase.from('articles').delete().eq('id', it.article.id)
  items.value = items.value.filter((x) => x.id !== it.id)
}

// Bestaande artikelgegevens corrigeren vanuit de tabel (verkeerd serienummer,
// vergeten datum/bouwjaar). Online direct naar de articles-tabel; offline via
// de lokale cache + mutatiewachtrij -- dit faalde eerst volledig stil: het
// veld leek gewijzigd maar er werd niets opgeslagen, ook lokaal niet, en na
// herladen was de correctie weg (code review 2026-07-01).
async function saveArticle(it: Item) {
  const a = it.article
  const patch = {
    serial_number: a.serial_number?.toString().trim() || null,
    manufacture_year: a.manufacture_year || null,
    manufacture_month: a.manufacture_month || null,
    first_use_date: a.first_use_date || null,
    assigned_user_name: a.assigned_user_name?.toString().trim() || null,
    suggest_for_catalog: a.suggest_for_catalog,
  }
  if (!isOnline.value) {
    try {
      const key = useOfflineSession().getKey()
      const customerId = inspection.value!.customer_id
      const current = await getArticle<Record<string, unknown> & { id: string }>(key, a.id)
      if (!current) {
        addError.value = t('offline.notCachedInspection')
        return
      }
      await putArticles(key, customerId, [{ ...current, ...patch }])
      await enqueueMutation({ customerId, table: 'articles', op: 'update', payload: { id: a.id, ...patch } })
      await touchDownloadActivity(customerId)
    } catch (e) {
      addError.value = errorMessage(e)
    }
    return
  }
  const { error: err } = await supabase.from('articles').update(patch).eq('id', a.id)
  if (err) addError.value = err.message
}

async function saveRow(it: Item) {
  const patch = {
    result: it.result,
    next_due: it.next_due,
    rejection_code_id: it.rejection_code_id,
    comment: it.comment,
  }
  if (!isOnline.value) {
    // Offline: lokale weergave bijwerken + de wijziging in de mutatiewachtrij
    // zetten. Meerdere wijzigingen aan hetzelfde item vóór de volgende sync
    // worden daar samengevoegd tot één mutatie (last-write-wins per record,
    // zie mutationQueue.ts) -- niet per toetsaanslag een eigen wachtrij-item.
    try {
      const key = useOfflineSession().getKey()
      await patchInspectionItem(key, it.id, patch)
      await enqueueMutation({
        customerId: inspection.value!.customer_id,
        table: 'inspection_items',
        op: 'update',
        payload: { id: it.id, ...patch },
      })
      // Elk ingevuld resultaat telt als activiteit: zonder dit zag de
      // opruimlogica (4-uur-inactiviteitsregel) een hele middag keuren aan
      // voor stilte, omdat alleen het openen van de wizard geregistreerd werd.
      await touchDownloadActivity(inspection.value!.customer_id)
    } catch (e) {
      error.value = errorMessage(e)
    }
    return
  }
  // Fout NIET negeren (code review 2026-07-18): dit is het keurresultaat
  // zelf -- mislukt de update stil, dan denkt de keurmeester dat het staat
  // terwijl het er niet staat. Eigen ref (niet addError): de melding hoort
  // weer te verdwijnen zodra een volgende save wél slaagt, zonder een
  // eventuele losstaande toevoeg-fout mee te wissen.
  const { error: err } = await supabase.from('inspection_items').update(patch).eq('id', it.id)
  rowSaveError.value = err ? t('inspections.table.saveRowFailed', { name: itemLabel(it) }) + ' ' + err.message : ''
}

async function finish() {
  // Afgevoerde artikelen (bv. vervangen via de "onderdeel toevoegen"-koppeling)
  // horen niet in deze waarschuwing: die blijven niet "bij de klant staan voor
  // een volgende keer" -- ze zijn al vervangen/uit dienst. De tabel filtert ze
  // om diezelfde reden al weg (zie rows), deze check moet dat spiegelen.
  // Niet afronden zolang een resultaat niet is opgeslagen (zie saveRow): het
  // certificaat wordt van de server gelezen en zou anders het OUDE resultaat
  // tonen. De keurmeester moet eerst de mislukte save opnieuw doen.
  if (rowSaveError.value) {
    completeError.value = t('inspections.table.finishBlockedUnsaved')
    return
  }
  const notAssessed = items.value.filter((i) => i.result === 'not_assessed' && !i.article.retired)
  if (notAssessed.length) {
    const names = notAssessed.map((i) => itemLabel(i)).join('\n - ')
    const ok = confirm(t('inspections.table.notAssessedConfirm', { count: notAssessed.length }) + '\n - ' + names)
    if (!ok) return
  }
  completing.value = true
  completeError.value = ''
  try {
    if (!isOnline.value) {
      // Het certificaat-PDF heeft sowieso een netwerk-roundtrip nodig (Storage-
      // upload + DB-record), dus die blijft uitgesteld tot synchronisatie (zie
      // BOUWPLAN, slice 5 -- geaccepteerde consequentie, akkoord Jos). De
      // keuring krijgt een aparte lokale status "pending_completion" zodat hij
      // niet meer als hervatbaar concept verschijnt, maar ook nog niet als
      // "afgerond" telt totdat het certificaat er écht is. De sync-engine
      // (useOffline.ts → runSync) genereert het certificaat alsnog zodra er
      // weer verbinding is.
      const key = useOfflineSession().getKey()
      await markInspectionPendingCompletion(key, id)
      await touchDownloadActivity(inspection.value!.customer_id)
      // Statusbalk meteen laten zien dat er een certificaat op sync wacht.
      await useOffline().refreshPendingCompletions()
      awaitingSync.value = true
      finished.value = true
      return
    }

    // Eerst het certificaat genereren en opslaan; pas als dat lukt, markeren we
    // de keuring als afgerond. Zo blijft een mislukte PDF-upload een hervatbaar
    // concept i.p.v. een "afgeronde" keuring zonder certificaat.
    const { storagePath } = await generateCertificate(id)

    const { error: err } = await supabase
      .from('inspections')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err

    certificateUrl.value = supabase.storage
      .from('certificates')
      .getPublicUrl(storagePath, { download: true }).data.publicUrl
    finished.value = true
  } catch (e) {
    completeError.value = errorMessage(e)
  } finally {
    completing.value = false
  }
}

onMounted(load)

// Na ontgrendelen via de statusbalk alsnog uit de cache laden (zie Customers.vue).
watch(useOfflineSession().isUnlocked, (unlocked) => {
  if (unlocked && loading.value === false && error.value) void load()
})
</script>

<style scoped>
/* De opmaak van de keurtabel zelf (regels, cellen, invoervelden,
   suggestielijsten en de kaartweergave op telefoon) staat in
   ../styles/inspection-table.css: die wordt gedeeld met InspectionRow.vue,
   en scoped styles reiken niet tot in een kindcomponent. Hieronder blijft
   alleen wat exclusief van deze pagina is. */
.iw { min-height: var(--page-min-h, 100vh); background: #f0f4f8; display: flex; flex-direction: column; }
.iw__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10; gap: 0.75rem;
}
.iw__nav { display: flex; align-items: center; gap: 0.15rem; }
.iw__header h1 { font-size: 1.1rem; margin: 0; flex: 1; text-align: center; }
.iw__totals { font-size: 0.8rem; opacity: 0.9; white-space: nowrap; }
.iw__state { text-align: center; padding: 3rem 1rem; color: #666; }
.iw__state--error { color: #dc2626; }
.iw__body { padding: 1.25rem; }

.iw__add { background: #fff; border-radius: 12px; padding: 0.85rem; margin-bottom: 0.85rem; display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }

/* Inline suggestielijst (Optie A): duwt de tabel naar beneden i.p.v. eroverheen. */
.iw__free-extras { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0.5rem 0 0; }
/* De per-veld-suggestielijst is alleen voor telefoon/tablet (zie media-query);
   op desktop staat de gedeelde lijst onder de hele rij (iw__suggest--main). */
.iw__suggest--field { display: none; }

/* SN-zoekresultaten: serienummer prominent, daarnaast artikel/merk en een
   badge of het al in de keuring zit of nog toegevoegd moet worden. */
.iw__sn-item {
  display: flex; align-items: center; gap: 0.5rem; width: 100%;
  text-align: left; border: none; background: transparent; cursor: pointer;
  padding: 0.5rem 0.6rem; border-radius: 6px; font-family: inherit;
}
.iw__sn-item:hover { background: #f3f4f6; }
.iw__sn-serial { font-weight: 700; color: #111827; font-size: 0.9rem; white-space: nowrap; }
.iw__sn-meta { color: #6b7280; font-size: 0.82rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iw__sn-badge { font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.45rem; border-radius: 999px; white-space: nowrap; }
.iw__sn-badge--in { background: #e0e7ff; color: #3730a3; }
.iw__sn-badge--add { background: #dcfce7; color: #166534; }
.iw__sn-badge--retired { background: #f3f4f6; color: #6b7280; }

.iw__cheatsheet {
  display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
  font-size: 0.8rem; color: #6b7280; margin-bottom: 0.85rem; padding: 0 0.25rem;
}
.iw__cheatsheet .iw__input { flex: 0 0 4rem; min-width: 3.5rem; padding: 0.35rem 0.5rem; }
.iw__cheatsheet-toggle {
  background: none; border: none; color: #16a34a; font-weight: 600;
  font-size: 0.8rem; cursor: pointer; padding: 0;
}
.iw__snref { background: #fff; border-radius: 12px; padding: 0.85rem; margin-bottom: 0.85rem; }
.iw__cheatsheet-label { white-space: nowrap; }
.iw__cheatsheet-result { font-weight: 600; color: #16a34a; white-space: nowrap; }
.iw__cheatsheet-apply { border: 1px solid #16a34a; color: #16a34a; background: #fff; border-radius: 6px; padding: 0.15rem 0.5rem; font-size: 0.75rem; cursor: pointer; }
.iw__cheatsheet-sep { opacity: 0.5; }

.iw__table-wrap { background: #fff; border-radius: 12px; overflow-x: auto; }
.iw__sortable { cursor: pointer; user-select: none; }
.iw__sortable:hover { color: #111827; }
/* Klein en subtiel regeltje onder de toevoegrij, geen blok (feedback Jos
   2026-07-11). */
.iw__add-recall-hint { margin: 0.4rem 0 0; font-size: 0.8rem; color: #b91c1c; }
.iw__add-recall-hint a { color: inherit; }

.iw__link-bar {
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
  background: #eff6ff; color: #1e40af; border-radius: 10px;
  padding: 0.6rem 0.85rem; margin-bottom: 0.5rem; font-size: 0.9rem;
}
.iw__link-cancel { border: none; background: none; color: #1e40af; cursor: pointer; font-size: 1rem; margin-left: auto; }
.iw__retired-badge { opacity: 0.5; }

.iw__error { color: #dc2626; font-size: 0.9rem; margin: 0.5rem 0; }

.iw__next {
  width: 100%; margin-top: 1.25rem; padding: 0.9rem; border-radius: 10px;
  border: none; background: #16a34a; color: #fff; font-size: 1.05rem; font-weight: 700; cursor: pointer;
}
.iw__next:disabled { opacity: 0.6; }

.iw__btn { padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.iw__btn--cancel { background: #f3f4f6; color: #374151; }
.iw__btn--save { background: #16a34a; color: #fff; }
.iw__btn--copy { background: #f3f4f6; color: #374151; padding: 0.6rem 0.85rem; font-size: 0.9rem; }
.iw__btn:disabled { opacity: 0.6; }

.iw__cert-done { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
.iw__cert-ok { font-weight: 600; color: #16a34a; margin: 0; }
.iw__cert-pending { font-weight: 600; color: #92400e; background: #fffbeb; border-radius: 8px; padding: 0.75rem; margin: 0; }
.iw__cert-imported { font-weight: 600; color: #1e3a5f; background: #eff6ff; border-radius: 8px; padding: 0.75rem; margin: 0; }
.iw__cert-link { text-align: center; text-decoration: none; display: block; }

/* Telefoon & tablet: zie ../styles/inspection-table.css voor de tabel-als-
   kaartjes; hieronder alleen de toevoegrij en de suggestielijsten. */
@media (max-width: 820px) {
  .iw__body { padding: 0.85rem; }

  /* Toevoegrij: velden vol-breed onder elkaar i.p.v. samengeknepen. */
  .iw__add .iw__input,
  .iw__add .iw__input--sm,
  .iw__add .iw__select--xs { flex: 1 1 100%; min-width: 0; }
  .iw__add .iw__input--xs { flex: 1 1 45%; }

  /* Suggesties direct onder het actieve veld (i.p.v. de gedeelde lijst die
     onderaan, achter het toetsenbord, zou vallen). */
  .iw__suggest--main { display: none; }
  .iw__suggest--field { display: flex; flex: 1 1 100%; margin: 0.1rem 0 0.2rem; }

  .iw__table-wrap { background: transparent; overflow: visible; }
}
</style>
