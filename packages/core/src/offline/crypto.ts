// Versleuteling van de lokale offline-cache (besloten met Jos 2026-06-30):
// AES-256-GCM via de Web Crypto API, sleutel afgeleid van een lokale PIN
// (PBKDF2). De sleutel zelf wordt nooit opgeslagen -- alleen de salt en een
// "check"-waarde staan onversleuteld lokaal, zodat een verkeerde PIN
// gedetecteerd kan worden zonder de echte sleutel ooit te bewaren.
//
// Bewuste beperking (communiceren naar gebruikers): wie zowel het toestel
// als de PIN heeft, kan bij de data -- net als bij elke andere offline-app
// (Netflix-downloads, banking-apps). De bescherming is tegen een kwijtgeraakt
// of gestolen toestel waarvan de PIN niet bekend is.

const PBKDF2_ITERATIONS = 150_000;
const PIN_CHECK_PLAINTEXT = "gearonimo-offline-ok";

export interface EncryptedPayload {
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(key: CryptoKey, data: unknown): Promise<EncryptedPayload> {
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plaintext);
  return { iv, ciphertext };
}

export async function decryptJson<T>(key: CryptoKey, payload: EncryptedPayload): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: payload.iv as BufferSource },
    key,
    payload.ciphertext
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/** Maakt de "check"-waarde die na PIN-instellen onversleuteld lokaal bewaard
 * wordt, zodat een volgende ontgrendelpoging een foute PIN kan herkennen
 * (decrypt faalt of geeft niet de verwachte tekst terug) zonder de sleutel
 * zelf ooit op te slaan. */
export async function makePinCheck(key: CryptoKey): Promise<EncryptedPayload> {
  return encryptJson(key, PIN_CHECK_PLAINTEXT);
}

export async function verifyPinCheck(key: CryptoKey, check: EncryptedPayload): Promise<boolean> {
  try {
    const value = await decryptJson<string>(key, check);
    return value === PIN_CHECK_PLAINTEXT;
  } catch {
    // AES-GCM-authenticatie faalt bij een verkeerde sleutel (verkeerde PIN).
    return false;
  }
}
