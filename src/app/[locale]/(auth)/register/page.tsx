import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/features/auth";
import { BrandLogo } from "@/shared/components/brand";
import { Link } from "@/shared/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 py-8">
      <BrandLogo size={88} priority className="flex-col gap-3 text-center [&_span]:text-[22px]" />
      <AuthForm mode="register" />
      <p className="flex flex-wrap items-center justify-center gap-x-1 text-ap-body text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="inline-flex min-h-11 items-center px-1 font-bold text-ink underline underline-offset-4">
          {t("goLogin")}
        </Link>
      </p>
    </main>
  );
}
