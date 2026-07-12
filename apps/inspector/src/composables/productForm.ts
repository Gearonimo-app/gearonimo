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
  manufacturer_code: string
  max_age_use_years: number | null
  max_age_mfr_years: number | null
  breaking_strength: string
  working_load_limit: string
  max_user_weight_kg: number | null
  rope_diameter_min_mm: number | null
  rope_diameter_max_mm: number | null
  serial_number_location: string
  interval_override_months: number | null
  manual_url: string
  product_page_url: string
  recall_url: string
  inspection_notice_url: string
  notes: string
}

export function emptyProductForm(): ProductFormModel {
  return {
    brand: '', name: '', product_type: '', category: '', material: '', standard: '',
    manufacturer_code: '',
    max_age_use_years: null, max_age_mfr_years: null,
    breaking_strength: '', working_load_limit: '', max_user_weight_kg: null,
    rope_diameter_min_mm: null, rope_diameter_max_mm: null,
    serial_number_location: '',
    interval_override_months: null,
    manual_url: '', product_page_url: '', recall_url: '', inspection_notice_url: '', notes: '',
  }
}

const STRING_FIELDS = [
  'brand', 'name', 'product_type', 'category', 'material', 'standard', 'manufacturer_code',
  'breaking_strength', 'working_load_limit', 'serial_number_location',
  'manual_url', 'product_page_url', 'recall_url', 'inspection_notice_url', 'notes',
] as const satisfies readonly (keyof ProductFormModel)[]

// products.* laat de meeste tekstvelden null zijn in de database, ook al
// belooft ProductFormModel altijd een string. Data van buitenaf (bewerken,
// kopiëren, catalog_suggestion-JSON) moet hierdoorheen voordat 'm in het
// formulier komt, anders crasht het opslaan op `null.trim()`.
export function toFormModel(row: Partial<Record<keyof ProductFormModel, unknown>>): ProductFormModel {
  const merged = { ...emptyProductForm(), ...row } as ProductFormModel
  for (const key of STRING_FIELDS) {
    if (merged[key] == null) merged[key] = ''
  }
  return merged
}
