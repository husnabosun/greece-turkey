import { getTranslations } from "next-intl/server";
import { hasSupabaseConfig } from "@/core/config/env";
import { createClient } from "@/core/supabase/server";
import { Link } from "@/shared/i18n/navigation";

async function homeHref() {
  if (!hasSupabaseConfig()) return "/";
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return "/";
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role === "processor" || user.user_metadata?.role === "processor") {
      return "/processor/overview";
    }
    if (profile?.role === "farmer" || user.user_metadata?.role === "farmer") {
      return "/farmer/dashboard";
    }
    return "/";
  } catch {
    return "/";
  }
}

export default async function NotFound() {
  const t = await getTranslations("errors");
  const href = await homeHref();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-ink">
      <p className="text-[48px] leading-none font-extrabold">404</p>
      <h1 className="text-[22px] font-extrabold">{t("notFoundTitle")}</h1>
      <p className="max-w-sm text-[14px] font-medium text-muted-foreground">{t("notFoundBody")}</p>
      <Link
        href={href}
        className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-ap-btn font-bold text-white"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
