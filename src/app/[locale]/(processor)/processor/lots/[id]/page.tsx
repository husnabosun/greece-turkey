import { setRequestLocale } from "next-intl/server";
import { ProcessorLotDetailScreen } from "@/features/marketplace/processor-screens";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function ProcessorLotDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ProcessorLotDetailScreen lotId={id} />;
}
