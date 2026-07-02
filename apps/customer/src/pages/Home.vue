<template>
  <div class="hm">
    <header class="hm__header">
      <h1>{{ customerName || 'Gearonimo' }}</h1>
      <button class="hm__signout" @click="onSignOut">{{ $t('common.signOut') }}</button>
    </header>

    <div v-if="loading" class="hm__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="hm__state hm__state--error">{{ error }}</div>

    <div v-else class="hm__body">
      <!-- Het stoplicht: "ben ik in orde?" in één oogopslag. Nooit-gekeurde
           artikelen maken het oordeel bewust niet rood (zie packages/core
           status.ts) -- die krijgen hun eigen regel. -->
      <section class="hm__verdict" :class="`hm__verdict--${verdict}`">
        <span class="hm__verdict-icon">{{ verdictIcon }}</span>
        <span class="hm__verdict-text">{{ $t(`home.verdict.${verdict}`) }}</span>
      </section>

      <section class="hm__counts">
        <div class="hm__count hm__count--ok"><strong>{{ counts.ok }}</strong> {{ $t('home.counts.ok') }}</div>
        <div class="hm__count hm__count--due"><strong>{{ counts.due_soon }}</strong> {{ $t('home.counts.dueSoon') }}</div>
        <div class="hm__count hm__count--bad"><strong>{{ counts.action }}</strong> {{ $t('home.counts.action') }}</div>
        <div v-if="counts.never" class="hm__count"><strong>{{ counts.never }}</strong> {{ $t('home.counts.never') }}</div>
      </section>

      <!-- Artikelen -->
      <section class="hm__section">
        <h2>{{ $t('home.articles') }}</h2>
        <p v-if="retireError" class="hm__state hm__state--error">{{ retireError }}</p>
        <p v-if="!articles.length" class="hm__state">{{ $t('home.noArticles') }}</p>
        <ul v-else class="hm__list">
          <li v-for="a in sortedArticles" :key="a.id" class="hm__item">
            <div class="hm__item-main">
              <div class="hm__item-name">
                {{ [a.brand, a.name].filter(Boolean).join(' ') || $t('home.untitled') }}
                <!-- Tekstlink i.p.v. het boek-emoji: dat rendert op sommige
                     desktopfonts als een leeg vierkantje. -->
                <a v-if="a.manual_url" :href="a.manual_url" target="_blank" class="hm__manual">{{ $t('home.manual') }}</a>
                <a v-if="a.recall_url" :href="a.recall_url" target="_blank" class="hm__recall" :title="$t('home.recall')">🚩 {{ $t('home.recall') }}</a>
              </div>
              <div class="hm__item-meta">
                <span v-if="a.serial_number">SN {{ a.serial_number }}</span>
                <span v-if="a.assigned_user_name">· {{ a.assigned_user_name }}</span>
                <span v-if="a.next_due"> · {{ $t('home.nextDue') }} {{ formatDate(a.next_due) }}</span>
              </div>
              <!-- Afvoeren mag op elk eigen artikel (vervangen na afkeur, maar
                   ook verlies/diefstal -- besluit Jos 2026-07-02), mét reden:
                   de keurmeester ziet die terug bij het SN-zoeken. Verdwijnt
                   uit dit overzicht en uit volgende keuringen; historie en
                   certificaten blijven bewaard (retired-vlag, zelfde
                   mechanisme als de keurmeester-app). -->
              <button
                class="hm__retire"
                :disabled="retiringId === a.id"
                @click="retireArticle(a)"
              >{{ retiringId === a.id ? $t('common.busy') : (a.uiStatus === 'rejected' ? $t('home.retire') : $t('home.retireOther')) }}</button>
            </div>
            <span class="hm__chip" :class="`hm__chip--${a.uiStatus}`">{{ $t(`home.status.${a.uiStatus}`) }}</span>
          </li>
        </ul>
      </section>

      <!-- Certificaten -->
      <section class="hm__section">
        <h2>{{ $t('home.certificates') }}</h2>
        <p v-if="!certificates.length" class="hm__state">{{ $t('home.noCertificates') }}</p>
        <ul v-else class="hm__list">
          <li v-for="c in certificates" :key="c.inspection_id" class="hm__item">
            <div class="hm__item-main">
              <div class="hm__item-name">{{ c.number }}</div>
              <div class="hm__item-meta">{{ formatDate(c.completed_at ?? c.inspection_date) }}</div>
            </div>
            <a class="hm__download" :href="certificateUrl(c)" target="_blank">⬇ PDF</a>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { supabase, useAuth, errorMessage, calcStatus } from "@gearonimo/core";

const router = useRouter();
const { t } = useI18n();
const { signOut } = useAuth();

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
interface CertificateRow {
  inspection_id: string;
  number: string;
  storage_path: string;
  inspection_date: string;
  completed_at: string | null;
}

const customerName = ref("");
const articles = ref<UiArticle[]>([]);
const certificates = ref<CertificateRow[]>([]);
const loading = ref(true);
const error = ref("");

function uiStatus(a: ArticleRow): UiStatus {
  if (a.last_result === "rejected") return "rejected";
  return calcStatus({
    today: new Date(),
    next_due: a.next_due ? new Date(a.next_due) : null,
  }) as UiStatus;
}

