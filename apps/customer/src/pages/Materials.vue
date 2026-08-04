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
    <PageHeader back :title="pageTitle" />

    <div v-if="loading" class="mt__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="mt__state mt__state--error">{{ error }}</div>

    <!-- Tegelkeuze: alleen als er méér dan één materiaalsoort aanstaat. Bij één
         soort (de standaard: alleen Klimmateriaal) zou dit een scherm met één
         knop zijn -- dan meteen de lijst, zie `showDomainTiles`. -->
    <div v-else-if="showDomainTiles" class="mt__body">
      <nav class="mt__domains">
        <button
          v-for="d in enabledDomains"
          :key="d"
          class="mt__domain"
          @click="selectDomain(d)"
        >
          <GIcon :name="domainIcon(d)" class="mt__domain-icon" />
          <span class="mt__domain-label">{{ $t(`materials.domains.${d}`) }}</span>
          <span class="mt__domain-count">{{ domainCounts[d] ?? 0 }}</span>
          <!-- Aandacht per tegel, zodat je niet hoeft in te klikken om te zien
               waar iets speelt. Kleding/Overig krijgen dit nooit: daar wordt
               niets gekeurd. -->
          <span v-if="domainAttention[d]" class="mt__domain-flag">
            ❗ {{ $t('materials.attentionCount', { n: domainAttention[d] }) }}
          </span>
        </button>
      </nav>
    </div>

    <div v-else class="mt__body">
      <!-- Terug naar de tegels; alleen zichtbaar als er iets om naar terug te
           gaan is (bij één materiaalsoort bestaat het tegelscherm niet). -->
      <button v-if="enabledDomains.length > 1" class="mt__back-domains" @click="clearDomain">
        ‹ {{ $t('materials.allDomains') }}
      </button>
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
        <!-- De tegel ís de typekeuze (besluit Jos 2026-08-04): toevoegen vanuit
             Kleding levert een artikel met type `clothing`, en de
             catalogus-zoekfunctie kijkt alleen binnen die soort. Staat er maar
             één soort aan, dan is dat vanzelf de actieve. -->
        <AddArticleForm
          v-if="addingArticle"
          :known-users="memberNames"
          :domain="activeDomain ?? enabledDomains[0]"
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
                </div>
                <div class="mt__item-meta">
                  <span v-if="row.article.serial_number">SN {{ row.article.serial_number }}</span>
                  <span v-if="row.article.assigned_user_name">· {{ row.article.assigned_user_name }}</span>
                  <span v-if="row.article.next_due"> · {{ $t('home.nextDue') }} {{ formatDate(row.article.next_due) }}</span>
                </div>
                <!-- De reden staat nu ook als tekst in de rij (Jos, 2026-07-13:
                     "ik wil meteen zien waarom"): op de telefoon is een tooltip
                     onbereikbaar. Alleen bij "in orde" is er niets te melden. -->
                <div v-if="row.article.uiStatus !== 'ok'" class="mt__item-reason" :class="`mt__item-reason--${row.article.uiStatus}`">
                  {{ $t(`home.status.${row.article.uiStatus}`) }}
                </div>
              </div>
              <!-- Status als vinkje/kruisje; kleur van de chip draagt de
                   betekenis, net als in de keurtabel. De tekst staat er
                   voortaan ook al bij (zie hierboven), dit blijft alleen het
                   compacte icoon voor op-een-oogopslag-scannen. -->
              <span class="mt__chip-status" :class="`mt__chip-status--${row.article.uiStatus}`" :title="$t(`home.status.${row.article.uiStatus}`)">{{ statusIcon(row.article.uiStatus) }}</span>
              <!-- Onderdeel toevoegen aan dit artikel (bv. een vervangen brug op
                   een klimgordel) -- koppelt in één stap aan (of maakt) de set. -->
              <button class="mt__partbtn" :title="$t('sets.addPart.title')" @click="partFor = row.article">🔗+</button>
              <!-- Afvoeren: alleen de beheerder (Jos, 2026-07-13 -- draait het
                   besluit van 2026-07-02 terug: dat mocht toen nog elk lid).
                   Ook serverside afgedwongen in retire_my_article, dit is
                   niet alleen de knop verbergen. Bewust een onopvallend
                   prullenbakje: het is een uitzonderingsactie. -->
              <button
                v-if="isAdmin"
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
import {
  supabase,
  errorMessage,
  calcStatus,
  isFirstInspectionOverdue,
  domainForType,
  normalizeDomains,
  typeIsInspected,
  MATERIAL_DOMAINS,
  type MaterialDomain,
} from "@gearonimo/core";
import { GIcon } from "@gearonimo/ui";
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
  product_type: string | null;
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
// `no_inspection` is er sinds 2026-08-04 bij: kleding, geen-PBM en overig
// hebben geen keurtermijn (zie regimes.ts). Dat is bewust een eigen toestand
// en niet "nog niet gekeurd" -- die laatste nodigt uit om een keuring aan te
// vragen, en dat is hier juist niet de bedoeling.
type UiStatus = "rejected" | "overdue" | "due_soon" | "first_inspection_due" | "ok" | "never_inspected" | "no_inspection";
interface UiArticle extends ArticleRow {
  uiStatus: UiStatus;
}

