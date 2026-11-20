import { setRequestLocale } from "next-intl/server";
import { ProcessorOfferDetailScreen } from "@/features/marketplace/processor-offer-detail-screen";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function ProcessorOfferDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ProcessorOfferDetailScreen id={id} />;
}
