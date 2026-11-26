import { z } from "zod";
import { homePathForRole } from "@/core/auth/routing";
import { DEFAULT_LOCALE, LOCALES } from "@/core/config/constants";
import { hasSupabaseConfig } from "@/core/config/env";
import { createClient } from "@/core/supabase/server";
import { DEMO_ROLES, demoCredentials } from "@/features/auth/demo-accounts";
import { jsonError, jsonOk } from "@/shared/lib/api/http";

const bodySchema = z.object({
  role: z.enum(DEMO_ROLES),
  locale: z.enum(LOCALES).catch(DEFAULT_LOCALE),
});

/**
 * Signs the visitor in to a demo account: the session cookies are set on this response and the
 * client then opens `redirectTo`. Credentials stay on the server; responses and logs never carry them.
 */
export async function POST(request: Request) {
  // A cross-site form cannot send JSON, so other sites cannot silently sign a visitor in.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonError("invalid_request", 415);
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_request", 400);
  const { role, locale } = parsed.data;

  const credentials = demoCredentials(role);
  if (!credentials || !hasSupabaseConfig()) return jsonError("demo_unavailable", 404);

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      console.error("demo sign-in failed", { role, status: error.status, code: error.code });
      return error.status === 429 ? jsonError("rate_limited", 429) : jsonError("demo_sign_in_failed", 401);
    }
  } catch {
    console.error("demo sign-in failed", { role });
    return jsonError("demo_sign_in_failed", 502);
  }

  const home = homePathForRole(role === "mill" ? "processor" : "farmer");
  return jsonOk({ redirectTo: `/${locale}${home}` }, { headers: { "Cache-Control": "no-store" } });
}
