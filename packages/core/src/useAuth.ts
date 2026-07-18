import { ref, computed } from "vue";
import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Module-niveau state: één gedeelde sessie voor de hele app. De listener en de
// initiële sessie-load draaien éénmalig bij import, daarna leest elke
// useAuth()-aanroep dezelfde refs.
const user = ref<User | null>(null);
const loading = ref(true);

supabase.auth.onAuthStateChange((_event, session) => {
  user.value = session?.user ?? null;
  loading.value = false;
});

supabase.auth.getSession().then(({ data }) => {
  user.value = data.session?.user ?? null;
  loading.value = false;
});

export function useAuth() {
  const isLoggedIn = computed(() => user.value !== null);

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  // redirectTo: waar de inloglink moet landen (bv. de klant-app op /klant/).
  // Zonder dit valt Supabase terug op de Site URL -- de inspector-app -- en
  // komt een klant na het klikken op de link op de verkeerde app uit. De URL
  // moet wel in de Supabase Auth-allowlist staan (Redirect URLs).
  async function signInWithMagicLink(email: string, redirectTo?: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  // redirectTo: de reset-pagina van de app (bv. .../reset-password) waar de
  // link in de e-mail naartoe wijst; moet in de Supabase Auth Redirect URLs
  // staan, zelfde eis als bij de magic-link.
  async function resetPasswordForEmail(email: string, redirectTo?: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );
    if (error) throw error;
  }

  // Alleen bruikbaar met de tijdelijke sessie die Supabase opzet nadat de
  // reset-link in de e-mail is aangeklikt (detectSessionInUrl verwerkt de
  // tokens uit de URL vanzelf).
  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  // Registreert een passkey (vingerafdruk/Face ID/Windows Hello) voor de
  // ingelogde gebruiker op dít toestel. Vereist een actieve sessie -- de
  // eerste keer moet een klant dus altijd nog via magic-link/wachtwoord
  // inloggen, pas daarna kan een toestel gekoppeld worden.
  async function registerPasskey() {
    const { data, error } = await supabase.auth.registerPasskey();
    if (error) throw error;
    return data;
  }

  // Discoverable-credential flow: de browser laat de gebruiker zelf een
  // gekoppeld account/toestel kiezen, geen e-mailadres nodig vooraf.
  async function signInWithPasskey() {
    const { data, error } = await supabase.auth.signInWithPasskey();
    if (error) throw error;
    return data;
  }

  async function listPasskeys() {
    const { data, error } = await supabase.auth.passkey.list();
    if (error) throw error;
    return data;
  }

  async function deletePasskey(passkeyId: string) {
    const { error } = await supabase.auth.passkey.delete({ passkeyId });
    if (error) throw error;
  }

  return {
    user,
    loading,
    isLoggedIn,
    signInWithEmail,
    signInWithMagicLink,
    signOut,
    resetPasswordForEmail,
    updatePassword,
    registerPasskey,
    signInWithPasskey,
    listPasskeys,
    deletePasskey,
  };
}

// Losse (niet-async-afhankelijke) capability-checks -- los van useAuth() zodat
// een pagina vóór het tonen van een knop kan checken of dit toestel
// vingerafdruk/Face ID ondersteunt, zonder een sessie nodig te hebben.
export function passkeySupported(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
  if (!passkeySupported() || !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

// Duck-typed check i.p.v. een afhankelijkheid op supabase-js' interne
// WebAuthnError-klasse (die niet publiek geëxporteerd wordt): een gebruiker
// die de vingerafdruk/Face ID-prompt annuleert of wegklikt hoort geen
// foutmelding te zien, alleen andere mislukkingen (bv. geen internet) wel.
export function isPasskeyCancelled(e: unknown): boolean {
  const err = e as { code?: string; name?: string } | null;
  return (
    err?.code === "ERROR_CEREMONY_ABORTED" ||
    err?.name === "AbortError" ||
    err?.name === "NotAllowedError"
  );
}

// Eén gedeelde bron voor de twee toestel-vlaggen rond passkeys (i.p.v. de
// localStorage-sleutels los in Login.vue, PasskeyPrompt.vue en
// Members.vue te herhalen). Bewust per-toestel (niet in het account) --
// dat is precies wat een platform-passkey ook is.
const PASSKEY_ENABLED_KEY = "gearonimo.passkeyEnabled";
const PASSKEY_PROMPT_DISMISSED_KEY = "gearonimo.passkeyPromptDismissed";

export function isPasskeyEnabledOnThisDevice(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(PASSKEY_ENABLED_KEY) === "1";
}

export function markPasskeyEnabledOnThisDevice(): void {
  if (typeof window !== "undefined") localStorage.setItem(PASSKEY_ENABLED_KEY, "1");
}

export function isPasskeyPromptDismissed(): boolean {
  return typeof window !== "undefined" && localStorage.getItem(PASSKEY_PROMPT_DISMISSED_KEY) === "1";
}

export function markPasskeyPromptDismissed(): void {
  if (typeof window !== "undefined") localStorage.setItem(PASSKEY_PROMPT_DISMISSED_KEY, "1");
}
