import { createClient } from "@supabase/supabase-js";

export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseFunctionHeaders() {
  if (!supabaseAnonKey) return {};
  return {
    Authorization: `Bearer ${supabaseAnonKey}`,
    apikey: supabaseAnonKey,
  };
}
