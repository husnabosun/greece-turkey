import { createClient } from "@/core/supabase/server";
import { jsonError } from "@/shared/lib/api/http";

type Authed =
  | { ok: true; userId: string }
  | { ok: false; response: Response };

/** Require a signed-in Supabase user for AI / satellite / quality API routes. */
export async function requireApiUser(): Promise<Authed> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, response: jsonError("Unauthorized", 401) };
    return { ok: true, userId: user.id };
  } catch {
    return { ok: false, response: jsonError("Unauthorized", 401) };
  }
}
