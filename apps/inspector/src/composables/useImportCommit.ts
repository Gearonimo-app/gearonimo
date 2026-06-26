import { supabase } from '@gearonimo/core'
import { ensureInspector } from './useInspections'
import type { FieldKey, RawRow } from './useImportMapping'

export function headerSignature(headerRow: RawRow): string {
  return headerRow.map((c) => String(c ?? '').trim().toLowerCase()).join('|')
}

/** Zet een cel om naar een ISO-datum (yyyy-mm-dd) of null. Geen fuzzy gokwerk:
 * herkent de gangbare NL/EN-notaties en Excel-datumobjecten (xlsx levert die
 * al als JS Date als de cel een datumformaat heeft). */
export function parseToISODate(value: string | number | null): string | null {
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
  if (['goed', 'ok', 'pass', 'passed', 'akkoord', 'goedgekeurd'].includes(s)) return 'passed'
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
  /** Keuringsdatum (ISO yyyy-mm-dd) voor het hele bestand, voor bestanden zonder datumkolom. Overschrijft een eventuele gekoppelde kolom. */
  fixedInspectionDate?: string
}

export interface CommitResult {
  customersCreated: number
  articlesCreated: number
  articlesSkipped: number
  inspectionsCreated: number
  rowsSkipped: number
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

  const customerCache = new Map<string, string>() // naam (lower) -> id
  const inspectionCache = new Map<string, string>() // customerId|date -> inspection id
  let imported = 0
  let skipped = 0

  for (const row of opts.rows) {
    try {
      const customerName = opts.fixedCustomerName?.trim() || cellsForField(opts.mapping, 'customerName', row)
      const serial = cellsForField(opts.mapping, 'serialNumber', row)
      const description = cellsForField(opts.mapping, 'description', row)
      const inspectionDateRaw = cellsForField(opts.mapping, 'inspectionDate', row)
      const inspectionDate = opts.fixedInspectionDate?.trim() || parseToISODate(inspectionDateRaw)

      if (!customerName || !description || !inspectionDate) {
        skipped++
        continue
      }

      const customerKey = customerName.toLowerCase()
      let customerId = customerCache.get(customerKey)
      if (!customerId) {
        const email = cellsForField(opts.mapping, 'customerEmail', row)
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .ilike('name', customerName)
          .maybeSingle()
        if (existing) {
          customerId = existing.id
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
          customerId = created.id
          result.customersCreated++
        }
        customerCache.set(customerKey, customerId)
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
        const yearRaw = cellsForField(opts.mapping, 'manufactureYear', row)
        const { data: createdArticle, error: artErr } = await supabase
          .from('articles')
          .insert({
            customer_id: customerId,
            free_brand: cellsForField(opts.mapping, 'brand', row) || null,
            free_description: description,
            free_category: cellsForField(opts.mapping, 'category', row) || null,
            free_material: cellsForField(opts.mapping, 'material', row) || null,
            serial_number: serial || null,
            manufacture_year: yearRaw ? parseInt(yearRaw, 10) || null : null,
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
        inspectionId = createdInspection.id
        inspectionCache.set(inspectionKey, inspectionId)
        result.inspectionsCreated++
      }

      const { error: itemErr } = await supabase.from('inspection_items').insert({
        inspection_id: inspectionId,
        article_id: articleId,
        result: normalizeResult(cellsForField(opts.mapping, 'result', row)),
        next_due: parseToISODate(cellsForField(opts.mapping, 'nextDue', row) || null),
        comment: cellsForField(opts.mapping, 'rejectionComment', row) || null,
      })
      if (itemErr) throw itemErr

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
