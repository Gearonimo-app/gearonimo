import { supabase } from '@gearonimo/core'
import { ensureInspector, fetchRejectionCodes } from './useInspections'
import { parseMonth, parseYearMonth, type FieldKey, type RawRow } from './useImportMapping'

/** Zoekt bij een geïmporteerde afkeurcode-cel de juiste rejection_code_id.
 * Matcht eerst op het nummer vooraan ("6" of "6 Defecte sluiting"), daarna op
 * de labeltekst. Niet gevonden → null, zodat de aanroeper de ruwe tekst in de
 * opmerking kan bewaren (niets gaat verloren). */
function resolveRejectionCodeId(
  raw: string,
  codes: { id: string; code: number; label: string | null }[]
): string | null {
  const s = raw.trim()
  if (!s) return null
  const num = s.match(/^(\d+)/)
  if (num) {
    const byCode = codes.find((c) => c.code === parseInt(num[1], 10))
    if (byCode) return byCode.id
  }
  const lower = s.toLowerCase()
  const byLabel = codes.find((c) => {
    const l = (c.label ?? '').toLowerCase()
    return l !== '' && (l === lower || lower.includes(l) || l.includes(lower))
  })
  return byLabel ? byLabel.id : null
}

export function headerSignature(headerRow: RawRow): string {
  return headerRow.map((c) => String(c ?? '').trim().toLowerCase()).join('|')
}

/** Zet een cel om naar een ISO-datum (yyyy-mm-dd) of null. Geen fuzzy gokwerk:
 * herkent de gangbare NL/EN-notaties en Excel-datumobjecten (xlsx levert die
 * al als JS Date als de cel een datumformaat heeft). */
export function parseToISODate(value: string | number | Date | null): string | null {
  if (value === null || value === '') return null
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = String(value).trim()
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/)
  if (dmy) {
    const [, d, m, yRaw] = dmy
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10)
  return null
}

export function normalizeResult(value: string | number | null): 'passed' | 'rejected' | 'not_assessed' {
  const s = String(value ?? '').trim().toLowerCase()
  // 'x'/'✓'/'v': veel certificaten hebben een "Goed"-kolom met alleen een
  // kruisje of vinkje per goedgekeurd artikel — dat is een uitslag, geen
  // ontbrekende waarde.
  if (['goed', 'ok', 'pass', 'passed', 'akkoord', 'goedgekeurd', 'x', '✓', 'v', 'ja', 'yes'].includes(s)) return 'passed'
  if (['afgekeurd', 'nok', 'fail', 'rejected', 'afkeur'].includes(s)) return 'rejected'
  return 'not_assessed'
}

function cellsForField(mapping: Record<number, FieldKey>, field: FieldKey, row: RawRow): string {
  const col = Object.entries(mapping).find(([, f]) => f === field)?.[0]
  if (col === undefined) return ''
  const v = row[Number(col)]
  return v === null ? '' : String(v).trim()
}

export interface CommitOptions {
  rows: RawRow[]
  mapping: Record<number, FieldKey>
  file: File
  sheetName: string
  skipDuplicateSerials: boolean
  /** Klantnaam voor het hele bestand, voor bestanden zonder klantkolom (bijv. één klant per import). Overschrijft een eventuele gekoppelde kolom. */
  fixedCustomerName?: string
  /** Id van een al bestaande klant voor het hele bestand. Is dit gezet, dan
   * gaan alle rijen naar precies die klant (geen zoek-op-naam, geen nieuwe
   * klant) — gekozen via de klant-dropdown in stap 3. */
  fixedCustomerId?: string
  /** Keuringsdatum (ISO yyyy-mm-dd) voor het hele bestand, voor bestanden zonder datumkolom. Overschrijft een eventuele gekoppelde kolom. */
  fixedInspectionDate?: string
}

export interface CommitResult {
  customersCreated: number
  articlesCreated: number
  articlesSkipped: number
  inspectionsCreated: number
  rowsSkipped: number
  /** Subset van rowsSkipped: rij had geen klantnaam (kolom niet gekoppeld én geen vaste klantnaam). */
  rowsSkippedNoCustomer: number
  /** Subset van rowsSkipped: rij had wel een klant, maar geen omschrijving/artikel. */
  rowsSkippedNoDescription: number
  errors: string[]
}

/** Schrijft de gemapte rijen naar de database. Granulariteit: platte lijst,
 * rijen met dezelfde klant + keuringsdatum komen in dezelfde `inspections`-rij
 * (zoals een echte keurdag). Dedup op (klant + serienummer). Het originele
 * bestand gaat ongewijzigd naar Storage (`imports`-bucket) als juridisch
 * anker — er wordt nooit een nieuw certificaat-PDF voor gerenderd. */
