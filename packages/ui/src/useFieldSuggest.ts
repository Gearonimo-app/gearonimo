import { ref, computed, watch, nextTick, type Ref } from "vue";

export interface FieldSuggestOptions<F extends string> {
  /** Geef de suggesties voor het opgegeven veld. Mag reactieve bronnen lezen;
   * de interne computed houdt de afhankelijkheden bij. */
  resolve: (field: F) => string[];
  /** Pas een gekozen waarde toe op het opgegeven veld. */
  select: (field: F, value: string) => void;
  /** Optioneel: na bevestigen met Enter (bijv. focus naar het volgende veld). */
  onEnter?: (field: F) => void;
  /** Optioneel: gemarkeerde suggestie in beeld scrollen (lange lijsten). */
  scrollToActive?: boolean;
}

/**
 * Gedeelde typeahead-besturing: actief veld, suggestielijst, toetsenbord-
 * navigatie (↑/↓/Esc/Enter/Tab) en index-beheer. De velddefinities en de
 * bron-/toepasslogica blijven bij de aanroeper, zodat zowel de keuring-wizard
 * (artikel/merk/categorie/serienummer/match) als de klant-artikelenlijst
 * (artikel/merk/categorie) dezelfde besturing delen.
 */
export function useFieldSuggest<F extends string>(opts: FieldSuggestOptions<F>) {
  const activeField = ref<F | null>(null) as Ref<F | null>;
  const suggestIndex = ref(-1);
  const itemRefs = ref<HTMLElement[]>([]);

  const suggestions = computed<string[]>(() => {
    const f = activeField.value;
    return f ? opts.resolve(f) : [];
  });

  watch(suggestions, () => {
    suggestIndex.value = -1;
  });

  if (opts.scrollToActive) {
    watch(suggestIndex, (i) => {
      if (i < 0) return;
      nextTick(() => itemRefs.value[i]?.scrollIntoView({ block: "nearest" }));
    });
  }

  /** Klik op een suggestie. */
  function pick(value: string) {
    const f = activeField.value;
    if (!f) return;
    opts.select(f, value);
    // select() kan activeField zelf al hebben gesloten (bijv. async match).
    if (activeField.value === f) activeField.value = null;
  }

  /** Korte vertraging zodat een klik nog registreert vóór blur de lijst sluit. */
  function close() {
    setTimeout(() => {
      activeField.value = null;
    }, 120);
  }

  function onKeydown(e: KeyboardEvent) {
    const f = activeField.value;
    if (!f) return;
    const sugg = suggestions.value;
    if (e.key === "ArrowDown" && sugg.length) {
      e.preventDefault();
      suggestIndex.value = (suggestIndex.value + 1) % sugg.length;
    } else if (e.key === "ArrowUp" && sugg.length) {
      e.preventDefault();
      suggestIndex.value = suggestIndex.value <= 0 ? sugg.length - 1 : suggestIndex.value - 1;
    } else if (e.key === "Escape") {
      activeField.value = null;
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (suggestIndex.value >= 0 && sugg.length) {
        opts.select(f, sugg[suggestIndex.value]);
      }
      activeField.value = null;
      if (e.key === "Enter") {
        e.preventDefault();
        opts.onEnter?.(f);
      }
    }
  }

  return { activeField, suggestIndex, suggestions, itemRefs, pick, close, onKeydown };
}
