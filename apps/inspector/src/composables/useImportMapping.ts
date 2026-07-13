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
  | 'serialNumber'
  | 'manufactureYear'
  | 'manufactureMonth'
  | 'firstUseDate'
  | 'assignedUserName'
  | 'inspectionDate'
  | 'result'
  | 'rejectionCode'
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
  { key: 'category', group: 'article', hints: ['categorie', 'category', 'soort', 'materiaal'] },
  { key: 'serialNumber', group: 'article', required: true, hints: ['serienr', 'serienummer', 'serie', 'sn', 'serial'] },
  // Bewust géén losse 'manufacture'-hint op het jaarveld: die zou een kolom
  // als "Manufacture month" wegkapen vóór het maandveld aan de beurt is.
  { key: 'manufactureYear', group: 'article', hints: ['bouwjaar', 'fabricagejaar', 'jaar', 'year'] },
  { key: 'manufactureMonth', group: 'article', hints: ['bouwmaand', 'fabricagemaand', 'maand', 'month'] },
  { key: 'firstUseDate', group: 'article', hints: ['ingebruik', 'eerste gebruik', 'first use'] },
  { key: 'assignedUserName', group: 'article', hints: ['gebruiker', 'user', 'toegewezen'] },
  { key: 'inspectionDate', group: 'inspection', hints: ['keurdatum', 'keuringsdatum', 'datum', 'date', 'inspection date'] },
  { key: 'result', group: 'inspection', hints: ['resultaat', 'result', 'goed', 'afgekeurd', 'ok', 'nok'] },
  { key: 'rejectionCode', group: 'inspection', hints: ['afkeurcode', 'afkeurreden', 'afkeur', 'wegens', 'reject', 'reason', 'defect'] },
  { key: 'rejectionComment', group: 'inspection', hints: ['opmerking', 'toelichting', 'notitie', 'comment', 'remark'] },
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

// --- Bouwjaar/bouwmaand-parsing ----------------------------------------------
// Certificaten schrijven de fabricagedatum op allerlei manieren: "2021",
// "2021-8", "07/2022", "mei 2021" of een volledige datum. Een kale parseInt
// zou van "07/2022" jaar 7 maken; daarom hier expliciete patronen. Jaartallen
// buiten 1900–2100 (bijv. een serienummer als "2205" in de verkeerde kolom)
// worden geweigerd in plaats van opgeslagen.

const MIN_YEAR = 1900
const MAX_YEAR = 2100

// NL + EN maandnamen, gematcht op de eerste drie letters ("mrt" en "maa"
// dekken zowel de afkorting als het voluit geschreven "maart").
const MONTH_PREFIXES: Record<string, number> = {
  jan: 1, feb: 2, mrt: 3, maa: 3, mar: 3, apr: 4, mei: 5, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12,
}

/** Leest een losse maandcel: "8", "08", "mei", "May", "maart" → 1–12 of null. */
export function parseMonth(value: string | number | Date | null): number | null {
  if (value === null || value === '') return null
  if (value instanceof Date) return value.getMonth() + 1
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null
  }
  const s = String(value).trim().toLowerCase()
  if (!s) return null
  if (/^\d{1,2}$/.test(s)) {
    const m = parseInt(s, 10)
    return m >= 1 && m <= 12 ? m : null
  }
  return MONTH_PREFIXES[s.slice(0, 3)] ?? null
}

function checkedYearMonth(yearRaw: string, monthRaw: string | null): { year: number | null; month: number | null } {
  const year = parseInt(yearRaw, 10)
  if (year < MIN_YEAR || year > MAX_YEAR) return { year: null, month: null }
  const month = monthRaw === null ? null : parseMonth(monthRaw)
  return { year, month }
}

/** Leest een bouwjaar-cel die ook een maand kan bevatten. Herkent "2021",
 * "2021-8", "07/2022", "mei 2021", "2021 mei", volledige datums en
 * Excel-datumobjecten. Onleesbaar of onwaarschijnlijk jaartal → alles null;
 * de maand gaat nooit "verloren" in een verkeerd jaar. */
export function parseYearMonth(value: string | number | Date | null): { year: number | null; month: number | null } {
  const none = { year: null, month: null }
  if (value === null || value === '') return none
  if (value instanceof Date) {
    return checkedYearMonth(String(value.getFullYear()), String(value.getMonth() + 1))
  }
  const s = String(value).trim()
  if (!s) return none

  let m = s.match(/^(\d{4})$/) // 2021
  if (m) return checkedYearMonth(m[1], null)
  m = s.match(/^(\d{4})[-/. ](\d{1,2})$/) // 2021-8, 2021/08
  if (m) return checkedYearMonth(m[1], m[2])
  m = s.match(/^(\d{1,2})[-/. ](\d{4})$/) // 07/2022, 7-2022
  if (m) return checkedYearMonth(m[2], m[1])
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/) // 15-07-2022 (dag-maand-jaar)
  if (m) return checkedYearMonth(m[3], m[2])
  m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/) // 2022-07-15 (ISO)
  if (m) return checkedYearMonth(m[1], m[2])
  m = s.match(/^([a-zA-Z]+)[-/. ]+(\d{4})$/) // mei 2021
  if (m) return checkedYearMonth(m[2], m[1])
  m = s.match(/^(\d{4})[-/. ]+([a-zA-Z]+)$/) // 2021 mei
  if (m) return checkedYearMonth(m[1], m[2])

  // Laatste redmiddel voor bijv. "Wed Jul 07 2022 00:00:00 GMT+0200" (een als
  // tekst doorgekomen Excel-datumcel).
  const t = Date.parse(s)
  if (!isNaN(t)) {
    const d = new Date(t)
    return checkedYearMonth(String(d.getFullYear()), String(d.getMonth() + 1))
  }
  return none
}

export interface ValidationResult {
  missingRequired: FieldKey[]
  emptyRequiredCount: Partial<Record<FieldKey, number>>
  duplicateSerials: string[]
  unparsableDates: number
  /** Niet-lege bouwjaar-cellen waar geen jaartal uit te lezen valt. */
  unparsableYears: number
  rowCount: number
}

// xlsx levert datumcellen al als JS Date, dus accepteren we die expliciet.
function tryParseDate(value: string | number | Date | null): boolean {
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
  let unparsableYears = 0

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
    const yearCol = colsByField.get('manufactureYear')?.[0]
    if (yearCol !== undefined) {
      const v = row[yearCol]
      if (v !== null && String(v).trim() !== '' && parseYearMonth(v).year === null) {
        unparsableYears++
      }
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
    emptyRequiredCount: emptyRequiredCount as Partial<Record<FieldKey, number>>,
    duplicateSerials: [...duplicateSerials],
    unparsableDates,
    unparsableYears,
    rowCount: rows.length,
  }
}
