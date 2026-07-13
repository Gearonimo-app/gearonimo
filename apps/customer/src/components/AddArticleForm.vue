<template>
  <form class="aa" @submit.prevent="save">
    <!-- Catalogus eerst: zoeken via search_products (zelfde fuzzy zoeker als
         de keurmeester gebruikt; de products-leespolicy geldt voor alle
         ingelogden). Geen match = vrije invoer, die automatisch de
         catalogus-wachtrij in gaat (add_my_article). -->
    <template v-if="!chosen && !freeMode">
      <!-- Merk is een keuzelijst (geen los zoekveld meer -- dat leek te veel
           op het naam-veld eronder, Jos 2026-07-13): kies een merk en blader
           zonder zoekterm door de hele catalogus van dat merk ("soms is een
           naam niet duidelijk en weet je het pas als je hem ziet"). Het
           naam/merk-zoekveld eronder blijft ernaast bestaan en versmalt
           verder. -->
      <select v-model="brand" class="aa__input aa__brand-select" @change="triggerSearch">
        <option value="">{{ $t('home.addArticle.allBrands') }}</option>
        <option v-for="b in brandOptions" :key="b" :value="b">{{ b }}</option>
      </select>
      <input
        ref="searchInput"
        v-model="q"
        class="aa__input"
        :placeholder="$t('home.addArticle.search')"
        autocomplete="off"
        @input="triggerSearch"
        @keydown="onKeydown"
      />
      <ul v-if="suggestions.length" class="aa__suggest">
        <li v-for="(s, i) in suggestions" :key="s.id">
          <button
            type="button"
            ref="itemRefs"
            class="aa__suggest-item"
            :class="{ 'aa__suggest-item--active': i === highlightIndex }"
            @click="choose(s)"
            @mouseenter="highlightIndex = i"
          >
            <strong>{{ s.brand }}</strong> {{ s.name }}
            <span v-if="s.product_type" class="aa__suggest-type">{{ s.product_type }}</span>
          </button>
        </li>
      </ul>
      <button type="button" class="aa__free-toggle" @click="openFreeMode">
        {{ $t('home.addArticle.freeToggle') }}
      </button>
    </template>

    <div v-if="chosen" class="aa__chosen">
      <span><strong>{{ chosen.brand }}</strong> {{ chosen.name }}</span>
      <button type="button" class="aa__chosen-clear" @click="clearChosen">✕</button>
    </div>

    <template v-if="freeMode">
      <input ref="descriptionInput" v-model="freeDescription" class="aa__input" :placeholder="$t('home.addArticle.description')" />
      <input v-model="freeBrand" class="aa__input" :placeholder="$t('home.addArticle.brand')" />
      <input v-model="freeCategory" class="aa__input" :placeholder="$t('home.addArticle.category')" />
      <p class="aa__note">{{ $t('home.addArticle.queueNote') }}</p>
      <button type="button" class="aa__free-toggle" @click="backToSearch">
        {{ $t('home.addArticle.backToSearch') }}
      </button>
    </template>

    <input ref="serialInput" v-model="serial" class="aa__input" :placeholder="$t('home.addArticle.serial')" />
    <!-- Gebruiker: typeahead op de medewerkerslijst (Jos, 2026-07-13: "piet"
         en "Piet" stonden er al naast elkaar) -- zelfde patroon/composable
         als de Pro-app (useFieldSuggest, CustomerArticles.vue). Vrije invoer
         blijft mogelijk voor wie niet als medewerker geregistreerd staat. -->
    <div class="aa__field">
      <input
        v-model="userName"
        class="aa__input"
        :placeholder="$t('home.addArticle.user')"
        autocomplete="off"
        @focus="activeField = 'user'"
        @blur="closeSuggest"
        @keydown="onSuggestKeydown"
      />
      <ul v-if="activeField === 'user' && userSuggestions.length" class="aa__suggest">
        <li v-for="(s, i) in userSuggestions" :key="s">
          <button
            type="button"
            ref="userItemRefs"
            class="aa__suggest-item"
            :class="{ 'aa__suggest-item--active': i === suggestIndex }"
            @mousedown.prevent="pickSuggestion(s)"
            @mouseenter="suggestIndex = i"
          >{{ s }}</button>
        </li>
      </ul>
    </div>
    <div class="aa__row">
      <input v-model.number="year" type="number" min="1990" max="2100" class="aa__input" :placeholder="$t('home.addArticle.year')" />
      <input v-model.number="month" type="number" min="1" max="12" class="aa__input" :placeholder="$t('home.addArticle.month')" />
    </div>
    <!-- Aankoopdatum is leidend (zelfde lijn als de Pro-app,
         CustomerArticles.vue): de ingebruiknamedatum spiegelt 'm standaard
         totdat je die zelf aanpast. -->
    <label class="aa__date">
      {{ $t('home.addArticle.purchaseDate') }}
      <input v-model="purchaseDate" type="date" class="aa__input" />
    </label>
    <label class="aa__date">
      {{ $t('home.addArticle.firstUse') }}
      <input v-model="firstUse" type="date" class="aa__input" @input="firstUseTouched = true" />
    </label>

    <p v-if="formError" class="aa__error">{{ formError }}</p>
    <div class="aa__actions">
      <button type="submit" class="aa__save" :disabled="saving">{{ $t('home.addArticle.save') }}</button>
      <button type="button" class="aa__cancel" @click="$emit('close')">{{ $t('home.addArticle.cancel') }}</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { supabase, errorMessage } from "@gearonimo/core";
import { useFieldSuggest, fuzzyFilter } from "@gearonimo/ui";

// knownUsers: de namen die al op andere artikelen van deze klant staan
// (Materials.vue's memberNames). Nodig naast de officiële medewerkerslijst
// (my_members): "Piet"/"piet" waren nooit als medewerker toegevoegd, alleen
// getypt op een ander artikel -- zonder deze bron bleef de typeahead leeg
// voor precies de namen die de duplicatie veroorzaakten (Jos, 2026-07-13).
const props = defineProps<{ knownUsers?: string[] }>();
const emit = defineEmits<{ (e: "close"): void; (e: "added"): void }>();
const { t } = useI18n();

interface ProductHit {
  id: string;
  brand: string | null;
  name: string | null;
  product_type: string | null;
}

const q = ref("");
const brand = ref("");
const brandOptions = ref<string[]>([]);
const suggestions = ref<ProductHit[]>([]);
const highlightIndex = ref(-1);
const itemRefs = ref<HTMLElement[]>([]);
const chosen = ref<ProductHit | null>(null);
const freeMode = ref(false);
const freeDescription = ref("");
const freeBrand = ref("");
const freeCategory = ref("");
const serial = ref("");
const userName = ref("");
const year = ref<number | null>(null);
const month = ref<number | null>(null);
const purchaseDate = ref("");
const firstUse = ref("");
const firstUseTouched = ref(false);
const saving = ref(false);
const formError = ref("");

watch(purchaseDate, (v) => {
  if (!firstUseTouched.value) firstUse.value = v;
});

const memberNames = ref<string[]>([]);

onMounted(async () => {
  const [brandsRes, membersRes] = await Promise.all([
    supabase.rpc("list_product_brands"),
    supabase.rpc("my_members"),
  ]);
  brandOptions.value = ((brandsRes.data ?? []) as { brand: string }[]).map((r) => r.brand);
  const registeredNames = ((membersRes.data ?? []) as { name: string; active: boolean }[])
    .filter((m) => m.active)
    .map((m) => m.name);
  // Beide bronnen samen, exacte duplicaten eruit -- verschillende
  // schrijfwijzen ("piet"/"Piet") blijven bewust allebei zichtbaar, dat is
  // eerlijker dan er zomaar één van te laten verdwijnen.
  memberNames.value = [...new Set([...registeredNames, ...(props.knownUsers ?? [])])];
});

// Gebruiker-typeahead: zelfde composable als de Pro-app (packages/ui),
// hier met één veld ("user").
type SuggestField = "user";
const {
  activeField,
  suggestIndex,
  suggestions: userSuggestions,
  itemRefs: userItemRefs,
  pick: pickSuggestion,
  close: closeSuggest,
  onKeydown: onSuggestKeydown,
} = useFieldSuggest<SuggestField>({
  resolve: () => fuzzyFilter(memberNames.value, userName.value),
  select: (_field, value) => {
    userName.value = value;
  },
  scrollToActive: true,
});

let searchTimer: ReturnType<typeof setTimeout> | undefined;
function triggerSearch() {
  clearTimeout(searchTimer);
  const term = q.value.trim();
  const brandTerm = brand.value;
  // Merk alleen (nog) geen naam getypt mag ook al resultaten tonen: dat is
  // het "bladeren door een merk"-geval.
  if (term.length < 2 && !brandTerm) {
    suggestions.value = [];
    highlightIndex.value = -1;
    return;
  }
  const browsing = term.length === 0 && !!brandTerm;
  searchTimer = setTimeout(async () => {
    const { data } = await supabase.rpc("search_products", {
      q: term || null,
      brand_filter: brandTerm || null,
      limit_count: browsing ? 50 : 15,
    });
    suggestions.value = (data ?? []) as ProductHit[];
    highlightIndex.value = -1;
  }, 250);
}

function onKeydown(e: KeyboardEvent) {
  if (!suggestions.value.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlightIndex.value = (highlightIndex.value + 1) % suggestions.value.length;
    scrollActiveIntoView();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlightIndex.value = highlightIndex.value <= 0 ? suggestions.value.length - 1 : highlightIndex.value - 1;
    scrollActiveIntoView();
  } else if (e.key === "Enter" && highlightIndex.value >= 0) {
    e.preventDefault();
    choose(suggestions.value[highlightIndex.value]);
  } else if (e.key === "Escape") {
    suggestions.value = [];
    highlightIndex.value = -1;
  }
}

function scrollActiveIntoView() {
  nextTick(() => itemRefs.value[highlightIndex.value]?.scrollIntoView({ block: "nearest" }));
}

// Refs voor de focus-fix hieronder: kiezen/wisselen van modus verwijdert het
// blok met het net-geklikte element uit de DOM (v-if), waarna de browser de
// focus kwijtraakt en terugvalt op <body> -- Tab begint dan weer helemaal
// bovenaan de pagina i.p.v. bij het volgende veld (Jos, 2026-07-13). Door na
// zo'n wissel expliciet een veld te focussen, blijft Tab een zinnig pad
// volgen.
const searchInput = ref<HTMLInputElement | null>(null);
const descriptionInput = ref<HTMLInputElement | null>(null);
const serialInput = ref<HTMLInputElement | null>(null);

function choose(s: ProductHit) {
  chosen.value = s;
  suggestions.value = [];
  highlightIndex.value = -1;
  q.value = "";
  nextTick(() => serialInput.value?.focus());
}

function clearChosen() {
  chosen.value = null;
  nextTick(() => searchInput.value?.focus());
}

// "Zelf invullen": neemt over wat er al in het zoekveld stond, i.p.v. de
// gebruiker te laten retypen wat hij net al typte (Jos, 2026-07-13: "vrije
// invoer lukt niet ... maar omschrijving staat al ingevuld").
function openFreeMode() {
  if (!freeDescription.value.trim() && q.value.trim()) {
    freeDescription.value = q.value.trim();
  }
  freeMode.value = true;
  nextTick(() => descriptionInput.value?.focus());
}

function backToSearch() {
  freeMode.value = false;
  nextTick(() => searchInput.value?.focus());
}

async function save() {
  formError.value = "";
  // Zelfde reden als hierboven: een getypte zoekterm zonder gekozen product
  // of expliciete "Zelf invullen" telt óók als omschrijving -- niets kiezen
  // en op Toevoegen klikken hoort niet stil te falen op een tekst die er al
  // stond.
  const description = freeDescription.value.trim() || q.value.trim();
  if (!chosen.value && !description) {
    formError.value = t("home.addArticle.needProductOrDescription");
    return;
  }
  saving.value = true;
  try {
    const { error: err } = await supabase.rpc("add_my_article", {
      p_product_id: chosen.value?.id ?? null,
      p_free_brand: chosen.value ? null : freeBrand.value.trim() || null,
      p_free_category: chosen.value ? null : freeCategory.value.trim() || null,
      p_free_description: chosen.value ? null : description || null,
      p_serial_number: serial.value.trim() || null,
      p_assigned_user_name: userName.value.trim() || null,
      p_manufacture_year: year.value || null,
      p_manufacture_month: month.value || null,
      p_first_use_date: firstUse.value || null,
      p_purchase_date: purchaseDate.value || null,
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
.aa__brand-select { background: #fff; color: #111827; }
.aa__row { display: flex; gap: 0.5rem; }
.aa__field { position: relative; }
.aa__field .aa__suggest { position: absolute; top: calc(100% + 0.25rem); left: 0; right: 0; z-index: 10; background: #fff; }
.aa__suggest {
  list-style: none; margin: 0; padding: 0;
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
  max-height: 260px; overflow-y: auto;
}
.aa__suggest li + li { border-top: 1px solid #f3f4f6; }
.aa__suggest-item {
  display: block; width: 100%; text-align: left; background: none; border: none;
  padding: 0.55rem 0.7rem; cursor: pointer; font-size: 0.9rem;
}
.aa__suggest-item:hover, .aa__suggest-item--active { background: #f0fdf4; }
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
