<!-- "Onderdeel toevoegen aan dit materiaal" (besloten met Jos 2026-07-11):
     zelfde flow als de Pro-app-tegenhanger (AddPartDialog.vue) maar dan voor
     de klant zelf -- een klimgordel is het hoofdartikel, een vervangen
     onderdeel (bv. een nieuwe brug met eigen SN) moet in één stap gekoppeld
     worden i.p.v. los toegevoegd en achteraf opgezocht. Klant-accounts hebben
     geen directe tabeltoegang (RLS-ronde 20260713), dus dit gaat via twee
     RPC's: add_my_article (bestaand) om het nieuwe artikel aan te maken, en
     get_or_create_article_set (gedeeld met de Pro-app) om te koppelen en
     optioneel het vervangen onderdeel af te voeren. -->
<template>
  <div class="apf" @click.self="$emit('close')">
    <div class="apf__panel">
      <div class="apf__head">
        <h3 class="apf__title">{{ $t('sets.addPart.title') }}</h3>
        <button type="button" class="apf__x" @click="$emit('close')">✕</button>
      </div>
      <p class="apf__label">{{ $t('sets.addPart.linkedTo', { name: mainLabel }) }}</p>

      <form class="apf__form" @submit.prevent="save">
        <input v-model="brand" class="apf__input" :placeholder="$t('home.addArticle.brand')" />
        <input v-model="description" class="apf__input" :placeholder="$t('home.addArticle.description')" />
        <input v-model="serial" class="apf__input" :placeholder="$t('home.addArticle.serial')" />
        <div class="apf__row">
          <input v-model.number="year" type="number" min="1990" max="2100" class="apf__input" :placeholder="$t('home.addArticle.year')" />
          <input v-model.number="month" type="number" min="1" max="12" class="apf__input" :placeholder="$t('home.addArticle.month')" />
        </div>
        <input v-model="role" class="apf__input" :placeholder="$t('sets.addPart.rolePlaceholder')" />

        <label v-if="candidates.length" class="apf__replace">
          {{ $t('sets.addPart.replaces') }}
          <select v-model="replaceArticleId" class="apf__input">
            <option :value="null">{{ $t('sets.addPart.replacesNone') }}</option>
            <option v-for="c in candidates" :key="c.article_id" :value="c.article_id">{{ c.label }}</option>
          </select>
        </label>

        <p v-if="formError" class="apf__error">{{ formError }}</p>
        <div class="apf__actions">
          <button type="button" class="apf__cancel" @click="$emit('close')">{{ $t('home.addArticle.cancel') }}</button>
          <button type="submit" class="apf__save" :disabled="saving">
            {{ saving ? $t('common.saving') : $t('home.addArticle.save') }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { supabase, errorMessage } from "@gearonimo/core";

const props = defineProps<{ customerId: string; mainArticleId: string; mainLabel: string }>();
const emit = defineEmits<{ (e: "saved"): void; (e: "close"): void }>();
const { t } = useI18n();

const brand = ref("");
const description = ref("");
const serial = ref("");
const year = ref<number | null>(null);
const month = ref<number | null>(null);
const role = ref("");
const replaceArticleId = ref<string | null>(null);
const saving = ref(false);
const formError = ref("");

interface Candidate { article_id: string; label: string }
const candidates = ref<Candidate[]>([]);

interface SetRow { set_id: string; article_id: string; article_label: string | null; serial_number: string | null }

onMounted(async () => {
  const { data } = await supabase.rpc("my_article_sets");
  const rows = (data ?? []) as SetRow[];
  const mine = rows.find((r) => r.article_id === props.mainArticleId);
  if (!mine) return;
  candidates.value = rows
    .filter((r) => r.set_id === mine.set_id && r.article_id !== props.mainArticleId)
    .map((r) => ({
      article_id: r.article_id,
      label: (r.article_label || "?") + (r.serial_number ? ` (SN ${r.serial_number})` : ""),
    }));
});

async function save() {
  formError.value = "";
  if (!description.value.trim()) {
    formError.value = t("sets.addPart.errors.missing");
    return;
  }
  saving.value = true;
  try {
    const { data: newArticleId, error: addErr } = await supabase.rpc("add_my_article", {
      p_free_brand: brand.value.trim() || null,
      p_free_description: description.value.trim(),
      p_serial_number: serial.value.trim() || null,
      p_manufacture_year: year.value || null,
      p_manufacture_month: month.value || null,
    });
    if (addErr) throw addErr;

    const { error: linkErr } = await supabase.rpc("get_or_create_article_set", {
      p_customer_id: props.customerId,
      p_primary_article_id: props.mainArticleId,
      p_primary_label: props.mainLabel,
      p_new_article_id: newArticleId,
      p_role: role.value.trim() || null,
      p_retire_article_id: replaceArticleId.value,
    });
    if (linkErr) throw linkErr;

    emit("saved");
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.apf {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.apf__panel { background: #fff; border-radius: 16px; padding: 1.25rem; width: 100%; max-width: 420px; max-height: 90vh; overflow-y: auto; }
.apf__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem; }
.apf__title { margin: 0; font-size: 1.1rem; }
.apf__x { background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #6b7280; }
.apf__label { margin: 0 0 0.75rem; font-size: 0.85rem; color: #6b7280; }
.apf__form { display: flex; flex-direction: column; gap: 0.5rem; }
.apf__input {
  border: 1px solid #d1d5db; border-radius: 8px; padding: 0.55rem 0.7rem;
  font-size: 0.95rem; width: 100%; box-sizing: border-box;
}
.apf__row { display: flex; gap: 0.5rem; }
.apf__replace { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #374151; }
.apf__error { margin: 0; color: #dc2626; font-size: 0.9rem; }
.apf__actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.apf__save {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.5rem 1rem; font-weight: 700; cursor: pointer; flex: 1;
}
.apf__save:disabled { opacity: 0.5; }
.apf__cancel { background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 1rem; color: #374151; cursor: pointer; flex: 1; }
</style>