const customerId = ref("");
const isAdmin = ref(false);
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
  // Types zonder keurtermijn krijgen geen keurstatus. Zonder deze regel zou
  // een T-shirt na 12 maanden als "eerste keuring te laat" onder Aandacht
  // komen -- ruis die de stoplichtkaart zijn betekenis kost.
  if (!typeIsInspected(a.product_type)) return "no_inspection";
  const base = calcStatus({
    today: new Date(),
    next_due: a.next_due ? new Date(a.next_due) : null,
  });
  if (base === "never_inspected" && isFirstInspectionOverdue(a.first_use_date ? new Date(a.first_use_date) : null, new Date())) {
    return "first_inspection_due";
  }
  return base as UiStatus;
}

// ─── Materiaalsoorten (tegels, UX-FLOW §9.6) ────────────────────────────────
// De tegel is een weergave: welke tegel een artikel heeft volgt uit zijn
// product_type. De gekozen tegel staat in de URL (?domain=clothing) en niet in
// het pad, zodat de bestaande route /materials/:id (artikeldetail) ongemoeid
// blijft.
const enabledDomains = ref<MaterialDomain[]>(["climbing"]);

const activeDomain = computed<MaterialDomain | null>(() => {
  const q = route.query.domain;
  const value = Array.isArray(q) ? q[0] : q;
  const found = MATERIAL_DOMAINS.find((d) => d === value);
  return found && enabledDomains.value.includes(found) ? found : null;
});

// Het tegelscherm slaan we over als er niets te kiezen valt (één soort) of als
// de stoplichtkaart hierheen linkt met ?filter=aandacht -- dat filter gaat over
// alle soorten heen en hoort meteen de lijst te tonen.
const showDomainTiles = computed(
  () => enabledDomains.value.length > 1 && activeDomain.value === null && !attentionOnly.value
);

const pageTitle = computed(() =>
  activeDomain.value ? t(`materials.domains.${activeDomain.value}`) : t("materials.title")
);

// Artikelen van de gekozen tegel. Zonder gekozen tegel: alles wat in een
// aanstaande tegel valt. Materiaal in een uitgezette soort blijft dus zichtbaar
// -- verbergen mag nooit een waarschuwing onderdrukken (UX-FLOW §9.6).
const domainArticles = computed(() =>
  activeDomain.value === null
    ? articles.value
    : articles.value.filter((a) => domainForType(a.product_type) === activeDomain.value)
);

const domainCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const a of articles.value) {
    const d = domainForType(a.product_type);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
});

const domainAttention = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {};
  for (const a of articles.value) {
    if (!ATTENTION.includes(a.uiStatus)) continue;
    const d = domainForType(a.product_type);
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return counts;
});

// De icoonnaam is gelijk aan de domeinnaam (GIcon kent ze alle vier sinds
// 2026-08-04), dus geen afbeelding nodig.
function domainIcon(d: MaterialDomain): string {
  return d;
}

function selectDomain(d: MaterialDomain) {
  router.push({ path: "/materials", query: { domain: d } });
}

function clearDomain() {
  clearFilters();
  router.push({ path: "/materials" });
}

