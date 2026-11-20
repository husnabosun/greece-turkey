import { createBrowserClient } from "@supabase/ssr";
import { hasSupabaseConfig, publicEnv } from "@/core/config/env";
import type { Database } from "@/shared/types/database";

/** Returns a browser client, or `null` when Supabase env is not configured yet. */
export function tryCreateBrowserClient() {
  if (!hasSupabaseConfig()) return null;
  return createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL!,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
