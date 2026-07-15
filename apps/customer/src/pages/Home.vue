<!-- Het dashboard (optie A, besloten met Jos 2026-07-13): na inloggen één
     scherm met de stoplichtkaart ("ben ik in orde?") en daaronder grote
     keuzetegels — één keuze per scherm (UX-FLOW §1). De lijsten zelf staan
     op eigen pagina's: Mijn materiaal, Certificaten, Instellingen. Geen
     navigatiebalk onderin; de app-naam in de kop is overal de home-knop. -->
<template>
  <div class="dh" :style="heroStyle">
    <div class="dh__scrim"></div>
    <PageHeader plain>
      <button class="dh__signout" @click="onSignOut">{{ $t('common.signOut') }}</button>
    </PageHeader>

    <div v-if="loading" class="dh__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="dh__state dh__state--error">{{ error }}</div>

    <div v-else class="dh__body">
      <p class="dh__customer">{{ customerName }}</p>
      <!-- Gekoppeld keurbedrijf: puur informatief, geen actie -- dubbelt dus
           niet met de "Keuring aanvragen"-tegel en blijft daarom gewoon
           hier staan (geen banner, geen kader). -->
      <p v-if="companyName" class="dh__linked">{{ $t('request.linkedTo', { company: companyName }) }}</p>

      <!-- De stoplichtkaart: "ben ik in orde?" in één oogopslag, met de tellers
           erin. Bewust ingetogen (zachte tint, geen alarmvlak) en klikbaar:
           bij aandachtspunten opent hij Mijn materiaal voorgefilterd. Nog
           geen materiaal? Dan geen hol "alles in orde" maar een welkom
           (Jos, 2026-07-13). -->
      <router-link class="dh__verdict" :class="`dh__verdict--${verdict}`" :to="verdictLink">
        <span class="dh__verdict-icon">{{ verdictIcon }}</span>
        <span class="dh__verdict-main">
          <span class="dh__verdict-text">{{ $t(`home.verdict.${verdict}`) }}</span>
          <span v-if="verdict === 'empty'" class="dh__verdict-counts">{{ $t('home.verdict.emptyBody') }}</span>
          <span v-else class="dh__verdict-counts">
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
          <GIcon name="materials" class="dh__tile-icon" />
          <span class="dh__tile-label">{{ $t('home.tiles.materials') }}</span>
        </router-link>
        <router-link to="/certificates" class="dh__tile">
          <GIcon name="certificates" class="dh__tile-icon" />
          <span class="dh__tile-label">{{ $t('home.tiles.certificates') }}</span>
        </router-link>
        <!-- Status van de aanvraag/koppeling stond eerst in een aparte banner
             boven dit scherm -- dat was dubbelop met deze tegel (Jos,
             2026-07-13: "de tegel is genoeg, geen dubbele dingen"). Alleen de
             wachttoestand (nog geen ja/nee) is hier het vermelden waard; een
             koppeling zelf staat al bovenaan het scherm. -->
        <router-link v-if="isAdmin" to="/request" class="dh__tile">
          <GIcon name="calendar-check" class="dh__tile-icon" />
          <span class="dh__tile-label">{{ $t('home.tiles.request') }}</span>
          <span v-if="pendingRequest" class="dh__tile-caption">{{ $t('request.pendingCaption', { company: pendingRequest.company_name }) }}</span>
        </router-link>
        <router-link v-if="isAdmin" to="/members" class="dh__tile">
          <GIcon name="settings" class="dh__tile-icon" />
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
import { GIcon } from "@gearonimo/ui";
import PageHeader from "../components/PageHeader.vue";

const router = useRouter();
const { signOut } = useAuth();

