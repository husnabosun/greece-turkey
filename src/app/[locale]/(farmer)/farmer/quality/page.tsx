import { setRequestLocale } from "next-intl/server";
import { QualityScreen } from "@/features/quality/quality-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerQualityPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <QualityScreen />;
}
