import {
  supabase,
  useOfflineSession,
  listInspectionsPendingCompletion,
  countPendingForCustomer,
  getInspection,
  putInspection,
} from '@gearonimo/core'
import { generateCertificate } from './useCertificate'

// Wordt na elke (succesvolle) generieke sync aangeroepen (zie useOffline.ts ->
// runSync). Keuringen die offline op Afronden zijn gezet staan lokaal met
// status "pending_completion" (zie inspectionCache.ts) -- het certificaat kon
// toen niet gegenereerd worden (Storage-upload heeft netwerk nodig). Nu er
// weer verbinding is: alsnog het certificaat genereren via de bestaande,
// ongewijzigde generateCertificate() en pas dan de keuring echt afronden.
// Dit is bewust een app-laag-functie (niet in packages/core): de
// PDF-generator leeft in apps/inspector en blijft dat ook.
export async function completePendingInspections(): Promise<{ completed: number; failed: number }> {
  let key: CryptoKey
  try {
    key = useOfflineSession().getKey()
  } catch {
    // Offline-cache vergrendeld (geen PIN ingevoerd deze sessie) -- niets te doen.
    return { completed: 0, failed: 0 }
  }

  const pending = await listInspectionsPendingCompletion<{ id: string; customer_id: string } & Record<string, unknown>>(
    key
  )
  let completed = 0
  let failed = 0
  for (const insp of pending) {
    try {
      // Niet afronden zolang er nog niet-gesynchroniseerde mutaties voor deze
      // klant zijn: generateCertificate leest van de server, en een mislukte
      // item-upload zou anders een certificaat opleveren waar artikelen of
      // resultaten op ontbreken. Liever een sync-ronde later dan een
      // onvolledig veiligheidsdocument.
      if ((await countPendingForCustomer(insp.customer_id)) > 0) {
        failed += 1
        continue
      }
      await generateCertificate(insp.id)
      const { error } = await supabase
        .from('inspections')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', insp.id)
      if (error) throw error

      const updated = await getInspection<{ id: string; customer_id: string; status: string } & Record<string, unknown>>(
        key,
        insp.id
      )
      if (updated) await putInspection(key, { ...updated, status: 'completed' })
      completed += 1
    } catch {
      // Blijft op "pending_completion" staan -- volgende sync probeert opnieuw.
      failed += 1
    }
  }
  return { completed, failed }
}
