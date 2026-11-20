import { setRequestLocale } from "next-intl/server";
import { ProcessorDeliveriesScreen } from "@/features/marketplace/processor-deliveries-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function ProcessorDeliveriesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessorDeliveriesScreen />;
}
