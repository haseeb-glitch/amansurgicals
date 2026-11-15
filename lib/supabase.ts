import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns a configured Supabase client if valid credentials are provided,
 * or null if credentials are empty or still set to placeholder values.
 */
export function getSupabase(): SupabaseClient | null {
  const url =
    process.env.SUPABASE_URL ||
    (typeof env !== "undefined" ? (env as Record<string, unknown>).SUPABASE_URL : undefined);

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    (typeof env !== "undefined"
      ? (env as Record<string, unknown>).SUPABASE_SERVICE_ROLE_KEY ||
        (env as Record<string, unknown>).SUPABASE_ANON_KEY
      : undefined);

  if (!url || typeof url !== "string" || !key || typeof key !== "string") {
    return null;
  }

  // Check if still set to placeholder/dummy values
  if (
    url.includes("your-project-id") ||
    key.includes("your-supabase") ||
    url.trim() === "" ||
    key.trim() === ""
  ) {
    return null;
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(url.trim(), key.trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return supabaseInstance;
}
