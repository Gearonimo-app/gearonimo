<!-- Het dashboard (optie A, besloten met Jos 2026-07-13): na inloggen één
     scherm met de stoplichtkaart ("ben ik in orde?") en daaronder grote
     keuzetegels — één keuze per scherm (UX-FLOW §1). De lijsten zelf staan
     op eigen pagina's: Mijn materiaal, Certificaten, Instellingen. Geen
     navigatiebalk onderin; de app-naam in de kop is overal de home-knop. -->
<template>
  <div class="dh">
    <PageHeader>
      <button class="dh__signout" @click="onSignOut">{{ $t('common.signOut') }}</button>
    </PageHeader>

    <div v-if="loading" class="dh__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="dh__state dh__state--error">{{ error }}</div>

    <div v-else class="dh__body">
      <p class="dh__customer">{{ customerName }}</p>

      <!-- Leadmotor: een klant zonder gekoppeld keurbedrijf ziet geen alarm maar
           een uitnodiging om een keuring aan te vragen (BLAUWDRUK §7). Een
           lopende aanvraag toont zijn status; een gekoppeld keurbedrijf staat
           subtiel in beeld. -->
      <section v-if="pendingRequest" class="dh__banner dh__banner--pending">
        <span>{{ $t('request.pendingBanner', { company: pendingRequest.company_name }) }}</span>
        <router-link v-if="isAdmin" to="/request" class="dh__banner-link">{{ $t('request.view') }}</router-link>
      </section>
      <section v-else-if="!companyName" class="dh__banner dh__banner--lead">
        <span>{{ $t('request.leadBanner') }}</span>
        <router-link v-if="isAdmin" to="/request" class="dh__banner-link">{{ $t('request.navLink') }}</router-link>
      </section>
      <p v-else class="dh__linked">{{ $t('request.linkedTo', { company: companyName }) }}</p>

      <!-- De stoplichtkaart: "ben ik in orde?" in één oogopslag, met de tellers
           erin. Bewust ingetogen (zachte tint, geen alarmvlak) en klikbaar:
           bij aandachtspunten opent hij Mijn materiaal voorgefilterd. -->
      <router-link class="dh__verdict" :class="`dh__verdict--${verdict}`" :to="verdictLink">
        <span class="dh__verdict-icon">{{ verdictIcon }}</span>
        <span class="dh__verdict-main">
          <span class="dh__verdict-text">{{ $t(`home.verdict.${verdict}`) }}</span>
          <span class="dh__verdict-counts">
            ✓ {{ counts.ok }} {{ $t('home.counts.ok') }}
            · ! {{ counts.due_soon }} {{ $t('home.counts.dueSoon') }}
            · ✗ {{ counts.action }} {{ $t('home.counts.action') }}<template v-if="counts.never">
            · — {{ counts.never }} {{ $t('home.counts.never') }}</template>
          </span>
        </span>
        <span class="dh__verdict-chevron">›</span>
      </router-link>

      <!-- De keuzetegels: taakgericht ("wat kom je doen?"), zelfde patroon als
           het hoofdmenu van de Pro-app. Aanvragen en Instellingen zijn
           beheerderswerk en blijven voor een gewone medewerker verborgen. -->
      <nav class="dh__grid">
        <router-link to="/materials" class="dh__tile">
          <span class="dh__tile-icon">🧰</span>
          <span class="dh__tile-label">{{ $t('home.tiles.materials') }}</span>
        </router-link>
        <router-link to="/certificates" class="dh__tile">
          <span class="dh__tile-icon">📄</span>
          <span class="dh__tile-label">{{ $t('home.tiles.certificates') }}</span>
        </router-link>
        <router-link v-if="isAdmin" to="/request" class="dh__tile">
          <span class="dh__tile-icon">📅</span>
          <span class="dh__tile-label">{{ $t('home.tiles.request') }}</span>
        </router-link>
        <router-link v-if="isAdmin" to="/members" class="dh__tile">
          <span class="dh__tile-icon">⚙️</span>
          <span class="dh__tile-label">{{ $t('home.tiles.settings') }}</span>
        </router-link>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { supabase, useAuth, errorMessage, calcStatus, isFirstInspectionOverdue } from "@gearonimo/core";
import PageHeader from "../components/PageHeader.vue";

const router = useRouter();
const { signOut } = useAuth();

interface ArticleRow {
  last_result: string | null;
  next_due: string | null;
  first_use_date: string | null;
}
type UiStatus = "rejected" | "overdue" | "due_soon" | "first_inspection_due" | "ok" | "never_inspected";

const customerName = ref("");
const companyName = ref("");
const pendingRequest = ref<{ status: string; company_name: string } | null>(null);
const isAdmin = ref(false);
const statuses = ref<UiStatus[]>([]);
const loading = ref(true);
const error = ref("");

