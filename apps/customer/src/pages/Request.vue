<!-- Keuring aanvragen / de leadmotor (BLAUWDRUK §7). De klant vindt een
     keurbedrijf op een wereldkaart (alle bedrijven die "open voor nieuwe
     klanten" aan hebben) of via naam-zoeken (vindt ook niet-gelijste
     bedrijven), en stuurt een aanvraag. GEEN landfilter: de klant kiest zelf
     waar hij naartoe wil (besluit Jos 2026-07-05). De keurmeester keurt de
     aanvraag goed/af in de Pro-app; bij goedkeuring wordt de koppeling actief
     (en een eventuele oude koppeling beëindigd). -->
<template>
  <div class="rq">
    <PageHeader :title="$t('request.title')" back />

    <div v-if="loading" class="rq__state">{{ $t('common.loading') }}</div>
    <div v-else class="rq__body">
      <!-- Lopende/afgehandelde aanvragen -->
      <section v-if="myRequests.length" class="rq__section">
        <h2>{{ $t('request.mine') }}</h2>
        <ul class="rq__reqlist">
          <li v-for="r in myRequests" :key="r.id" class="rq__req">
            <div>
              <div class="rq__req-name">{{ r.company_name }}</div>
              <div class="rq__req-meta">{{ $t(`request.status.${r.status}`) }}</div>
            </div>
            <button v-if="r.status === 'pending'" class="rq__withdraw" :disabled="busy" @click="withdraw(r.id)">
              {{ $t('request.withdraw') }}
            </button>
          </li>
        </ul>
      </section>

      <p class="rq__intro">{{ $t('request.intro') }}</p>

      <!-- Naam-zoeken -->
      <input
        v-model="query"
        class="rq__search"
        :placeholder="$t('request.searchPlaceholder')"
        @input="onSearch"
      />

      <!-- Wereldkaart met alle vindbare keurbedrijven -->
      <div ref="mapEl" class="rq__map"></div>
      <p v-if="mapError" class="rq__maphint">{{ $t('request.mapUnavailable') }}</p>

      <!-- Lijst (zoekresultaten of alle gelijste bedrijven) -->
      <ul class="rq__list">
        <li
          v-for="c in shownCompanies"
          :key="c.id"
          class="rq__item"
          :class="{ 'rq__item--active': selected?.id === c.id }"
          @click="select(c)"
        >
          <div class="rq__item-name">{{ c.name }}</div>
          <div class="rq__item-meta">{{ [c.city, c.country_code].filter(Boolean).join(' · ') }}</div>
        </li>
        <li v-if="!shownCompanies.length" class="rq__empty">{{ $t('request.noneFound') }}</li>
      </ul>

      <!-- Bevestigen -->
      <div v-if="selected" class="rq__confirm">
        <h3>{{ $t('request.confirmTitle', { company: selected.name }) }}</h3>
        <textarea
          v-model="message"
          class="rq__message"
          rows="2"
          :placeholder="$t('request.messagePlaceholder')"
        ></textarea>
        <p v-if="error" class="rq__error">{{ error }}</p>
        <div class="rq__actions">
          <button class="rq__btn rq__btn--ghost" @click="selected = null">{{ $t('common.cancel') }}</button>
          <button class="rq__btn rq__btn--go" :disabled="busy" @click="submit">
            {{ busy ? $t('common.busy') : $t('request.send') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase, errorMessage } from "@gearonimo/core";
import PageHeader from "../components/PageHeader.vue";


interface Company {
  id: string;
  name: string;
  city: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface RequestRow {
  id: string;
  company_name: string;
  status: string;
}

const loading = ref(true);
const busy = ref(false);
const error = ref("");
const listed = ref<Company[]>([]);
const searchResults = ref<Company[]>([]);
const query = ref("");
const selected = ref<Company | null>(null);
const message = ref("");
const myRequests = ref<RequestRow[]>([]);

// Bij een actieve zoekopdracht de zoekresultaten (kan ook niet-gelijste
// bedrijven bevatten), anders de volledige openbare lijst.
const shownCompanies = computed(() => (query.value.trim().length >= 2 ? searchResults.value : listed.value));

const mapEl = ref<HTMLElement | null>(null);
const mapError = ref(false);
let map: L.Map | null = null;
const markers = new Map<string, L.CircleMarker>();

async function load() {
  loading.value = true;
  try {
    const [comps, reqs] = await Promise.all([
      supabase.rpc("list_inspection_companies"),
      supabase.rpc("my_inspection_requests"),
    ]);
    if (comps.error) throw comps.error;
    if (reqs.error) throw reqs.error;
    listed.value = (comps.data ?? []) as Company[];
    myRequests.value = (reqs.data ?? []) as RequestRow[];
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
  await nextTick();
  initMap();
}

function initMap() {
  if (!mapEl.value) return;
  try {
    map = L.map(mapEl.value, { zoomControl: true }).setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    renderMarkers(listed.value);
  } catch {
    mapError.value = true;
  }
}

// Pins tekenen als eenvoudige cirkels (geen externe icoon-assets nodig, die
// breken vaak onder een bundler). Klik = selecteren.
function renderMarkers(companies: Company[]) {
  if (!map) return;
  markers.forEach((m) => m.remove());
  markers.clear();
  const withCoords = companies.filter((c) => c.latitude != null && c.longitude != null);
  const bounds: L.LatLngExpression[] = [];
  for (const c of withCoords) {
    const marker = L.circleMarker([c.latitude as number, c.longitude as number], {
      radius: 9,
      color: "#166534",
      fillColor: "#16a34a",
      fillOpacity: 0.85,
      weight: 2,
    })
      .addTo(map)
      .bindTooltip(c.name);
    marker.on("click", () => select(c));
    markers.set(c.id, marker);
    bounds.push([c.latitude as number, c.longitude as number]);
  }
  if (bounds.length === 1) map.setView(bounds[0], 8);
  else if (bounds.length > 1) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function onSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  const q = query.value.trim();
  if (q.length < 2) {
    searchResults.value = [];
    renderMarkers(listed.value);
    return;
  }
  searchTimer = setTimeout(async () => {
    const { data, error: err } = await supabase.rpc("search_inspection_companies", { p_query: q });
    if (!err) {
      searchResults.value = (data ?? []) as Company[];
      renderMarkers(searchResults.value);
    }
  }, 300);
}

function select(c: Company) {
  selected.value = c;
  error.value = "";
  if (map && c.latitude != null && c.longitude != null) {
    map.setView([c.latitude, c.longitude], 10);
  }
}

async function submit() {
  if (!selected.value) return;
  busy.value = true;
  error.value = "";
  try {
    const source = query.value.trim().length >= 2 ? "name_search" : "public_list";
    const { error: err } = await supabase.rpc("request_inspection", {
      p_company_id: selected.value.id,
      p_source: source,
      p_message: message.value.trim() || null,
    });
    if (err) throw err;
    selected.value = null;
    message.value = "";
    const { data } = await supabase.rpc("my_inspection_requests");
    myRequests.value = (data ?? []) as RequestRow[];
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function withdraw(id: string) {
  busy.value = true;
  try {
    const { error: err } = await supabase.rpc("withdraw_inspection_request", { p_request_id: id });
    if (err) throw err;
    myRequests.value = myRequests.value.map((r) => (r.id === id ? { ...r, status: "withdrawn" } : r));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
onBeforeUnmount(() => {
  if (map) {
    map.remove();
    map = null;
  }
});
</script>

<style scoped>
.rq { min-height: 100vh; background: #f0f4f8; }
.rq__state { text-align: center; padding: 2.5rem 1rem; color: #666; }
.rq__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }
.rq__section { margin-bottom: 1.25rem; }
.rq__section h2 { font-size: 1rem; margin: 0 0 0.5rem; }
.rq__reqlist { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.rq__req {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.rq__req:last-child { border-bottom: none; }
.rq__req-name { font-weight: 600; }
.rq__req-meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
.rq__withdraw { background: none; border: none; color: #b91c1c; font-weight: 600; font-size: 0.85rem; cursor: pointer; }
.rq__intro { color: #6b7280; font-size: 0.9rem; margin: 0 0 0.75rem; }
.rq__search {
  width: 100%; padding: 0.85rem 1rem; border-radius: 10px; border: 1px solid #ddd;
  font-size: 1rem; box-sizing: border-box; margin-bottom: 0.85rem;
}
.rq__map { height: 300px; border-radius: 12px; overflow: hidden; margin-bottom: 0.35rem; background: #e5e7eb; }
.rq__maphint { font-size: 0.8rem; color: #9ca3af; margin: 0 0 0.75rem; }
.rq__list { list-style: none; margin: 0 0 1rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.rq__item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.rq__item:last-child { border-bottom: none; }
.rq__item--active { background: #ecfdf5; }
.rq__item-name { font-weight: 600; }
.rq__item-meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
.rq__empty { padding: 1rem; color: #9ca3af; text-align: center; }
.rq__confirm { background: #fff; border-radius: 12px; padding: 1rem; }
.rq__confirm h3 { margin: 0 0 0.5rem; font-size: 1rem; }
.rq__message {
  width: 100%; box-sizing: border-box; padding: 0.7rem; border-radius: 8px;
  border: 1px solid #ddd; font-family: inherit; font-size: 0.95rem; margin-bottom: 0.5rem;
}
.rq__error { color: #dc2626; font-size: 0.9rem; margin: 0 0 0.5rem; }
.rq__actions { display: flex; gap: 0.6rem; }
.rq__btn { flex: 1; padding: 0.85rem; border-radius: 10px; border: none; font-size: 0.95rem; font-weight: 700; cursor: pointer; }
.rq__btn--ghost { background: #f3f4f6; color: #374151; }
.rq__btn--go { background: #16a34a; color: #fff; }
.rq__btn:disabled { opacity: 0.6; }
</style>
