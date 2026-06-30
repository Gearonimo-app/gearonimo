import { ref, computed } from "vue";
import { deriveKey, makePinCheck, verifyPinCheck, randomBytes, type EncryptedPayload } from "./crypto";
import { getMeta, setMeta, wipeAllOfflineData } from "./db";
import { supabase } from "../supabase";

// Module-niveau sessiestaat, zelfde patroon als useAuth.ts: één gedeelde
// "is de offline-cache ontgrendeld"-status voor de hele app. De sleutel staat
// alleen in het geheugen (deze ref) en verdwijnt bij het sluiten van de app
// of bij expliciet vergrendelen -- nooit op schijf.
const sessionKey = ref<CryptoKey | null>(null);
const checking = ref(true);
const pinConfigured = ref(false);

async function loadPinState() {
  const check = await getMeta<EncryptedPayload>("pinCheck");
  pinConfigured.value = !!check;
  checking.value = false;
}
loadPinState();

export function useOfflineSession() {
  const isUnlocked = computed(() => sessionKey.value !== null);

  /** Eerste keer: kiest een PIN en ontgrendelt meteen. */
  async function setupPin(pin: string): Promise<void> {
    const salt = randomBytes(16);
    const key = await deriveKey(pin, salt);
    const check = await makePinCheck(key);
    await setMeta("pinSalt", salt);
    await setMeta("pinCheck", check);
    pinConfigured.value = true;
    sessionKey.value = key;
  }

  /** Probeert te ontgrendelen met de gegeven PIN. Geeft false bij een foute PIN. */
  async function unlock(pin: string): Promise<boolean> {
    const salt = await getMeta<Uint8Array>("pinSalt");
    const check = await getMeta<EncryptedPayload>("pinCheck");
    if (!salt || !check) return false;
    const key = await deriveKey(pin, salt);
    const ok = await verifyPinCheck(key, check);
    if (ok) sessionKey.value = key;
    return ok;
  }

  function lock(): void {
    sessionKey.value = null;
  }

  /** Alleen mogelijk als de gebruiker online ingelogd is (herauthenticatie via
   * de normale login telt als bewijs van identiteit). Wist alle lokale
   * offline-data onherroepelijk -- de oude sleutel is weg, dus eventuele
   * nog niet gesynchroniseerde mutaties van vóór de reset zijn niet meer te
   * lezen. De UI moet dit expliciet aan de gebruiker voorleggen vóór de
   * aanroep, dit is geen "wachtwoord vergeten"-gemak-knopje. */
  async function resetPin(newPin: string): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("PIN-reset kan alleen met een actieve internetverbinding.");
    }
    // Forceert een echte netwerk-roundtrip naar Supabase Auth (herauthenticatie
    // op basis van de bestaande sessie) -- niet zomaar lokaal aangenomen.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error("PIN-reset kan alleen na een geldige, online sessie. Log opnieuw in.");
    }
    await wipeAllOfflineData();
    await setupPin(newPin);
  }

  function getKey(): CryptoKey {
    if (!sessionKey.value) {
      throw new Error("Offline-cache is vergrendeld: eerst de PIN invoeren.");
    }
    return sessionKey.value;
  }

  return {
    checking,
    pinConfigured,
    isUnlocked,
    setupPin,
    unlock,
    lock,
    resetPin,
    getKey,
  };
}
