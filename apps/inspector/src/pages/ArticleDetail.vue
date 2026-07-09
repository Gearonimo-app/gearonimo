<template>
  <div class="ad">
    <header class="ad__header">
      <div class="ad__nav">
        <button class="ad__icon" @click="back">←</button>
        <button class="ad__icon" :title="$t('common.home')" @click="$router.push('/')">🏠</button>
      </div>
      <h1>{{ articleLabel || $t('articles.title') }}</h1>
      <button v-if="article && !editMode && isOnline" class="ad__icon" @click="startEdit">✎</button>
    </header>

    <div v-if="loading" class="ad__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ad__state ad__state--error">{{ error }}</div>
    <div v-else-if="!article" class="ad__state">{{ $t('articles.detail.notFound') }}</div>

    <!-- Bekijken -->
    <div v-else-if="!editMode" class="ad__body">
      <span v-if="article.retired" class="ad__retired-badge">{{ $t('articles.detail.retiredBadge') }}</span>
      <dl class="ad__list">
        <div class="ad__view-row">
          <dt>{{ $t('articles.fields.brand') }}</dt>
          <dd>{{ brandLabel }}</dd>
        </div>
        <template v-for="f in fieldDefs" :key="f.col">
          <div v-if="article[f.col] !== null && article[f.col] !== ''" class="ad__view-row">
            <dt>{{ label(f.label) }}</dt>
            <dd>{{ displayValue(f, article[f.col]) }}</dd>
          </div>
        </template>
      </dl>
      <button v-if="!article.retired && isOnline" class="ad__retire" @click="openRetire">
        {{ $t('articles.detail.retire') }}
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

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  supabase,
  useOnline,
  useOfflineSession,
  getArticle,
  getProducts,
  errorMessage,
} from '@gearonimo/core'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = route.params.id as string
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
const loading = ref(true)
const error = ref('')
const editMode = ref(false)
const saving = ref(false)
const retiring = ref(false)
const formError = ref('')
const showRetire = ref(false)
const everCertified = ref(true)
// Bewerk-formulier wordt dynamisch uit fieldDefs opgebouwd (tekst, getal,
// checkbox door elkaar) en via v-model gebonden; één concreet type past hier
// niet, vandaar bewust Record<string, any> voor alleen dit formulierobject.
const form = ref<Record<string, any>>({})

const brandLabel = computed(() => {
  const a = article.value
  if (!a) return ''
  return a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
})
const articleLabel = computed(() => brandLabel.value || t('articles.untitled'))

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
      const cached = await getArticle<ArticleRecord & { product_id: string | null }>(key, id)
      if (cached) {
        const product = cached.product_id
          ? ((await getProducts<{ id: string; brand: string | null; name: string | null }>(key, [cached.product_id]))[0] ?? null)
          : null
        article.value = { ...cached, product }
      } else {
        article.value = null
      }
    } catch (e) {
      error.value = errorMessage(e)
    }
    loading.value = false
    return
  }

  const { data, error: err } = await supabase
    .from('articles')
    .select('*, product:products(id, brand, name)')
    .eq('id', id)
    .maybeSingle()
  if (err) error.value = err.message
  else article.value = data
  loading.value = false
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
    .eq('id', id)
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
    .eq('article_id', id)
    .eq('inspections.status', 'completed')
    .limit(1)
  everCertified.value = !!(data && data.length)
  showRetire.value = true
}

async function remove() {
  retiring.value = true
  const { error: err } = await supabase.from('articles').delete().eq('id', id)
  retiring.value = false
  showRetire.value = false
  if (err) { error.value = err.message; return }
  back()
}

async function retire() {
  retiring.value = true
  const { data, error: err } = await supabase
    .from('articles')
    .update({ retired: true, retired_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, product:products(id, brand, name)')
    .single()
  retiring.value = false
  showRetire.value = false
  if (err) { error.value = err.message; return }
  article.value = data
}

function back() {
  if (article.value?.customer_id) router.push(`/customers/${article.value.customer_id}`)
  else router.back()
}

onMounted(load)

// Na ontgrendelen via de statusbalk alsnog uit de cache laden (zie Customers.vue).
watch(useOfflineSession().isUnlocked, (unlocked) => {
  if (unlocked) void load()
})
</script>

<style scoped>
.ad { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.ad__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.ad__nav { display: flex; align-items: center; gap: 0.15rem; }
.ad__header h1 { font-size: 1.2rem; margin: 0; flex: 1; text-align: center; }
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
.ad__retire {
  margin-top: 1.5rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: 1px solid #fecaca; background: #fff; color: #dc2626;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}

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
