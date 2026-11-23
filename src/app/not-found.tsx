import { cookies, headers } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/core/config/constants";

/** The user's language outside a locale segment: NEXT_LOCALE cookie, then Accept-Language, then the default. */
async function pickLocale(): Promise<Locale> {
  const fromCookie = (await cookies()).get("NEXT_LOCALE")?.value;
  if (fromCookie && (LOCALES as readonly string[]).includes(fromCookie)) return fromCookie as Locale;

  const accept = (await headers()).get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const lang = part.trim().split(";")[0]?.toLowerCase().split("-")[0];
    if (lang && (LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return DEFAULT_LOCALE;
}

/** Root fallback when a request is outside a locale segment. */
export default async function RootNotFound() {
  const locale = await pickLocale();
  const t = await getTranslations({ locale, namespace: "errors" });

  return (
    <html lang={locale}>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: 48, fontWeight: 800, margin: 0 }}>404</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t("notFoundTitle")}</h1>
          <p style={{ maxWidth: 360, color: "#666", margin: 0 }}>{t("notFoundBody")}</p>
          <Link
            href={`/${locale}`}
            style={{
              marginTop: 12,
              display: "inline-flex",
              height: 44,
              alignItems: "center",
              padding: "0 20px",
              borderRadius: 999,
              background: "#111",
              color: "#fff",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("backHome")}
          </Link>
        </div>
      </body>
    </html>
  );
}
