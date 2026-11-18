import { getTranslations } from "next-intl/server";
import { Link } from "@/shared/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-ink">
      <p className="text-[48px] font-extrabold leading-none">404</p>
      <h1 className="text-[22px] font-extrabold">{t("notFoundTitle")}</h1>
      <p className="max-w-sm text-[14px] font-medium text-muted-foreground">{t("notFoundBody")}</p>
      <Link
        href="/processor/overview"
        className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-ap-btn font-bold text-white"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
