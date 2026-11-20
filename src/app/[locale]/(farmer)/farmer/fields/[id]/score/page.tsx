import { setRequestLocale } from "next-intl/server";
import { FieldScoreScreen } from "@/features/fields/field-score-screen";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function FieldScorePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <FieldScoreScreen fieldId={id} />;
}