// Platform-brede hero-foto (UX-FLOW.md §7): dezelfde crowdsourced sfeerfoto als
// de keurmeester-app -- "merk met een glimlach", community-gevoel. Ingesteld
// door een platform-admin; geen foto = nette donkergroene fallback.
const heroMobileUrl = ref<string | null>(null);
const heroDesktopUrl = ref<string | null>(null);
const heroStyle = computed(() => {
  const url = heroDesktopUrl.value ?? heroMobileUrl.value;
  if (!url) return {};
  return { "--dh-hero-mobile": `url("${heroMobileUrl.value ?? url}")`, "--dh-hero-desktop": `url("${url}")` };
});
async function loadHeroPhoto() {
  const { data } = await supabase
    .from("platform_settings")
    .select("hero_photo_mobile_path, hero_photo_desktop_path")
    .eq("id", true)
    .maybeSingle();
  if (data?.hero_photo_mobile_path) {
    heroMobileUrl.value = supabase.storage.from("branding").getPublicUrl(data.hero_photo_mobile_path).data.publicUrl;
  }
  if (data?.hero_photo_desktop_path) {
    heroDesktopUrl.value = supabase.storage.from("branding").getPublicUrl(data.hero_photo_desktop_path).data.publicUrl;
  }
}

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
// packages/core status.ts) -- die krijgen hun eigen teller. Nul artikelen is
// geen "alles in orde" (dat voelde hol, Jos 2026-07-13) maar een welkom.
const verdict = computed<"good" | "warn" | "bad" | "empty">(() => {
  if (statuses.value.length === 0) return "empty";
  if (counts.value.action > 0) return "bad";
  if (counts.value.due_soon > 0) return "warn";
  return "good";
});
const verdictIcon = computed(() => ({ good: "✅", warn: "⚠️", bad: "❗", empty: "👋" })[verdict.value]);
const verdictLink = computed(() =>
  verdict.value === "good" || verdict.value === "empty" ? "/materials" : "/materials?filter=aandacht"
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

onMounted(() => {
  loadHeroPhoto();
  load();
});
</script>

<style scoped>
.dh {
  min-height: 100vh;
  position: relative;
  background-color: #142a1f;
  background-image: var(--dh-hero-mobile, none);
  background-size: cover;
  background-position: center;
}
@media (min-width: 900px) {
  .dh { background-image: var(--dh-hero-desktop, var(--dh-hero-mobile, none)); }
}
/* Vaste overlay boven de foto: garandeert leesbare tekst/tegels ongeacht welke
   sfeerfoto er per kwartaal onder staat. */
.dh__scrim {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg,
    rgba(10, 26, 18, calc(var(--hero-overlay, 0.55) + 0.15)) 0%,
    rgba(10, 26, 18, var(--hero-overlay, 0.55)) 45%,
    rgba(10, 26, 18, calc(var(--hero-overlay, 0.55) + 0.27)) 100%);
}
.dh__body { position: relative; z-index: 1; }
.dh__signout { background: none; border: none; color: #a7c4b0; cursor: pointer; font-size: 0.9rem; }
.dh__state { position: relative; z-index: 1; text-align: center; padding: 2rem 1rem; color: #e5efe8; }
.dh__state--error { color: #fecaca; }
.dh__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }
/* Op tablet/desktop mag het geheel wat breder; de tegels gaan dan op één rij. */
@media (min-width: 900px) { .dh__body { max-width: 860px; } }

.dh__customer { text-align: center; color: #fff; font-weight: 700; margin: 0 0 1rem; font-size: 1.1rem; }
.dh__linked { font-size: 0.85rem; color: #cfe3d6; margin: 0 0 0.85rem; text-align: center; }

/* Ingetogen stoplichtkaart: witte kaart met gekleurde accentrand, geen
   vol alarmvlak ("dat rode geschreeuw niet" -- Jos, 2026-07-13). */
/* Zelfde glas-opmaak als de tegels ("mooi eenduidig", Jos 2026-07-14); de
   status blijft afleesbaar via de gekleurde accentrand + een lichte
   pasteltint voor de tekst (donkere tinten lezen niet op glas). */
.dh__verdict {
  display: flex; align-items: center; gap: 0.85rem;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-left: 6px solid transparent;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  border-radius: 14px; padding: 1rem 1.1rem; margin-bottom: 1.25rem;
  text-decoration: none; color: #fff;
}
.dh__verdict--good { border-left-color: #16a34a; }
.dh__verdict--warn { border-left-color: #d97706; }
.dh__verdict--bad { border-left-color: #dc2626; }
.dh__verdict--empty { border-left-color: #2563eb; }
.dh__verdict-icon { font-size: 1.5rem; flex: 0 0 auto; }
.dh__verdict-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.dh__verdict-text { font-size: 1.05rem; font-weight: 700; }
.dh__verdict--good .dh__verdict-text { color: #86efac; }
.dh__verdict--warn .dh__verdict-text { color: #fcd34d; }
.dh__verdict--bad .dh__verdict-text { color: #fca5a5; }
.dh__verdict--empty .dh__verdict-text { color: #93c5fd; }
.dh__verdict-counts { font-size: 0.85rem; color: rgba(255, 255, 255, 0.8); }
.dh__verdict-chevron { flex: 0 0 auto; font-size: 1.5rem; color: rgba(255, 255, 255, 0.6); }

.dh__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.85rem; }
@media (min-width: 900px) { .dh__grid { grid-template-columns: repeat(4, 1fr); } }
/* Glas-tegels, zelfde stijl als de keurmeester-app: het icoon onderscheidt de
   tegel, niet de kleur. */
.dh__tile {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.6rem; border-radius: 16px;
  padding: 1.6rem 1rem; text-decoration: none; color: #fff;
  background: rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  transition: transform 0.1s, background 0.15s;
}
.dh__tile:active { transform: scale(0.97); background: rgba(255, 255, 255, 0.22); }
.dh__tile-icon { width: 34px; height: 34px; }
.dh__tile-label { font-weight: 700; font-size: 0.95rem; text-align: center; }
.dh__tile-caption { font-size: 0.75rem; color: #fde68a; text-align: center; }
</style>
