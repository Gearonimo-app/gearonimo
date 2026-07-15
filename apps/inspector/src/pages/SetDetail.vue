<template>
  <div class="sd">
    <AppHeader :title="set?.name || $t('sets.title')" @back="back">
      <button v-if="set && !editMode && isOnline" class="sd__icon" @click="startEdit">✎</button>
    </AppHeader>

    <div v-if="loading" class="sd__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="sd__state sd__state--error">{{ error }}</div>
    <div v-else-if="!set" class="sd__state">{{ $t('sets.detail.notFound') }}</div>

    <div v-else class="sd__body">
      <!-- Naam bewerken -->
      <div v-if="editMode" class="sd__field">
        <input v-model="nameForm" class="sd__input" />
        <div class="sd__actions">
          <button class="sd__btn sd__btn--cancel" @click="editMode = false">{{ $t('common.cancel') }}</button>
          <button class="sd__btn sd__btn--save" :disabled="saving" @click="saveName">
            {{ saving ? $t('common.saving') : $t('common.save') }}
          </button>
        </div>
      </div>

      <ul class="sd__list">
        <li v-for="m in members" :key="m.id" class="sd__item">
          <div class="sd__desc" @click="$router.push(`/articles/${m.article_id}`)">{{ m.label }}</div>
          <button v-if="isOnline" class="sd__remove" @click="removeMember(m.id)">×</button>
        </li>
        <li v-if="members.length === 0" class="sd__state">{{ $t('sets.detail.noMembers') }}</li>
      </ul>

      <!-- Artikel toevoegen aan set (online-only, net als de andere
           set-bewerkingen: offline is de set alleen-lezen) -->
      <div v-if="!showAddArticle && isOnline" class="sd__add-row">
        <button class="sd__add" @click="openAddArticle">+ {{ $t('sets.detail.addArticle') }}</button>
      </div>
      <div v-else class="sd__form">
        <ul v-if="addableArticles.length" class="sd__pick-list">
          <li v-for="a in addableArticles" :key="a.id" class="sd__pick-item" @click="addMember(a.id)">
            {{ a.label }}
          </li>
        </ul>
        <p v-else class="sd__state">{{ $t('sets.detail.noneToAdd') }}</p>
        <button class="sd__btn sd__btn--cancel" @click="showAddArticle = false">{{ $t('common.cancel') }}</button>
      </div>

      <p v-if="formError" class="sd__error">{{ formError }}</p>
      <button v-if="isOnline" class="sd__delete" @click="showDelete = true">{{ $t('sets.detail.deleteSet') }}</button>
    </div>

    <div v-if="showDelete" class="sd__overlay" @click.self="showDelete = false">
      <div class="sd__dialog">
        <h2>{{ $t('sets.detail.deleteTitle') }}</h2>
        <p>{{ $t('sets.detail.deleteBody') }}</p>
        <div class="sd__actions">
          <button class="sd__btn sd__btn--cancel" @click="showDelete = false">{{ $t('common.cancel') }}</button>
          <button class="sd__btn sd__btn--danger" :disabled="deleting" @click="deleteSet">{{ $t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue'
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  supabase,
  useOnline,
  useOfflineSession,
  getArticleSet,
  getArticlesForCustomer,
  getProducts,
  errorMessage,
} from '@gearonimo/core'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const id = route.params.id as string
const { isOnline } = useOnline()

interface ProductMatch { id: string; brand: string | null; name: string | null }
interface ArticleRow {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_description: string | null
  product: ProductMatch | null
}
interface MemberRow { id: string; article_id: string; label: string }
interface RawMember { id: string; article_id: string; article: ArticleRow }
interface SetRecord { name: string | null; customer_id: string }

const set = ref<SetRecord | null>(null)
const members = ref<MemberRow[]>([])
const addableArticles = ref<{ id: string; label: string }[]>([])
const loading = ref(true)
const error = ref('')
const formError = ref('')

const editMode = ref(false)
const nameForm = ref('')
const saving = ref(false)
const showAddArticle = ref(false)
const showDelete = ref(false)
const deleting = ref(false)

function articleLabel(a: ArticleRow) {
  const s = a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  const sn = a.serial_number ? ` (SN ${a.serial_number})` : ''
  return (s || t('articles.untitled')) + sn
}

async function load() {
  loading.value = true
  error.value = ''

  // Offline: set + leden uit de versleutelde cache; de artikel-labels worden
  // uit de eigen artikel-/productcache van de klant geresolved. Alleen-lezen
  // (alle bewerkknoppen zijn offline verborgen).
  if (!isOnline.value) {
    try {
      const key = useOfflineSession().getKey()
      const cachedSet = await getArticleSet<{
        id: string
        name: string | null
        customer_id: string
        article_set_members?: { id: string; article_id: string }[]
      }>(key, id)
      set.value = cachedSet ? { name: cachedSet.name, customer_id: cachedSet.customer_id } : null
      if (cachedSet) {
        const articles = await getArticlesForCustomer<ArticleRow & { product_id: string | null }>(
          key,
          cachedSet.customer_id
        )
        const productIds = [...new Set(articles.map((a) => a.product_id).filter((p): p is string => !!p))]
        const products = await getProducts<ProductMatch>(key, productIds)
        const productById = new Map(products.map((p) => [p.id, p]))
        const articleById = new Map(
          articles.map((a) => [a.id, { ...a, product: a.product_id ? productById.get(a.product_id) ?? null : null }])
        )
        members.value = (cachedSet.article_set_members ?? []).map((m) => {
          const article = articleById.get(m.article_id)
          return {
            id: m.id,
            article_id: m.article_id,
            label: article ? articleLabel(article) : t('articles.untitled'),
          }
        })
      }
    } catch (e) {
      error.value = errorMessage(e)
    }
    loading.value = false
    return
  }

  const { data: setData, error: setErr } = await supabase
    .from('article_sets')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (setErr) { error.value = setErr.message; loading.value = false; return }
  set.value = setData
  if (!setData) { loading.value = false; return }

  const { data: memberData, error: memberErr } = await supabase
    .from('article_set_members')
    .select('id, article_id, article:articles(id, serial_number, free_brand, free_description, product:products(id, brand, name))')
    .eq('set_id', id)
  if (memberErr) { error.value = memberErr.message; loading.value = false; return }
  members.value = ((memberData ?? []) as unknown as RawMember[]).map((m) => ({
    id: m.id,
    article_id: m.article_id,
    label: articleLabel(m.article),
  }))

  loading.value = false
}

async function openAddArticle() {
  formError.value = ''
  const memberIds = new Set(members.value.map((m) => m.article_id))
  const { data } = await supabase
    .from('articles')
    .select('id, serial_number, free_brand, free_description, product:products(id, brand, name)')
    .eq('customer_id', set.value!.customer_id)
    .eq('retired', false)
  addableArticles.value = ((data ?? []) as unknown as ArticleRow[])
    .filter((a) => !memberIds.has(a.id))
    .map((a) => ({ id: a.id, label: articleLabel(a) }))
  showAddArticle.value = true
}

async function addMember(articleId: string) {
  const { error: err } = await supabase
    .from('article_set_members')
    .insert({ set_id: id, article_id: articleId })
  if (err) { formError.value = err.message; return }
  showAddArticle.value = false
  await load()
}

async function removeMember(memberId: string) {
  const { error: err } = await supabase.from('article_set_members').delete().eq('id', memberId)
  if (err) { formError.value = err.message; return }
  await load()
}

function startEdit() { nameForm.value = set.value?.name ?? ''; editMode.value = true }

async function saveName() {
  if (!nameForm.value.trim()) { formError.value = t('sets.errors.nameRequired'); return }
  saving.value = true
  const { data, error: err } = await supabase
    .from('article_sets')
    .update({ name: nameForm.value.trim() })
    .eq('id', id)
    .select('*')
    .single()
  saving.value = false
  if (err) { formError.value = err.message; return }
  set.value = data
  editMode.value = false
}

async function deleteSet() {
  deleting.value = true
  const { error: err } = await supabase.from('article_sets').delete().eq('id', id)
  deleting.value = false
  showDelete.value = false
  if (err) { error.value = err.message; return }
  router.push(`/customers/${set.value?.customer_id}`)
}

function back() {
  if (set.value?.customer_id) router.push(`/customers/${set.value.customer_id}`)
  else router.back()
}

onMounted(load)

// Na ontgrendelen via de statusbalk alsnog uit de cache laden (zie Customers.vue).
watch(useOfflineSession().isUnlocked, (unlocked) => {
  if (unlocked) void load()
})
</script>

<style scoped>
.sd { min-height: 100vh; background: #f0f4f8; display: flex; flex-direction: column; }
.sd__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.sd__nav { display: flex; align-items: center; gap: 0.15rem; }
.sd__header h1 { font-size: 1.2rem; margin: 0; flex: 1; text-align: center; }
.sd__icon {
  background: none; border: none; color: #fff; font-size: 1.3rem;
  cursor: pointer; padding: 0.25rem 0.5rem; min-width: 2rem;
}
.sd__state { text-align: center; padding: 1.5rem 1rem; color: #666; }
.sd__state--error { color: #dc2626; }
.sd__body { padding: 1.25rem; }

.sd__list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.sd__item { display: flex; align-items: center; justify-content: space-between; padding: 0.85rem 1rem; border-bottom: 1px solid #eee; }
.sd__item:last-child { border-bottom: none; }
.sd__desc { font-weight: 600; cursor: pointer; flex: 1; }
.sd__remove { background: none; border: none; color: #dc2626; font-size: 1.2rem; cursor: pointer; padding: 0 0.4rem; }

.sd__add-row { margin-bottom: 1rem; }
.sd__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.sd__form { background: #fff; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.sd__pick-list { list-style: none; margin: 0; padding: 0; border: 1px solid #e5e7eb; border-radius: 8px; max-height: 220px; overflow-y: auto; }
.sd__pick-item { padding: 0.6rem 0.85rem; cursor: pointer; border-bottom: 1px solid #f3f4f6; }
.sd__pick-item:last-child { border-bottom: none; }

.sd__field { margin-bottom: 1rem; }
.sd__input {
  width: 100%; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; font-family: inherit; margin-bottom: 0.6rem;
}
.sd__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.5rem; }
.sd__actions { display: flex; gap: 0.75rem; }
.sd__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.sd__btn--cancel { background: #f3f4f6; color: #374151; }
.sd__btn--save { background: #16a34a; color: #fff; }
.sd__btn--danger { background: #dc2626; color: #fff; }
.sd__btn:disabled { opacity: 0.6; }
.sd__delete {
  margin-top: 0.5rem; width: 100%; padding: 0.85rem; border-radius: 10px;
  border: 1px solid #fecaca; background: #fff; color: #dc2626;
  font-size: 1rem; font-weight: 600; cursor: pointer;
}

.sd__overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.sd__dialog { background: #fff; border-radius: 16px; padding: 1.5rem; width: 100%; max-width: 360px; }
.sd__dialog h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
.sd__dialog p { margin: 0 0 0.5rem; color: #4b5563; }
</style>
