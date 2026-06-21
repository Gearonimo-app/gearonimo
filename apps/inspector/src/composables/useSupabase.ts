import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const _client = createClient(supabaseUrl, supabaseAnonKey)

export function useSupabase() {
  return { supabase: _client }
}
