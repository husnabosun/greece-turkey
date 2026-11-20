import { setRequestLocale } from "next-intl/server";
import { LogbookScreen } from "@/features/logbook/logbook-screen";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ add?: string; label?: string }>;
};

export default async function FarmerLogbookPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  return <LogbookScreen startAdd={query.add === "1" || query.label === "1"} />;
}