export async function commitImport(opts: CommitOptions): Promise<CommitResult> {
  const inspector = await ensureInspector()
  const result: CommitResult = {
    customersCreated: 0,
    articlesCreated: 0,
    articlesSkipped: 0,
    inspectionsCreated: 0,
    rowsSkipped: 0,
    rowsSkippedNoCustomer: 0,
    rowsSkippedNoDescription: 0,
    errors: [],
  }

  const storagePath = `${inspector.company_id}/${Date.now()}-${opts.file.name}`
  const { error: uploadErr } = await supabase.storage.from('imports').upload(storagePath, opts.file)
  if (uploadErr) { result.errors.push(uploadErr.message); return result }

  const { data: batch, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      company_id: inspector.company_id,
      inspector_id: inspector.id,
      original_filename: opts.file.name,
      storage_path: storagePath,
      sheet_name: opts.sheetName,
      row_count: opts.rows.length,
    })
    .select('id')
    .single()
  if (batchErr) { result.errors.push(batchErr.message); return result }

  // Afkeurcodes alleen ophalen als er een afkeurcode-kolom is gekoppeld, zodat
  // we de geïmporteerde code naar de juiste rejection_code_id kunnen vertalen.
  const hasCodeColumn = Object.values(opts.mapping).includes('rejectionCode')
  const rejectionCodes = hasCodeColumn ? await fetchRejectionCodes(inspector.company_id) : []

  const customerCache = new Map<string, string>() // naam (lower) -> id
  const inspectionCache = new Map<string, string>() // customerId|date -> inspection id
  const draftInspectionCache = new Map<string, string>() // customerId -> concept-inspection id (rijen zonder datum)
  let imported = 0
  let skipped = 0

  for (const row of opts.rows) {
    try {
      const customerName = opts.fixedCustomerName?.trim() || cellsForField(opts.mapping, 'customerName', row)
      const serial = cellsForField(opts.mapping, 'serialNumber', row)
      const description = cellsForField(opts.mapping, 'description', row)
      const inspectionDateRaw = cellsForField(opts.mapping, 'inspectionDate', row)
      const inspectionDate = opts.fixedInspectionDate?.trim() || parseToISODate(inspectionDateRaw)

      // Een gekozen bestaande klant (fixedCustomerId) telt altijd als "klant bekend",
      // ook als er geen klantkolom/naam in het bestand staat.
      if ((!customerName && !opts.fixedCustomerId) || !description) {
        skipped++
        // Splits de reden uit zodat het eindscherm kan zeggen wélk veld ontbrak
        // (bij een bestand zonder klantkolom is dat bijna altijd de klantnaam —
        // dan moet in stap 3 een klant gekozen worden).
        if (!customerName && !opts.fixedCustomerId) result.rowsSkippedNoCustomer++
        else result.rowsSkippedNoDescription++
        continue
      }

      let customerId: string
      if (opts.fixedCustomerId) {
        // Vast gekozen klant: alle rijen naar die klant, geen zoek/aanmaak.
        customerId = opts.fixedCustomerId
      } else {
        const customerKey = customerName.toLowerCase()
        customerId = customerCache.get(customerKey) ?? ''
        if (!customerId) {
          const email = cellsForField(opts.mapping, 'customerEmail', row)
          const { data: existing } = await supabase
            .from('customers')
            .select('id')
            .ilike('name', customerName)
            .maybeSingle()
          if (existing) {
            customerId = String(existing.id)
          } else {
            const { data: created, error: custErr } = await supabase
              .from('customers')
              .insert({
                name: customerName,
                email: email || `import-${Date.now()}-${Math.random().toString(36).slice(2)}@onbekend.nl`,
                phone: cellsForField(opts.mapping, 'customerPhone', row) || null,
                city: cellsForField(opts.mapping, 'customerCity', row) || null,
              })
              .select('id')
              .single()
            if (custErr) throw custErr
            customerId = String(created.id)
            result.customersCreated++
          }
          customerCache.set(customerKey, customerId)
        }
      }

      let articleId: string | undefined
      if (serial) {
        const { data: existingArticle } = await supabase
          .from('articles')
          .select('id')
          .eq('customer_id', customerId)
          .ilike('serial_number', serial)
          .maybeSingle()
        if (existingArticle) {
          if (opts.skipDuplicateSerials) {
            articleId = existingArticle.id
            result.articlesSkipped++
          }
        }
      }

      if (!articleId) {
        // Jaar en maand: een aparte maandkolom wint; anders pakken we de maand
        // die eventueel in de jaarcel zelf zit ("07/2022", "mei 2021").
        const ym = parseYearMonth(cellsForField(opts.mapping, 'manufactureYear', row) || null)
        const month = parseMonth(cellsForField(opts.mapping, 'manufactureMonth', row) || null) ?? ym.month
        const { data: createdArticle, error: artErr } = await supabase
          .from('articles')
          .insert({
            customer_id: customerId,
            free_brand: cellsForField(opts.mapping, 'brand', row) || null,
            free_description: description,
            free_category: cellsForField(opts.mapping, 'category', row) || null,
            serial_number: serial || null,
            manufacture_year: ym.year,
            manufacture_month: month,
            first_use_date: parseToISODate(cellsForField(opts.mapping, 'firstUseDate', row) || null),
            assigned_user_name: cellsForField(opts.mapping, 'assignedUserName', row) || null,
            retired: false,
            source: 'import',
          })
          .select('id')
          .single()
        if (artErr) throw artErr
        articleId = createdArticle.id
        result.articlesCreated++
      }

      if (inspectionDate) {
        const inspectionKey = `${customerId}|${inspectionDate}`
        let inspectionId = inspectionCache.get(inspectionKey)
        if (!inspectionId) {
          const { data: createdInspection, error: inspErr } = await supabase
            .from('inspections')
            .insert({
              customer_id: customerId,
              company_id: inspector.company_id,
              inspector_id: inspector.id,
              inspection_date: inspectionDate,
              status: 'completed',
              completed_at: new Date().toISOString(),
              source: 'import',
              import_batch_id: batch.id,
            })
            .select('id')
            .single()
          if (inspErr) throw inspErr
          inspectionId = String(createdInspection.id)
          inspectionCache.set(inspectionKey, inspectionId)
          result.inspectionsCreated++
        }

        // Afkeurcode en opmerking zijn aparte kolommen. De code proberen we te
        // koppelen aan een rejection_code_id; lukt dat niet, dan blijft de ruwe
        // tekst behouden in de opmerking zodat er niets verdwijnt.
        const rawCode = cellsForField(opts.mapping, 'rejectionCode', row)
        const rejectionCodeId = rawCode ? resolveRejectionCodeId(rawCode, rejectionCodes) : null
        const commentParts = [
          rawCode && !rejectionCodeId ? rawCode : '',
          cellsForField(opts.mapping, 'rejectionComment', row),
        ].filter((p) => p && p.trim() !== '')

        // Staat er een afkeurcode maar geen expliciete uitslag, dan was dit een
        // afgekeurd artikel — anders zou de code niet getoond worden.
        let itemResult = normalizeResult(cellsForField(opts.mapping, 'result', row))
        if (rawCode && itemResult === 'not_assessed') itemResult = 'rejected'

        const { error: itemErr } = await supabase.from('inspection_items').insert({
          inspection_id: inspectionId,
          article_id: articleId,
          result: itemResult,
          next_due: parseToISODate(cellsForField(opts.mapping, 'nextDue', row) || null),
          rejection_code_id: rejectionCodeId,
          comment: commentParts.length ? commentParts.join(' — ') : null,
        })
        if (itemErr) throw itemErr
      } else {
        // Geen datum bekend: artikel komt wel bij de klant te staan, maar er is
        // geen echte keuring geweest. Toch zetten we 'm in een concept-keuring
        // (status 'draft', geen certificaat) zodat hij vanzelf opduikt zodra de
        // keurmeester via Klant → Nieuwe keuring deze klant oppakt — in plaats
        // van pas zichtbaar te worden na een handmatige zoekactie.
        let draftInspectionId = draftInspectionCache.get(customerId)
        if (!draftInspectionId) {
          const { data: existingDraft } = await supabase
            .from('inspections')
            .select('id')
            .eq('customer_id', customerId)
            .eq('company_id', inspector.company_id)
            .eq('status', 'draft')
            .maybeSingle()
          if (existingDraft) {
            draftInspectionId = String(existingDraft.id)
          } else {
            const { data: createdDraft, error: draftErr } = await supabase
              .from('inspections')
              .insert({
                customer_id: customerId,
                company_id: inspector.company_id,
                inspector_id: inspector.id,
                status: 'draft',
                source: 'import',
                import_batch_id: batch.id,
              })
              .select('id')
              .single()
            if (draftErr) throw draftErr
            draftInspectionId = String(createdDraft.id)
            result.inspectionsCreated++
          }
          draftInspectionCache.set(customerId, draftInspectionId)
        }

        const { error: itemErr } = await supabase.from('inspection_items').insert({
          inspection_id: draftInspectionId,
          article_id: articleId,
          result: 'not_assessed',
        })
        if (itemErr) throw itemErr
      }

      imported++
    } catch (err) {
      result.errors.push((err as Error).message)
      skipped++
    }
  }

  result.rowsSkipped = skipped
  await supabase
    .from('import_batches')
    .update({ imported_count: imported, skipped_count: skipped })
    .eq('id', batch.id)

  return result
}

export interface SavedProfile {
  header_row_index: number
  mapping: Record<number, FieldKey>
}

export async function findImportProfile(headerRow: RawRow): Promise<SavedProfile | null> {
  const inspector = await ensureInspector()
  const { data } = await supabase
    .from('import_profiles')
    .select('header_row_index, mapping')
    .eq('company_id', inspector.company_id)
    .eq('header_signature', headerSignature(headerRow))
    .maybeSingle()
  if (!data) return null
  return { header_row_index: data.header_row_index, mapping: data.mapping as Record<number, FieldKey> }
}

export async function saveImportProfile(headerRow: RawRow, headerRowIndex: number, mapping: Record<number, FieldKey>): Promise<void> {
  const inspector = await ensureInspector()
  await supabase
    .from('import_profiles')
    .upsert(
      {
        company_id: inspector.company_id,
        header_signature: headerSignature(headerRow),
        header_row_index: headerRowIndex,
        mapping,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,header_signature' }
    )
}
