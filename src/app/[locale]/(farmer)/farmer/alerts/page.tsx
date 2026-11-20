import { setRequestLocale } from "next-intl/server";
import { AlertsScreen } from "@/features/alerts/alerts-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function AlertsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AlertsScreen />;
}
