import { setRequestLocale } from "next-intl/server";
import { LogbookScreen } from "@/features/logbook/logbook-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerLogbookPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LogbookScreen />;
}
