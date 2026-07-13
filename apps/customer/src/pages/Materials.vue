<!-- Mijn materiaal: de artikellijst, verhuisd uit het dashboard (optie A,
     besloten met Jos 2026-07-13). Hier zit alles rond het eigen materiaal:
     zoeken, filteren op personeelslid, toevoegen, sets samenstellen en
     afvoeren. De stoplichtkaart op het dashboard linkt hierheen met
     ?filter=aandacht (voorgefilterd op wat aandacht nodig heeft). -->
<template>
  <div class="mt">
    <PageHeader back :title="$t('materials.title')" />

    <div v-if="loading" class="mt__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="mt__state mt__state--error">{{ error }}</div>

    <div v-else class="mt__body">
      <input
        v-model="search"
        type="search"
        class="mt__search"
        :placeholder="$t('materials.searchPlaceholder')"
      />
      <!-- Filterchips: "aandacht nodig" (gevoed vanaf de stoplichtkaart) en
           per personeelslid. Een gewone medewerker start op zijn eigen
           materiaal (UX-FLOW §9.2) maar kan altijd naar "Iedereen" wisselen. -->
      <div v-if="memberNames.length || attentionOnly" class="mt__chips">
        <button
          class="mt__chip mt__chip--attention"
          :class="{ 'mt__chip--active': attentionOnly }"
          @click="attentionOnly = !attentionOnly"
        >❗ {{ $t('materials.attention') }}</button>
        <template v-if="memberNames.length">
          <button
            class="mt__chip"
            :class="{ 'mt__chip--active': memberFilter === '' }"
            @click="memberFilter = ''"
          >{{ $t('materials.everyone') }}</button>
          <button
            v-for="name in memberNames"
            :key="name"
            class="mt__chip"
            :class="{ 'mt__chip--active': memberFilter === name }"
            @click="memberFilter = name"
          >{{ name }}</button>
        </template>
      </div>

      <section class="mt__section">
        <div class="mt__section-head">
          <h2>{{ $t('home.articles') }} <span class="mt__count">({{ filteredArticles.length }})</span></h2>
          <div class="mt__section-actions">
            <!-- Samenstellen vanuit de lijst (besloten met Jos 2026-07-11):
                 artikelen aanvinken en in één stap groeperen, i.p.v. eerst een
                 lege set aan te maken en er dan naar artikelen te zoeken. -->
            <button v-if="articles.length > 1 && !addingArticle" class="mt__selectbtn" @click="toggleSelectMode">
              {{ selectMode ? $t('common.cancel') : $t('sets.group.selectButton') }}
            </button>
            <!-- Zelf materiaal aanmelden mag elk actief lid (zelfde lijn als
                 afvoeren); de keurmeester ziet het terug met source='customer'. -->
            <button v-if="!addingArticle && !selectMode" class="mt__addbtn" @click="addingArticle = true">{{ $t('home.addArticle.button') }}</button>
          </div>
        </div>
        <div v-if="selectMode" class="mt__group-bar">
          <span>{{ $t('sets.group.selectedCount', { count: selectedIds.length }) }}</span>
          <button class="mt__group-btn" :disabled="selectedIds.length === 0" @click="openGroupDialog">
            {{ $t('sets.group.action') }}
          </button>
        </div>
        <AddArticleForm
          v-if="addingArticle"
          @close="addingArticle = false"
          @added="onArticleAdded"
        />
        <p v-if="retireError" class="mt__state mt__state--error">{{ retireError }}</p>
        <p v-if="!articles.length" class="mt__state">{{ $t('home.noArticles') }}</p>
        <p v-else-if="!filteredArticles.length" class="mt__state">
          {{ $t('materials.noMatches') }}
          <button class="mt__clear" @click="clearFilters">{{ $t('materials.clearFilters') }}</button>
        </p>
        <ul v-else class="mt__list">
          <template v-for="row in displayArticles" :key="row.article.id">
            <li v-if="row.isFirstInGroup" class="mt__group-head">🔗 {{ row.groupName }}</li>
            <li class="mt__item" :class="{ 'mt__item--grouped': row.groupId }">
              <input
                v-if="selectMode"
                type="checkbox"
                class="mt__checkbox"
                :checked="selectedIds.includes(row.article.id)"
                @change="toggleSelect(row.article.id)"
              />
              <div class="mt__item-main" @click="selectMode && toggleSelect(row.article.id)">
                <div class="mt__item-name">
                  {{ [row.article.brand, row.article.name].filter(Boolean).join(' ') || $t('home.untitled') }}
                  <!-- Tekstlink i.p.v. het boek-emoji: dat rendert op sommige
                       desktopfonts als een leeg vierkantje. -->
                  <a v-if="row.article.manual_url" :href="row.article.manual_url" target="_blank" class="mt__manual">{{ $t('home.manual') }}</a>
                  <a v-if="row.article.recall_url" :href="row.article.recall_url" target="_blank" class="mt__recall" :title="$t('home.recall')">🚩 {{ $t('home.recall') }}</a>
                </div>
                <div class="mt__item-meta">
                  <span v-if="row.article.serial_number">SN {{ row.article.serial_number }}</span>
                  <span v-if="row.article.assigned_user_name">· {{ row.article.assigned_user_name }}</span>
                  <span v-if="row.article.next_due"> · {{ $t('home.nextDue') }} {{ formatDate(row.article.next_due) }}</span>
                </div>
              </div>
              <template v-if="!selectMode">
                <!-- Status als vinkje/kruisje (tekst in de tooltip); kleur van de
                     chip draagt de betekenis, net als in de keurtabel. -->
                <span class="mt__chip-status" :class="`mt__chip-status--${row.article.uiStatus}`" :title="$t(`home.status.${row.article.uiStatus}`)">{{ statusIcon(row.article.uiStatus) }}</span>
                <!-- Onderdeel toevoegen aan dit artikel (bv. een vervangen brug op
                     een klimgordel) -- koppelt in één stap aan (of maakt) de set. -->
                <button class="mt__partbtn" :title="$t('sets.addPart.title')" @click="partFor = row.article">🔗+</button>
                <!-- Afvoeren mag op elk eigen artikel (vervangen na afkeur, maar
                     ook verlies/diefstal -- besluit Jos 2026-07-02), mét reden:
                     de keurmeester ziet die terug bij het SN-zoeken. Bewust een
                     onopvallend prullenbakje: het is een uitzonderingsactie. -->
                <button
                  class="mt__trash"
                  :title="row.article.uiStatus === 'rejected' ? $t('home.retire') : $t('home.retireOther')"
                  :disabled="retiringId === row.article.id"
                  @click="retireArticle(row.article)"
                >🗑</button>
              </template>
            </li>
          </template>
        </ul>
      </section>

      <AddPartForm
        v-if="partFor"
        :customer-id="customerId"
        :main-article-id="partFor.id"
        :main-label="[partFor.brand, partFor.name].filter(Boolean).join(' ') || $t('home.untitled')"
        @saved="onPartSaved"
        @close="partFor = null"
      />

      <div v-if="showGroupDialog" class="mt__overlay" @click.self="showGroupDialog = false">
        <div class="mt__dialog">
          <h2>{{ $t('sets.group.dialogTitle') }}</h2>
          <input v-model="groupName" class="mt__dialog-input" :placeholder="$t('sets.fields.name')" />
          <p v-if="groupError" class="mt__state mt__state--error">{{ groupError }}</p>
          <div class="mt__dialog-actions">
            <button class="mt__cancel" @click="showGroupDialog = false">{{ $t('common.cancel') }}</button>
            <button class="mt__addbtn" :disabled="groupSaving" @click="saveGroup">
              {{ groupSaving ? $t('common.saving') : $t('home.addArticle.save') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { supabase, errorMessage, calcStatus } from "@gearonimo/core";
import AddArticleForm from "../components/AddArticleForm.vue";
import AddPartForm from "../components/AddPartForm.vue";
import PageHeader from "../components/PageHeader.vue";

const route = useRoute();
const router = useRouter();
const { t } = useI18n();

interface ArticleRow {
  id: string;
  name: string | null;
  brand: string | null;
  category: string | null;
  serial_number: string | null;
  assigned_user_name: string | null;
  manual_url: string | null;
  recall_url: string | null;
  last_result: string | null;
  last_inspection_date: string | null;
  next_due: string | null;
}
// UI-status = calcStatus (packages/core, de geteste domeinlogica) + één
// extra geval dat daar buiten valt: bij de laatste keuring afgekeurd.
type UiStatus = "rejected" | "overdue" | "due_soon" | "ok" | "never_inspected";
interface UiArticle extends ArticleRow {
  uiStatus: UiStatus;
}

const customerId = ref("");
const addingArticle = ref(false);
const articles = ref<UiArticle[]>([]);
const loading = ref(true);
const error = ref("");

// Filters. ?filter=aandacht komt van de stoplichtkaart op het dashboard.
const search = ref("");
const memberFilter = ref("");
const attentionOnly = ref(route.query.filter === "aandacht");

function uiStatus(a: ArticleRow): UiStatus {
  if (a.last_result === "rejected") return "rejected";
  return calcStatus({
    today: new Date(),
    next_due: a.next_due ? new Date(a.next_due) : null,
  }) as UiStatus;
}

// Personeelslid-chips: de namen zoals ze aan artikelen hangen.
const memberNames = computed(() => {
  const names = new Set<string>();
  for (const a of articles.value) if (a.assigned_user_name) names.add(a.assigned_user_name);
  return [...names].sort((a, b) => a.localeCompare(b));
});

// "Aandacht" = alles wat het stoplicht niet groen maakt: afgekeurd, verlopen
// of binnenkort te keuren. Nooit-gekeurd valt er bewust buiten (blauwdruk §7:
// uitnodigend, geen alarm).
const ATTENTION: UiStatus[] = ["rejected", "overdue", "due_soon"];

const filteredArticles = computed(() => {
  const q = search.value.trim().toLowerCase();
  return articles.value.filter((a) => {
    if (attentionOnly.value && !ATTENTION.includes(a.uiStatus)) return false;
    if (memberFilter.value && a.assigned_user_name !== memberFilter.value) return false;
    if (q) {
      const haystack = [a.brand, a.name, a.serial_number, a.category, a.assigned_user_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
});

function clearFilters() {
  search.value = "";
  memberFilter.value = "";
  attentionOnly.value = false;
}

const STATUS_ORDER: Record<UiStatus, number> = { rejected: 0, overdue: 1, due_soon: 2, never_inspected: 3, ok: 4 };
const sortedArticles = computed(() =>
  [...filteredArticles.value].sort(
    (a, b) => STATUS_ORDER[a.uiStatus] - STATUS_ORDER[b.uiStatus] || (a.name ?? "").localeCompare(b.name ?? "")
  )
);

// Setleden bij elkaar tonen i.p.v. los verspreid over de lijst (besloten met
// Jos 2026-07-11), bovenop de bestaande status-sortering: een groep komt op
// de plek van zijn dringendste lid (bv. een afgekeurd onderdeel trekt de hele
// set naar boven), en de leden blijven daarna aaneengesloten.
interface DisplayArticleRow { article: UiArticle; groupId: string | null; groupName: string | null; isFirstInGroup: boolean }
const displayArticles = computed<DisplayArticleRow[]>(() => {
  const seen = new Set<string>();
  const result: DisplayArticleRow[] = [];
  for (const a of sortedArticles.value) {
    if (seen.has(a.id)) continue;
    const info = setInfo.value[a.id];
    if (info) {
      const members = sortedArticles.value.filter((x) => setInfo.value[x.id]?.setId === info.setId);
      members.forEach((m, idx) => {
        seen.add(m.id);
        result.push({ article: m, groupId: info.setId, groupName: info.setName, isFirstInGroup: idx === 0 });
      });
    } else {
      seen.add(a.id);
      result.push({ article: a, groupId: null, groupName: null, isFirstInGroup: false });
    }
  }
  return result;
});

// Vinkjes/kruisjes i.p.v. tekst in de statuschips (wens Jos 2026-07-02);
// de volledige tekst blijft als tooltip beschikbaar.
function statusIcon(s: UiStatus): string {
  return { ok: "✓", due_soon: "!", overdue: "✗", rejected: "✗", never_inspected: "—" }[s];
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data: cust, error: custErr } = await supabase.rpc("my_customer");
    if (custErr) throw custErr;
    const row = Array.isArray(cust) ? cust[0] : cust;
    if (!row) {
      // Nog geen klant: naar de startkeuze (uitnodigingscode of zelf beginnen).
      router.replace("/start");
      return;
    }
    customerId.value = row.customer_id;

    const { data, error: err } = await supabase.rpc("my_articles");
    if (err) throw err;
    articles.value = ((data ?? []) as ArticleRow[]).map((a) => ({ ...a, uiStatus: uiStatus(a) }));
    // Een gewone medewerker start op zijn eigen materiaal; de beheerder ziet
    // standaard alles. Wisselen kan altijd via de chips.
    if (!row.is_admin && row.member_name && !memberFilter.value && memberNames.value.includes(row.member_name)) {
      memberFilter.value = row.member_name;
    }
    await loadSets();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

const retiringId = ref<string | null>(null);
const retireError = ref("");

async function retireArticle(a: UiArticle) {
  const name = [a.brand, a.name].filter(Boolean).join(" ") || t("home.untitled");
  // prompt doet dubbel dienst als bevestiging (Annuleren = afbreken) en als
  // reden-invoer; de reden komt bij de keurmeester in beeld bij SN-zoeken.
  const reason = window.prompt(
    t("home.retirePrompt", { name }),
    a.uiStatus === "rejected" ? t("home.retireReasonReplaced") : ""
  );
  if (reason === null) return;
  retiringId.value = a.id;
  retireError.value = "";
  try {
    const { error: err } = await supabase.rpc("retire_my_article", {
      p_article_id: a.id,
      p_reason: reason.trim() || null,
    });
    if (err) throw err;
    articles.value = articles.value.filter((x) => x.id !== a.id);
  } catch (e) {
    retireError.value = errorMessage(e);
  } finally {
    retiringId.value = null;
  }
}

async function onArticleAdded() {
  addingArticle.value = false;
  await load();
}

// Sets: samenstellen vanuit de materiaallijst (besloten met Jos 2026-07-11) --
// zelfde flow als de Pro-app-verbetering, via RPC's omdat klant-accounts geen
// directe tabeltoegang hebben.
// article_id -> zijn (eerste) set. Voedt de groepering in displayArticles.
const setInfo = ref<Record<string, { setId: string; setName: string }>>({});
const selectMode = ref(false);
const selectedIds = ref<string[]>([]);
const showGroupDialog = ref(false);
const groupName = ref("");
const groupSaving = ref(false);
const groupError = ref("");
const partFor = ref<UiArticle | null>(null);

interface SetRow { set_id: string; set_name: string; article_id: string }

async function loadSets() {
  const { data } = await supabase.rpc("my_article_sets");
  const map: Record<string, { setId: string; setName: string }> = {};
  for (const row of (data ?? []) as SetRow[]) {
    if (!map[row.article_id]) map[row.article_id] = { setId: row.set_id, setName: row.set_name };
  }
  setInfo.value = map;
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  selectedIds.value = [];
}
function toggleSelect(id: string) {
  const i = selectedIds.value.indexOf(id);
  if (i === -1) selectedIds.value.push(id);
  else selectedIds.value.splice(i, 1);
}
function openGroupDialog() {
  groupError.value = "";
  const first = articles.value.find((a) => a.id === selectedIds.value[0]);
  groupName.value = first ? [first.brand, first.name].filter(Boolean).join(" ") : "";
  showGroupDialog.value = true;
}
async function saveGroup() {
  groupError.value = "";
  if (!groupName.value.trim()) {
    groupError.value = t("sets.errors.nameRequired");
    return;
  }
  groupSaving.value = true;
  try {
    const { error: err } = await supabase.rpc("create_my_article_set", {
      p_name: groupName.value.trim(),
      p_article_ids: selectedIds.value,
    });
    if (err) throw err;
    showGroupDialog.value = false;
    selectMode.value = false;
    selectedIds.value = [];
    await loadSets();
  } catch (e) {
    groupError.value = errorMessage(e);
  } finally {
    groupSaving.value = false;
  }
}

async function onPartSaved() {
  partFor.value = null;
  await load();
}

onMounted(load);
</script>

<style scoped>
.mt { min-height: 100vh; background: #f0f4f8; }
.mt__state { text-align: center; padding: 2rem 1rem; color: #666; }
.mt__state--error { color: #dc2626; }
.mt__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }
@media (min-width: 900px) { .mt__body { max-width: 760px; } }

.mt__search {
  width: 100%; box-sizing: border-box;
  border: 1px solid #d1d5db; border-radius: 10px;
  padding: 0.6rem 0.85rem; font-size: 0.95rem; margin-bottom: 0.6rem;
  background: #fff;
}
.mt__chips { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1rem; }
.mt__chip {
  border: 1px solid #d1d5db; background: #fff; color: #374151;
  border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.85rem;
  font-weight: 600; cursor: pointer;
}
.mt__chip--active { background: #1a3a2a; border-color: #1a3a2a; color: #fff; }
.mt__chip--attention.mt__chip--active { background: #b45309; border-color: #b45309; }
.mt__count { font-weight: 400; color: #6b7280; font-size: 0.9rem; }
.mt__clear {
  display: block; margin: 0.5rem auto 0; background: none; border: none;
  color: #1d4ed8; font-weight: 700; cursor: pointer; font-size: 0.85rem;
}

.mt__section { margin-bottom: 1.5rem; }
.mt__section h2 { font-size: 1rem; margin: 0; }
.mt__section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.mt__section-actions { display: flex; align-items: center; gap: 0.75rem; }
.mt__addbtn {
  background: #16a34a; color: #fff; border: none; border-radius: 8px;
  padding: 0.4rem 0.8rem; font-weight: 700; cursor: pointer; font-size: 0.85rem;
}
.mt__addbtn:disabled { opacity: 0.5; }
.mt__selectbtn { background: none; border: none; color: #1d4ed8; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
.mt__group-bar {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  background: #dbeafe; color: #1e40af; border-radius: 10px;
  padding: 0.55rem 0.85rem; margin-bottom: 0.5rem; font-size: 0.85rem;
}
.mt__group-btn {
  background: #1d4ed8; color: #fff; border: none; border-radius: 8px;
  padding: 0.4rem 0.8rem; font-weight: 700; cursor: pointer; font-size: 0.8rem;
}
.mt__group-btn:disabled { opacity: 0.5; }
.mt__checkbox { flex: 0 0 auto; width: 1.15rem; height: 1.15rem; }
.mt__partbtn { flex: 0 0 auto; border: none; background: transparent; cursor: pointer; font-size: 0.95rem; opacity: 0.45; padding: 0.25rem; }
.mt__partbtn:hover { opacity: 1; }
.mt__overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
  display: flex; align-items: center; justify-content: center; padding: 1.25rem; z-index: 100;
}
.mt__dialog { background: #fff; border-radius: 16px; padding: 1.25rem; width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 0.6rem; }
.mt__dialog h2 { margin: 0 0 0.25rem; font-size: 1.1rem; }
.mt__dialog-input { border: 1px solid #d1d5db; border-radius: 8px; padding: 0.55rem 0.7rem; font-size: 0.95rem; width: 100%; box-sizing: border-box; }
.mt__dialog-actions { display: flex; gap: 0.5rem; margin-top: 0.25rem; }
.mt__cancel { background: none; border: 1px solid #d1d5db; border-radius: 8px; padding: 0.5rem 1rem; color: #374151; cursor: pointer; flex: 1; }

.mt__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.mt__item {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.mt__item:last-child { border-bottom: none; }
.mt__group-head {
  padding: 0.4rem 1rem; font-size: 0.75rem; font-weight: 700; color: #1e40af;
  background: #dbeafe; border-bottom: 1px solid #bfdbfe;
}
.mt__item--grouped { border-left: 3px solid #93c5fd; padding-left: calc(1rem - 3px); background: #f8fafc; }
.mt__item-main { min-width: 0; }
.mt__item-name { font-weight: 600; }
.mt__item-name a { text-decoration: none; margin-left: 0.35rem; }
.mt__recall { color: #dc2626; font-size: 0.8rem; font-weight: 700; }
.mt__manual { color: #16a34a; font-size: 0.8rem; font-weight: 600; margin-left: 0.35rem; }
.mt__trash {
  flex: 0 0 auto; border: none; background: transparent; cursor: pointer;
  font-size: 1rem; opacity: 0.45; padding: 0.25rem;
}
.mt__trash:hover { opacity: 1; }
.mt__trash:disabled { opacity: 0.25; }
.mt__item-meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }

.mt__chip-status {
  flex: 0 0 auto; font-size: 0.9rem; font-weight: 800; line-height: 1;
  border-radius: 999px; padding: 0.35rem 0; width: 1.9rem; text-align: center;
}
.mt__chip-status--ok { background: #dcfce7; color: #166534; }
.mt__chip-status--due_soon { background: #fef9c3; color: #854d0e; }
.mt__chip-status--overdue, .mt__chip-status--rejected { background: #fee2e2; color: #991b1b; }
.mt__chip-status--never_inspected { background: #f3f4f6; color: #6b7280; }
</style>