// UI-status = calcStatus (packages/core, de geteste domeinlogica) + twee
// extra gevallen: bij de laatste keuring afgekeurd, en (EN 365, Jos
// 2026-07-13) 12 maanden in gebruik zonder ooit gekeurd te zijn -- telt mee
// als "binnenkort keuren" (zachte toon, geen rood alarm).
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

const counts = computed(() => ({
  ok: statuses.value.filter((s) => s === "ok").length,
  due_soon: statuses.value.filter((s) => s === "due_soon" || s === "first_inspection_due").length,
  action: statuses.value.filter((s) => s === "rejected" || s === "overdue").length,
  never: statuses.value.filter((s) => s === "never_inspected").length,
}));

// Nooit-gekeurde artikelen maken het oordeel bewust niet rood (zie
// packages/core status.ts) -- die krijgen hun eigen teller.
const verdict = computed<"good" | "warn" | "bad">(() => {
  if (counts.value.action > 0) return "bad";
  if (counts.value.due_soon > 0) return "warn";
  return "good";
});
const verdictIcon = computed(() => ({ good: "✅", warn: "⚠️", bad: "❗" })[verdict.value]);
const verdictLink = computed(() =>
  verdict.value === "good" ? "/materials" : "/materials?filter=aandacht"
);

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
    customerName.value = row.customer_name;
    isAdmin.value = !!row.is_admin;

    const [arts, link, reqs] = await Promise.all([
      supabase.rpc("my_articles"),
      supabase.rpc("my_link_status"),
      supabase.rpc("my_inspection_requests"),
    ]);
    if (arts.error) throw arts.error;
    statuses.value = ((arts.data ?? []) as ArticleRow[]).map(uiStatus);
    const linkRow = Array.isArray(link.data) ? link.data[0] : link.data;
    companyName.value = linkRow?.company_name ?? "";
    pendingRequest.value = ((reqs.data ?? []) as { status: string; company_name: string }[])
      .find((r) => r.status === "pending") ?? null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function onSignOut() {
  await signOut();
  router.push("/login");
}

onMounted(load);
</script>

<style scoped>
.dh { min-height: 100vh; background: #f0f4f8; }
.dh__signout { background: none; border: none; color: #a7c4b0; cursor: pointer; font-size: 0.9rem; }
.dh__state { text-align: center; padding: 2rem 1rem; color: #666; }
.dh__state--error { color: #dc2626; }
.dh__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }
/* Op tablet/desktop mag het geheel wat breder; de tegels gaan dan op één rij. */
@media (min-width: 900px) { .dh__body { max-width: 860px; } }

.dh__customer { text-align: center; color: #374151; font-weight: 600; margin: 0 0 1rem; }

.dh__banner {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  border-radius: 14px; padding: 0.9rem 1.1rem; margin-bottom: 0.85rem;
  font-size: 0.95rem; font-weight: 600;
}
.dh__banner--lead { background: #dbeafe; color: #1e40af; }
.dh__banner--pending { background: #fef9c3; color: #854d0e; }
.dh__banner-link {
  flex: 0 0 auto; background: #fff; border-radius: 8px; padding: 0.4rem 0.8rem;
  text-decoration: none; color: #1a3a2a; font-weight: 700; font-size: 0.85rem;
}
.dh__linked { font-size: 0.85rem; color: #6b7280; margin: 0 0 0.85rem; text-align: center; }

/* Ingetogen stoplichtkaart: witte kaart met gekleurde accentrand, geen
   vol alarmvlak ("dat rode geschreeuw niet" -- Jos, 2026-07-13). */
.dh__verdict {
  display: flex; align-items: center; gap: 0.85rem;
  background: #fff; border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 1.25rem;
  text-decoration: none; color: #111827;
  border-left: 6px solid transparent;
}
.dh__verdict--good { border-left-color: #16a34a; }
.dh__verdict--warn { border-left-color: #d97706; }
.dh__verdict--bad { border-left-color: #dc2626; }
.dh__verdict-icon { font-size: 1.5rem; flex: 0 0 auto; }
.dh__verdict-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.dh__verdict-text { font-size: 1.05rem; font-weight: 700; }
.dh__verdict--good .dh__verdict-text { color: #166534; }
.dh__verdict--warn .dh__verdict-text { color: #854d0e; }
.dh__verdict--bad .dh__verdict-text { color: #991b1b; }
.dh__verdict-counts { font-size: 0.85rem; color: #6b7280; }
.dh__verdict-chevron { flex: 0 0 auto; font-size: 1.5rem; color: #9ca3af; }

.dh__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
@media (min-width: 900px) { .dh__grid { grid-template-columns: repeat(4, 1fr); } }
.dh__tile {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.6rem; background: #fff; border-radius: 16px;
  padding: 1.6rem 1rem; text-decoration: none; color: #111827;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.dh__tile:active { background: #e5e7eb; }
.dh__tile-icon { font-size: 2rem; }
.dh__tile-label { font-weight: 700; font-size: 0.95rem; text-align: center; }
</style>
