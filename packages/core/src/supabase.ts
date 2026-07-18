import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase environment variables");
}

// Eén gedeelde client voor de hele app. De auth-opties staan expliciet zodat
// duidelijk is dat de sessie wordt bewaard en automatisch wordt meegestuurd
// met elke query (Authorization: Bearer <user_jwt>).
//
// experimental.passkey: zet Supabase's bèta-ondersteuning voor WebAuthn-
// passkeys aan (sinds mei 2026) -- nodig voor vingerafdruk/Face ID-login in
// de klant-app (Jos, 2026-07-16). Bèta: de API kan nog wijzigen. Vereist ook
// een Relying Party-configuratie in het Supabase Dashboard (Authentication →
// Passkeys), die Jos zelf moet instellen.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    experimental: { passkey: true },
  },
});
