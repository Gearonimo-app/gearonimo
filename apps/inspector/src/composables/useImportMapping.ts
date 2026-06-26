// Excel/CSV-import: kolomdefinities, een lichte hint-prefill (géén fuzzy
// matching — zie besluit met Jos 2026-06-26: de keurmeester wijst zelf de
// koprij en kolommen aan via dropdowns; dit is alleen een sneltoetsje) en
// droogloop-validatie van de gemapte rijen.

export type FieldKey =
  | 'ignore'
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'customerCity'
  | 'brand'
  | 'description'
  | 'category'
  | 'material'
  | 'serialNumber'
  | 'manufactureYear'
  | 'firstUseDate'
  | 'assignedUserName'
  | 'inspectionDate'
  | 'result'
  | 'rejectionComment'
  | 'nextDue'

export interface FieldDef {
  key: FieldKey
  group: 'ignore' | 'customer' | 'article' | 'inspection'
  required?: boolean
  /** kleine set substrings (lowercase, nl+en) voor de hint-prefill */
  hints: string[]
}

export const FIELD_DEFS: FieldDef[] = [
  { key: 'ignore', group: 'ignore', hints: [] },
  { key: 'customerName', group: 'customer', required: true, hints: ['klant', 'bedrijf', 'customer', 'company', 'naam', 'name'] },
  { key: 'customerEmail', group: 'customer', hints: ['e-mail', 'email'] },
  { key: 'customerPhone', group: 'customer', hints: ['telefoon', 'tel', 'phone'] },
  { key: 'customerCity', group: 'customer', hints: ['plaats', 'stad', 'city', 'woonplaats'] },
  { key: 'brand', group: 'article', hints: ['merk', 'brand', 'fabrikant', 'manufacturer'] },
  { key: 'description', group: 'article', required: true, hints: ['omschrijving', 'artikel', 'product', 'description', 'type'] },
  { key: 'category', group: 'article', hints: ['categorie', 'category', 'soort'] },
  { key: 'material', group: 'article', hints: ['materiaal', 'material'] },
  { key: 'serialNumber', group: 'article', required: true, hints: ['serienr', 'serienummer', 'sn', 'serial'] },
  { key: 'manufactureYear', group: 'article', hints: ['bouwjaar', 'fabricagejaar', 'manufacture', 'year'] },
  { key: 'firstUseDate', group: 'article', hints: ['ingebruik', 'eerste gebruik', 'first use'] },
  { key: 'assignedUserName', group: 'article', hints: ['gebruiker', 'user', 'toegewezen'] },
  { key: 'inspectionDate', group: 'inspection', hints: ['keurdatum', 'keuringsdatum', 'datum', 'date', 'inspection date'] },
  { key: 'result', group: 'inspection', hints: ['resultaat', 'result', 'goed', 'afgekeurd', 'ok', 'nok'] },
  { key: 'rejectionComment', group: 'inspection', hints: ['afkeur', 'opmerking', 'comment', 'reject'] },
  { key: 'nextDue', group: 'inspection', hints: ['volgende keuring', 'next due', 'vervaldatum'] },
]

export type RawRow = (string | number | null)[]

/** Gokt welke rij in de eerste 30 rijen de koprij is: de rij met de meeste
 * niet-lege cellen. Puur een startwaarde — de gebruiker bevestigt/corrigeert
 * dit altijd zelf (zie het "rij 14"-probleem bij sommige keurbedrijven). */
export function guessHeaderRow(rows: RawRow[]): number {
  let best = 0
  let bestCount = -1
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const count = rows[i].filter((c) => c !== null && String(c).trim() !== '').length
    if (count > bestCount) {
      bestCount = count
      best = i
    }
  }
  return best
}

/** Substring-hint per kolomkop — geen fuzzy/typo-matching, alleen een
 * voor-ingevulde dropdown die de gebruiker altijd kan overschrijven. */
export function guessMapping(headerRow: RawRow): Record<number, FieldKey> {
  const mapping: Record<number, FieldKey> = {}
  const used = new Set<FieldKey>()
  headerRow.forEach((cell, colIndex) => {
    const text = String(cell ?? '').trim().toLowerCase()
    if (!text) {
      mapping[colIndex] = 'ignore'
      return
    }
    const match = FIELD_DEFS.find(
      (f) => !used.has(f.key) && f.key !== 'ignore' && f.hints.some((h) => text.includes(h))
    )
    if (match) {
      mapping[colIndex] = match.key
      used.add(match.key)
    } else {
      mapping[colIndex] = 'ignore'
    }
  })
  return mapping
}

export interface ValidationResult {
  missingRequired: FieldKey[]
  emptyRequiredCount: Record<FieldKey, number>
  duplicateSerials: string[]
  unparsableDates: number
  rowCount: number
}

function tryParseDate(value: string | number | null): boolean {
  if (value === null || value === '') return true // leeg telt niet als onleesbaar
  if (value instanceof Date) return true
  if (typeof value === 'number') return true // Excel-seriegetal
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s)) return true
  return !isNaN(Date.parse(s))
}

export function validateRows(
  mapping: Record<number, FieldKey>,
  rows: RawRow[]
): ValidationResult {
  const colsByField = new Map<FieldKey, number[]>()
  Object.entries(mapping).forEach(([colIndex, field]) => {
    if (field === 'ignore') return
    const list = colsByField.get(field) ?? []
    list.push(Number(colIndex))
    colsByField.set(field, list)
  })

  const requiredFields = FIELD_DEFS.filter((f) => f.required).map((f) => f.key)
  const missingRequired = requiredFields.filter((f) => !colsByField.has(f))

  const emptyRequiredCount: Record<string, number> = {}
  const serials: string[] = []
  let unparsableDates = 0

  for (const row of rows) {
    for (const field of requiredFields) {
      const cols = colsByField.get(field)
      if (!cols) continue
      const value = cols.map((c) => row[c]).find((v) => v !== null && String(v).trim() !== '')
      if (value === undefined) {
        emptyRequiredCount[field] = (emptyRequiredCount[field] ?? 0) + 1
      }
    }
    const serialCol = colsByField.get('serialNumber')?.[0]
    if (serialCol !== undefined) {
      const v = row[serialCol]
      if (v !== null && String(v).trim() !== '') serials.push(String(v).trim().toLowerCase())
    }
    const dateCol = colsByField.get('inspectionDate')?.[0]
    if (dateCol !== undefined && !tryParseDate(row[dateCol])) {
      unparsableDates++
    }
  }

  const seen = new Set<string>()
  const duplicateSerials = new Set<string>()
  for (const s of serials) {
    if (seen.has(s)) duplicateSerials.add(s)
    seen.add(s)
  }

  return {
    missingRequired,
    emptyRequiredCount: emptyRequiredCount as Record<FieldKey, number>,
    duplicateSerials: [...duplicateSerials],
    unparsableDates,
    rowCount: rows.length,
  }
}
