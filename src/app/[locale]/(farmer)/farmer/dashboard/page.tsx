import { setRequestLocale } from "next-intl/server";
import { DashboardScreen } from "@/features/home/dashboard-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerDashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardScreen />;
}
