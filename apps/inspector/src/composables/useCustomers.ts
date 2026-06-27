import { supabase } from '@gearonimo/core'

// Eén plek voor alle klant-tabeltoegang, zodat de queries niet verspreid in de
// componenten staan (lijst, detail, aanmaken, bijwerken, verwijderen). De
// componenten doen alleen nog UI + foutweergave.

export interface CustomerListItem {
  id: string
  name: string
  city: string | null
  phone: string | null
  email: string | null
}

export async function listCustomers(): Promise<CustomerListItem[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, city, phone, email')
    .order('name')
  if (error) throw error
  return (data ?? []) as CustomerListItem[]
}

export async function fetchCustomer(id: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

/** Maakt een klant aan en geeft het nieuwe id terug. */
export async function createCustomer(values: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.from('customers').insert(values).select('id').single()
  if (error) throw error
  return String(data.id)
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
