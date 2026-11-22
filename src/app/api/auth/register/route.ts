import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getServerEnv, publicEnv } from "@/core/config/env";
import { DEFAULT_LOCALE, LOCALES, USER_ROLES } from "@/core/config/constants";
import type { Database } from "@/shared/types/database";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(USER_ROLES),
  locale: z.enum(LOCALES).default(DEFAULT_LOCALE),
  display_name: z.string().trim().min(1).optional(),
  company_name: z.string().trim().optional().nullable(),
});

/**
 * Creates a confirmed user immediately (no email verification gate).
 * Client then signs in with the same credentials.
 * Anyone may register as farmer or processor (no invite code); the role is still
 * validated here (USER_ROLES) and written server-side to app_metadata.
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

  const email = parsed.data.email.trim().toLowerCase();
  const { password, role, locale, display_name, company_name } = parsed.data;

  if (role === "processor") {
    if (!company_name?.trim()) {
      return NextResponse.json({ error: "Company name is required for processors." }, { status: 400 });
    }
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // The DB trigger reads the role ONLY from app_metadata (service role), never from user_metadata.
    app_metadata: { role },
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

  // GoTrue inserts the auth user first and writes custom app_metadata in a later UPDATE, so the
  // on_auth_user_created trigger only sees the default role (farmer). Set the processor role on
  // the profile here with the service role (the profile guard only blocks role changes by users).
  if (role === "processor") {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ role: "processor", company_name: company_name?.trim().slice(0, 120) || null })
      .eq("id", data.user.id);
    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
