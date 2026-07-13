<!-- Certificaten: eigen pagina (optie A, besloten met Jos 2026-07-13);
     stond eerst onderaan het dashboard. Alle PDF's van deze klant op een
     rij, downloadbaar. -->
<template>
  <div class="ct">
    <PageHeader back :title="$t('home.certificates')" />

    <div v-if="loading" class="ct__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="ct__state ct__state--error">{{ error }}</div>

    <div v-else class="ct__body">
      <p v-if="!certificates.length" class="ct__state">{{ $t('home.noCertificates') }}</p>
      <ul v-else class="ct__list">
        <li v-for="c in certificates" :key="c.inspection_id" class="ct__item">
          <div class="ct__item-main">
            <div class="ct__item-name">{{ c.number }}</div>
            <div class="ct__item-meta">{{ formatDate(c.completed_at ?? c.inspection_date) }}</div>
          </div>
          <a class="ct__download" :href="certificateUrl(c)" target="_blank">⬇ PDF</a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { supabase, errorMessage } from "@gearonimo/core";
import PageHeader from "../components/PageHeader.vue";

interface CertificateRow {
  inspection_id: string;
  number: string;
  storage_path: string;
  inspection_date: string;
  completed_at: string | null;
}

const certificates = ref<CertificateRow[]>([]);
const loading = ref(true);
const error = ref("");

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

function certificateUrl(c: CertificateRow) {
  // download-optie: Supabase serveert de PDF dan met een attachment-header,
  // zodat de telefoon 'm echt in Downloads zet i.p.v. alleen in de browser
  // te tonen (gemeld door Jos: "ik kan hem in downloads niet vinden").
  return supabase.storage.from("certificates").getPublicUrl(c.storage_path, { download: `${c.number}.pdf` }).data
    .publicUrl;
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const { data, error: err } = await supabase.rpc("my_certificates");
    if (err) throw err;
    certificates.value = (data ?? []) as CertificateRow[];
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.ct { min-height: 100vh; background: #f0f4f8; }
.ct__state { text-align: center; padding: 2rem 1rem; color: #666; }
.ct__state--error { color: #dc2626; }
.ct__body { padding: 1.25rem; max-width: 640px; margin: 0 auto; }

.ct__list { list-style: none; margin: 0; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.ct__item {
  display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
  padding: 0.85rem 1rem; border-bottom: 1px solid #eee;
}
.ct__item:last-child { border-bottom: none; }
.ct__item-main { min-width: 0; }
.ct__item-name { font-weight: 600; }
.ct__item-meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }

.ct__download {
  flex: 0 0 auto; text-decoration: none; font-weight: 700; font-size: 0.85rem;
  color: #16a34a; border: 1px solid #16a34a; border-radius: 8px; padding: 0.35rem 0.7rem;
}
</style>
