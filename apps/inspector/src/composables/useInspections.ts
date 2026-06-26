import { supabase } from '@gearonimo/core'

export interface Inspector {
  id: string
  company_id: string
}

let cached: Inspector | null = null

// De inspectors-tabel heeft nog geen beheerscherm; deze RPC zet automatisch
// een rij neer voor de ingelogde gebruiker bij het (enige) keurbedrijf.
export async function ensureInspector(): Promise<Inspector> {
  if (cached) return cached
  const { data, error } = await supabase.rpc('ensure_inspector').single()
  if (error) throw error
  cached = data as Inspector
  return cached
}

// Welke optionele velden een keurbedrijf bij vrije invoer wil kunnen invullen,
// afgeleid van de aangezette certificaat-kolommen (cert_layout.columns). Nu
// alleen Norm/MBS; leeg/onbekend = uit (gelijk aan DEFAULT_CERT_LAYOUT).
export async function fetchFreeInputFields(): Promise<{ norm: boolean; mbs: boolean }> {
  const inspector = await ensureInspector()
  const { data } = await supabase
    .from('inspection_companies')
    .select('cert_layout')
    .eq('id', inspector.company_id)
    .single()
  const cols = ((data?.cert_layout as { columns?: Record<string, boolean> } | null)?.columns) ?? {}
  return { norm: !!cols.norm, mbs: !!cols.mbs }
}

export interface ArticleScope { allIds: string[]; newIds: string[] }

// Bij grote sets (tientallen artikelen) is per-artikel aanvinken onwerkbaar.
// In plaats daarvan biedt de keurmeester een binaire keuze: alles van de
// klant erbij, of alleen de artikelen die nog nooit in een keuring hebben
// gezeten (bijv. net geüpload n.a.v. een oud certificaat, of straks
// zelf door de klant toegevoegd). "Nieuw" = geen enkele inspection_items-rij
// ooit, dus onafhankelijk van wanneer het artikel is aangemaakt.
export async function fetchArticleScope(customerId: string, excludeArticleIds: string[] = []): Promise<ArticleScope> {
  const exclude = new Set(excludeArticleIds)
  const { data, error } = await supabase
    .from('articles')
    .select('id')
    .eq('customer_id', customerId)
    .eq('retired', false)
  if (error) throw error
  const allIds = (data ?? []).map((a) => a.id).filter((id) => !exclude.has(id))
  if (!allIds.length) return { allIds: [], newIds: [] }
  const { data: inspected, error: insErr } = await supabase
    .from('inspection_items')
    .select('article_id')
    .in('article_id', allIds)
  if (insErr) throw insErr
  const inspectedSet = new Set((inspected ?? []).map((r) => r.article_id))
  const newIds = allIds.filter((id) => !inspectedSet.has(id))
  return { allIds, newIds }
}

// Welke artikelen staan al in deze (concept-)keuring, om bij het hervatten te
// kunnen tonen wat er nog extra van de klant bij gehaald kan worden.
export async function fetchInspectionArticleIds(inspectionId: string): Promise<string[]> {
  const { data, error } = await supabase.from('inspection_items').select('article_id').eq('inspection_id', inspectionId)
  if (error) throw error
  return (data ?? []).map((r) => r.article_id)
}

// Voegt artikelen toe aan een al bestaande keuring (bijv. een open concept
// dat oorspronkelijk niet alle artikelen van de klant had) als nog
// onbeoordeelde items.
export async function addArticlesToInspection(inspectionId: string, articleIds: string[]): Promise<void> {
  if (!articleIds.length) return
  const { data: articles, error: artErr } = await supabase.from('articles').select('*').in('id', articleIds)
  if (artErr) throw artErr
  const { error: itemsErr } = await supabase.from('inspection_items').insert(
    (articles ?? []).map((a) => ({
      inspection_id: inspectionId,
      article_id: a.id,
      article_snapshot: a,
      result: 'not_assessed',
    }))
  )
  if (itemsErr) throw itemsErr
}

// Maakt een nieuwe keuring (concept) aan met precies de gekozen artikelen als
// (nog onbeoordeelde) keuringsitems — het resultaat van de selectiedialoog.
export async function startInspectionWithArticles(customerId: string, articleIds: string[]): Promise<string> {
  const inspector = await ensureInspector()

  const { data: inspection, error: insErr } = await supabase
    .from('inspections')
    .insert({ customer_id: customerId, company_id: inspector.company_id, inspector_id: inspector.id })
    .select('id')
    .single()
  if (insErr) throw insErr

  if (articleIds.length) {
    const { data: articles, error: artErr } = await supabase.from('articles').select('*').in('id', articleIds)
    if (artErr) throw artErr
    const { error: itemsErr } = await supabase.from('inspection_items').insert(
      (articles ?? []).map((a) => ({
        inspection_id: inspection.id,
        article_id: a.id,
        article_snapshot: a,
        result: 'not_assessed',
      }))
    )
    if (itemsErr) throw itemsErr
  }

  return inspection.id
}

// Bestaand concept ophalen zonder er een aan te maken (voor de Start/Hervat-
// knop op de klantpagina).
export async function findDraftInspection(customerId: string): Promise<{ id: string; inspection_date: string } | null> {
  const inspector = await ensureInspector()
  const { data, error } = await supabase
    .from('inspections')
    .select('id, inspection_date')
    .eq('customer_id', customerId)
    .eq('company_id', inspector.company_id)
    .eq('status', 'draft')
    .maybeSingle()
  if (error) throw error
  return data
}

// Resultaat (en datum) van de meest recente afgeronde keuring van dit artikel,
// voor de "vorige keuring: goed (12 jun 2025)"-context in stap 2 van de wizard.
export async function findPreviousResult(
  articleId: string,
  excludeInspectionId: string
): Promise<{ result: string; comment: string | null; inspection_date: string } | null> {
  const { data, error } = await supabase
    .from('inspection_items')
    .select('result, comment, inspection:inspections(inspection_date, status)')
    .eq('article_id', articleId)
    .neq('inspection_id', excludeInspectionId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  const completed = (data ?? []).find((row: any) => row.inspection?.status === 'completed')
  if (!completed) return null
  return {
    result: completed.result,
    comment: completed.comment,
    inspection_date: (completed as any).inspection.inspection_date,
  }
}

// Afkeurcodes zijn per keurbedrijf instelbaar (besluit Jos 2026-06-25). Heeft
// dit bedrijf een eigen set, dan gebruiken we alléén die (ook als sommige
// uitgezet zijn — bewust niet terugvallen). Heeft het er nog geen, dan vallen
// we terug op de platformstandaard (company_id leeg) als startset; het
// instellingenscherm seedt bij eerste opening een eigen kopie. Leeg resultaat
// = wizard valt terug op vrije tekst (zie 20260624_rejection_codes.sql).
export async function fetchRejectionCodes(companyId: string): Promise<{ id: string; code: number; label: string | null }[]> {
  const own = await supabase
    .from('rejection_codes')
    .select('id, code, label, active')
    .eq('company_id', companyId)
    .order('code')
  if (own.error) throw own.error
  if (own.data && own.data.length) {
    return own.data
      .filter((r) => r.active)
      .map((r) => ({ id: r.id, code: r.code, label: r.label }))
  }

  const platform = await supabase
    .from('rejection_codes')
    .select('id, code, label')
    .eq('active', true)
    .is('company_id', null)
    .order('code')
  if (platform.error) throw platform.error
  return (platform.data ?? []).map((r) => ({ id: r.id, code: r.code, label: r.label }))
}
