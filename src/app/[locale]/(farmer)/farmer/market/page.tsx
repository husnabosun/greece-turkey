import { setRequestLocale } from "next-intl/server";
import { FarmerMarketScreen } from "@/features/marketplace/farmer-market-screen";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function FarmerMarketPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  return <FarmerMarketScreen initialTab={query.tab} />;
}
