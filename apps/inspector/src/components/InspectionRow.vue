<template>
  <!-- Zacht/transparant i.p.v. een volle, felle balk (feedback Jos 2026-07-11:
       "schreeuwt van de daken, doet pijn aan de ogen") -- zelfde subtiele tint
       als de artikellijst, met alleen een dun randje zodat de kop nog wel opvalt. -->
  <tr v-if="groupHead !== null" class="iw__group-head-row">
    <td colspan="12">🔗 {{ groupHead }}</td>
  </tr>
  <tr
    :id="'iw-row-' + item.id"
    :class="{ 'iw__row--rejected': item.result === 'rejected', 'iw__row--passed': item.result === 'passed', 'iw__row--highlight': highlighted, 'iw__row--grouped': inSet }"
  >
    <td class="iw__warn-cell">
      <!-- Levensduur-waarschuwing (⛔/⚠) staat bewust alléén naast het
           bouwjaar (zie iw__year-cell), niet ook nog eens vooraan de rij. -->
      <a v-if="manualUrl" :href="manualUrl" target="_blank" class="iw__warn-icon" :title="$t('articles.fields.manualUrl')">📖</a>
      <button v-else-if="!item.article.product" class="iw__icon-btn" :title="$t('inspections.table.addManualUrl')" @click="emit('edit-manual-url', item)">📖</button>
      <!-- Alleen het vlaggetje (geen rood blok meer -- feedback Jos
           2026-07-11: "dan hoeft er niet ook nog een rood vlak met
           RECALL te staan schreeuwen. het vlaggetje is genoeg").
           Recall en inspection notice zijn twee verschillende
           signalen (zie DATAMODEL products.recall_url /
           inspection_notice_url) en stonden hier ten onrechte
           samengevoegd achter hetzelfde 🚩 -- een gewoon
           fabrikantsbulletin zag er zo uit als een echte recall
           (feedback Jos 2026-07-14: onnodige paniek). Nu eigen
           icoon + tooltip per type, allebei tonen kan (een
           product kan beide links los hebben). Elk heeft een
           eigen ✕ om af te vinken met een opmerking (bv.
           "voldaan" of "dit exemplaar valt niet binnen de
           batch") -- feedback Jos 2026-07-14: anders blijft de
           vlag voor altijd staan, ook na beoordeling. -->
      <template v-if="recallUrl">
        <a :href="recallUrl" target="_blank" class="iw__warn-icon" :aria-label="$t('inspections.table.recallFlag')" :title="recallTitle!">🚩</a>
        <button type="button" class="iw__flag-clear" :title="$t('inspections.table.clearFlag')" @click="emit('clear-recall', item)">✕</button>
      </template>
      <span v-else-if="recallClearedNote" class="iw__flag-cleared" :title="`${$t('inspections.table.clearedTitle')}: ${recallClearedNote}`">✓</span>
      <template v-if="noticeUrl">
        <a :href="noticeUrl" target="_blank" class="iw__warn-icon" :aria-label="$t('inspections.table.noticeFlag')" :title="noticeTitle!">⚠️</a>
        <button type="button" class="iw__flag-clear" :title="$t('inspections.table.clearFlag')" @click="emit('clear-notice', item)">✕</button>
      </template>
      <span v-else-if="noticeClearedNote" class="iw__flag-cleared" :title="`${$t('inspections.table.clearedTitle')}: ${noticeClearedNote}`">✓</span>
      <!-- Opmerking uit de catalogus: allebei de manieren, want
           er wordt zowel op een telefoon als op een laptop
           gekeurd. Muisaanwijzen toont de tekst als tooltip,
           klikken klapt hem uit onder de rij -- dat laatste is
           de enige route op een aanraakscherm. -->
      <button
        v-if="productNotes"
        type="button"
        class="iw__notes-toggle"
        :aria-expanded="notesOpen"
        :aria-label="$t('inspections.table.productNotesFlag')"
        :title="productNotesTitle!"
        @click="emit('toggle-notes', item)"
      >ℹ️</button>
    </td>
    <td class="iw__category" :data-label="$t('inspections.table.colCategory')">{{ category || '—' }}</td>
    <td :data-label="$t('inspections.table.colBrand')">{{ brand || '—' }}</td>
    <td class="iw__match-cell" :data-label="$t('inspections.table.colDescription')">
      <template v-if="matchActive">
        <input
          :value="matchSearch"
          class="iw__cell-input"
          :placeholder="$t('inspections.table.matchPlaceholder')"
          autofocus
          @input="emit('update:matchSearch', ($event.target as HTMLInputElement).value)"
          @blur="emit('match-blur')"
          @keydown="emit('match-keydown', $event)"
        />
        <div v-if="matchSuggestions.length" class="iw__suggest iw__suggest--row">
          <button
            v-for="(s, i) in matchSuggestions"
            :key="s"
            type="button"
            class="iw__suggest-item"
            :class="{ 'iw__suggest-item--active': i === matchIndex }"
            @mousedown.prevent="emit('pick-suggestion', s)"
            @mouseenter="emit('hover-suggestion', i)"
          >{{ s }}</button>
        </div>
      </template>
      <button
        v-else-if="!item.article.product"
        type="button"
        class="iw__match-btn"
        :title="$t('inspections.table.matchTooltip')"
        @click="emit('start-match', item)"
      >{{ label }}</button>
      <span v-else>{{ label }}</span>
      <span
        v-if="setName"
        class="iw__set-flag"
        :title="$t('sets.addPart.linkedTo', { name: setName })"
      >🔗</span>
    </td>
    <td :data-label="$t('inspections.table.colSerial')">
      <input
        v-model="item.article.serial_number"
        class="iw__cell-input"
        :placeholder="$t('inspections.table.serial')"
        @change="emit('save-article', item)"
      />
    </td>
    <td class="iw__year-cell" :data-label="$t('inspections.table.colYear')">
      <span v-if="warningIcon" :title="warningText!" class="iw__warn-icon">{{ warningIcon }}</span>
      <input
        v-model.number="item.article.manufacture_year"
        type="number"
        class="iw__cell-input iw__cell-input--xs"
        placeholder="JJJJ"
        @change="emit('save-article', item)"
      />
      <select v-model.number="item.article.manufacture_month" class="iw__month-select" @change="emit('save-article', item)">
        <option :value="null">{{ $t('inspections.table.month') }}</option>
        <option v-for="m in 12" :key="m" :value="m">{{ monthName(m) }}</option>
      </select>
    </td>
    <td :data-label="$t('inspections.table.colFirstUse')">
      <input
        v-model="item.article.first_use_date"
        type="date"
        class="iw__date-input"
        @change="emit('save-article', item)"
      />
    </td>
    <td :data-label="$t('inspections.table.colUser')">
      <input
        v-model="item.article.assigned_user_name"
        class="iw__cell-input"
        :placeholder="$t('articles.fields.user')"
        @change="emit('save-article', item)"
      />
    </td>
    <td :data-label="$t('inspections.table.colPrevious')">
      <span
        v-if="previousResult && previousResult !== 'not_assessed'"
        :class="previousResult === 'passed' ? 'iw__prev--pass' : 'iw__prev--fail'"
      >
        {{ previousResult === 'passed' ? '✅' : '❌' }} {{ previousDate }}
      </span>
      <span v-else class="iw__prev--none">—</span>
    </td>
    <td class="iw__result-cell" :data-label="$t('inspections.table.colResult')">
      <div class="iw__result-buttons">
        <button
          class="iw__result-btn iw__result-btn--pass"
          :class="{ 'iw__result-btn--active': item.result === 'passed' }"
          @click="emit('set-result', item, 'passed')"
        >✅ {{ $t('inspections.table.pass') }}</button>
        <button
          class="iw__result-btn iw__result-btn--fail"
          :class="{ 'iw__result-btn--active': item.result === 'rejected' }"
          @click="emit('set-result', item, 'rejected')"
        >❌ {{ $t('inspections.table.fail') }}</button>
        <select v-if="item.result === 'rejected'" v-model="item.rejection_code_id" class="iw__select iw__select--sm" @change="emit('save-row', item)">
          <option :value="null">{{ $t('inspections.noCode') }}</option>
          <option v-for="c in rejectionCodes" :key="c.id" :value="c.id">{{ c.code }} — {{ c.label }}</option>
        </select>
        <input
          v-model="item.comment"
          class="iw__input iw__input--sm iw__comment-input"
          :placeholder="$t('inspections.commentPlaceholder')"
          @blur="emit('save-row', item)"
        />
      </div>
    </td>
    <td :data-label="$t('inspections.table.colNextDue')">
      <input
        v-if="item.result === 'passed'"
        type="date"
        v-model="item.next_due"
        class="iw__date-input"
        @change="emit('save-row', item)"
      />
      <span v-else>—</span>
    </td>
    <td class="iw__actions-cell">
      <!-- Alleen bij vrije artikelen (geen catalogusmatch): aanmelden
           voor de catalogus-wachtrij. Geen kaal vinkje meer: de knop
           opent een productformulier dat de keurmeester zelf invult
           vóór het op de wachtrij komt (besluit Jos 2026-07-05).
           Actief = al aangemeld. -->
      <button v-if="!item.article.product" type="button"
              class="iw__catalog-toggle"
              :class="{ 'iw__catalog-toggle--on': item.article.suggest_for_catalog }"
              :title="$t('inspections.table.suggestForCatalog')"
              @click="emit('suggest-catalog', item.article)">
        📚
      </button>
      <button class="iw__part-btn" :title="$t('sets.addPart.title')" @click="emit('link-part', item)">🔗+</button>
      <button class="iw__retire-btn" :title="$t('articles.detail.retire')" @click="emit('retire', item)">🗑</button>
    </td>
  </tr>
  <tr v-if="notesOpen" class="iw__notes-row">
    <td colspan="12">
      <strong>{{ $t('inspections.table.productNotesTitle') }}:</strong>
      {{ productNotes }}
    </td>
  </tr>
</template>

<script setup lang="ts">
/**
 * Eén regel in de keurtabel van InspectionWizard.
 *
 * Bestaat als eigen component om prestatieredenen, niet om de opmaak. Toen de
 * hele tabel nog in de template van de wizard stond, tekende Vue bij élke
 * toetsaanslag in de toevoegrij (serienummer, merk, ...) alle regels opnieuw:
 * één render-doorloop is per regel 35 vertaal-lookups, 15 afleidingsfuncties
 * en 9 invoervelden. Gemeten bij een klant met 260 artikelen (2026-08-02,
 * headless Chromium): ~57 ms per toetsaanslag, oplopend tot ~109 ms bij 500 --
 * op een telefoon een veelvoud daarvan, en dat is precies het "zoeken gaat
 * traag" dat Jos op locatie meldde.
 *
 * Als eigen component slaat Vue een regel over zolang zijn props gelijk
 * blijven: ~4 ms, ongeacht het aantal artikelen.
 *
 * DAAROM: alle props hier zijn primitieven of stabiele objectverwijzingen, en
 * alle gebeurtenissen gaan omhoog via `emit`. Zodra de ouder een prop bindt
 * die per render een nieuw object/functie oplevert (`:foo="{ ... }"`,
 * `@klik="() => doe(rij)"`), is het effect weg en tekent élke regel weer mee.
 * Zie InspectionWizard.vue bij `<InspectionRow`.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  itemManualUrl,
  itemRecallUrl,
  itemRecallClearedNote,
  itemNoticeUrl,
  itemNoticeClearedNote,
  itemProductNotes,
  monthName,
  type Article,
  type Item,
  type RejectionCode,
} from '../composables/inspectionItem'

const props = defineProps<{
  item: Item
  /** Door de ouder voorgekauwd (uit de `rows`-computed), zodat dit component niets hoeft te herberekenen. */
  label: string
  brand: string
  category: string
  /** Levensduurwaarschuwing, als losse primitieven -- een object zou per render nieuw zijn. */
  warningIcon: string | null
  warningText: string | null
  previousResult: string | null
  /** Al opgemaakte datum: opmaken hoort bij de ouder, zodat hier geen tweede formatDate nodig is. */
  previousDate: string | null
  highlighted: boolean
  /** Niet-null = eerste lid van een set, dus met groepskop erboven. */
  groupHead: string | null
  inSet: boolean
  setName: string | null
  notesOpen: boolean
  rejectionCodes: RejectionCode[]
  /** Rij-match ("bedoelt u"): alleen de actieve rij krijgt tekst en suggesties. */
  matchActive: boolean
  matchSearch: string
  matchSuggestions: string[]
  matchIndex: number
}>()

const emit = defineEmits<{
  (e: 'edit-manual-url', it: Item): void
  (e: 'clear-recall', it: Item): void
  (e: 'clear-notice', it: Item): void
  (e: 'toggle-notes', it: Item): void
  (e: 'start-match', it: Item): void
  (e: 'save-article', it: Item): void
  (e: 'save-row', it: Item): void
  (e: 'set-result', it: Item, result: 'passed' | 'rejected'): void
  (e: 'suggest-catalog', article: Article): void
  (e: 'link-part', it: Item): void
  (e: 'retire', it: Item): void
  (e: 'update:matchSearch', value: string): void
  (e: 'match-blur'): void
  (e: 'match-keydown', event: KeyboardEvent): void
  (e: 'pick-suggestion', value: string): void
  (e: 'hover-suggestion', index: number): void
}>()

const { t } = useI18n()

const manualUrl = computed(() => itemManualUrl(props.item))
const recallUrl = computed(() => itemRecallUrl(props.item))
const recallClearedNote = computed(() => itemRecallClearedNote(props.item))
const noticeUrl = computed(() => itemNoticeUrl(props.item))
const noticeClearedNote = computed(() => itemNoticeClearedNote(props.item))
const productNotes = computed(() => itemProductNotes(props.item))

const recallTitle = computed(() =>
  recallUrl.value ? `${t('inspections.table.recallHint')}: ${recallUrl.value}` : null,
)
const noticeTitle = computed(() =>
  noticeUrl.value ? `${t('inspections.table.noticeHint')}: ${noticeUrl.value}` : null,
)
/**
 * De opmerking als tooltip, zodat muisaanwijzen op laptop/pc al volstaat
 * (Jos 2026-07-31: "keuren gebeurt ook vaak op een laptop/pc"). Klikken klapt
 * hem uit en blijft nodig op een telefoon, waar hoveren niet bestaat.
 */
const productNotesTitle = computed(() =>
  productNotes.value ? `${t('inspections.table.productNotesTitle')}: ${productNotes.value}` : null,
)
</script>

<!-- Geen <style scoped> hier: de opmaak van tabel en regels staat in
     ../styles/inspection-table.css, gedeeld met InspectionWizard.vue. Scoped
     styles van de ouder bereiken de elementen van een kindcomponent niet, en
     de regels twee keer neerzetten is precies wat CLAUDE.md verbiedt. -->
