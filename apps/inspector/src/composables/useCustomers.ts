import { supabase, useOnline, useOfflineSession, getCustomer, listDownloads } from '@gearonimo/core'

// Eén plek voor alle klant-tabeltoegang, zodat de queries niet verspreid in de
// componenten staan (lijst, detail, aanmaken, bijwerken, verwijderen). De
// componenten doen alleen nog UI + foutweergave.
//
// listCustomers/fetchCustomer zijn offline-bewust (lezen): dit was het gat dat
// Jos tijdens het testen raakte (2026-07-01) -- een gedownloade klant openen
// terwijl je offline was gaf een kale "failed to fetch", want deze twee
// functies praatten nog altijd rechtstreeks met Supabase, ook al was de klant
// al lokaal gedownload (slice 2/3 dekte alleen het keuring-startproces, niet
// het klantscherm zelf). Schrijven (aanmaken/bijwerken/verwijderen) blijft
// bewust online-only, zoals de rest van de secundaire acties.

export interface CustomerListItem {
  id: string
  name: string
  city: string | null
  phone: string | null
  email: string | null
}

export async function listCustomers(): Promise<CustomerListItem[]> {
  const { isOnline } = useOnline()
  if (isOnline.value) {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, city, phone, email')
      .order('name')
    if (error) throw error
    return (data ?? []) as CustomerListItem[]
  }

  const session = useOfflineSession()
  if (!session.isUnlocked.value) return []
  const key = session.getKey()
  const downloads = await listDownloads(key)
  return Promise.all(
    downloads.map(async (d) => {
      const full = await getCustomer<Record<string, unknown>>(key, d.customerId)
      return {
        id: d.customerId,
        name: d.customerName,
        city: (full?.city as string | null) ?? null,
        phone: (full?.phone as string | null) ?? null,
        email: (full?.email as string | null) ?? null,
      }
    })
  )
}

export async function fetchCustomer(id: string): Promise<Record<string, unknown> | null> {
  const { isOnline } = useOnline()
  if (isOnline.value) {
    const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
    if (error) throw error
    return data
  }

  const session = useOfflineSession()
  if (!session.isUnlocked.value) return null
  return getCustomer<Record<string, unknown>>(session.getKey(), id)
}

/** Maakt een klant aan en geeft het nieuwe id terug.
 *
 * Gaat via de security definer-RPC `create_customer` i.p.v. een rechtstreekse
 * insert: die insert liep op de RLS-policy van customers stuk ("new row
 * violates row-level security policy", Jos-test 16). De RPC autoriseert zelf
 * op een actieve keurmeester en omzeilt RLS -- zelfde patroon als alle andere
 * klant-schrijfacties (save_my_member/add_my_article/...). */
export async function createCustomer(values: Record<string, unknown>): Promise<string> {
  const str = (k: string) => {
    const v = values[k]
    return v == null ? null : String(v)
  }
  const { data, error } = await supabase.rpc('create_customer', {
    p_name: str('name'),
    p_email: str('email'),
    p_customer_number: str('customer_number'),
    p_kvk_number: str('kvk_number'),
    p_vat_number: str('vat_number'),
    p_contact_person: str('contact_person'),
    p_phone: str('phone'),
    p_street: str('street'),
    p_house_number: str('house_number'),
    p_house_number_addition: str('house_number_addition'),
    p_postal_code: str('postal_code'),
    p_city: str('city'),
    p_province: str('province'),
    p_country: str('country'),
    p_notes: str('notes'),
  })
  if (error) throw error
  return String(data)
}

export async function updateCustomer(
  id: string,
  patch: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('customers').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data
}

export async function deleteCustomer(id: string): Promise<void> {
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}
