// SN-referentie ophalen uit de platformbrede tabel (migratie 20260747),
// met een localStorage-kopie zodat het spiekbriefje ook offline werkt
// (geen versleuteling nodig: merkenreferentie, geen klant-/persoonsdata).
// Valt op de statische seed-lijst terug zolang er nog nooit iets is
// opgehaald (eerste gebruik offline).
import { supabase } from '@gearonimo/core'
import { SN_REFERENCE, type SnReferenceEntry } from '../data/snReference'

export interface SnRefRow extends SnReferenceEntry {
  id: string
}

const CACHE_KEY = 'gearonimo.snReference'

function readCache(): SnRefRow[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as SnRefRow[]) : null
  } catch {
    return null
  }
}

function writeCache(rows: SnRefRow[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows))
  } catch {
    /* opslag geweigerd: dan geen offline kopie */
  }
}

export async function fetchSnReference(): Promise<SnRefRow[]> {
  const { data, error } = await supabase
    .from('sn_reference')
    .select('id, brand, example, format, note, link')
    .order('brand')
  if (!error && data) {
    const rows = data as SnRefRow[]
    writeCache(rows)
    return rows
  }
  return readCache() ?? SN_REFERENCE.map((e, i) => ({ ...e, id: `seed-${i}` }))
}
