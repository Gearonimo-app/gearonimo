import { translateDbError, errorLocale } from "./dbErrors";

/** Haalt een leesbare melding uit een onbekende fout (catch geeft `unknown`).
 * Vervangt het patroon `catch (e: any) { x = e.message }` door iets dat ook
 * klopt als er geen Error-object wordt gegooid. Meldingen uit de database
 * komen in de taal van de app (zie dbErrors.ts). */
export function errorMessage(e: unknown): string {
  return translateDbError(rawMessage(e), errorLocale());
}

function rawMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(e);
}
