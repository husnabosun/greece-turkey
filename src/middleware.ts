import createMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { routing } from "@/shared/i18n/routing";
import { updateSession } from "@/core/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  // Unprefixed URL: next-intl already resolved the locale (NEXT_LOCALE cookie,
  // then Accept-Language, then default) and issued a redirect. Return it as-is
  // so auth redirects don't fall back to a hardcoded locale.
  const first = request.nextUrl.pathname.split("/").filter(Boolean)[0];
  if (!routing.locales.includes(first as (typeof routing.locales)[number])) {
    return response;
  }
  return updateSession(request, response);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
