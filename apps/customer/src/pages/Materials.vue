<!-- Mijn materiaal: de artikellijst, verhuisd uit het dashboard (optie A,
     besloten met Jos 2026-07-13). Hier zit alles rond het eigen materiaal:
     zoeken, filteren op personeelslid, toevoegen en afvoeren. Sets
     samenstellen gaat uitsluitend via het 🔗+-knopje per artikel (besloten
     met Jos 2026-07-13: het los aanvinken-en-groeperen hieronder gaf een
     dubbele weg naar hetzelfde en is eruit gehaald). De stoplichtkaart op
     het dashboard linkt hierheen met ?filter=aandacht (voorgefilterd op wat
     aandacht nodig heeft). -->
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
            <!-- Zelf materiaal aanmelden mag elk actief lid (zelfde lijn als
                 afvoeren); de keurmeester ziet het terug met source='customer'. -->
            <button v-if="!addingArticle" class="mt__addbtn" @click="addingArticle = true">{{ $t('home.addArticle.button') }}</button>
          </div>
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
              <div class="mt__item-main" @click="router.push(`/materials/${row.article.id}`)">
                <div class="mt__item-name">
                  {{ [row.article.brand, row.article.name].filter(Boolean).join(' ') || $t('home.untitled') }}
                  <!-- Tekstlink i.p.v. het boek-emoji: dat rendert op sommige
                       desktopfonts als een leeg vierkantje. -->
                  <a v-if="row.article.manual_url" :href="row.article.manual_url" target="_blank" class="mt__manual" @click.stop>{{ $t('home.manual') }}</a>
                  <a v-if="row.article.recall_url" :href="row.article.recall_url" target="_blank" class="mt__recall" :title="$t('home.recall')" @click.stop>🚩 {{ $t('home.recall') }}</a>
                </div>
                <div class="mt__item-meta">
                  <span v-if="row.article.serial_number">SN {{ row.article.serial_number }}</span>
                  <span v-if="row.article.assigned_user_name">· {{ row.article.assigned_user_name }}</span>
                  <span v-if="row.article.next_due"> · {{ $t('home.nextDue') }} {{ formatDate(row.article.next_due) }}</span>
                </div>
              </div>
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

      <div v-if="retireFor" class="mt__overlay" @click.self="retireFor = null">
        <div class="mt__dialog">
          <h2>{{ $t('home.retireOther') }}</h2>
          <p class="mt__dialog-text">{{ $t('home.retireConfirm', { name: retireLabel(retireFor) }) }}</p>
          <input v-model="retireReason" class="mt__dialog-input" :placeholder="$t('home.retireReasonPlaceholder')" />
          <p v-if="retireError" class="mt__state mt__state--error">{{ retireError }}</p>
          <div class="mt__dialog-actions">
            <button class="mt__cancel" @click="retireFor = null">{{ $t('common.cancel') }}</button>
            <button class="mt__dangerbtn" :disabled="retiringId !== null" @click="confirmRetire">
              {{ retiringId ? $t('common.busy') : $t('home.retireOther') }}
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
import { supabase, errorMessage, calcStatus, isFirstInspectionOverdue } from "@gearonimo/core";
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
  first_use_date: string | null;
}
// UI-status = calcStatus (packages/core, de geteste domeinlogica) + twee
// extra gevallen die daar buiten vallen: bij de laatste keuring afgekeurd,
// en (EN 365, Jos 2026-07-13) 12 maanden in gebruik zonder ooit gekeurd te
// zijn -- zelfde zachte toon als "binnenkort keuren", geen rood alarm
// (blauwdruk §7 blijft gelden voor "nog geen 12 maanden").
type UiStatus = "rejected" | "overdue" | "due_soon" | "first_inspection_due" | "ok" | "never_inspected";
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
  const base = calcStatus({
    today: new Date(),
    next_due: a.next_due ? new Date(a.next_due) : null,
  });
  if (base === "never_inspected" && isFirstInspectionOverdue(a.first_use_date ? new Date(a.first_use_date) : null, new Date())) {
    return "first_inspection_due";
  }
  return base as UiStatus;
}