// Personeelslid-chips: de namen zoals ze aan artikelen hangen. Binnen een tegel
// alleen de namen die dáár voorkomen -- anders sta je in Kleding te filteren op
// een collega die alleen klimspullen heeft.
const memberNames = computed(() => {
  const names = new Set<string>();
  for (const a of domainArticles.value) if (a.assigned_user_name) names.add(a.assigned_user_name);
  return [...names].sort((a, b) => a.localeCompare(b));
});

// "Aandacht" = alles wat het stoplicht niet groen maakt: afgekeurd, verlopen,
// binnenkort te keuren, of 12 maanden in gebruik zonder eerste keuring.
// Nooit-gekeurd (binnen 12 maanden) valt er bewust buiten (blauwdruk §7:
// uitnodigend, geen alarm).
const ATTENTION: UiStatus[] = ["rejected", "overdue", "due_soon", "first_inspection_due"];

const filteredArticles = computed(() => {
  const q = search.value.trim().toLowerCase();
  return domainArticles.value.filter((a) => {
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
  // Onderaan: er valt niets aan te doen en er hoeft niets mee te gebeuren.
  no_inspection: 6,
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
  return { ok: "✓", due_soon: "!", first_inspection_due: "!", overdue: "✗", rejected: "✗", never_inspected: "—", no_inspection: "·" }[s];
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
    isAdmin.value = !!row.is_admin;
    enabledDomains.value = normalizeDomains(row.enabled_domains);

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

/* Materiaalsoort-tegels. Bewust een lijst van brede knoppen en geen raster van
   vierkantjes: er zijn er maximaal vier, ze hebben een teller en soms een
   aandachtsregel, en op een telefoon leest een rij prettiger dan 2x2. */
.mt__domains { display: flex; flex-direction: column; gap: 0.6rem; }
.mt__domain {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.75rem;
  width: 100%; box-sizing: border-box;
  background: #fff; border: 1px solid #e5e7eb; border-radius: 12px;
  padding: 1rem; cursor: pointer; text-align: left; font: inherit;
}
.mt__domain:hover { border-color: #1a3a2a; }
.mt__domain-icon { width: 1.6rem; height: 1.6rem; color: #1a3a2a; }
.mt__domain-label { font-weight: 700; font-size: 1rem; }
.mt__domain-count { color: #6b7280; font-size: 0.9rem; font-variant-numeric: tabular-nums; }
/* Loopt over de volle breedte onder de eerste rij door. */
.mt__domain-flag {
  grid-column: 2 / -1;
  font-size: 0.8rem; font-weight: 700; color: #92400e;
}
.mt__back-domains {
  background: none; border: none; padding: 0 0 0.5rem; margin: 0;
  color: #1d4ed8; font-weight: 700; cursor: pointer; font-size: 0.9rem;
}

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
.mt__trash {
  flex: 0 0 auto; border: none; background: transparent; cursor: pointer;
  font-size: 1rem; opacity: 0.45; padding: 0.25rem;
}
.mt__trash:hover { opacity: 1; }
.mt__trash:disabled { opacity: 0.25; }
.mt__item-meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
.mt__item-reason { font-size: 0.8rem; font-weight: 700; margin-top: 0.2rem; }
.mt__item-reason--due_soon, .mt__item-reason--first_inspection_due { color: #92400e; }
.mt__item-reason--overdue, .mt__item-reason--rejected { color: #991b1b; }
.mt__item-reason--never_inspected { color: #6b7280; font-weight: 600; }
.mt__item-reason--no_inspection { color: #9ca3af; font-weight: 600; }

.mt__chip-status {
  flex: 0 0 auto; font-size: 0.9rem; font-weight: 800; line-height: 1;
  border-radius: 999px; padding: 0.35rem 0; width: 1.9rem; text-align: center;
}
.mt__chip-status--ok { background: #dcfce7; color: #166534; }
.mt__chip-status--due_soon, .mt__chip-status--first_inspection_due { background: #fef9c3; color: #854d0e; }
.mt__chip-status--overdue, .mt__chip-status--rejected { background: #fee2e2; color: #991b1b; }
.mt__chip-status--never_inspected { background: #f3f4f6; color: #6b7280; }
.mt__chip-status--no_inspection { background: #f9fafb; color: #9ca3af; }
</style>
