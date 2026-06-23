<template>
  <section class="cs">
    <div class="cs__head">
      <h2>{{ $t('sets.title') }}</h2>
      <button v-if="!showAdd" class="cs__add" @click="openAdd">+ {{ $t('sets.add') }}</button>
    </div>

    <div v-if="loading" class="cs__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="cs__state cs__state--error">{{ error }}</div>
    <p v-else-if="sets.length === 0 && !showAdd" class="cs__state">{{ $t('sets.empty') }}</p>

    <ul v-else-if="sets.length" class="cs__list">
      <li v-for="s in sets" :key="s.id" class="cs__item" @click="$router.push(`/sets/${s.id}`)">
        <div class="cs__name">{{ s.name }}</div>
        <div class="cs__meta">{{ s.memberCount }} {{ $t('sets.itemsSuffix') }}</div>
      </li>
    </ul>

    <div v-if="showAdd" class="cs__form">
      <h3>{{ $t('sets.add') }}</h3>
      <input v-model="form.name" :placeholder="$t('sets.fields.name')" class="cs__input" />

      <p class="cs__pick-label">{{ $t('sets.pickArticles') }}</p>
      <ul v-if="articles.length" class="cs__pick-list">
        <li v-for="a in articles" :key="a.id" class="cs__pick-item">
          <label class="cs__pick-row">
            <input type="checkbox" :value="a.id" v-model="form.articleIds" />
            {{ articleLabel(a) }}
          </label>
        </li>
      </ul>
      <p v-else class="cs__state">{{ $t('articles.empty') }}</p>

      <p v-if="formError" class="cs__error">{{ formError }}</p>
      <div class="cs__actions">
        <button class="cs__btn cs__btn--cancel" @click="closeAdd">{{ $t('common.cancel') }}</button>
        <button class="cs__btn cs__btn--save" :disabled="saving" @click="save">
          {{ saving ? $t('common.saving') : $t('common.save') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase } from '@gearonimo/core'

const props = defineProps<{ customerId: string }>()
const { t } = useI18n()

interface ProductMatch { id: string; brand: string | null; name: string | null }
interface Article {
  id: string
  serial_number: string | null
  free_brand: string | null
  free_description: string | null
  product: ProductMatch | null
}
interface SetRow { id: string; name: string; memberCount: number }

const sets = ref<SetRow[]>([])
const articles = ref<Article[]>([])
const loading = ref(true)
const error = ref('')

const showAdd = ref(false)
const saving = ref(false)
const formError = ref('')

function emptyForm() {
  return { name: '', articleIds: [] as string[] }
}
const form = ref(emptyForm())

function articleLabel(a: Article) {
  const s = a.product
    ? [a.product.brand, a.product.name].filter(Boolean).join(' ')
    : [a.free_brand, a.free_description].filter(Boolean).join(' ')
  const sn = a.serial_number ? ` (SN ${a.serial_number})` : ''
  return (s || t('articles.untitled')) + sn
}

async function load() {
  loading.value = true
  error.value = ''

  const [setsRes, articlesRes] = await Promise.all([
    supabase
      .from('article_sets')
      .select('id, name, article_set_members(count)')
      .eq('customer_id', props.customerId)
      .order('created_at', { ascending: false }),
    supabase
      .from('articles')
      .select('id, serial_number, free_brand, free_description, product:products(id, brand, name)')
      .eq('customer_id', props.customerId)
      .eq('retired', false)
      .order('created_at', { ascending: false }),
  ])

  if (setsRes.error) error.value = setsRes.error.message
  else {
    sets.value = (setsRes.data ?? []).map((s: any) => ({
      id: s.id,
      name: s.name,
      memberCount: s.article_set_members?.[0]?.count ?? 0,
    }))
  }
  articles.value = (articlesRes.data ?? []) as unknown as Article[]
  loading.value = false
}

function openAdd() { showAdd.value = true }
function closeAdd() {
  showAdd.value = false
  formError.value = ''
  form.value = emptyForm()
}

async function save() {
  formError.value = ''
  if (!form.value.name.trim()) { formError.value = t('sets.errors.nameRequired'); return }
  if (form.value.articleIds.length === 0) { formError.value = t('sets.errors.articlesRequired'); return }

  saving.value = true
  const { data: set, error: setErr } = await supabase
    .from('article_sets')
    .insert({ customer_id: props.customerId, name: form.value.name.trim() })
    .select('id')
    .single()

  if (setErr) { saving.value = false; formError.value = setErr.message; return }

  const { error: membersErr } = await supabase
    .from('article_set_members')
    .insert(form.value.articleIds.map((article_id) => ({ set_id: set.id, article_id })))

  saving.value = false
  if (membersErr) { formError.value = membersErr.message; return }
  closeAdd()
  await load()
}

onMounted(load)
</script>

<style scoped>
.cs { margin-top: 1.5rem; }
.cs__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.cs__head h2 { font-size: 1rem; margin: 0; }
.cs__add { background: none; border: none; color: #16a34a; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
.cs__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.cs__state--error { color: #dc2626; }
.cs__list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.cs__item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.cs__item:last-child { border-bottom: none; }
.cs__name { font-weight: 600; }
.cs__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }

.cs__form { background: #fff; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
.cs__form h3 { margin: 0 0 0.25rem; font-size: 1rem; }
.cs__input {
  padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 1rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
.cs__pick-label { margin: 0.25rem 0 0; font-size: 0.85rem; color: #6b7280; }
.cs__pick-list { list-style: none; margin: 0; padding: 0; border: 1px solid #e5e7eb; border-radius: 8px; max-height: 220px; overflow-y: auto; }
.cs__pick-item { border-bottom: 1px solid #f3f4f6; }
.cs__pick-item:last-child { border-bottom: none; }
.cs__pick-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.6rem 0.85rem; cursor: pointer; font-size: 0.95rem; }
.cs__error { color: #dc2626; font-size: 0.9rem; margin: 0; }
.cs__actions { display: flex; gap: 0.75rem; margin-top: 0.25rem; }
.cs__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 1rem; font-weight: 600; cursor: pointer; }
.cs__btn--cancel { background: #f3f4f6; color: #374151; }
.cs__btn--save { background: #16a34a; color: #fff; }
.cs__btn:disabled { opacity: 0.6; }
</style>
