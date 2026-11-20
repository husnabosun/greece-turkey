import { setRequestLocale } from "next-intl/server";
import { FieldsScreen } from "@/features/fields/fields-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function FarmerFieldsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FieldsScreen />;
}
