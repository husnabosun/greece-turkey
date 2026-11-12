import { DEFAULT_LOCALE, LOCALES, type Locale, type UserRole } from "@/core/config/constants";

export function homePathForRole(role: UserRole) {
  return role === "processor" ? "/processor/overview" : "/farmer/dashboard";
}

export function parseLocalizedPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  const maybeLocale = parts[0];
  const hasLocale = LOCALES.includes(maybeLocale as Locale);
  const locale = (hasLocale ? maybeLocale : DEFAULT_LOCALE) as Locale;
  const rest = hasLocale ? parts.slice(1) : parts;
  const path = rest.length === 0 ? "/" : `/${rest.join("/")}`;
  return { locale, path };
}

export function isAuthPath(path: string) {
  return path === "/login" || path === "/register";
}

export function isFarmerPath(path: string) {
  return path === "/farmer" || path.startsWith("/farmer/");
}

export function isProcessorPath(path: string) {
  return path === "/processor" || path.startsWith("/processor/");
}

export function isProtectedPath(path: string) {
  return isFarmerPath(path) || isProcessorPath(path);
}
