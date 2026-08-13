<!-- Artikeldetail (Jos, 2026-07-13): tot nu toe kon een toegevoegd artikel
     nergens teruggevonden of aangepast worden. Iedereen kan hier alles
     terugzien (incl. de ingebruiknamedatum); alleen de beheerder mag iets
     wijzigen, en dan alleen gebruiker, aankoopdatum en (eenmalig, DATAMODEL
     besloten 2026-06-14) de ingebruiknamedatum -- de rest blijft bewust
     vast. -->
<template>
  <div class="ad">
    <PageHeader back :title="headerTitle" />

    <div v-if="loading" class="ad__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ad__state ad__state--error">{{ error }}</div>
    <div v-else-if="!article" class="ad__state">{{ $t('articleDetail.notFound') }}</div>

    <div v-else class="ad__body">
      <span class="ad__status" :class="`ad__status--${status}`">{{ $t(`home.status.${status}`) }}</span>

      <dl v-if="!editMode" class="ad__list">
        <div v-if="article.name" class="ad__row"><dt>{{ $t('articleDetail.fields.article') }}</dt><dd>{{ article.name }}</dd></div>
        <div v-if="article.brand" class="ad__row"><dt>{{ $t('articleDetail.fields.brand') }}</dt><dd>{{ article.brand }}</dd></div>
        <div v-if="article.category" class="ad__row"><dt>{{ $t('articleDetail.fields.category') }}</dt><dd>{{ article.category }}</dd></div>
        <div v-if="article.material" class="ad__row"><dt>{{ $t('articleDetail.fields.material') }}</dt><dd>{{ article.material }}</dd></div>
        <div v-if="article.serial_number" class="ad__row"><dt>{{ $t('articleDetail.fields.serial') }}</dt><dd>{{ article.serial_number }}</dd></div>
        <div class="ad__row"><dt>{{ $t('articleDetail.fields.user') }}</dt><dd>{{ article.assigned_user_name || $t('articleDetail.noUser') }}</dd></div>
        <div v-if="article.manufacture_year" class="ad__row">
          <dt>{{ $t('articleDetail.fields.year') }}</dt>
          <dd>{{ article.manufacture_year }}<template v-if="article.manufacture_month"> / {{ article.manufacture_month }}</template></dd>
        </div>
        <div class="ad__row"><dt>{{ $t('articleDetail.fields.purchaseDate') }}</dt><dd>{{ article.purchase_date ? formatDate(article.purchase_date) : '—' }}</dd></div>
        <div class="ad__row"><dt>{{ $t('articleDetail.fields.firstUse') }}</dt><dd>{{ article.first_use_date ? formatDate(article.first_use_date) : '—' }}</dd></div>
        <!-- Keuring of controle: bewust andere woorden. Een zelf afgevinkt
             artikel is geen keuring door een keurbedrijf, en dat verschil in
             juridische status moet zichtbaar blijven (DATAMODEL §3). -->
        <template v-if="isSelfChecked">
          <div class="ad__row">
            <dt>{{ $t('selfCheck.lastCheckLabel') }}</dt>
            <dd>{{ article.self_checked_at ? formatDate(article.self_checked_at) : $t('selfCheck.neverChecked') }}</dd>
          </div>
          <div v-if="article.self_next_due" class="ad__row">
            <dt>{{ $t('selfCheck.nextCheckLabel') }}</dt>
            <dd>{{ formatDate(article.self_next_due) }}</dd>
          </div>
        </template>
        <template v-else>
          <div class="ad__row">
            <dt>{{ $t('articleDetail.lastInspection') }}</dt>
            <dd>{{ article.last_inspection_date ? formatDate(article.last_inspection_date) : $t('articleDetail.noLastInspection') }}</dd>
          </div>
          <div v-if="article.next_due" class="ad__row"><dt>{{ $t('articleDetail.fields.nextDue') }}</dt><dd>{{ formatDate(article.next_due) }}</dd></div>
        </template>
        <div v-if="article.manual_url" class="ad__row"><dt>{{ $t('home.manual') }}</dt><dd><a :href="article.manual_url" target="_blank">{{ $t('home.manual') }}</a></dd></div>
        <div v-if="article.recall_url" class="ad__row"><dt>{{ $t('home.recall') }}</dt><dd><a :href="article.recall_url" target="_blank" class="ad__recall">🚩 {{ $t('home.recall') }}</a></dd></div>
      </dl>

      <div v-if="!editMode" class="ad__actions">
        <!-- Afvinken mag elk actief lid (zelfde lijn als in de materiaallijst);
             bewerken blijft beheerderswerk. -->
        <button v-if="isSelfChecked" class="ad__checkbtn" @click="selfCheckOpen = true">{{ $t('selfCheck.action') }}</button>
        <button v-if="isAdmin" class="ad__editbtn" @click="startEdit">{{ $t('articleDetail.edit') }}</button>
      </div>

      <!-- Afvink-dialoog, zelfde patroon als in de materiaallijst. -->
      <div v-if="selfCheckOpen" class="ad__overlay" @click.self="selfCheckOpen = false">
        <div class="ad__dialog">
          <h2>{{ $t('selfCheck.action') }}</h2>
          <p class="ad__dialog-text">{{ $t('selfCheck.dialogText', { name: headerTitle }) }}</p>
          <label class="ad__dialog-label">
            {{ $t('selfCheck.checkedAt') }}
            <input v-model="selfCheckDate" type="date" :max="todayIso" class="ad__dialog-input" />
          </label>
          <input v-model="selfCheckBy" class="ad__dialog-input" :placeholder="$t('selfCheck.performedByPlaceholder')" />
          <p v-if="selfCheckError" class="ad__state ad__state--error">{{ selfCheckError }}</p>
          <div class="ad__dialog-actions">
            <button class="ad__cancel" @click="selfCheckOpen = false">{{ $t('common.cancel') }}</button>
            <button class="ad__savebtn" :disabled="selfCheckSaving" @click="confirmSelfCheck">
              {{ selfCheckSaving ? $t('common.busy') : $t('selfCheck.save') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Bewerken: alleen deze drie velden mogen wijzigen (besloten met
           Jos 2026-07-13); de rest staat hierboven vast. -->
      <form v-else-if="editMode" class="ad__form" @submit.prevent="save">
        <label class="ad__field">
          {{ $t('articleDetail.fields.user') }}
          <input
            v-model="form.userName"
            class="ad__input"
            autocomplete="off"
            @focus="activeField = 'user'"
            @blur="closeSuggest"
            @keydown="onSuggestKeydown"
          />
          <ul v-if="activeField === 'user' && userSuggestions.length" class="ad__suggest">
            <li v-for="(s, i) in userSuggestions" :key="s">
              <button
                type="button"
                ref="userItemRefs"
                class="ad__suggest-item"
                :class="{ 'ad__suggest-item--active': i === suggestIndex }"
                @mousedown.prevent="pickSuggestion(s)"
                @mouseenter="suggestIndex = i"
              >{{ s }}</button>
            </li>
          </ul>
        </label>
        <label class="ad__field">
          {{ $t('articleDetail.fields.purchaseDate') }}
          <input v-model="form.purchaseDate" type="date" class="ad__input" />
        </label>
        <label class="ad__field">
          {{ $t('articleDetail.fields.firstUse') }}
          <input v-if="!article.first_use_date" v-model="form.firstUseDate" type="date" class="ad__input" />
          <p v-else class="ad__locked">{{ formatDate(article.first_use_date) }} — {{ $t('articleDetail.firstUseLocked') }}</p>
        </label>
        <p v-if="formError" class="ad__state ad__state--error">{{ formError }}</p>
        <div class="ad__actions">
          <button type="button" class="ad__cancel" @click="editMode = false">{{ $t('common.cancel') }}</button>
          <button type="submit" class="ad__save" :disabled="saving">{{ saving ? $t('common.saving') : $t('common.save') }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  supabase,
  errorMessage,
  typeIsInspected,
  selfCheckIntervalMonths,
  customerArticleStatus,
} from "@gearonimo/core";
import { useFieldSuggest, fuzzyFilter } from "@gearonimo/ui";
import PageHeader from "../components/PageHeader.vue";

const route = useRoute();
const router = useRouter();

interface ArticleDetailRow {
  id: string;
  name: string | null;
  brand: string | null;
  material: string | null;
  category: string | null;
  serial_number: string | null;
  assigned_user_name: string | null;
  manufacture_year: number | null;
  manufacture_month: number | null;
  purchase_date: string | null;
  first_use_date: string | null;
  manual_url: string | null;
  recall_url: string | null;
  product_type: string | null;
  self_managed: boolean | null;
  last_result: string | null;
  last_inspection_date: string | null;
  next_due: string | null;
  self_checked_at: string | null;
  self_next_due: string | null;
  retired: boolean;
}

const article = ref<ArticleDetailRow | null>(null);
const isAdmin = ref(false);
const loading = ref(true);
const error = ref("");

// ─── Zelf afvinken ──────────────────────────────────────────────────────────
const selfCheckOpen = ref(false);
// Standaard vandaag; de watcher vult 'm bij het openen van het dialoog.
const selfCheckDate = ref("");
const selfCheckBy = ref("");
const selfCheckSaving = ref(false);
const selfCheckError = ref("");
const todayIso = computed(() => new Date().toISOString().slice(0, 10));

watch(selfCheckOpen, (open) => {
  if (open) {
    selfCheckError.value = "";
    selfCheckDate.value = todayIso.value;
  }
});

async function confirmSelfCheck() {
  if (!article.value) return;
  selfCheckSaving.value = true;
  selfCheckError.value = "";
  try {
    // De server rekent de volgende datum uit, zodat die regel op één plek staat.
    const { error: err } = await supabase.rpc("add_my_self_check", {
      p_article_id: article.value.id,
      p_checked_at: selfCheckDate.value || null,
      p_performed_by: selfCheckBy.value.trim() || null,
    });
    if (err) throw err;
    selfCheckOpen.value = false;
    selfCheckBy.value = "";
    await load();
  } catch (e) {
    selfCheckError.value = errorMessage(e);
  } finally {
    selfCheckSaving.value = false;
  }
}

const headerTitle = computed(() =>
  article.value ? [article.value.brand, article.value.name].filter(Boolean).join(" ") : ""
);

const status = computed(() => {
  if (!article.value) return "never_inspected";
  // Eén gedeelde bron met het dashboard en de materiaallijst (packages/core).
  // Stond hier tot 2026-08-04 apart, waardoor een afgevinkte EHBO-koffer op dit
  // scherm nog "Nog niet gekeurd" toonde.
  return customerArticleStatus({
    last_result: article.value.last_result,
    next_due: article.value.next_due,
    first_use_date: article.value.first_use_date,
    purchase_date: article.value.purchase_date,
    self_managed: article.value.self_managed,
    self_check_interval_months: selfCheckIntervalMonths(article.value.product_type),
    self_checked_at: article.value.self_checked_at,
    self_next_due: article.value.self_next_due,
    type_is_inspected: typeIsInspected(article.value.product_type),
  });
});

// Dit artikel wordt niet gekeurd maar gecontroleerd (Jos 2026-08-04: "deze
// wordt niet gekeurd maar gecontroleerd, ik denk dat het daar mis gaat").
// Bepaalt de woordkeuze op dit scherm én of de afvinkknop verschijnt.
const isSelfChecked = computed(
  () => !!article.value?.self_managed && selfCheckIntervalMonths(article.value?.product_type) != null
);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [custRes, detailRes] = await Promise.all([
      supabase.rpc("my_customer"),
      supabase.rpc("my_article_detail", { p_article_id: route.params.id }),
    ]);
    if (custRes.error) throw custRes.error;
    if (detailRes.error) throw detailRes.error;
    const custRow = Array.isArray(custRes.data) ? custRes.data[0] : custRes.data;
    if (!custRow) {
      router.replace("/start");
      return;
    }
    isAdmin.value = !!custRow.is_admin;
    const row = Array.isArray(detailRes.data) ? detailRes.data[0] : detailRes.data;
    article.value = (row ?? null) as ArticleDetailRow | null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

const editMode = ref(false);
const saving = ref(false);
const formError = ref("");
const form = ref({ userName: "", purchaseDate: "", firstUseDate: "" });

// Gebruiker-typeahead: zelfde patroon als AddArticleForm.vue -- helpt
// tikfouten/hoofdletterverschillen voorkomen ("piet" naast "Piet").
const memberNames = ref<string[]>([]);
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
  resolve: () => fuzzyFilter(memberNames.value, form.value.userName),
  select: (_field, value) => {
    form.value.userName = value;
  },
  scrollToActive: true,
});

