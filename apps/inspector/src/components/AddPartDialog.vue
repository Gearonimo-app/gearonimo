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
        <input v-model="brand" class="apd__input" :placeholder="$t('inspections.table.brand')" />
        <input v-model="description" class="apd__input" :placeholder="$t('inspections.table.article')" />
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { supabase, useOnline, errorMessage } from '@gearonimo/core'

const props = defineProps<{ customerId: string; mainArticleId: string; mainLabel: string }>()
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
    const { data: article, error: artErr } = await supabase
      .from('articles')
      .insert({
        customer_id: props.customerId,
        free_brand: brand.value.trim() || null,
        free_description: description.value.trim() || null,
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
.apd__input {
  padding: 0.7rem 0.9rem; border-radius: 8px; border: 1px solid #ddd;
  font-size: 0.95rem; width: 100%; box-sizing: border-box; font-family: inherit;
}
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
