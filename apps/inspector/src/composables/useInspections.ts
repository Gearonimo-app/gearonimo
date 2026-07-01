import {
  supabase,
  useOnline,
  useOfflineSession,
  getArticlesForCustomer,
  getRejectionCodes,
  getCompanySettings,
  cacheInspectorContext,
  getCachedInspectorContext,
  enqueueMutation,
  putInspection,
  putInspectionItems,
  getInspection,
  getDraftInspectionForCustomer,
  getInspectionItems,
  findLocalPreviousResult,
  findLocalPreviousResults,
  getLocallyInspectedArticleIds,
  getLocalInspectionStatus,
  deleteInspectionCache,
  deleteMutationsForInspection,
  touchDownloadActivity,
} from '@gearonimo/core'

export interface Inspector {
  id: string
  company_id: string
}

let cached: Inspector | null = null

function requireOfflineKey(): CryptoKey {
  return useOfflineSession().getKey()
}

// De inspectors-tabel heeft nog geen beheerscherm; deze RPC zet automatisch
// een rij neer voor de ingelogde gebruiker bij het (enige) keurbedrijf. Het
// resultaat wordt ook lokaal gecached (niet gevoelig, het is de eigen
// identiteit van de keurmeester) zodat de rest van deze module ook zonder
// netwerk weet welk keurbedrijf/welke keurmeester het is.
export async function ensureInspector(): Promise<Inspector> {
  if (cached) return cached
  const { isOnline } = useOnline()
  if (isOnline.value) {
    const { data, error } = await supabase.rpc('ensure_inspector').single()
    if (error) throw error
    cached = data as Inspector
    await cacheInspectorContext({ companyId: cached.company_id, inspectorId: cached.id })
    return cached
  }
  const ctx = await getCachedInspectorContext()
  if (!ctx) {
    throw new Error('Geen offline keurmeester-gegevens bekend. Log eerst één keer online in voordat je offline werkt.')
  }
  cached = { id: ctx.inspectorId, company_id: ctx.companyId }
  return cached
}

// Welke optionele velden een keurbedrijf bij vrije invoer wil kunnen invullen,
// afgeleid van de aangezette certificaat-kolommen (cert_layout.columns). Nu
// alleen Norm/MBS; leeg/onbekend = uit (gelijk aan DEFAULT_CERT_LAYOUT).
export async function fetchFreeInputFields(): Promise<{ norm: boolean; mbs: boolean }> {
  const inspector = await ensureInspector()
  const { isOnline } = useOnline()
  let certLayout: { columns?: Record<string, boolean> } | null = null
  if (isOnline.value) {
    const { data } = await supabase
      .from('inspection_companies')
      .select('cert_layout')
      .eq('id', inspector.company_id)
      .single()
    certLayout = (data?.cert_layout as { columns?: Record<string, boolean> } | null) ?? null
  } else {
    const key = requireOfflineKey()
    const company = await getCompanySettings<{ cert_layout?: { columns?: Record<string, boolean> } }>(
      key,
      inspector.company_id
    )
    certLayout = company?.cert_layout ?? null
  }
  const cols = certLayout?.columns ?? {}
  return { norm: !!cols.norm, mbs: !!cols.mbs }
}

export interface ArticleScope { allIds: string[]; newIds: string[] }

