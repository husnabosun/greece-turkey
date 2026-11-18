import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm } from "@/features/auth";
import { BrandLogo } from "@/shared/components/brand";
import { Link } from "@/shared/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-4 py-10">
      <BrandLogo size={88} priority className="flex-col gap-3 text-center [&_span]:text-[22px]" />
      <AuthForm mode="login" />
      <p className="text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="font-medium text-foreground underline">
          {t("goRegister")}
        </Link>
      </p>
    </main>
  );
}