// Personeelslid-chips: de namen zoals ze aan artikelen hangen.
const memberNames = computed(() => {
  const names = new Set<string>();
  for (const a of articles.value) if (a.assigned_user_name) names.add(a.assigned_user_name);
  return [...names].sort((a, b) => a.localeCompare(b));
});

// "Aandacht" = alles wat het stoplicht niet groen maakt: afgekeurd, verlopen,
// binnenkort te keuren, of 12 maanden in gebruik zonder eerste keuring.
// Nooit-gekeurd (binnen 12 maanden) valt er bewust buiten (blauwdruk §7:
// uitnodigend, geen alarm).
const ATTENTION: UiStatus[] = ["rejected", "overdue", "due_soon", "first_inspection_due"];

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

const STATUS_ORDER: Record<UiStatus, number> = {
  rejected: 0,
  overdue: 1,
  due_soon: 2,
  first_inspection_due: 3,
  never_inspected: 4,
  ok: 5,
};
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
// de volledige tekst blijft als tooltip beschikbaar. first_inspection_due
// deelt het "!" van due_soon: zelfde zachte toon, andere tooltiptekst.
function statusIcon(s: UiStatus): string {
  return { ok: "✓", due_soon: "!", first_inspection_due: "!", overdue: "✗", rejected: "✗", never_inspected: "—" }[s];
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
// Eigen dialoog i.p.v. window.prompt: Jos vinkte tijdens het testen
// (2026-07-13) "voorkom extra dialoogvensters" aan, waarna afvoeren
// geluidloos niets meer deed. Een in-app dialoog kan de browser niet
// onderdrukken. Het dialoog doet dubbel dienst als bevestiging
// (Annuleren = afbreken) en als reden-invoer; de reden komt bij de
// keurmeester in beeld bij SN-zoeken.
const retireFor = ref<UiArticle | null>(null);
const retireReason = ref("");

function retireLabel(a: UiArticle) {
  return [a.brand, a.name].filter(Boolean).join(" ") || t("home.untitled");
}

function retireArticle(a: UiArticle) {
  retireError.value = "";
  retireReason.value = a.uiStatus === "rejected" ? t("home.retireReasonReplaced") : "";
  retireFor.value = a;
}

async function confirmRetire() {
  const a = retireFor.value;
  if (!a) return;
  retiringId.value = a.id;
  retireError.value = "";
  try {
    const { error: err } = await supabase.rpc("retire_my_article", {
      p_article_id: a.id,
      p_reason: retireReason.value.trim() || null,
    });
    if (err) throw err;
    articles.value = articles.value.filter((x) => x.id !== a.id);
    retireFor.value = null;
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

// Sets: alleen nog via het 🔗+-knopje per artikel (AddPartForm) -- het
// aanvinken-en-groeperen hierboven is eruit (besloten met Jos 2026-07-13).
// article_id -> zijn (eerste) set. Voedt de groepering in displayArticles.
const setInfo = ref<Record<string, { setId: string; setName: string }>>({});
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
/* Ingetogen i.p.v. vol oranje/rood (Jos, 2026-07-13: "ik hou niet van
   geschreeuw, zeker niet om niks") -- zachte amber-tint, geen alarmvlak,
   zelfde lijn als de stoplichtkaart op het dashboard. */
.mt__chip--attention.mt__chip--active { background: #fef3c7; border-color: #fde68a; color: #92400e; }
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
.mt__dialog-text { margin: 0; font-size: 0.9rem; color: #374151; }
.mt__dangerbtn {
  background: #dc2626; color: #fff; border: none; border-radius: 8px;
  padding: 0.5rem 1rem; font-weight: 700; cursor: pointer; flex: 1;
}
.mt__dangerbtn:disabled { opacity: 0.5; }

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
.mt__item-main { min-width: 0; cursor: pointer; flex: 1; }
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
.mt__chip-status--due_soon, .mt__chip-status--first_inspection_due { background: #fef9c3; color: #854d0e; }
.mt__chip-status--overdue, .mt__chip-status--rejected { background: #fee2e2; color: #991b1b; }
.mt__chip-status--never_inspected { background: #f3f4f6; color: #6b7280; }
</style>
