// Vorm van één artikelregel op de klantpagina, gedeeld door
// CustomerArticles.vue (de lijst) en CustomerArticleRow.vue (de regel).
//
// Bewust smal gehouden: alleen de velden die de lijst zelf toont of nodig
// heeft. Het volledige artikel staat in DATAMODEL.md.

export interface ProductMatch {
  id: string;
  brand: string | null;
  name: string | null;
  product_type?: string | null;
}

export interface Article {
  id: string;
  serial_number: string | null;
  free_brand: string | null;
  free_description: string | null;
  product_id: string | null;
  suggest_for_catalog: boolean;
  product: ProductMatch | null;
  retired_reason?: string | null;
}
