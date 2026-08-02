<template>
  <!-- Klikbare setkop: sinds het aparte "Sets"-blok weg is (dubbelop met
       deze groepskoppen, besluit Jos 2026-07-13) is dit dé ingang naar
       het setdetail (hernoemen/leden wijzigen/verwijderen). -->
  <li
    v-if="groupHead !== null"
    class="ca__group-head"
    role="link"
    :title="$t('sets.openDetail')"
    @click="emit('open-set', groupId!)"
  >🔗 {{ groupHead }}<span class="ca__group-chev">›</span></li>
  <li class="ca__item" :class="{ 'ca__item--grouped': !!groupId }">
    <div class="ca__item-main" @click="emit('open', article)">
      <div class="ca__desc">{{ label }}</div>
      <div class="ca__meta">
        <span v-if="article.serial_number">SN {{ article.serial_number }}</span>
        <span v-if="!article.product_id" class="ca__badge">{{ $t('articles.freeBadge') }}</span>
      </div>
    </div>
    <!-- Onderdeel toevoegen aan dit artikel (bv. een vervangen brug op
         een klimgordel) -- koppelt in één stap aan (of maakt) de set. -->
    <button type="button" class="ca__part-btn" :title="$t('sets.addPart.title')" @click.stop="emit('add-part', article)">🔗+</button>
    <!-- Alleen bij vrije artikelen: aanmelden voor de catalogus-wachtrij.
         Geen kaal vinkje meer: de knop opent een productformulier dat de
         keurmeester zelf invult vóór het op de wachtrij komt (besluit Jos
         2026-07-05). @click.stop zodat het niet doorklikt naar het
         artikeldetail. Actief = al aangemeld. -->
    <button v-if="!article.product_id" type="button" class="ca__catalog-toggle"
            :class="{ 'ca__catalog-toggle--on': article.suggest_for_catalog }"
            :title="$t('articles.suggestForCatalog')"
            @click.stop="emit('suggest', article)">
      📚
    </button>
  </li>
</template>

<script setup lang="ts">
/**
 * Eén artikel in de lijst op de klantpagina.
 *
 * Eigen component om dezelfde reden als InspectionRow.vue: het
 * toevoegformulier staat in hetzelfde component als deze lijst, dus zonder
 * deze knip tekende Vue bij elke toetsaanslag in dat formulier alle regels
 * opnieuw -- bij een klant met 260 artikelen honderden knooppunten voor niets.
 *
 * Props zijn daarom primitieven of stabiele verwijzingen en acties gaan via
 * `emit`; een inline `@click="() => ..."` of `:foo="{ ... }"` in de ouder
 * maakt het effect meteen ongedaan. Zie CustomerArticles.vue.
 */
import type { Article } from './customerArticleTypes'

defineProps<{
  article: Article
  /** Door de ouder opgemaakt (articleLabel), zodat het archieflijstje dezelfde functie kan gebruiken. */
  label: string
  /** Niet-null = eerste lid van een set, dus met groepskop erboven. */
  groupHead: string | null
  groupId: string | null
}>()

const emit = defineEmits<{
  (e: 'open', article: Article): void
  (e: 'open-set', setId: string): void
  (e: 'add-part', article: Article): void
  (e: 'suggest', article: Article): void
}>()
</script>

<!-- Geen <style scoped>: zie ../styles/article-list.css, gedeeld met
     CustomerArticles.vue (dat dezelfde klassen voor het archief gebruikt). -->
