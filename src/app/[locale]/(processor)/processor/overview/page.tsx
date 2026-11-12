import { setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";

type Props = { params: Promise<{ locale: string }> };

export default async function ProcessorOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="mx-auto min-h-dvh max-w-6xl px-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Processor overview</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Desktop B2B shell ready. Supply outlook, lots, offers, and deliveries arrive in Phases 2–4.
        </CardContent>
      </Card>
    </main>
  );
}
