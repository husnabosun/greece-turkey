import { setRequestLocale } from "next-intl/server";
import { WelcomeScreen } from "@/features/home/welcome-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerWelcomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <WelcomeScreen />;
}
