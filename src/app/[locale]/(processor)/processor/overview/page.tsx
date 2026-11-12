import { setRequestLocale } from "next-intl/server";
import { ProcessorOverviewScreen } from "@/features/marketplace/processor-screens";

type Props = { params: Promise<{ locale: string }> };

export default async function ProcessorOverviewPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessorOverviewScreen />;
}
