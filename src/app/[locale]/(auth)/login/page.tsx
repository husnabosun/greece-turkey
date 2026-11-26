import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthForm, DemoLogin } from "@/features/auth";
import { availableDemoRoles } from "@/features/auth/demo-accounts";
import { BrandLogo } from "@/shared/components/brand";
import { Link } from "@/shared/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Render per request, so the demo buttons follow the current env vars, not those of the build.
  await connection();
  const t = await getTranslations("auth");

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 py-8">
      <BrandLogo size={88} priority className="flex-col gap-3 text-center [&_span]:text-[22px]" />
      <AuthForm mode="login" />
      <DemoLogin roles={availableDemoRoles()} />
      <p className="flex flex-wrap items-center justify-center gap-x-1 text-ap-body text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/register" className="inline-flex min-h-11 items-center px-1 font-bold text-ink underline underline-offset-4">
          {t("goRegister")}
        </Link>
      </p>
    </main>
  );
}
