import { ref, computed } from "vue";
import { supabase } from "@gearonimo/core";
import type { User } from "@supabase/supabase-js";

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

  async function signInWithMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return { user, loading, isLoggedIn, signInWithEmail, signInWithMagicLink, signOut };
}
