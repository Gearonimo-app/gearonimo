// Gedeeld tussen ProductForm.vue, CatalogQueue.vue en CatalogManager.vue.
// Losstaand bestand omdat <script setup> geen losse runtime-exports mag
// hebben naast de component zelf.
export interface ProductFormModel {
  brand: string
  name: string
  product_type: string
  category: string
  material: string
  standard: string
  max_age_years: number | null
  max_age_use_years: number | null
  max_age_mfr_years: number | null
  breaking_strength: string
  interval_override_months: number | null
  manual_url: string
  recall_url: string
  inspection_notice_url: string
  notes: string
}

export function emptyProductForm(): ProductFormModel {
  return {
    brand: '', name: '', product_type: '', category: '', material: '', standard: '',
    max_age_years: null, max_age_use_years: null, max_age_mfr_years: null,
    breaking_strength: '', interval_override_months: null,
    manual_url: '', recall_url: '', inspection_notice_url: '', notes: '',
  }
}
