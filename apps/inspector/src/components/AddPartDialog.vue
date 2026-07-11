<!-- "Onderdeel toevoegen aan dit artikel" (besloten met Jos 2026-07-11): een
     hoofdartikel (bv. een klimgordel) krijgt vaak een vervangen onderdeel met
     een eigen serienummer (bv. een nieuwe brug). Zonder deze dialoog moest je
     dat onderdeel los toevoegen en daarna apart de gordel + het onderdeel
     opzoeken om ze te groeperen -- niet intuïtief (Jos). Deze dialoog doet
     alles in één actie: nieuw artikel aanmaken, koppelen aan (of aanmaken van)
     de set van het hoofdartikel via de gedeelde RPC get_or_create_article_set,
     en optioneel het oude onderdeel afvoeren + uit de set halen ("vervangt").
     Bewust online-only, zelfde lijn als andere set-acties. -->
<template>
  <div class="apd" @click.self="$emit('close')">
    <div class="apd__panel">
      <div class="apd__head">
        <h3 class="apd__title">{{ $t('sets.addPart.title') }}</h3>
        <button class="apd__x" :title="$t('common.cancel')" @click="$emit('close')">✕</button>
      </div>
      <p class="apd__label">{{ $t('sets.addPart.linkedTo', { name: mainLabel }) }}</p>

      <div v-if="!isOnline" class="apd__state apd__state--error">{{ $t('sets.addPart.offline') }}</div>
      <form v-else class="apd__form" @submit.prevent="save">
        <div class="apd__field">
          <input
            v-model="brand"
            class="apd__input"
            :placeholder="$t('inspections.table.brand')"
            @focus="activeField = 'brand'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <div v-if="activeField === 'brand' && fieldSuggestions.length" class="apd__suggest">
            <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" ref="itemRefs"
                    class="apd__suggest-item" :class="{ 'apd__suggest-item--active': i === suggestIndex }"
                    @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
          </div>
        </div>
        <div class="apd__field">
          <input
            v-model="description"
            class="apd__input"
            :placeholder="$t('inspections.table.article')"
            @focus="activeField = 'article'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <div v-if="activeField === 'article' && fieldSuggestions.length" class="apd__suggest">
            <button v-for="(s, i) in fieldSuggestions" :key="s" type="button" ref="itemRefs"
                    class="apd__suggest-item" :class="{ 'apd__suggest-item--active': i === suggestIndex }"
                    @mousedown.prevent="pickSuggestion(s)" @mouseenter="suggestIndex = i">{{ s }}</button>
          </div>
        </div>
        <input v-model="serial" class="apd__input" :placeholder="$t('articles.fields.serial')" />
        <div class="apd__row">
          <input v-model.number="year" type="number" class="apd__input apd__input--sm" :placeholder="$t('inspections.table.year')" />
          <select v-model="month" class="apd__input apd__input--sm">
            <option :value="null">{{ $t('inspections.table.month') }}</option>
            <option v-for="m in 12" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <input v-model="role" class="apd__input" :placeholder="$t('sets.addPart.rolePlaceholder')" />

        <label v-if="candidates.length" class="apd__replace">
          {{ $t('sets.addPart.replaces') }}
          <select v-model="replaceArticleId" class="apd__input">
            <option :value="null">{{ $t('sets.addPart.replacesNone') }}</option>
            <option v-for="c in candidates" :key="c.article_id" :value="c.article_id">{{ c.label }}</option>
          </select>
        </label>

        <p v-if="formError" class="apd__error">{{ formError }}</p>
        <div class="apd__actions">
          <button type="button" class="apd__btn apd__btn--cancel" @click="$emit('close')">{{ $t('common.cancel') }}</button>
          <button type="submit" class="apd__btn apd__btn--save" :disabled="saving">
            {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, useOnline, errorMessage } from '@gearonimo/core'
import { useFieldSuggest, fuzzyFilter } from '@gearonimo/ui'

interface CatalogProduct { id: string; brand: string | null; name: string | null; category: string | null; manufacturer_code: string | null }
const props = defineProps<{ customerId: string; mainArticleId: string; mainLabel: string; products: CatalogProduct[] }>()
const emit = defineEmits<{ (e: 'saved'): void; (e: 'close'): void }>()

const { t } = useI18n()
const { isOnline } = useOnline()

const brand = ref('')
const description = ref('')
const serial = ref('')
const year = ref<number | null>(null)
const month = ref<number | null>(null)
const role = ref('')
const replaceArticleId = ref<string | null>(null)
const saving = ref(false)
const formError = ref('')

// Zelfde zoeken/dropdown als bij "Artikel toevoegen" (CustomerArticles.vue):
// merk filtert de artikel-suggesties (trechter), een exacte match vult het
// merk terug in en koppelt bij het opslaan aan het echte catalogusproduct
// i.p.v. altijd een vrij artikel te maken.
function unique(arr: (string | null)[]): string[] {
  return Array.from(new Set(arr.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b))
}
const allBrands = computed(() => unique(props.products.map((p) => p.brand)))
const matchingProducts = computed(() =>
  props.products.filter((p) => p.name && (!brand.value.trim() || (p.brand ?? '').toLowerCase() === brand.value.trim().toLowerCase()))
)
const CODE_SEP = '  ·  '
function productLabel(p: CatalogProduct): string {
  return p.manufacturer_code ? `${p.name}${CODE_SEP}${p.manufacturer_code}` : (p.name ?? '')
}
function stripCode(label: string): string {
  return label.split(CODE_SEP)[0].trim()
}
const matchingArticleLabels = computed(() => unique(matchingProducts.value.map(productLabel)))

