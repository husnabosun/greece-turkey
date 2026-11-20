import { setRequestLocale } from "next-intl/server";
import { ProcessorRequestsScreen } from "@/features/marketplace/processor-requests-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function ProcessorRequestsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessorRequestsScreen />;
}
