import { ref, watch, type Ref } from 'vue'
import { useCategoryLabel } from './useCategoryLabel'

export type FreeType = 'ppe' | 'rigging'

/**
 * PBM of rigging voor een vrij artikel (geen catalogusproduct). Bepaalt de
 * keurtermijn (6/12 maanden) via `articles.free_product_type` (Jos,
 * 2026-10-02: "iedere keer een datum aanklikken kost veel tijd").
 *
 * Voorgevuld met wat de catalogus in de getypte categorie het meest is,
 * zolang de keurmeester niet zelf geklikt heeft. Gemengde categorieën
 * (katrollen, slings, ankers) vallen zo meestal op PBM -- daarom blijft het
 * een knopje en geen stille aanname. Gedeeld door de keuring en
 * Klantartikelen, zodat de twee nooit verschillend raden.
 */
export function useFreeType(
  products: Ref<{ category: string | null; product_type?: string | null }[]>,
  category: Ref<string>
) {
  const categoryLabel = useCategoryLabel()
  const freeType = ref<FreeType>('ppe')
  let touched = false

  function guess(categoryText: string): FreeType {
    const c = categoryText.trim().toLowerCase()
    if (!c) return 'ppe'
    let ppe = 0
    let rigging = 0
    for (const p of products.value) {
      if (categoryLabel(p.category).toLowerCase() !== c) continue
      if (p.product_type === 'rigging') rigging++
      else if (p.product_type === 'ppe') ppe++
    }
    return rigging > ppe ? 'rigging' : 'ppe'
  }

  watch(category, (c) => {
    if (!touched) freeType.value = guess(c)
  })

  function setFreeType(type: FreeType) {
    freeType.value = type
    touched = true
  }
  function resetFreeType() {
    touched = false
    freeType.value = guess(category.value)
  }

  return { freeType, setFreeType, resetFreeType }
}