type SuggestField = 'brand' | 'article'
function suggestFilter(list: string[], typed: string): string[] {
  return fuzzyFilter(list, typed, 30)
}
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
  resolve: (field) => (field === 'brand' ? suggestFilter(allBrands.value, brand.value) : suggestFilter(matchingArticleLabels.value, description.value)),
  select: (field, val) => {
    if (field === 'brand') brand.value = val
    else description.value = stripCode(val)
  },
})

watch(description, (name) => {
  const n = name.trim().toLowerCase()
  if (!n) return
  const p = props.products.find((p) => (p.name ?? '').toLowerCase() === n)
  if (p?.brand) brand.value = p.brand
})

function matchProduct(): CatalogProduct | null {
  const name = description.value.trim().toLowerCase()
  if (!name) return null
  const matches = props.products.filter((p) => (p.name ?? '').toLowerCase() === name)
  if (!matches.length) return null
  const b = brand.value.trim().toLowerCase()
  if (b) {
    const withBrand = matches.find((p) => (p.brand ?? '').toLowerCase() === b)
    if (withBrand) return withBrand
  }
  return matches[0]
}

interface Candidate { article_id: string; label: string }
const candidates = ref<Candidate[]>([])

function labelFor(a: { serial_number: string | null; free_brand: string | null; free_description: string | null; product: { brand: string | null; name: string | null } | null }) {
  const s = a.product ? [a.product.brand, a.product.name].filter(Boolean).join(' ') : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  const sn = a.serial_number ? ` (SN ${a.serial_number})` : ''
  return (s || '?') + sn
}

onMounted(async () => {
  if (!isOnline.value) return
  const { data: memberRow } = await supabase
    .from('article_set_members')
    .select('set_id, article_sets!inner(customer_id)')
    .eq('article_id', props.mainArticleId)
    .eq('article_sets.customer_id', props.customerId)
    .maybeSingle()
  if (!memberRow) return

  const { data: members } = await supabase
    .from('article_set_members')
    .select('article_id, article:articles(serial_number, free_brand, free_description, retired, product:products(brand, name))')
    .eq('set_id', (memberRow as { set_id: string }).set_id)
    .neq('article_id', props.mainArticleId)
  type RawMember = { article_id: string; article: { serial_number: string | null; free_brand: string | null; free_description: string | null; retired: boolean; product: { brand: string | null; name: string | null } | null } }
  candidates.value = ((members ?? []) as unknown as RawMember[])
    .filter((m) => !m.article.retired)
    .map((m) => ({ article_id: m.article_id, label: labelFor(m.article) }))
})

async function save() {
  formError.value = ''
  if (!description.value.trim() && !brand.value.trim()) {
    formError.value = t('sets.addPart.errors.missing')
    return
  }
  saving.value = true
  try {
    const product = matchProduct()
    const { data: article, error: artErr } = await supabase
      .from('articles')
      .insert({
        customer_id: props.customerId,
        product_id: product?.id ?? null,
        free_brand: product ? null : (brand.value.trim() || null),
        free_description: product ? null : (description.value.trim() || null),
        serial_number: serial.value.trim() || null,
        manufacture_year: year.value || null,
        manufacture_month: month.value || null,
        suggest_for_catalog: false,
        retired: false,
      })
      .select('id')
      .single()
    if (artErr) throw artErr

    const { error: linkErr } = await supabase.rpc('get_or_create_article_set', {
      p_customer_id: props.customerId,
      p_primary_article_id: props.mainArticleId,
      p_primary_label: props.mainLabel,
      p_new_article_id: article.id,
      p_role: role.value.trim() || null,
      p_retire_article_id: replaceArticleId.value,
    })
    if (linkErr) throw linkErr

    emit('saved')
  } catch (e) {
    formError.value = errorMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.apd {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.apd__panel { background: #fff; border-radius: 16px; padding: 1.25rem; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; }
.apd__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem; }
.apd__title { margin: 0; font-size: 1.1rem; }
.apd__x { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #6b7280; }
.apd__label { margin: 0 0 0.75rem; font-size: 0.85rem; color: #6b7280; }
.apd__state { padding: 1rem 0; }
.apd__state--error { color: #dc2626; }
.apd__form { display: flex; flex-direction: column; gap: 0.6rem; }
.apd__field { position: relative; }
.apd__input {
  padding: 0.7rem 0.9rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
.apd__suggest {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 5;
  background: #fff; border: 1px solid #ddd; border-radius: 8px;
  margin-top: 0.25rem; padding: 0.3rem;
  display: flex; flex-direction: column; gap: 0.1rem;
  max-height: 200px; overflow-y: auto; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.apd__suggest-item {
  text-align: left; border: none; background: transparent; cursor: pointer;
  padding: 0.45rem 0.6rem; border-radius: 6px; font-size: 0.9rem;
  color: #111827; font-family: inherit;
}
.apd__suggest-item:hover { background: #f3f4f6; }
.apd__suggest-item--active { background: #e0e7ff; }
.apd__row { display: flex; gap: 0.6rem; }
.apd__input--sm { flex: 1; }
.apd__replace { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #374151; }
.apd__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.apd__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.apd__btn { flex: 1; padding: 0.8rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 600; cursor: pointer; }
.apd__btn--cancel { background: #f3f4f6; color: #374151; }
.apd__btn--save { background: #16a34a; color: #fff; }
.apd__btn:disabled { opacity: 0.6; }
</style>
