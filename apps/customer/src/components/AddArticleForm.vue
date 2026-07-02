<template>
  <form class="aa" @submit.prevent="save">
    <!-- Catalogus eerst: zoeken via search_products (zelfde fuzzy zoeker als
         de keurmeester gebruikt; de products-leespolicy geldt voor alle
         ingelogden). Geen match = vrije invoer, die automatisch de
         catalogus-wachtrij in gaat (add_my_article). -->
    <template v-if="!chosen && !freeMode">
      <input
        v-model="q"
        class="aa__input"
        :placeholder="$t('home.addArticle.search')"
        autocomplete="off"
        @input="onSearch"
      />
      <ul v-if="suggestions.length" class="aa__suggest">
        <li v-for="s in suggestions" :key="s.id">
          <button type="button" class="aa__suggest-item" @click="choose(s)">
            <strong>{{ s.brand }}</strong> {{ s.name }}
            <span v-if="s.product_type" class="aa__suggest-type">{{ s.product_type }}</span>
          </button>
        </li>
      </ul>
      <button type="button" class="aa__free-toggle" @click="freeMode = true">
        {{ $t('home.addArticle.freeToggle') }}
      </button>
    </template>

    <div v-if="chosen" class="aa__chosen">
      <span><strong>{{ chosen.brand }}</strong> {{ chosen.name }}</span>
      <button type="button" class="aa__chosen-clear" @click="clearChosen">✕</button>
    </div>

    <template v-if="freeMode">
      <input v-model="freeDescription" class="aa__input" :placeholder="$t('home.addArticle.description')" />
      <input v-model="freeBrand" class="aa__input" :placeholder="$t('home.addArticle.brand')" />
      <input v-model="freeCategory" class="aa__input" :placeholder="$t('home.addArticle.category')" />
      <p class="aa__note">{{ $t('home.addArticle.queueNote') }}</p>
      <button type="button" class="aa__free-toggle" @click="freeMode = false">
        {{ $t('home.addArticle.backToSearch') }}
      </button>
    </template>

    <input v-model="serial" class="aa__input" :placeholder="$t('home.addArticle.serial')" />
    <input v-model="userName" class="aa__input" :placeholder="$t('home.addArticle.user')" />
    <div class="aa__row">
      <input v-model.number="year" type="number" min="1990" max="2100" class="aa__input" :placeholder="$t('home.addArticle.year')" />
      <input v-model.number="month" type="number" min="1" max="12" class="aa__input" :placeholder="$t('home.addArticle.month')" />
    </div>
    <label class="aa__date">
      {{ $t('home.addArticle.firstUse') }}
      <input v-model="firstUse" type="date" class="aa__input" />
    </label>

    <p v-if="formError" class="aa__error">{{ formError }}</p>
    <div class="aa__actions">
      <button type="submit" class="aa__save" :disabled="saving">{{ $t('home.addArticle.save') }}</button>
      <button type="button" class="aa__cancel" @click="$emit('close')">{{ $t('home.addArticle.cancel') }}</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { supabase, errorMessage } from "@gearonimo/core";

const emit = defineEmits<{ (e: "close"): void; (e: "added"): void }>();
const { t } = useI18n();

interface ProductHit {
  id: string;
  brand: string | null;
  name: string | null;
  product_type: string | null;
}

const q = ref("");
const suggestions = ref<ProductHit[]>([]);
const chosen = ref<ProductHit | null>(null);
const freeMode = ref(false);
const freeDescription = ref("");
const freeBrand = ref("");
const freeCategory = ref("");
const serial = ref("");
const userName = ref("");
const year = ref<number | null>(null);
const month = ref<number | null>(null);
const firstUse = ref("");
const saving = ref(false);
const formError = ref("");

let searchTimer: ReturnType<typeof setTimeout> | undefined;
function onSearch() {
  clearTimeout(searchTimer);
  const term = q.value.trim();
  if (term.length < 2) {
    suggestions.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    const { data } = await supabase.rpc("search_products", { q: term, brand_filter: null });
    suggestions.value = (data ?? []) as ProductHit[];
  }, 250);
}

function choose(s: ProductHit) {
  chosen.value = s;
  suggestions.value = [];
  q.value = "";
}

function clearChosen() {
  chosen.value = null;
}

async function save() {
  formError.value = "";
  if (!chosen.value && !freeDescription.value.trim()) {
    formError.value = t("home.addArticle.needProductOrDescription");
    return;
  }
  saving.value = true;
  try {
    const { error: err } = await supabase.rpc("add_my_article", {
      p_product_id: chosen.value?.id ?? null,
      p_free_brand: chosen.value ? null : freeBrand.value.trim() || null,
      p_free_category: chosen.value ? null : freeCategory.value.trim() || null,
      p_free_description: chosen.value ? null : freeDescription.value.trim() || null,
      p_serial_number: serial.value.trim() || null,
      p_assigned_user_name: userName.value.trim() || null,
      p_manufacture_year: year.value || null,
      p_manufacture_month: month.value || null,
      p_first_use_date: firstUse.value || null,
    });
    if (err) throw err;
    emit("added");
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.aa {
  background: #fff; border-radius: 12px; padding: 1rem; margin-bottom: 0.85rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.aa__input {
  border: 1px solid #d1d5db; border-radius: 8px; padding: 0.55rem 0.7rem;
  font-size: 0.95rem; width: 100%; box-sizing: border-box;
}
.aa__row { display: flex; gap: 0.5rem; }
.aa__suggest {
  list-style: none; margin: 0; padding: 0;
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
}
.aa__suggest li + li { border-top: 1px solid #f3f4f6; }
.aa__suggest-item {
  display: block; width: 100%; text-align: left; background: none; border: none;
  padding: 0.55rem 0.7rem; cursor: pointer; font-size: 0.9rem;
}
.aa__suggest-item:hover { background: #f0fdf4; }
.aa__suggest-type { color: #6b7280; font-size: 0.8rem; margin-left: 0.35rem; }
.aa__free-toggle {
  background: none; border: none; color: #16a34a; cursor: pointer;
  font-size: 0.85rem; text-align: left; padding: 0;
}
.aa__chosen {
  display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
  background: #dcfce7; color: #166534; border-radius: 8px; padding: 0.5rem 0.7rem;
  font-size: 0.9rem;
}
.aa__chosen-clear { background: none; border: none; color: #166534; cursor: pointer; font-weight: 700; }
.aa__note { margin: 0; font-size: 0.8rem; color: #6b7280; }
.aa__date { font-size: 0.85rem; color: #374151; display: flex; flex-direction: column; gap: 0.25rem; }
.aa__error { margin: 0; color: #dc2626; font-size: 0.9rem; }
.aa__actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.aa__save {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.5rem 1rem; font-weight: 700; cursor: pointer;
}
.aa__save:disabled { opacity: 0.5; }
.aa__cancel { background: none; border: none; color: #6b7280; cursor: pointer; }
</style>
