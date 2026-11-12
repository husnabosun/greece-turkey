import { setRequestLocale } from "next-intl/server";
import { ProcessorLotsScreen } from "@/features/marketplace/processor-screens";

type Props = { params: Promise<{ locale: string }> };

export default async function ProcessorLotsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessorLotsScreen />;
}
