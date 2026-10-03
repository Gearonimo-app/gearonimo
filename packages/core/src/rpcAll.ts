import { supabase } from "./supabase";
import { fetchAllRows } from "./fetchAll";

/**
 * Een lijst-functie (RPC die een tabel teruggeeft) volledig ophalen.
 *
 * Supabase kapt ook het antwoord van een RPC stil af op 1000 rijen. Een klant
 * met meer dan 1000 artikelen zag in de klant-app dus een deel van zijn
 * materiaal niet, en de statussen op het dashboard klopten niet (2026-10-03).
 * `order` moet een stabiele sortering opleveren (eindig op een unieke kolom),
 * anders kan een rij tussen twee pagina's verspringen.
 */
export function fetchAllRpc<T>(
  fn: string,
  order: { column: string; ascending?: boolean }[],
  args?: Record<string, unknown>,
): Promise<T[]> {
  return fetchAllRows<T>((from, to) => {
    let q = supabase.rpc(fn, args ?? {});
    for (const o of order) q = q.order(o.column, { ascending: o.ascending ?? true });
    return q.range(from, to);
  });
}