// Bij grote sets (tientallen artikelen) is per-artikel aanvinken onwerkbaar.
// In plaats daarvan biedt de keurmeester een binaire keuze: alles van de
// klant erbij, of alleen de artikelen die nog nooit in een keuring hebben
// gezeten (bijv. net geüpload n.a.v. een oud certificaat, of straks
// zelf door de klant toegevoegd). "Nieuw" = geen enkele inspection_items-rij
// ooit, dus onafhankelijk van wanneer het artikel is aangemaakt.
//
// Offline-beperking: "nieuw" wordt dan bepaald op basis van wat lokaal
// gecached is (gedownloade klant + eventuele eerder offline gemaakte
// keuringen), niet de volledige serverhistorie. Een prima hint, geen
// besluitvormende logica.
export async function fetchArticleScope(customerId: string, excludeArticleIds: string[] = []): Promise<ArticleScope> {
  const exclude = new Set(excludeArticleIds)
  const { isOnline } = useOnline()

  if (isOnline.value) {
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

  const key = requireOfflineKey()
  const articles = await getArticlesForCustomer<{ id: string; retired: boolean }>(key, customerId)
  const allIds = articles.filter((a) => !a.retired).map((a) => a.id).filter((id) => !exclude.has(id))
  if (!allIds.length) return { allIds: [], newIds: [] }
  const inspectedSet = await getLocallyInspectedArticleIds(key)
  const newIds = allIds.filter((id) => !inspectedSet.has(id))
  return { allIds, newIds }
}

// Welke artikelen staan al in deze (concept-)keuring, om bij het hervatten te
// kunnen tonen wat er nog extra van de klant bij gehaald kan worden.
export async function fetchInspectionArticleIds(inspectionId: string): Promise<string[]> {
  const { isOnline } = useOnline()
  if (isOnline.value) {
    const { data, error } = await supabase.from('inspection_items').select('article_id').eq('inspection_id', inspectionId)
    if (error) throw error
    return (data ?? []).map((r) => r.article_id)
  }
  const key = requireOfflineKey()
  const items = await getInspectionItems<{ article_id: string }>(key, inspectionId)
  return items.map((i) => i.article_id)
}

// Voegt artikelen toe aan een al bestaande keuring (bijv. een open concept
// dat oorspronkelijk niet alle artikelen van de klant had) als nog
// onbeoordeelde items.
export async function addArticlesToInspection(inspectionId: string, articleIds: string[]): Promise<void> {
  if (!articleIds.length) return
  const { isOnline } = useOnline()

  if (isOnline.value) {
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
    return
  }

  const key = requireOfflineKey()
  const inspection = await getInspection<{ id: string; customer_id: string }>(key, inspectionId)
  if (!inspection) throw new Error('Deze keuring is niet offline beschikbaar.')
  const articles = await getArticlesForCustomer<Record<string, unknown> & { id: string }>(key, inspection.customer_id)
  const byId = new Map(articles.map((a) => [a.id, a]))
  const newItems = articleIds.map((articleId) => ({
    id: crypto.randomUUID(),
    inspection_id: inspectionId,
    article_id: articleId,
    article_snapshot: byId.get(articleId) ?? null,
    result: 'not_assessed',
    next_due: null,
    rejection_code_id: null,
    comment: null,
  }))
  await putInspectionItems(key, inspectionId, newItems)
  for (const item of newItems) {
    await enqueueMutation({ customerId: inspection.customer_id, table: 'inspection_items', op: 'insert', payload: item })
  }
  await touchDownloadActivity(inspection.customer_id)
}

// Maakt een nieuwe keuring (concept) aan met precies de gekozen artikelen als
// (nog onbeoordeelde) keuringsitems — het resultaat van de selectiedialoog.
// Offline: het keuring-id en de item-id's worden hier client-side aangemaakt
// (crypto.randomUUID()) i.p.v. door de server -- nodig om zonder netwerk toch
// een bruikbaar id te hebben. De certificaatnummering (JJJJMMDD-KLANTNAAM,
// geen volgnummer) loopt hier niet doorheen en heeft dus geen last van een
// client-side id (zie BOUWPLAN, slice 5).
export async function startInspectionWithArticles(customerId: string, articleIds: string[]): Promise<string> {
  const inspector = await ensureInspector()
  const { isOnline } = useOnline()

  if (isOnline.value) {
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

  const key = requireOfflineKey()
  const inspectionId = crypto.randomUUID()
  const inspectionRow = {
    id: inspectionId,
    customer_id: customerId,
    company_id: inspector.company_id,
    inspector_id: inspector.id,
    status: 'draft',
    inspection_date: new Date().toISOString().slice(0, 10),
  }
  await putInspection(key, inspectionRow)
  await enqueueMutation({ customerId, table: 'inspections', op: 'insert', payload: inspectionRow })

  if (articleIds.length) {
    const articles = await getArticlesForCustomer<Record<string, unknown> & { id: string }>(key, customerId)
    const byId = new Map(articles.map((a) => [a.id, a]))
    const items = articleIds.map((articleId) => ({
      id: crypto.randomUUID(),
      inspection_id: inspectionId,
      article_id: articleId,
      article_snapshot: byId.get(articleId) ?? null,
      result: 'not_assessed',
      next_due: null,
      rejection_code_id: null,
      comment: null,
    }))
    await putInspectionItems(key, inspectionId, items)
    for (const item of items) {
      await enqueueMutation({ customerId, table: 'inspection_items', op: 'insert', payload: item })
    }
  }

  await touchDownloadActivity(customerId)
  return inspectionId
}

// Bestaand concept ophalen zonder er een aan te maken (voor de Start/Hervat-
// knop op de klantpagina).
export async function findDraftInspection(customerId: string): Promise<{ id: string; inspection_date: string } | null> {
  const inspector = await ensureInspector()
  const { isOnline } = useOnline()
  if (isOnline.value) {
    // Er kunnen meerdere concepten naast elkaar bestaan (bv. offline gestart
    // terwijl er op de server al één stond -- de lokale cache ziet die niet
    // altijd). maybeSingle() zonder limit gooit dan een "multiple rows"-fout
    // en blokkeert de hele Start/Hervat-knop; pak gewoon de nieuwste.
    const { data, error } = await supabase
      .from('inspections')
      .select('id, inspection_date')
      .eq('customer_id', customerId)
      .eq('company_id', inspector.company_id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data
  }
  const key = requireOfflineKey()
  return getDraftInspectionForCustomer<{ id: string; inspection_date: string }>(key, customerId)
}

// Een concept-keuring definitief weggooien (testresten, dubbel gestart, per
// ongeluk aangemaakt). Alleen concepten: afgeronde keuringen zijn historie,
// en een lokaal als pending_completion gemarkeerde keuring (offline afgerond,
// certificaat wacht op sync) is geen concept meer -- die weigeren we hier,
// ook al staat hij op de server nog als draft. Artikelen van de klant blijven
// gewoon bestaan; alleen de keuring en haar (resultaat)items gaan weg.
// Online-only (de knop is offline verborgen): het serverrecord is de bron.
export async function deleteDraftInspection(inspectionId: string): Promise<void> {
  const { isOnline } = useOnline()
  if (!isOnline.value) throw new Error('Concepten verwijderen kan alleen online.')

  if ((await getLocalInspectionStatus(inspectionId)) === 'pending_completion') {
    throw new Error('Deze keuring is offline afgerond en wacht op haar certificaat -- synchroniseer eerst.')
  }

  const { data: insp, error: checkErr } = await supabase
    .from('inspections')
    .select('id, status')
    .eq('id', inspectionId)
    .maybeSingle()
  if (checkErr) throw checkErr
  if (insp && insp.status !== 'draft') {
    throw new Error('Alleen concepten kunnen verwijderd worden.')
  }
  if (insp) {
    const { error: itemsErr } = await supabase.from('inspection_items').delete().eq('inspection_id', inspectionId)
    if (itemsErr) throw itemsErr
    const { error: insErr } = await supabase.from('inspections').delete().eq('id', inspectionId)
    if (insErr) throw insErr
  }

  // Lokale sporen ook opruimen: de gecachete kopie (anders duikt het concept
  // offline weer op) en de wachtrij-mutaties (anders zet de eerstvolgende
  // sync het net verwijderde concept gewoon terug op de server).
  const itemIds = await deleteInspectionCache(inspectionId)
  await deleteMutationsForInspection(inspectionId, itemIds)
}

// Resultaat (en datum) van de meest recente afgeronde keuring van dit artikel,
// voor de "vorige keuring: goed (12 jun 2025)"-context in stap 2 van de wizard.
// Offline-beperking: ziet alleen geschiedenis die lokaal gecached is (zie
// findLocalPreviousResult) -- een contexthint, geen besluitvormende logica.
export async function findPreviousResult(
  articleId: string,
  excludeInspectionId: string
): Promise<{ result: string; comment: string | null; inspection_date: string } | null> {
  const { isOnline } = useOnline()
  if (isOnline.value) {
    const { data, error } = await supabase
      .from('inspection_items')
      .select('result, comment, inspection:inspections(inspection_date, status)')
      .eq('article_id', articleId)
      .neq('inspection_id', excludeInspectionId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    interface PrevItemRow {
      result: string
      comment: string | null
      inspection: { inspection_date: string; status: string } | null
    }
    const rows = (data ?? []) as unknown as PrevItemRow[]
    const completed = rows.find((row) => row.inspection?.status === 'completed')
    if (!completed || !completed.inspection) return null
    return {
      result: completed.result,
      comment: completed.comment,
      inspection_date: completed.inspection.inspection_date,
    }
  }

  const key = requireOfflineKey()
  const item = await findLocalPreviousResult<{ result: string; comment: string | null; inspection_id: string; article_id: string }>(
    key,
    articleId,
    excludeInspectionId
  )
  if (!item) return null
  const inspection = await getInspection<{ status: string; inspection_date: string }>(key, item.inspection_id)
  if (!inspection || inspection.status !== 'completed') return null
  return { result: item.result, comment: item.comment, inspection_date: inspection.inspection_date }
}

export type PreviousResult = { result: string; comment: string | null; inspection_date: string } | null

// Bulk-variant van findPreviousResult voor het laden van de wizard: online
// gewoon de bestaande per-artikel-aanroepen parallel (gedrag ongewijzigd),
// offline één decryptie-ronde over de lokale cache i.p.v. per item opnieuw
// alles ontsleutelen (O(n^2), merkbaar traag op een tablet bij grote sets).
export async function findPreviousResults(
  articleIds: string[],
  excludeInspectionId: string
): Promise<Record<string, PreviousResult>> {
  const { isOnline } = useOnline()
  if (isOnline.value) {
    const entries = await Promise.all(
      articleIds.map(async (id) => [id, await findPreviousResult(id, excludeInspectionId)] as const)
    )
    return Object.fromEntries(entries)
  }

  const key = requireOfflineKey()
  const hits = await findLocalPreviousResults<{
    result: string
    comment: string | null
    inspection_id: string
    article_id: string
  }>(key, articleIds, excludeInspectionId)
  const out: Record<string, PreviousResult> = Object.fromEntries(articleIds.map((id) => [id, null]))
  const inspectionById = new Map<string, { status: string; inspection_date: string } | null>()
  for (const [articleId, item] of hits) {
    let inspection = inspectionById.get(item.inspection_id)
    if (inspection === undefined) {
      inspection = await getInspection<{ status: string; inspection_date: string }>(key, item.inspection_id)
      inspectionById.set(item.inspection_id, inspection)
    }
    if (inspection && inspection.status === 'completed') {
      out[articleId] = { result: item.result, comment: item.comment, inspection_date: inspection.inspection_date }
    }
  }
  return out
}

// Afkeurcodes zijn per keurbedrijf instelbaar (besluit Jos 2026-06-25). Heeft
// dit bedrijf een eigen set, dan gebruiken we alléén die (ook als sommige
// uitgezet zijn — bewust niet terugvallen). Heeft het er nog geen, dan vallen
// we terug op de platformstandaard (company_id leeg) als startset; het
// instellingenscherm seedt bij eerste opening een eigen kopie. Leeg resultaat
// = wizard valt terug op vrije tekst (zie 20260624_rejection_codes.sql).
export async function fetchRejectionCodes(companyId: string): Promise<{ id: string; code: number; label: string | null }[]> {
  const { isOnline } = useOnline()
  if (!isOnline.value) {
    const key = requireOfflineKey()
    return getRejectionCodes<{ id: string; code: number; label: string | null }>(key, companyId)
  }

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
