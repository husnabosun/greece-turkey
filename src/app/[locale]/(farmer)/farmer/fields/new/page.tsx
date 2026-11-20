import { setRequestLocale } from "next-intl/server";
import { AddFieldScreen } from "@/features/fields/add-field-screen";

type Props = { params: Promise<{ locale: string }> };

export default async function AddFieldPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AddFieldScreen />;
}