const STATUS_ORDER: Record<UiStatus, number> = { rejected: 0, overdue: 1, due_soon: 2, never_inspected: 3, ok: 4 };
const sortedArticles = computed(() =>
  [...articles.value].sort(
    (a, b) => STATUS_ORDER[a.uiStatus] - STATUS_ORDER[b.uiStatus] || (a.name ?? "").localeCompare(b.name ?? "")
  )
);

const counts = computed(() => ({
  ok: articles.value.filter((a) => a.uiStatus === "ok").length,
  due_soon: articles.value.filter((a) => a.uiStatus === "due_soon").length,
  action: articles.value.filter((a) => a.uiStatus === "rejected" || a.uiStatus === "overdue").length,
  never: articles.value.filter((a) => a.uiStatus === "never_inspected").length,
}));

const verdict = computed<"good" | "warn" | "bad">(() => {
  if (counts.value.action > 0) return "bad";
  if (counts.value.due_soon > 0) return "warn";
  return "good";
});
const verdictIcon = computed(() => ({ good: "✅", warn: "⚠️", bad: "❌" })[verdict.value]);

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

function certificateUrl(c: CertificateRow) {
  return supabase.storage.from("certificates").getPublicUrl(c.storage_path).data.publicUrl;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data: cust, error: custErr } = await supabase.rpc("my_customer");
    if (custErr) throw custErr;
    const row = Array.isArray(cust) ? cust[0] : cust;
    if (!row) {
      // Nog niet gekoppeld aan een klantbedrijf: eerst de uitnodigingscode.
      router.replace("/koppelen");
      return;
    }
    customerName.value = row.customer_name;

    const [arts, certs] = await Promise.all([
      supabase.rpc("my_articles"),
      supabase.rpc("my_certificates"),
    ]);
    if (arts.error) throw arts.error;
    if (certs.error) throw certs.error;
    articles.value = ((arts.data ?? []) as ArticleRow[]).map((a) => ({ ...a, uiStatus: uiStatus(a) }));
    certificates.value = (certs.data ?? []) as CertificateRow[];
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

async function onSignOut() {
  await signOut();
  router.push("/login");
}

onMounted(load);
</script>

<style scoped>
.hm { min-height: 100vh; background: #f0f4f8; }
.hm__header {
  background: #1a3a2a; color: #fff;
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; position: sticky; top: 0; z-index: 10;
}
.hm__header h1 { font-size: 1.2rem; margin: 0; }
.hm__signout { background: none; border: none; color: #a7c4b0; cursor: pointer; font-size: 0.9rem; }
.hm__state { text-align: center; padding: 2rem 1rem; color: #666; }
.hm__state--error { color: #dc2626; }
.hm__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }

.hm__verdict {
  display: flex; align-items: center; gap: 0.75rem;
  border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 0.85rem;
  font-size: 1.05rem; font-weight: 700;
}
.hm__verdict--good { background: #dcfce7; color: #166534; }
.hm__verdict--warn { background: #fef9c3; color: #854d0e; }
.hm__verdict--bad { background: #fee2e2; color: #991b1b; }
.hm__verdict-icon { font-size: 1.4rem; }

.hm__counts { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.hm__count {
  background: #fff; border-radius: 10px; padding: 0.5rem 0.85rem;
  font-size: 0.85rem; color: #6b7280;
}
.hm__count strong { color: #111827; margin-right: 0.25rem; }
.hm__count--ok strong { color: #16a34a; }
.hm__count--due strong { color: #d97706; }
.hm__count--bad strong { color: #dc2626; }

.hm__section { margin-bottom: 1.5rem; }
.hm__section h2 { font-size: 1rem; margin: 0 0 0.5rem; }
.hm__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.hm__item {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.hm__item:last-child { border-bottom: none; }
.hm__item-main { min-width: 0; }
.hm__item-name { font-weight: 600; }
.hm__item-name a { text-decoration: none; margin-left: 0.35rem; }
.hm__recall { color: #dc2626; font-size: 0.8rem; font-weight: 700; }
.hm__manual { color: #16a34a; font-size: 0.8rem; font-weight: 600; margin-left: 0.35rem; }
.hm__retire {
  margin-top: 0.4rem; border: 1px solid #fecaca; background: #fff; color: #dc2626;
  border-radius: 8px; padding: 0.3rem 0.6rem; font-size: 0.8rem; font-weight: 600; cursor: pointer;
}
.hm__retire:disabled { opacity: 0.6; }
.hm__item-meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }

.hm__chip {
  flex: 0 0 auto; font-size: 0.75rem; font-weight: 700;
  border-radius: 999px; padding: 0.25rem 0.6rem; white-space: nowrap;
}
.hm__chip--ok { background: #dcfce7; color: #166534; }
.hm__chip--due_soon { background: #fef9c3; color: #854d0e; }
.hm__chip--overdue, .hm__chip--rejected { background: #fee2e2; color: #991b1b; }
.hm__chip--never_inspected { background: #f3f4f6; color: #6b7280; }

.hm__download {
  flex: 0 0 auto; text-decoration: none; font-weight: 700; font-size: 0.85rem;
  color: #16a34a; border: 1px solid #16a34a; border-radius: 8px; padding: 0.35rem 0.7rem;
}
</style>
