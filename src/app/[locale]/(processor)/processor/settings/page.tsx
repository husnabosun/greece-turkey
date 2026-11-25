import { setRequestLocale } from "next-intl/server";
import { ProcessorSettingsScreen } from "@/features/marketplace/processor-settings-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function ProcessorSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProcessorSettingsScreen />;
}