async function startEdit() {
  if (!article.value) return;
  form.value = {
    userName: article.value.assigned_user_name ?? "",
    purchaseDate: article.value.purchase_date ?? "",
    firstUseDate: "",
  };
  formError.value = "";
  editMode.value = true;
  if (!memberNames.value.length) {
    // Beide bronnen: de officiële medewerkerslijst én de namen die al op
    // andere artikelen staan (Jos, 2026-07-13 -- "Piet"/"piet" waren nooit
    // als medewerker toegevoegd, alleen getypt bij het toevoegen).
    const [membersRes, articlesRes] = await Promise.all([
      supabase.rpc("my_members"),
      supabase.rpc("my_articles"),
    ]);
    const registeredNames = ((membersRes.data ?? []) as { name: string; active: boolean }[])
      .filter((m) => m.active)
      .map((m) => m.name);
    const usedNames = ((articlesRes.data ?? []) as { assigned_user_name: string | null }[])
      .map((a) => a.assigned_user_name)
      .filter((n): n is string => !!n);
    memberNames.value = [...new Set([...registeredNames, ...usedNames])];
  }
}

async function save() {
  formError.value = "";
  saving.value = true;
  try {
    const { error: err } = await supabase.rpc("update_my_article", {
      p_article_id: route.params.id,
      p_assigned_user_name: form.value.userName.trim() || null,
      p_purchase_date: form.value.purchaseDate || null,
      p_first_use_date: form.value.firstUseDate || null,
    });
    if (err) throw err;
    editMode.value = false;
    await load();
  } catch (e) {
    formError.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ad { min-height: 100vh; background: #f0f4f8; }
.ad__state { text-align: center; padding: 2rem 1rem; color: #666; }
.ad__state--error { color: #dc2626; }
.ad__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }

.ad__actions { display: flex; gap: 0.5rem; align-items: center; }
/* Omlijnd i.p.v. dicht groen: naast de bestaande Bewerken-knop stonden twee
   identieke groene blokken (gerenderd en gezien, 2026-08-04). Zo blijft
   Bewerken ongewijzigd en is Afvinken toch duidelijk een eigen actie. */
.ad__checkbtn {
  background: #fff; color: #15803d; border: 1.5px solid #16a34a; border-radius: 8px;
  padding: 0.5rem 1rem; font-weight: 700; cursor: pointer;
}
.ad__overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.ad__dialog { background: #fff; border-radius: 16px; padding: 1.25rem; width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 0.6rem; }
.ad__dialog h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
.ad__dialog-text { margin: 0; font-size: 0.9rem; color: #374151; }
.ad__dialog-label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #374151; }
.ad__dialog-input { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.55rem 0.7rem; font-size: 0.95rem; width: 100%; box-sizing: border-box; }
.ad__dialog-actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.ad__cancel { background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 1rem; color: #374151; cursor: pointer; flex: 1; }
.ad__savebtn { background: #16a34a; color: #fff; border: none; border-radius: 8px; padding: 0.5rem 1rem; font-weight: 700; cursor: pointer; flex: 1; }
.ad__savebtn:disabled { opacity: 0.5; }
.ad__status--never_checked, .ad__status--no_inspection { background: #f3f4f6; color: #6b7280; }
.ad__status--self_check_due { background: #fef9c3; color: #854d0e; }
.ad__status {
  display: inline-block; font-size: 0.85rem; font-weight: 700;
  border-radius: 999px; padding: 0.3rem 0.8rem; margin-bottom: 1rem;
}
.ad__status--ok { background: #dcfce7; color: #166534; }
.ad__status--due_soon, .ad__status--first_inspection_due { background: #fef9c3; color: #854d0e; }
.ad__status--overdue, .ad__status--rejected { background: #fee2e2; color: #991b1b; }
.ad__status--never_inspected { background: #f3f4f6; color: #6b7280; }

.ad__list {
  background: #fff; border-radius: 12px; padding: 0.25rem 1rem; margin: 0 0 1rem;
}
.ad__row {
  display: flex; justify-content: space-between; gap: 1rem;
  padding: 0.7rem 0; border-bottom: 1px solid #f3f4f6;
}
.ad__row:last-child { border-bottom: none; }
.ad__row dt { color: #6b7280; font-size: 0.85rem; }
.ad__row dd { margin: 0; font-weight: 600; text-align: right; }
.ad__recall { color: #dc2626; }

.ad__editbtn {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.55rem 1rem; font-weight: 700; cursor: pointer; font-size: 0.9rem;
}

.ad__form {
  background: #fff; border-radius: 12px; padding: 1rem; margin-bottom: 0.85rem;
  display: flex; flex-direction: column; gap: 0.7rem;
}
.ad__field { font-size: 0.85rem; color: #374151; display: flex; flex-direction: column; gap: 0.25rem; position: relative; }
.ad__input {
  border: 1px solid #d1d5db; border-radius: 8px; padding: 0.55rem 0.7rem;
  font-size: 0.95rem; width: 100%; box-sizing: border-box;
}
.ad__suggest {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10; margin-top: 0.25rem;
  list-style: none; padding: 0; background: #fff;
  border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;
  max-height: 220px; overflow-y: auto;
}
.ad__suggest li + li { border-top: 1px solid #f3f4f6; }
.ad__suggest-item {
  display: block; width: 100%; text-align: left; background: none; border: none;
  padding: 0.55rem 0.7rem; cursor: pointer; font-size: 0.9rem; font-weight: 400; color: #111827;
}
.ad__suggest-item:hover, .ad__suggest-item--active { background: #f0fdf4; }
.ad__locked { margin: 0; font-size: 0.85rem; color: #6b7280; }
.ad__actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.ad__save {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.55rem 1rem; font-weight: 700; cursor: pointer; flex: 1;
}
.ad__save:disabled { opacity: 0.5; }
.ad__cancel { background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.55rem 1rem; color: #374151; cursor: pointer; flex: 1; }
</style>
