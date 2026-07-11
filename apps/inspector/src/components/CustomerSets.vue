<!-- Sets aanmaken gebeurt sinds 2026-07-11 vanuit de artikellijst zelf
     (CustomerArticles.vue: selecteren + "Groepeer tot set") -- intuïtiever
     dan hier eerst een lege set aanmaken en er dan naar artikelen te zoeken
     (besluit Jos). Dit scherm is nu puur overzicht + doorklikken naar
     setdetail (hernoemen/leden wijzigen/verwijderen blijft daar). -->
<template>
  <section class="cs">
    <div class="cs__head">
      <h2>{{ $t('sets.title') }}</h2>
    </div>

    <div v-if="loading" class="cs__state">{{ $t('common.loading') }}</div>
    <div v-else-if="error" class="cs__state cs__state--error">{{ error }}</div>
    <p v-else-if="sets.length === 0" class="cs__state">{{ $t('sets.empty') }}</p>

    <ul v-else class="cs__list">
      <li v-for="s in sets" :key="s.id" class="cs__item" @click="$router.push(`/sets/${s.id}`)">
        <div class="cs__name">{{ s.name }}</div>
        <div class="cs__meta">{{ s.memberCount }} {{ $t('sets.itemsSuffix') }}</div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { supabase, useOnline, useOfflineSession, getArticleSetsForCustomer, errorMessage } from '@gearonimo/core'

const props = defineProps<{ customerId: string }>()
const { isOnline } = useOnline()

interface SetRow { id: string; name: string; memberCount: number }

const sets = ref<SetRow[]>([])
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''

  // Offline: sets uit de versleutelde cache (met ingebedde leden, zie
  // downloadCustomer).
  if (!isOnline.value) {
    try {
      const key = useOfflineSession().getKey()
      const cached = await getArticleSetsForCustomer<{
        id: string
        name: string
        article_set_members?: { id: string; article_id: string }[]
      }>(key, props.customerId)
      sets.value = cached.map((s) => ({
        id: s.id,
        name: s.name,
        memberCount: s.article_set_members?.length ?? 0,
      }))
    } catch (e) {
      error.value = errorMessage(e)
    }
    loading.value = false
    return
  }

  const { data, error: err } = await supabase
    .from('article_sets')
    .select('id, name, article_set_members(count)')
    .eq('customer_id', props.customerId)
    .order('created_at', { ascending: false })

  if (err) error.value = err.message
  else {
    type RawSet = { id: string; name: string; article_set_members?: { count: number }[] }
    sets.value = ((data ?? []) as unknown as RawSet[]).map((s) => ({
      id: s.id,
      name: s.name,
      memberCount: s.article_set_members?.[0]?.count ?? 0,
    }))
  }
  loading.value = false
}

onMounted(load)

// Na ontgrendelen via de statusbalk alsnog uit de cache laden (zie Customers.vue).
watch(useOfflineSession().isUnlocked, (unlocked) => {
  if (unlocked) void load()
})
</script>

<style scoped>
.cs { margin-top: 1.5rem; }
.cs__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
.cs__head h2 { font-size: 1rem; margin: 0; }
.cs__state { color: #666; font-size: 0.9rem; padding: 0.5rem 0; }
.cs__state--error { color: #dc2626; }
.cs__list { list-style: none; margin: 0 0 0.75rem; padding: 0; background: #fff; border-radius: 12px; overflow: hidden; }
.cs__item { padding: 0.85rem 1rem; border-bottom: 1px solid #eee; cursor: pointer; }
.cs__item:last-child { border-bottom: none; }
.cs__name { font-weight: 600; }
.cs__meta { font-size: 0.85rem; color: #6b7280; margin-top: 0.15rem; }
</style>
