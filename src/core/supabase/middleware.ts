import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/core/config/env";
import type { UserRole } from "@/core/config/constants";
import {
  homePathForRole,
  isAuthPath,
  isFarmerPath,
  isProcessorPath,
  isProtectedPath,
  parseLocalizedPath,
} from "@/core/auth/routing";

/**
 * Refreshes the auth session and enforces:
 * - anonymous users → login (cannot open farmer/processor)
 * - signed-in users → their role home (not the marketing/auth entry points)
 * - role mismatch → correct role area
 */
export async function updateSession(request: NextRequest, response: NextResponse) {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const key = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return response;
  }

  let supabaseResponse = response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { locale, path } = parseLocalizedPath(request.nextUrl.pathname);

  const redirectTo = (nextPath: string) => {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}${nextPath === "/" ? "" : nextPath}`;
    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  };

  if (!user) {
    if (isProtectedPath(path) || path === "/") {
      return redirectTo("/login");
    }
    return supabaseResponse;
  }

  let role = (user.user_metadata?.role as UserRole | undefined) ?? undefined;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "farmer" || profile?.role === "processor") {
    role = profile.role;
  }
  if (role !== "farmer" && role !== "processor") {
    role = "farmer";
  }

  const home = homePathForRole(role);

  if (path === "/" || isAuthPath(path)) {
    return redirectTo(home);
  }
  if (isFarmerPath(path) && role !== "farmer") {
    return redirectTo(home);
  }
  if (isProcessorPath(path) && role !== "processor") {
    return redirectTo(home);
  }

  return supabaseResponse;
}
