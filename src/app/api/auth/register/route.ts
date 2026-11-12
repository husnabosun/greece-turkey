import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getServerEnv, publicEnv } from "@/core/config/env";
import { LOCALES, USER_ROLES } from "@/core/config/constants";
import type { Database } from "@/shared/types/database";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(USER_ROLES),
  locale: z.enum(LOCALES).default("el"),
  display_name: z.string().trim().min(1).optional(),
  company_name: z.string().trim().optional().nullable(),
});

/**
 * Creates a confirmed user immediately (no email verification gate).
 * Client then signs in with the same credentials.
 */
export async function POST(request: Request) {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase service role is not configured." },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const { email, password, role, locale, display_name, company_name } = parsed.data;

  if (role === "processor" && !company_name?.trim()) {
    return NextResponse.json({ error: "Company name is required for processors." }, { status: 400 });
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      locale,
      display_name: display_name || email.split("@")[0],
      company_name: role === "processor" ? company_name : null,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
