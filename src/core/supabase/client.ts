import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/core/config/env";
import type { Database } from "@/shared/types/database";

/** Browser Supabase client (anon key). Safe for Client Components. */
export function createClient() {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local.",
    );
  }

  return createBrowserClient<Database>(url, key);
}
