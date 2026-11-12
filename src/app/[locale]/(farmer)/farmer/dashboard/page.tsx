import { setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Farmer dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Mobile-first shell ready. Weather risk, tasks, and AI advice arrive in Phases 3–4.
        </CardContent>
      </Card>
    </main>
  );
}
