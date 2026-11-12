import { setRequestLocale } from "next-intl/server";
import { ScanScreen } from "@/features/diagnostics/scan-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerScanPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ScanScreen />;
}
