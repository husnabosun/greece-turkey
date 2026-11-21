import { setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function FarmerIndexPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(`/${locale}/farmer/dashboard`);
}
