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

  return { user, loading, isLoggedIn, signInWithEmail, signInWithMagicLink, signOut };
}
