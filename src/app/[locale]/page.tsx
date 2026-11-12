import { getTranslations, setRequestLocale } from "next-intl/server";
import { Leaf } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Link } from "@/shared/i18n/navigation";
import { LocaleSwitcher } from "@/shared/components/locale-switcher";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tn = await getTranslations("nav");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Leaf className="size-4" aria-hidden />
          </span>
          Agro Pulse AI
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-muted-foreground sm:inline">{tn("language")}</span>
          <LocaleSwitcher />
        </div>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-8">
        <div className="space-y-4">
          <Badge variant="secondary">{t("badge")}</Badge>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            {t("headline")}
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground text-pretty">{t("subhead")}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{tn("farmer")}</CardTitle>
              <CardDescription>{t("ctaFarmer")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link href="/farmer/dashboard">{t("ctaFarmer")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{tn("processor")}</CardTitle>
              <CardDescription>{t("ctaProcessor")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="secondary" className="w-full">
                <Link href="/processor/overview">{t("ctaProcessor")}</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("ctaAuth")}</CardTitle>
              <CardDescription>RBAC · Supabase Auth</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">{t("ctaAuth")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-sm text-muted-foreground">{t("phaseNote")}</p>
      </section>
    </main>
  );
}
