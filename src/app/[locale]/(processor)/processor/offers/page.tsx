import { setRequestLocale } from "next-intl/server";
import { ProcessorOffersScreen } from "@/features/marketplace/processor-offers-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function ProcessorOffersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessorOffersScreen />;
}
