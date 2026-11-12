import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/features/auth";
import { Link } from "@/shared/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 py-10">
      <AuthForm mode="register" />
      <p className="text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium text-foreground underline">
          {t("goLogin")}
        </Link>
      </p>
    </main>
  );
}
