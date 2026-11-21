import { setRequestLocale } from "next-intl/server";
import { NotificationsScreen } from "@/features/home/notifications-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerNotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotificationsScreen />;
}
