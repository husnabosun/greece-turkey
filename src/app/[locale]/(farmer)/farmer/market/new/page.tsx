import { setRequestLocale } from "next-intl/server";
import { NewListingScreen } from "@/features/marketplace/new-listing-screen";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ field?: string; factory?: string }>;
};

export default async function NewListingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  return <NewListingScreen fieldId={query.field} factoryId={query.factory} />;
}
